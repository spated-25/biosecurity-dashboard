import os
import json
import base64
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

anthropic = None
try:
    import anthropic
except (ImportError, ModuleNotFoundError):
    anthropic = None

load_dotenv()

app = FastAPI(title="Poultry Biosecurity API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

client = None
if anthropic.Anthropic and ANTHROPIC_API_KEY:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


@app.get("/")
def root():
    return {
        "message": "Poultry Biosecurity API",
        "status": "online"
    }


@app.get("/whatsapp/config")
def whatsapp_config():
    return {
        "configured": bool(os.getenv("WHATSAPP_ACCESS_TOKEN")),
        "display_number": os.getenv(
            "WHATSAPP_DISPLAY_NUMBER",
            "Not configured"
        )
    }


@app.get("/farm-status")
def farm_status():
    return [
        {
            "id": 1,
            "name": "Zone A",
            "lat": 13.0827,
            "lng": 80.2707,
            "risk": 25,
            "status": "Normal",
            "note": ""
        },
        {
            "id": 2,
            "name": "Zone B",
            "lat": 13.0840,
            "lng": 80.2720,
            "risk": 55,
            "status": "Monitor",
            "note": "Increased observation recommended"
        },
        {
            "id": 3,
            "name": "Zone C",
            "lat": 13.0815,
            "lng": 80.2695,
            "risk": 85,
            "status": "High Risk",
            "note": "Isolate affected birds and contact a veterinarian"
        }
    ]


@app.get("/zone-history/{zone_id}")
def zone_history(zone_id: int):
    now = datetime.now()

    return [
        {
            "time": f"{i + 1}",
            "risk": max(0, min(100, 30 + i * 5))
        }
        for i in range(10)
    ]


# ---------------------------------------------------------
# POULTRY HEALTH / DISEASE SCREENING
# ---------------------------------------------------------

@app.post("/poultry-diagnosis")
async def poultry_diagnosis(file: UploadFile = File(...)):

    if not client:
        raise HTTPException(
            status_code=503,
            detail="AI diagnosis is not configured. Add ANTHROPIC_API_KEY to the backend environment."
        )

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a poultry/bird image."
        )

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty."
        )

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image must be smaller than 10 MB."
        )

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    media_type = file.content_type

    prompt = """
You are a poultry health screening assistant.

Analyze the uploaded poultry/bird photograph.

This is an AI-assisted screening tool, NOT a definitive veterinary diagnosis.
Do not invent a disease when the image is unclear.

Return ONLY valid JSON using exactly this structure:

{
  "bird_type": "best guess at the poultry/bird type, or 'Unidentified bird' if unclear",
  "disease_name": "suspected poultry disease or health condition, or 'No obvious signs of disease' if the bird looks healthy, or 'Unable to determine' if unclear",
  "scientific_name": "pathogen scientific name if applicable, otherwise empty string",
  "severity": "Low, Moderate, High, or Unable to determine",
  "confidence": 0,
  "description": "brief description of visible signs",
  "symptoms": [
    "visible symptom 1",
    "visible symptom 2"
  ],
  "recommendations": [
    "recommended biosecurity/action step 1",
    "recommended biosecurity/action step 2"
  ]
}

Important:
- confidence must be a number from 0 to 100.
- Only describe symptoms that are actually visible or reasonably supported by the photograph.
- If the photograph is blurry, too distant, or does not show a bird clearly, use 'Unable to determine'.
- Do not claim certainty.
- For serious or unclear cases, recommend veterinary assessment.
"""

    try:
        response = client.messages.create(
            model=os.getenv(
                "ANTHROPIC_MODEL",
                "claude-3-5-sonnet-20241022"
            ),
            max_tokens=1200,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_base64
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        )

        text = response.content[0].text.strip()

        # Remove accidental markdown fences.
        if text.startswith("```"):
            text = text.replace("```json", "")
            text = text.replace("```", "")
            text = text.strip()

        result = json.loads(text)

        return result

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="AI returned an invalid diagnosis response."
        )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI provider error: {str(e)}"
        )


# ---------------------------------------------------------
# WHATSAPP
# ---------------------------------------------------------

@app.post("/health-report")
async def health_report(report: dict):
    return {
        "status": "received",
        "message": "Poultry health report received",
        "report": report
    }


# ---------------------------------------------------------
# STARTUP
# ---------------------------------------------------------

@app.post("/seed")
def seed():
    return {
        "status": "ok",
        "message": "Database seed completed"
    }