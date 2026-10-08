from typing import List, Optional

from pydantic import BaseModel, Field


class SandboxLLMRequest(BaseModel):
    model: str
    prompt: str = Field(min_length=1,max_length=12000)
    temperature: Optional[float] = 0.7
    web_search: Optional[bool] = False


class SandboxVLMRequest(BaseModel):
    model: str
    prompt: str = Field(min_length=1,max_length=12000)
    images: List[str]


class SandboxT2IRequest(BaseModel):
    model: str
    prompt: str = Field(min_length=1,max_length=12000)
    style: Optional[str] = "anime"
    ratio: Optional[str] = "16:9"


class SandboxI2IRequest(BaseModel):
    model: str
    prompt: str = Field(min_length=1,max_length=12000)
    image: str
    ratio: Optional[str] = "16:9"


class SandboxVideoRequest(BaseModel):
    model: str
    prompt: str = Field(min_length=1,max_length=12000)
    image: Optional[str] = None
