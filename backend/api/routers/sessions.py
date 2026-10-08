from fastapi import APIRouter, HTTPException

from api.dependencies import workflow_engine
from product.accounts import owned_ids

router = APIRouter(tags=["Sessions"])


@router.get("/api/sessions")
async def list_sessions():
    ids = owned_ids("project")
    return {"sessions": [s for s in workflow_engine.list_saved_sessions() if s["id"] in ids]}


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """直接删除历史记录（已验证所有权）"""
    deleted = workflow_engine.delete_session(session_id)
    if not deleted:
        raise HTTPException(404, "Session not found")
    return {"status": "deleted", "session_id": session_id}


@router.delete("/api/sessions")
async def cleanup_orphan_files():
    """清理孤立的结果文件（仅管理员）"""
    return workflow_engine.cleanup_orphan_results()
