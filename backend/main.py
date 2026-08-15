import os
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file
import json
import base64
import urllib.request
import urllib.error
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, Query, Request, Body, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from risk.engine import calculate_total_risk
from database import engine, get_db
from models import schemas

schemas.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Poultry Biosecurity API")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "https://biosecurity-dashboard-c7yrbsais-spated.vercel.app")
allowed_origins = [x.strip() for x in frontend_origin.split(",") if x.strip()]
if "http://localhost:3000" not in allowed_origins:
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Observation(BaseModel):
    farm_id: str
    zone_id: str
    observation_type: str
    value: float

@app.get("/")
def read_root():
    return {"status": "Backend is running", "service": "Farm Signal"}

@app.get("/whatsapp/config")
def whatsapp_config():
    """Safe public configuration: never expose the WhatsApp access token."""
    return {
        "configured": bool(os.getenv("WHATSAPP_ACCESS_TOKEN") and os.getenv("WHATSAPP_PHONE_NUMBER_ID")),
        "display_number": os.getenv("WHATSAPP_DISPLAY_NUMBER", "Not configured"),
        "business_number_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")[:6] + "…" if os.getenv("WHATSAPP_PHONE_NUMBER_ID") else ""
    }

@app.post("/seed")
def seed_database(db: Session = Depends(get_db)):
    if db.query(schemas.Zone).count() == 0:
        farm = schemas.Farm(name="Tony's Farm", location="Chennai, Tamil Nadu", owner="Tony")
        db.add(farm)
        db.commit()
        db.refresh(farm)
        zones = [
            schemas.Zone(id="shed1", farm_id=farm.id, name="Shed 1", zone_type="shed", latitude=13.0830, longitude=80.2700, current_risk=24, status="🟢 Normal"),
            schemas.Zone(id="shed2", farm_id=farm.id, name="Shed 2", zone_type="shed", latitude=13.0820, longitude=80.2710, current_risk=68, status="🟡 High Risk", note="Abnormal behavior detected"),
            schemas.Zone(id="waste", farm_id=farm.id, name="Waste Area", zone_type="waste", latitude=13.0840, longitude=80.2720, current_risk=95, status="🔴 Contaminated")
        ]
        db.add_all(zones)
        db.commit()
        return {"message": "Database successfully seeded with farm and zones!"}
    return {"message": "Database already has data. No changes made."}

@app.get("/farm-status")
def get_farm_status(db: Session = Depends(get_db)):
    zones = db.query(schemas.Zone).all()
    return [{
        "id": z.id, "name": z.name, "lat": z.latitude, "lng": z.longitude,
        "risk": z.current_risk, "status": z.status, "note": z.note
    } for z in zones]

@app.post("/health-report")
def receive_health_report(obs: Observation, db: Session = Depends(get_db)):
    risk_score = calculate_total_risk(health=obs.value, environment=50, transmission=40, biosecurity=60, local=30)
    if risk_score >= 80:
        new_status = "🔴 Critical Risk"
    elif risk_score >= 50:
        new_status = "🟡 High Risk"
    else:
        new_status = "🟢 Normal"
    zone = db.query(schemas.Zone).filter(schemas.Zone.id == obs.zone_id).first()
    if zone:
        zone.current_risk = risk_score
        zone.status = new_status
        zone.note = f"Automated update via {obs.observation_type} scan"
        db.add(schemas.RiskLog(zone_id=zone.id, risk_score=risk_score))
        db.commit()
        return {"message": "Database updated successfully", "new_risk_score": risk_score}
    return {"error": "Zone not found"}

@app.get("/zone-history/{zone_id}")
def get_zone_history(zone_id: str, db: Session = Depends(get_db)):
    logs = db.query(schemas.RiskLog).filter(schemas.RiskLog.zone_id == zone_id).order_by(schemas.RiskLog.timestamp.asc()).limit(10).all()
    return [{"time": log.timestamp.strftime("%H:%M"), "risk": log.risk_score} for log in logs]

# ---------------- CROP DISEASE SCANNER ----------------
DIAGNOSIS_SYSTEM_PROMPT = """You are an agricultural plant pathologist assistant. Look carefully at the crop photo provided. Respond with ONLY a raw JSON object, no markdown fences, no preamble, matching exactly this shape:
{
  \"crop_type\": \"string, best guess at the crop/plant, or 'Unidentified plant' if unclear\",
  \"disease_name\": \"string, common name of the disease/pest/deficiency identified, or 'Healthy — no signs of disease' if the plant looks healthy, or 'Unable to determine' if the image is too unclear\",
  \"scientific_name\": \"string, pathogen scientific name if applicable, else empty string\",
  \"severity\": \"one of: none, low, moderate, high\",
  \"confidence\": integer 0-100,
  \"description\": \"1-3 sentences in plain language explaining what is visually observed and what is causing it\",
  \"recommendations\": [\"array of 3-5 short, concrete, actionable steps a farmer can take, ordered by priority\"]
}
Be honest about uncertainty. If the image is blurry, too zoomed out, or ambiguous, use a lower confidence score. Do not invent a disease if the plant looks healthy."""

def anthropic_request(image_bytes: bytes, media_type: str):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI diagnosis is not configured. Add ANTHROPIC_API_KEY to the backend environment.")
    encoded = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        "max_tokens": 1000,
        "system": DIAGNOSIS_SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": encoded}},
            {"type": "text", "text": "Diagnose this crop photo. Respond with only the JSON object."}
        ]}]
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"AI provider error: {detail[:500]}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI provider request failed: {exc}")

    text_blocks = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
    if not text_blocks:
        raise HTTPException(status_code=502, detail="No diagnosis was returned by the AI provider.")
    clean = text_blocks[0].strip().replace("```json", "").replace("```", "").strip()
    try:
        result = json.loads(clean)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned an invalid diagnosis format.")
    return result

@app.post("/crop-diagnosis")
async def crop_diagnosis(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG, WEBP, or other image file.")
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is too large. Maximum size is 10 MB.")
    result = anthropic_request(image_bytes, file.content_type)
    result["scanned_at"] = datetime.now(timezone.utc).isoformat()
    return result

# ---------------- WHATSAPP CLOUD API ----------------

def send_whatsapp_text(to_number: str, message: str):
    token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_number_id:
        raise HTTPException(status_code=503, detail="WhatsApp Cloud API is not configured.")
    url = f"https://graph.facebook.com/v23.0/{phone_number_id}/messages"
    payload = {"messaging_product": "whatsapp", "to": to_number, "type": "text", "text": {"body": message}}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"
    }, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"WhatsApp API error: {detail[:500]}")

@app.get("/whatsapp/webhook")
def verify_whatsapp_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == os.getenv("WHATSAPP_VERIFY_TOKEN"):
        return int(hub_challenge) if hub_challenge and hub_challenge.isdigit() else hub_challenge
    raise HTTPException(status_code=403, detail="Webhook verification failed")

@app.post("/whatsapp/webhook")
def receive_whatsapp_message(payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        entry = payload.get("entry", [])[0]
        changes = entry.get("changes", [])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        if messages:
            message = messages[0]
            phone_number = message.get("from")
            text = message.get("text", {}).get("body", "").strip()
            lower = text.lower()
            print(f"📩 WhatsApp message from {phone_number}: {text}")

            if "sick" in lower or "abnormal" in lower:
                shed2 = db.query(schemas.Zone).filter(schemas.Zone.id == "shed2").first()
                if shed2:
                    shed2.current_risk = 85.0
                    shed2.status = "🔴 Critical Risk"
                    shed2.note = "Reported via WhatsApp: Sick bird"
                    db.add(schemas.RiskLog(zone_id=shed2.id, risk_score=85.0))
                    db.commit()
                send_whatsapp_text(phone_number, "⚠️ Farm Signal received your report. Shed 2 has been marked Critical Risk. Please isolate affected birds and check the shed.")
            elif lower in {"menu", "hi", "hello", "help"}:
                send_whatsapp_text(phone_number, "Farm Signal menu:\n1. Report sick/abnormal birds\n2. Send a crop photo for disease screening\n3. Ask for farm status\n\nSend a message or photo to continue.")
            else:
                send_whatsapp_text(phone_number, "Farm Signal received your message. If you are reporting a sick/abnormal bird, reply with 'sick'. For crop screening, send a clear crop photo.")
    except Exception as e:
        print(f"❌ Error parsing WhatsApp webhook: {e}")
    return {"status": "ok"}
