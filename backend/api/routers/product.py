from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from api.dependencies import workflow_engine
from api.routers.workflow import start_project
from api.schemas.project import ProjectStartRequest
from config import settings
from product import accounts as a

router = APIRouter(tags=["Studio"])
MEDIA_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".bmp",
    ".mp4",
    ".mov",
    ".webm",
    ".mkv",
    ".avi",
    ".mp3",
    ".wav",
    ".m4a",
}


class Draft(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    idea: str = Field(min_length=1, max_length=12000)
    style: str = Field(default="realistic", max_length=80)
    video_ratio: str = Field(default="16:9", pattern="^(16:9|9:16|1:1)$")


class Rename(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    idea: str | None = Field(default=None, min_length=1, max_length=12000)


@router.get("/api/product/status")
async def product_status():
    return {
        "generation_ready": bool(
            settings.DASHSCOPE_API_KEY
            or settings.OPENAI_API_KEY
            or settings.ARK_API_KEY
            or settings.GEMINI_API_KEY
            or settings.DEEPSEEK_API_KEY
        ),
        "ffmpeg_ready": __import__("shutil").which("ffmpeg") is not None,
    }


@router.get("/api/product/projects")
async def projects():
    ids = a.owned_ids("project")
    items = workflow_engine.list_saved_sessions()
    return {
        "projects": [
            {**s, "title": s.get("meta", {}).get("title") or s.get("title") or "未命名作品"}
            for s in items
            if s["id"] in ids
        ]
    }


@router.post("/api/product/projects", status_code=201)
async def new_project(req: Draft):
    if not req.idea.strip() or not req.title.strip():
        raise HTTPException(422, "请填写作品名称和故事创意")
    # Read actual setting attributes to stay compatible with upstream config schema.
    fields = {
        key: getattr(settings, attr, "")
        for key, attr in {
            "llm_model": "LLM_MODEL",
            "vlm_model": "VLM_MODEL",
            "image_t2i_model": "IMAGE_T2I_MODEL",
            "image_it2i_model": "IMAGE_IT2I_MODEL",
            "video_model": "VIDEO_MODEL",
            "video_first_frame_model": "VIDEO_FIRST_FRAME_MODEL",
            "video_start_end_model": "VIDEO_START_END_MODEL",
            "video_reference_model": "VIDEO_REFERENCE_MODEL",
        }.items()
    }
    result = await start_project(
        ProjectStartRequest(
            idea=req.idea.strip(), style=req.style, video_ratio=req.video_ratio, **fields
        )
    )
    workflow_engine.update_session_meta(
        result["session_id"], {"title": req.title.strip()}, ("title",)
    )
    return result


@router.patch("/api/product/projects/{session_id}")
async def rename_project(session_id: str, req: Rename):
    a.require_owner("project", session_id)
    title = req.title.strip()
    if not title:
        raise HTTPException(422, "请输入作品名称")
    updates = {"title": title}
    if req.idea is not None:
        if not req.idea.strip():
            raise HTTPException(422, "请输入故事创意")
        updates["idea"] = req.idea.strip()
        updates["user_textbox_input"] = req.idea.strip()
    return workflow_engine.update_session_meta(
        session_id, updates, ("title", "idea", "user_textbox_input")
    )


@router.get("/api/product/assets")
async def assets(kind: str | None = Query(None, pattern="^(image|video|document)$")):
    roots = []
    for sid in a.owned_ids("project"):
        roots.extend(Path(settings.RESULT_DIR) / folder / sid for folder in ("image", "video"))
    roots.extend(Path(settings.RESULT_DIR) / "task" / tid for tid in a.owned_ids("task"))
    for root in roots:
        if root.is_dir():
            for path in root.rglob("*"):
                if (
                    path.is_file()
                    and not path.is_symlink()
                    and a.can_read_file(path)
                    and path.suffix.lower() in MEDIA_EXTENSIONS
                ):
                    try:
                        a.register_file(path)
                    except (OSError, ValueError):
                        continue
    with a.database() as db:
        rows = db.execute(
            "SELECT id,name,kind,size,created_at,path FROM assets WHERE user_id=? ORDER BY created_at DESC",
            (a.user()["id"],),
        ).fetchall()
    return {
        "assets": [
            {
                **{k: r[k] for k in ("id", "name", "kind", "size", "created_at")},
                "url": f"/api/product/assets/{r['id']}/file",
                "source": "upload"
                if Path(r["path"]).is_relative_to(Path(settings.TEMP_DIR))
                else "generated",
            }
            for r in rows
            if (not kind or r["kind"] == kind) and Path(r["path"]).is_file()
        ]
    }


@router.get("/api/product/assets/{asset_id}/file")
async def asset_file(asset_id: str, download: bool = False):
    with a.database() as db:
        row = db.execute(
            "SELECT * FROM assets WHERE id=? AND user_id=?", (asset_id, a.user()["id"])
        ).fetchone()
    if not row or not Path(row["path"]).is_file() or not a.can_read_file(row["path"]):
        raise HTTPException(404, "素材不存在")
    # Documents are downloads; render only raster/video media inline.
    inline = not download and Path(row["path"]).suffix.lower() in MEDIA_EXTENSIONS
    return FileResponse(
        row["path"],
        filename=None if inline else row["name"],
        headers={"Cache-Control": "private, no-store"},
    )


@router.delete("/api/product/assets/{asset_id}")
async def remove_asset(asset_id: str):
    with a.database() as db:
        row = db.execute(
            "SELECT * FROM assets WHERE id=? AND user_id=?", (asset_id, a.user()["id"])
        ).fetchone()
        if not row:
            raise HTTPException(404, "素材不存在")
        # Only uploads can be removed here; generated outputs belong to their project/task.
        path = Path(row["path"])
        if not path.resolve().is_relative_to(Path(settings.TEMP_DIR).resolve()):
            raise HTTPException(409, "生成素材请在对应作品或任务中删除")
        path.unlink(missing_ok=True)
        db.execute("DELETE FROM assets WHERE id=?", (asset_id,))
    return {"success": True}


@router.get("/api/media/uploads/{filename}")
async def uploaded_media(filename: str):
    return protected_file(Path(settings.TEMP_DIR) / filename)


@router.get("/code/{media_path:path}")
async def generated_media(media_path: str):
    return protected_file(Path(settings.CODE_DIR) / media_path)


def protected_file(path):
    path = path.resolve()
    if (
        path.suffix.lower() not in MEDIA_EXTENSIONS
        or not path.is_file()
        or not a.can_read_file(path)
    ):
        raise HTTPException(404, "文件不存在")
    if not any(
        path.is_relative_to(Path(root).resolve())
        for root in (settings.RESULT_DIR, settings.TEMP_DIR)
    ):
        raise HTTPException(404, "文件不存在")
    return FileResponse(path, headers={"Cache-Control": "private, no-store"})
