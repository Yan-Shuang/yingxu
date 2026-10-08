from fastapi import HTTPException

from config import settings
from models.config_model import MODEL_CONFIG


def require_model(model):
    entry = MODEL_CONFIG.get("models", {}).get(model)
    if not entry:
        raise HTTPException(400, "所选模型不可用，请重新选择")
    provider = entry.get("provider", "")
    available = {
        "openai": settings.OPENAI_API_KEY,
        "gemini": settings.GEMINI_API_KEY,
        "deepseek": settings.DEEPSEEK_API_KEY,
        "dashscope": settings.DASHSCOPE_API_KEY,
        "ark": settings.ARK_API_KEY,
        "kling": settings.KLING_ACCESS_KEY and settings.KLING_SECRET_KEY,
    }.get(provider)
    if not available:
        label = {
            "openai": "OpenAI",
            "gemini": "Gemini",
            "deepseek": "DeepSeek",
            "dashscope": "阿里云百炼",
            "ark": "火山方舟",
            "kling": "可灵",
        }.get(provider, provider)
        name = entry.get("name") or model
        raise HTTPException(
            503,
            f"生成服务尚未配置：{name} 使用{label}，该平台尚未填写 API 密钥。"
            "作品已保存，请配置该平台或切换到已启用平台的模型。",
        )
