import os
import httpx
import json  
import asyncio
from schemas import TextRequest, TextResponse
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from fastapi import WebSocket, WebSocketDisconnect
import websockets
from openai import AsyncOpenAI  

load_dotenv()
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

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
    if not OPENAI_API_KEY:
        return JSONResponse(
            content={"error": "OpenAI API key not configured"}, 
            status_code=500
        )
    
    if not payload.text or len(payload.text.strip()) == 0:
        return TextResponse(
            sentiment=0.5,
            label="neutral",
            keywords=[]
        )
    
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content":  """ You are a sentiment analysis expert. Analyze the given text and return a JSON response with:
                                    1. sentiment: a float between 0 and 1 (0=very negative, 0.5=neutral, 1=very positive)
                                    2. label: one of "positive", "neutral", or "negative"
                                    3. keywords: an array of 3-5 key topics or themes from the text

                                    Return ONLY valid JSON, no markdown or explanations.
                                """
                },
                {
                    "role": "user",
                    "content": f"Analyze this text: {payload.text}"
                }
            ],
            temperature=0.3,  
            max_tokens=1000
        )
        
        result_text = response.choices[0].message.content.strip()
        result = json.loads(result_text)
        
        return TextResponse(
            sentiment=float(result.get("sentiment", 0.5)),
            label=result.get("label", "neutral"),
            keywords=result.get("keywords", [])
        )
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print(f"Response was: {result_text}")
        
        return TextResponse(
            sentiment=0.5,
            label="neutral",
            keywords=["error", "parsing"]
        )
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return JSONResponse(
            content={"error": f"Failed to analyze text: {str(e)}"}, 
            status_code=500
        )


@app.websocket("/ws/transcribe")
async def transcribe_websocket(websocket: WebSocket):
    """
    WebSocket proxy: Frontend -> Your Server -> Deepgram
    Keeps API key secure on the server.
    """
    await websocket.accept()
    
    if not DEEPGRAM_API_KEY:
        await websocket.send_json({"error": "Deepgram API key not configured"})
        await websocket.close()
        return
    
    deepgram_url = (
        "wss://api.deepgram.com/v1/listen?"
        "encoding=linear16&"
        "sample_rate=16000&"
        "channels=1&"
        "model=nova-2&"
        "language=en&"
        "smart_format=true&"
        "interim_results=true"
    )
    
    deepgram_ws = None
    
    try:
        deepgram_ws = await websockets.connect(
            deepgram_url,
            additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"}
        )
        
        async def forward_to_deepgram():
            """Forward audio from frontend to Deepgram"""
            try:
                while True:
                    data = await websocket.receive_bytes()
                    await deepgram_ws.send(data)
            except WebSocketDisconnect:
                print("Client disconnected")
            except Exception as e:
                print(f"Error forwarding to Deepgram: {e}")
        
        async def forward_from_deepgram():
            """Forward transcription from Deepgram to frontend"""
            try:
                async for message in deepgram_ws:
                    await websocket.send_text(message)
            except Exception as e:
                print(f"Error receiving from Deepgram: {e}")
        
        await asyncio.gather(
            forward_to_deepgram(),
            forward_from_deepgram(),
            return_exceptions=True
        )
        
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.send_json({"error": str(e)})
    finally:
        if deepgram_ws:
            await deepgram_ws.close()
        try:
            await websocket.close()
        except:
            pass