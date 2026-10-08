"""Real HTTP account/ownership regressions. Providers are never called."""

import base64
import sys
import time
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from api.app import app
from api.dependencies import workflow_engine
from api.routers import pipelines, sandbox
from config import settings
from pipelines import storage
from product import accounts as a

ORIGIN = "http://localhost:3000"
PASSWORD = "Test-only-password-2026"
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=="
)


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    code = tmp_path / "code"
    result = code / "result"
    uploads = tmp_path / "uploads"
    sessions = code / "data" / "sessions"
    for folder in (code, result, uploads, sessions):
        folder.mkdir(parents=True, exist_ok=True)
    for key, value in {
        "CODE_DIR": code,
        "RESULT_DIR": result,
        "TEMP_DIR": uploads,
        "SESSION_DIR": sessions,
    }.items():
        monkeypatch.setattr(settings, key, str(value))
    monkeypatch.setenv("YINGXU_DB_PATH", str(code / "data" / "accounts.sqlite3"))
    monkeypatch.setattr(workflow_engine, "_session_dir", str(sessions))
    monkeypatch.setattr(workflow_engine, "sessions", {})
    monkeypatch.setattr(workflow_engine, "_stop_events", {})
    monkeypatch.setattr(workflow_engine, "_active_sessions", set())
    monkeypatch.setattr(storage, "TASK_DATA_DIR", str(code / "data" / "tasks"))
    monkeypatch.setattr(storage, "TASK_RESULT_DIR", str(result / "task"))
    monkeypatch.setattr(sandbox, "SANDBOX_HISTORY_FILE", str(result / "history.json"))
    monkeypatch.setattr(sandbox, "SANDBOX_ACTIVE_TASKS", {})
    a.initialize()


def client():
    c = TestClient(app, headers={"Origin": ORIGIN})
    c.get("/api/auth/me")
    return c


def send(c, method, path, **kw):
    headers = {"X-CSRF-Token": c.cookies.get(a.CSRF_COOKIE, "")}
    headers.update(kw.pop("headers", {}))
    return c.request(method, path, headers=headers, **kw)


def register(email="a@example.test"):
    c = client()
    r = send(
        c,
        "POST",
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "name": "测试创作者"},
    )
    assert r.status_code == 201, r.text
    return c, r.json()["user"]


def draft(c, title="测试作品"):
    r = send(
        c,
        "POST",
        "/api/product/projects",
        json={
            "title": title,
            "idea": "一只小猫寻找回家的路",
            "style": "anime",
            "video_ratio": "16:9",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["session_id"]


def test_password_sessions_logout_and_expiry():
    c, u = register()
    assert u["role"] == "member" and "password_hash" not in u
    with a.database() as db:
        hashed = db.execute("SELECT password_hash FROM users").fetchone()[0]
        assert PASSWORD not in hashed and a.check_password(PASSWORD, hashed)
        assert not a.check_password("wrong-password-2026", hashed)
        assert db.execute("SELECT token_hash FROM auth_sessions").fetchone()[0] != c.cookies.get(
            a.SESSION_COOKIE
        )
    token = c.cookies.get(a.SESSION_COOKIE)
    r = send(c, "POST", "/api/auth/logout", json={})
    assert r.status_code == 200
    c.cookies.set(a.SESSION_COOKIE, token)
    assert c.get("/api/sessions").status_code == 401
    c.get("/api/auth/me")
    r = send(c, "POST", "/api/auth/login", json={"email": u["email"], "password": PASSWORD})
    assert r.status_code == 200
    with a.database() as db:
        db.execute("UPDATE auth_sessions SET expires_at=?", (time.time() - 1,))
    assert c.get("/api/tasks").status_code == 401


def test_auth_validation_csrf_and_no_implicit_admin():
    c, u = register()
    assert send(c, "PUT", "/api/config", json={"values": {}}).status_code == 403
    assert send(c, "DELETE", "/api/sessions").status_code == 403
    assert c.post("/api/product/projects", json={"title": "x", "idea": "y"}).status_code == 403
    assert (
        send(
            c,
            "POST",
            "/api/product/projects",
            headers={"Origin": "https://foreign.example"},
            json={"title": "x", "idea": "y"},
        ).status_code
        == 403
    )
    assert (
        send(
            c,
            "POST",
            "/api/product/projects",
            headers={"X-CSRF-Token": "wrong"},
            json={"title": "x", "idea": "y"},
        ).status_code
        == 403
    )
    config = c.get("/api/config").json()["config"]
    assert "api_providers" not in config and "server" not in config and "models" in config
    other = client()
    assert (
        send(
            other, "POST", "/api/auth/register", json={"email": u["email"], "password": PASSWORD}
        ).status_code
        == 409
    )
    assert (
        send(
            other, "POST", "/api/auth/register", json={"email": "bad", "password": PASSWORD}
        ).status_code
        == 422
    )
    assert (
        send(
            other,
            "POST",
            "/api/auth/register",
            json={"email": "b@example.test", "password": "short"},
        ).status_code
        == 422
    )


def test_operator_can_promote_only_named_existing_account(monkeypatch):
    from manage import main

    c, u = register()
    other, _ = register("other@example.test")
    monkeypatch.setattr(sys, "argv", ["manage.py", "promote-admin", "--email", u["email"]])
    main()
    assert c.get("/api/auth/me").json()["user"]["role"] == "admin"
    assert other.get("/api/auth/me").json()["user"]["role"] == "member"
    assert "api_providers" in c.get("/api/config").json()["config"]
    assert "api_providers" not in other.get("/api/config").json()["config"]
    monkeypatch.setattr(sys, "argv", ["manage.py", "promote-admin", "--email", "missing@example.test"])
    with pytest.raises(SystemExit):
        main()


def test_image_preflight_uses_selected_provider_and_explains_missing_key(monkeypatch):
    from product.generation import require_model

    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", "test-only-configured-key")
    monkeypatch.setattr(settings, "ARK_API_KEY", "")
    require_model("wan2.7-image")
    with pytest.raises(HTTPException) as error:
        require_model("doubao-seedream-5-0-260128")
    assert error.value.status_code == 503
    assert "火山方舟" in error.value.detail
    assert "作品已保存" in error.value.detail
    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", "")
    with pytest.raises(HTTPException) as error:
        require_model("wan2.7-image")
    assert "阿里云百炼" in error.value.detail


def test_two_accounts_project_isolation_and_persistence():
    ca, ua = register()
    cb, ub = register("b@example.test")
    sid = draft(ca)
    assert cb.get("/api/product/projects").json()["projects"] == []
    assert ca.get("/api/product/projects").json()["projects"][0]["title"] == "测试作品"
    for path in (
        f"/api/project/{sid}/status",
        f"/api/project/{sid}/artifact/script_generation",
        f"/api/project/{sid}/scene/1/assets",
    ):
        assert cb.get(path).status_code == 404
    for method, path, payload in [
        ("POST", f"/api/project/{sid}/execute/script_generation", {}),
        ("PATCH", f"/api/project/{sid}/artifact/script_generation", {"title": "stolen"}),
        (
            "POST",
            f"/api/project/{sid}/intervene",
            {"stage": "script_generation", "modifications": {}},
        ),
        ("DELETE", f"/api/sessions/{sid}", None),
        ("PATCH", f"/api/product/projects/{sid}", {"title": "stolen"}),
    ]:
        assert send(cb, method, path, json=payload).status_code == 404
    # Clearing memory reproduces loading the persisted creative file after restart.
    workflow_engine.sessions.clear()
    assert ca.get(f"/api/project/{sid}/status").status_code == 200
    a.initialize()
    assert cb.get(f"/api/project/{sid}/status/from_disk").status_code == 404
    # Old unowned archive files are never assigned to a new account.
    workflow_engine.create_session("unowned-old", {"idea": "private historical work"})
    assert "unowned-old" not in repr(ca.get("/api/sessions").json())
    assert ca.get("/api/project/unowned-old/status").status_code == 404


def test_upload_asset_range_path_and_reference_isolation():
    ca, ua = register()
    cb, ub = register("b@example.test")
    sid = draft(cb)
    r = send(ca, "POST", "/api/upload_media", files={"file": ("frame.png", PNG, "image/png")})
    assert r.status_code == 200, r.text
    media = r.json()
    url = media["url"]
    assert not media["file_path"].startswith("/")
    assert len(ca.get("/api/product/assets").json()["assets"]) == 1
    assert cb.get("/api/product/assets").json()["assets"] == []
    assert cb.get(url).status_code == 404
    assert ca.get(url, headers={"Range": "bytes=0-9"}).status_code == 206
    assert ca.get(url, headers={"Range": "bytes=0-9"}).content == PNG[:10]
    assert send(cb, "DELETE", f"/api/product/assets/{media['asset_id']}").status_code == 404
    for ref in (
        media["file_path"],
        str(Path(settings.TEMP_DIR) / media["file_path"]),
        "https://127.0.0.1/private.png",
    ):
        r = send(
            cb,
            "PATCH",
            f"/api/project/{sid}/artifact/reference_generation",
            json={"selected_images": {"scene_1": ref}},
        )
        assert r.status_code in (400, 404), r.text
    assert send(cb, "DELETE", "/api/cache/temp").json()["deleted"] == 0
    assert ca.get(url).status_code == 200
    output = Path(settings.RESULT_DIR) / "image" / sid / "Scenes" / "a.png"
    output.parent.mkdir(parents=True)
    output.write_bytes(PNG)
    link = Path(settings.RESULT_DIR) / "image" / sid / "Scenes" / "foreign.png"
    link.symlink_to(Path(settings.TEMP_DIR) / media["file_path"])
    assert cb.get(f"/code/result/image/{sid}/Scenes/a.png").status_code == 200
    assert ca.get(f"/code/result/image/{sid}/Scenes/a.png").status_code == 404
    assert cb.get(f"/code/result/image/{sid}/Scenes/foreign.png").status_code == 404
    assert cb.get(f"/code/data/sessions/{sid}.json").status_code == 404
    assert cb.get("/code/data/accounts.sqlite3").status_code == 404


def test_reference_identity_cannot_override_route():
    ca, ua = register()
    cb, ub = register("b@example.test")
    sa = draft(ca)
    sb = draft(cb)
    r = send(
        ca,
        "POST",
        f"/api/project/{sa}/intervene",
        json={"stage": "script_generation", "modifications": {"session_id": sb}},
    )
    assert r.status_code == 404


def test_task_history_sandbox_and_stream_isolation(monkeypatch):
    ca, ua = register()
    cb, ub = register("b@example.test")
    monkeypatch.setattr(pipelines, "require_model", lambda value: None)
    monkeypatch.setattr(pipelines, "run_pipeline_task", lambda *args: None)
    r = send(
        ca,
        "POST",
        "/api/pipelines/standard/tasks",
        json={"text": "Test", "llm_model": "mock", "image_model": "mock"},
    )
    assert r.status_code == 200, r.text
    task = r.json()["task_id"]
    assert cb.get("/api/tasks").json()["tasks"] == []
    assert ca.get("/api/tasks").json()["tasks"][0]["task_id"] == task
    assert cb.get(f"/api/tasks/{task}/events").status_code == 404
    assert send(cb, "DELETE", f"/api/tasks/{task}").status_code == 404
    reset = a.current_user.set(ua)
    try:
        sandbox._add_record(
            "llm",
            "mock",
            {"prompt": "private"},
            {"response": "private output"},
            record_id="private-record",
        )
    finally:
        a.current_user.reset(reset)
    assert cb.get("/api/sandbox/history").json()["records"] == []
    assert len(ca.get("/api/sandbox/history").json()["records"]) == 1
    assert cb.get("/api/sandbox/history/private-record").status_code == 404
    assert send(cb, "DELETE", "/api/sandbox/history/private-record").status_code == 404


def test_missing_provider_is_truthful_and_keeps_draft(monkeypatch):
    ca, ua = register()
    sid = draft(ca)
    for attr in (
        "DASHSCOPE_API_KEY",
        "OPENAI_API_KEY",
        "ARK_API_KEY",
        "DEEPSEEK_API_KEY",
        "GEMINI_API_KEY",
    ):
        monkeypatch.setattr(settings, attr, "")
    r = send(ca, "POST", f"/api/project/{sid}/execute/script_generation", json={})
    assert r.status_code == 503 and "作品已保存" in r.json()["detail"]
    assert ca.get(f"/api/project/{sid}/status").status_code == 200


def test_login_rate_limit():
    c, u = register()
    anonymous = client()
    for _ in range(10):
        assert (
            send(
                anonymous,
                "POST",
                "/api/auth/login",
                json={"email": u["email"], "password": "invalid-password"},
            ).status_code
            == 401
        )
    assert (
        send(
            anonymous, "POST", "/api/auth/login", json={"email": u["email"], "password": PASSWORD}
        ).status_code
        == 429
    )


def test_own_artifact_selection_and_draft_edit_remain_usable():
    c, u = register()
    sid = draft(c)
    output = Path(settings.RESULT_DIR) / "video" / sid / "segment_1.mp4"
    output.parent.mkdir(parents=True)
    output.write_bytes(b"test media")
    selection = {
        "clips": [
            {
                "id": "segment_1",
                "selected": f"code/result/video/{sid}/segment_1.mp4",
                "description": "自己的片段",
            }
        ]
    }
    assert (
        send(
            c, "PATCH", f"/api/project/{sid}/artifact/video_generation", json=selection
        ).status_code
        == 200
    )
    invalid = {"characters": [{"id": "../../foreign", "name": "角色"}]}
    assert (
        send(c, "PATCH", f"/api/project/{sid}/artifact/character_design", json=invalid).status_code
        == 400
    )
    assert (
        send(
            c, "PATCH", f"/api/product/projects/{sid}", json={"title": "新标题", "idea": "新的创意"}
        ).status_code
        == 200
    )
    workflow_engine.sessions.clear()
    meta = c.get(f"/api/project/{sid}/status").json()["meta"]
    assert meta["title"] == "新标题" and meta["idea"] == "新的创意"


def test_upload_quota_empty_files_and_generated_library(monkeypatch):
    c, u = register()
    other, _ = register("b@example.test")
    sid = draft(c)
    monkeypatch.setenv("YINGXU_UPLOAD_QUOTA_MB", "1")
    r = send(
        c,
        "POST",
        "/api/upload_media",
        files={"file": ("large.png", b"x" * (1024 * 1024 + 1), "image/png")},
    )
    assert r.status_code == 413
    assert not list(Path(settings.TEMP_DIR).iterdir())
    assert (
        send(
            c, "POST", "/api/upload_media", files={"file": ("empty.png", b"", "image/png")}
        ).status_code
        == 400
    )
    output = Path(settings.RESULT_DIR) / "image" / sid / "Scenes" / "frame.png"
    output.parent.mkdir(parents=True)
    output.write_bytes(PNG)
    items = c.get("/api/product/assets").json()["assets"]
    assert len(items) == 1 and items[0]["source"] == "generated"
    assert other.get("/api/product/assets").json()["assets"] == []
    assert other.get(items[0]["url"]).status_code == 404
    assert send(c, "DELETE", f"/api/product/assets/{items[0]['id']}").status_code == 409


def test_daily_generation_quota_and_generic_validation(monkeypatch):
    c, u = register()
    monkeypatch.setenv("YINGXU_DAILY_GENERATIONS", "1")
    monkeypatch.setattr(pipelines, "require_model", lambda value: None)
    monkeypatch.setattr(pipelines, "run_pipeline_task", lambda *args: None)
    params = {"text": "Test", "llm_model": "mock", "image_model": "mock"}
    assert send(c, "POST", "/api/pipelines/standard/tasks", json=params).status_code == 200
    assert send(c, "POST", "/api/pipelines/standard/tasks", json=params).status_code == 429
    invalid = {**params, "n_scenes": 1000}
    assert (
        send(c, "POST", "/api/pipelines/quick_create/tasks", json={"params": invalid}).status_code
        == 422
    )


def test_production_cookie_flags_and_admin_visibility(monkeypatch):
    monkeypatch.setenv("YINGXU_SECURE_COOKIES", "1")
    c = TestClient(app,base_url="https://testserver",headers={"Origin":ORIGIN})
    c.get("/api/auth/me")
    r = send(
        c, "POST", "/api/auth/register", json={"email": "admin@example.test", "password": PASSWORD}
    )
    assert r.status_code == 201
    session_cookie = next(
        v for v in r.headers.get_list("set-cookie") if v.startswith(a.SESSION_COOKIE)
    )
    assert (
        "HttpOnly" in session_cookie
        and "Secure" in session_cookie
        and "SameSite=lax" in session_cookie
    )
    with a.database() as db:
        db.execute("UPDATE users SET role='admin'")
    c.base_url = "https://testserver"
    response = c.get("/api/config")
    assert response.status_code == 200 and "api_providers" in response.json()["config"]


def test_generated_file_ids_reject_traversal_before_writing(tmp_path, monkeypatch):
    from core.agents.character_agent import CharacterDesignerAgent
    from core.agents.reference_agent import ReferenceGeneratorAgent
    from core.agents.video_agent import VideoDirectorAgent

    monkeypatch.chdir(tmp_path)
    before = set(tmp_path.rglob("*"))
    for kind in (CharacterDesignerAgent, ReferenceGeneratorAgent, VideoDirectorAgent):
        agent = kind.__new__(kind)
        with pytest.raises(ValueError):
            if kind is CharacterDesignerAgent:
                agent._next_version_path("own", "characters", "../../foreign")
            else:
                agent._next_version_path("own", "../../foreign")
    assert set(tmp_path.rglob("*")) == before
