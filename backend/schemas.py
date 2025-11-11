from typing import List, Literal
from pydantic import BaseModel


class TextRequest(BaseModel):
    text: str

class TextResponse(BaseModel):
    sentiment: float              
    label: Literal["positive", "neutral", "negative"]
    keywords: List[str]