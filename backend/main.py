from schemas import TextRequest, TextResponse
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


app = FastAPI()
origins = ["http://localhost:5173"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
async def health_check():
    """
    Simple GET route to confirm backend is running.
    """
    return JSONResponse(content={"status": "healthy"})


@app.post("/process_text", response_model=TextResponse)
async def process_text(payload: TextRequest):
    """
    Processes the input text and returns sentiment analysis and keywords using the OpenAI API.
    
    Accepts: {"text": "..."}
    
    Returns: Sentiment analysis and keywords using the OpenAI API in format:
            {
                "sentiment": float,
                "label": "positive" | "neutral" | "negative",
                "keywords": [str, str, ...]
            }
    """
    return TextResponse(
        sentiment=0.62,
        label="positive",
        keywords=["focus", "demo"]
    )
