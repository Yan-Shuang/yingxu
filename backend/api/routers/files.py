import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from config import settings
from models.file_reader import FileReader
from path_security import resolve_allowed_local_file
from product.accounts import database, register_file, user, validate_reference

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Files"])

DOCUMENT_UPLOAD_LIMIT = 20 * 1024 * 1024
MEDIA_UPLOAD_LIMIT = 500 * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024
UPLOAD_LOCKS: dict[str, asyncio.Lock] = {}


async def _save_upload(file: UploadFile, destination: str, max_bytes: int) -> int:
    owner_id = user()["id"]
    lock = UPLOAD_LOCKS.setdefault(owner_id, asyncio.Lock())
    async with lock:
        with database() as db:
            used = db.execute(
                "SELECT COALESCE(SUM(size),0) FROM assets WHERE user_id=? AND path LIKE ?",
                (owner_id, str(Path(settings.TEMP_DIR).resolve()) + "/%"),
            ).fetchone()[0]
        quota = max(1, int(os.getenv("YINGXU_UPLOAD_QUOTA_MB", "2048"))) * 1024 * 1024
        written = 0
        try:
            with open(destination, "wb") as buffer:
                while chunk := await file.read(UPLOAD_CHUNK_SIZE):
                    written += len(chunk)
                    if written > max_bytes:
                        raise HTTPException(413, f"文件大小不能超过 {max_bytes // 1024 // 1024} MB")
                    if used + written > quota:
                        raise HTTPException(413, "素材空间已满，请整理后再上传")
                    buffer.write(chunk)
            if written == 0:
                raise HTTPException(400, "不能上传空文件")
            register_file(destination, Path(file.filename or "upload").name)
        except Exception:
            Path(destination).unlink(missing_ok=True)
            raise
        return written


def _safe_upload_name(filename: str, fallback: str = "upload") -> str:
    original_name = Path(filename or fallback).name or fallback
    return f"{uuid.uuid4().hex}_{original_name}"


def _path_size(path: str) -> int:
    if os.path.isfile(path) or os.path.islink(path):
        return os.path.getsize(path)
    total = 0
    for root, dirs, files in os.walk(path):
        for name in files:
            item = os.path.join(root, name)
            try:
                total += os.path.getsize(item)
            except OSError:
                continue
        for name in dirs:
            item = os.path.join(root, name)
            if os.path.islink(item):
                try:
                    total += os.path.getsize(item)
                except OSError:
                    continue
    return total


@router.post("/api/upload_file")
async def upload_file(file: UploadFile = File(...)):
    allowed_exts = [".docx", ".doc", ".txt", ".md", ".pdf"]
    filename = Path(file.filename or "upload").name
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"仅支持 {', '.join(allowed_exts)} 格式的文件")

    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    safe_filename = _safe_upload_name(filename)
    file_path = os.path.join(settings.TEMP_DIR, safe_filename)
    try:
        await _save_upload(file, file_path, DOCUMENT_UPLOAD_LIMIT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"保存上传文件失败: {e}")
        raise HTTPException(status_code=500, detail="文件保存失败，请稍后重试")

    asset_id = register_file(file_path, filename, "document")
    return {"filename": filename, "file_path": safe_filename, "asset_id": asset_id}


@router.post("/api/upload_media")
async def upload_media(file: UploadFile = File(...)):
    allowed_exts = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".bmp",
        ".mp4",
        ".mov",
        ".avi",
        ".mkv",
        ".webm",
    ]
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400, detail=f"仅支持 {', '.join(allowed_exts)} 格式的媒体文件"
        )

    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    safe_filename = _safe_upload_name(filename)
    file_path = os.path.join(settings.TEMP_DIR, safe_filename)
    try:
        await _save_upload(file, file_path, MEDIA_UPLOAD_LIMIT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"保存上传媒体失败: {e}")
        raise HTTPException(status_code=500, detail="媒体保存失败，请稍后重试")

    asset_id = register_file(file_path, filename)
    return {
        "filename": filename,
        "file_path": safe_filename,
        "asset_id": asset_id,
        "url": f"/api/product/assets/{asset_id}/file",
    }


@router.delete("/api/cache/temp")
async def clear_temp_cache():
    deleted, freed = 0, 0
    with database() as db:
        rows = db.execute("SELECT id,path FROM assets WHERE user_id=?", (user()["id"],)).fetchall()
        for row in rows:
            path = Path(row["path"])
            if path.resolve().is_relative_to(Path(settings.TEMP_DIR).resolve()):
                if path.is_file():
                    freed += path.stat().st_size
                    path.unlink()
                    deleted += 1
                db.execute("DELETE FROM assets WHERE id=?", (row["id"],))
    return {
        "status": "ok",
        "deleted": deleted,
        "freed_bytes": freed,
        "freed_mb": round(freed / 1024 / 1024, 2),
        "errors": [],
    }


def merge_uploaded_file_into_idea(idea: str, file_path: Optional[str]) -> str:
    if not file_path:
        return idea

    validate_reference(file_path)
    try:
        full_path = resolve_allowed_local_file(file_path, [settings.TEMP_DIR])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    content = FileReader.extract_text(full_path)
    if content:
        original_filename = "_".join(os.path.basename(file_path).split("_")[1:])
        prompt_fragment = FileReader.format_as_prompt(original_filename, content)
        idea = f"{idea}\n\n{prompt_fragment}"
    logger.info(f"成功处理上传文件: {full_path}")
    logger.debug(f"文件内容预览:\n{content[:500]}")
    return idea
