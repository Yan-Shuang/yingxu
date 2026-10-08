import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from fastapi import HTTPException

from config import settings

current_user: ContextVar[dict | None] = ContextVar("yingxu_user", default=None)
SESSION_COOKIE = "yx_session"
CSRF_COOKIE = "yx_csrf"
SESSION_TTL = 7 * 24 * 3600


def db_path():
    return Path(
        os.getenv("YINGXU_DB_PATH", str(Path(settings.CODE_DIR) / "data" / "accounts.sqlite3"))
    )


@contextmanager
def database():
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize():
    with database() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
          csrf TEXT NOT NULL, expires_at REAL NOT NULL, created_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS ownership (
          kind TEXT NOT NULL, resource_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
          created_at REAL NOT NULL, PRIMARY KEY(kind,resource_id));
        CREATE INDEX IF NOT EXISTS ownership_user ON ownership(user_id,kind);
        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
          path TEXT UNIQUE NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL,
          size INTEGER NOT NULL, created_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS auth_attempts (bucket TEXT NOT NULL, attempted_at REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS attempts_bucket ON auth_attempts(bucket,attempted_at);
        """)


def user():
    value = current_user.get()
    if not value:
        raise HTTPException(401, "请先登录")
    return value


def public_user(row):
    return {key: row[key] for key in ("id", "email", "name", "role", "created_at")}


def password_hash(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=32768, r=8, p=3, maxmem=128 * 1024 * 1024
    )
    return f"scrypt1${salt.hex()}${digest.hex()}"


def check_password(password, encoded):
    try:
        algorithm, salt, expected = encoded.split("$")
        if algorithm != "scrypt1":
            return False
        digest = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=32768, r=8, p=3, maxmem=128 * 1024 * 1024
        )
        return hmac.compare_digest(digest.hex(), expected)
    except (ValueError, TypeError):
        return False


def hash_token(value):
    return hashlib.sha256(value.encode()).hexdigest()


def find_session(token):
    if not token or len(token) > 128:
        return None
    with database() as db:
        row = db.execute(
            """SELECT u.*, s.csrf, s.expires_at FROM auth_sessions s
                            JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?""",
            (hash_token(token), time.time()),
        ).fetchone()
    return dict(row) if row else None


def start_session(user_id):
    token, csrf, now = secrets.token_urlsafe(32), secrets.token_urlsafe(32), time.time()
    with database() as db:
        db.execute("DELETE FROM auth_sessions WHERE expires_at<=?", (now,))
        db.execute(
            "INSERT INTO auth_sessions VALUES(?,?,?,?,?)",
            (hash_token(token), user_id, csrf, now + SESSION_TTL, now),
        )
        db.execute(
            """DELETE FROM auth_sessions WHERE user_id=? AND token_hash NOT IN
                     (SELECT token_hash FROM auth_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 5)""",
            (user_id, user_id),
        )
    return token, csrf


def cookie_options():
    return {
        "secure": os.getenv("YINGXU_SECURE_COOKIES", "0") == "1",
        "samesite": "lax",
        "path": "/",
    }


def set_session(response, user_id):
    token, csrf = start_session(user_id)
    response.set_cookie(
        SESSION_COOKIE, token, httponly=True, max_age=SESSION_TTL, **cookie_options()
    )
    response.set_cookie(CSRF_COOKIE, csrf, httponly=False, max_age=SESSION_TTL, **cookie_options())


def rate_limit(bucket, limit, window):
    now = time.time()
    bucket = hash_token(bucket)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM auth_attempts WHERE attempted_at<?", (now - max(86400, window),))
        count = db.execute(
            "SELECT COUNT(*) FROM auth_attempts WHERE bucket=? AND attempted_at>?",
            (bucket, now - window),
        ).fetchone()[0]
        if count >= limit:
            raise HTTPException(429, "尝试次数过多，请稍后再试")
        db.execute("INSERT INTO auth_attempts VALUES(?,?)", (bucket, now))


def claim(kind, resource_id, owner=None):
    owner_id = owner or user()["id"]
    with database() as db:
        db.execute(
            "INSERT INTO ownership VALUES(?,?,?,?)", (kind, resource_id, owner_id, time.time())
        )


def owns(kind, resource_id, owner=None):
    owner_id = owner or user()["id"]
    with database() as db:
        return (
            db.execute(
                "SELECT 1 FROM ownership WHERE kind=? AND resource_id=? AND user_id=?",
                (kind, resource_id, owner_id),
            ).fetchone()
            is not None
        )


def require_owner(kind, resource_id):
    if not owns(kind, resource_id):
        raise HTTPException(404, "内容不存在")


def owned_ids(kind):
    with database() as db:
        return {
            row[0]
            for row in db.execute(
                "SELECT resource_id FROM ownership WHERE kind=? AND user_id=?", (kind, user()["id"])
            )
        }


def register_file(path, name=None, kind=None):
    path = Path(path).resolve(strict=True)
    # Only explicitly controlled upload/output trees can be served as assets.
    if not any(
        path.is_relative_to(Path(root).resolve())
        for root in (settings.TEMP_DIR, settings.RESULT_DIR)
    ):
        raise ValueError("素材不在允许的目录中")
    ext = path.suffix.lower()
    kind = kind or (
        "image"
        if ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
        else "video"
        if ext in {".mp4", ".mov", ".webm", ".mkv", ".avi"}
        else "document"
    )
    asset_id = uuid.uuid4().hex
    with database() as db:
        existing = db.execute("SELECT id,user_id FROM assets WHERE path=?", (str(path),)).fetchone()
        if existing:
            if existing["user_id"] != user()["id"]:
                raise ValueError("素材不属于当前账号")
            return existing["id"]
        db.execute(
            "INSERT INTO assets VALUES(?,?,?,?,?,?,?)",
            (
                asset_id,
                user()["id"],
                str(path),
                name or path.name,
                kind,
                path.stat().st_size,
                time.time(),
            ),
        )
    return asset_id


def can_read_file(path):
    resolved = Path(path).resolve()
    owner_id = user()["id"]
    with database() as db:
        if db.execute(
            "SELECT 1 FROM assets WHERE path=? AND user_id=?", (str(resolved), owner_id)
        ).fetchone():
            return True
    try:
        parts = resolved.relative_to(Path(settings.RESULT_DIR).resolve()).parts
    except ValueError:
        return False
    if len(parts) >= 3 and parts[0] in {"image", "video"}:
        return owns("project", parts[1], owner_id)
    if len(parts) >= 3 and parts[0] == "task":
        return owns("task", parts[1], owner_id)
    if len(parts) == 2 and parts[0] == "script" and parts[1].endswith(".json"):
        return owns("project", parts[1][:-5], owner_id)
    return False


def validate_reference(value):
    from path_security import resolve_allowed_local_file

    raw = str(value).removeprefix("/code/").removeprefix("code/")
    if raw.startswith(("http://", "https://", "data:", "file:")):
        raise HTTPException(400, "请先将参考素材上传到自己的素材库")
    try:
        path = resolve_allowed_local_file(
            raw, [settings.TEMP_DIR, settings.CODE_DIR, settings.RESULT_DIR]
        )
    except ValueError:
        raise HTTPException(400, "参考素材不存在，请重新上传")
    if not can_read_file(path):
        raise HTTPException(404, "参考素材不存在")


REFERENCE_KEYS = {
    "file_path",
    "path",
    "image",
    "images",
    "image_path",
    "image_paths",
    "video",
    "video_path",
    "video_paths",
    "reference_image",
    "reference_images",
    "reference_video",
    "reference_videos",
    "selected",
    "selected_images",
    "selected_clips",
    "clips",
    "first_frame",
    "last_frame",
    "start_frame",
    "end_frame",
    "audio_path",
    "media",
    "media_path",
    "input_image",
    "input_video",
}
TEXT_KEYS = {
    "idea",
    "prompt",
    "description",
    "text",
    "content",
    "narration",
    "dialogue",
    "response",
    "title",
    "name",
    "style",
}


def validate_body_refs(value, key="", reference=False):
    if (
        key in {"id", "character_id", "setting_id", "scene_id", "shot_id", "segment_id"}
        and isinstance(value, str)
        and value
        and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", value)
    ):
        raise HTTPException(400, "素材标识无效")
    if key == "session_id" and isinstance(value, str) and value:
        require_owner("project", value)
    if key == "task_id" and isinstance(value, str) and value:
        require_owner("task", value)
    reference = (
        reference
        or key.lower() in REFERENCE_KEYS
        or key.lower().endswith(("_path", "_paths", "_url"))
    )
    if isinstance(value, dict):
        for k, v in value.items():
            validate_body_refs(
                v,
                k,
                reference
                and key.lower()
                in {
                    "selected_images",
                    "selected_clips",
                    "image_paths",
                    "video_paths",
                    "reference_images",
                },
            )
    elif isinstance(value, list):
        for item in value:
            validate_body_refs(item, key, reference)
    elif isinstance(value, str) and value.strip() and key.lower() not in TEXT_KEYS:
        # Plain storyboard labels may be nested in "clips"; only file references qualify.
        pathlike = value.startswith(
            ("/", "result/", "http://", "https://", "file:", "data:")
        ) or Path(value).suffix.lower() in {
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".mp4",
            ".mov",
            ".webm",
            ".pdf",
            ".txt",
            ".md",
            ".json",
            ".docx",
        }
        if reference or pathlike:
            validate_reference(value)
