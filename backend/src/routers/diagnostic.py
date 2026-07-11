import os
import json
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

# Attempt to initialize Groq client
try:
    from groq import Groq
    # Groq automatically looks for the GROQ_API_KEY environment variable
    client = Groq()
except ImportError:
    client = None

logger = logging.getLogger(__name__)
router = APIRouter()

# Define the expected JSON payload structure from the React frontend
class DiagnosticPayload(BaseModel):
    tier: str
    payload: Dict[str, Any]

@router.post("/api/diagnose")
async def run_diagnostic(request: DiagnosticPayload):
    if not client:
        raise HTTPException(status_code=500, detail="Groq SDK not installed or missing API key.")

    # 1. Dynamically assign the System Prompt based on the architecture tier
    if request.tier == "investigator":
        system_prompt = (
            "You are an L1 AI infrastructure triage engineer. Look at the provided cluster summary "
            "and identify the anomalous node. Be concise, highly technical, and respond in exactly two sentences. "
            "Do not use markdown formatting, just plain text."
        )
    elif request.tier == "diagnostician":
        system_prompt = (
            "You are a Senior AI Site Reliability Engineer. Diagnose the exact root cause of the "
            "node failure from the provided telemetry JSON. Provide a clear, technical diagnosis "
            "followed by a concise 3-step remediation plan."
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid diagnostic tier specified.")

    # 2. Execute the inference call to Groq
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": f"Analyze this telemetry window:\n{json.dumps(request.payload, indent=2)}"
                }
            ],
            # UPDATED: Replaced the decommissioned DeepSeek model with Llama 3.3 70B
            model="llama-3.3-70b-versatile", 
            temperature=0.2, 
            max_tokens=1024,
        )
        
        # Extract the model's text response
        diagnosis = chat_completion.choices[0].message.content
        return {"status": "success", "diagnosis": diagnosis}
        
    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Diagnostic failed: {str(e)}")