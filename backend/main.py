from fastapi import FastAPI, Depends, Query, Request,Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from risk.engine import calculate_total_risk

# Import your new database files
from database import engine, get_db, Base
from models import schemas

# This tells SQLAlchemy to create your tables in PostgreSQL!
schemas.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Poultry Biosecurity API")

# This allows your React app (port 3000) to talk to FastAPI (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
    return {"status": "Backend is running"}

@app.post("/seed")
def seed_database(db: Session = Depends(get_db)):
    # Check if the database is already seeded
    if db.query(schemas.Zone).count() == 0:
        # Create the main farm
        farm = schemas.Farm(name="Tony's Farm", location="Chennai, Tamil Nadu", owner="Tony")
        db.add(farm)
        db.commit()
        db.refresh(farm)

        # Create the zones based on your map coordinates
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
    # Fetch all zones directly from PostgreSQL
    zones = db.query(schemas.Zone).all()
    
    # Format the data exactly how React expects it
    return [
        {
            "id": z.id,
            "name": z.name,
            "lat": z.latitude,
            "lng": z.longitude,
            "risk": z.current_risk,
            "status": z.status,
            "note": z.note
        }
        for z in zones
    ]

@app.post("/health-report")
def receive_health_report(obs: Observation, db: Session = Depends(get_db)):
    risk_score = calculate_total_risk(
        health=obs.value, environment=50, transmission=40, biosecurity=60, local=30
    )
    
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
        
        # --- THE NEW MAGIC: SAVE TO HISTORY LOG ---
        new_log = schemas.RiskLog(zone_id=zone.id, risk_score=risk_score)
        db.add(new_log)
        
        db.commit()
        return {"message": "Database updated successfully", "new_risk_score": risk_score}
        
    return {"error": "Zone not found"}

@app.get("/zone-history/{zone_id}")
def get_zone_history(zone_id: str, db: Session = Depends(get_db)):
    """Fetches the last 10 risk events for a specific zone to draw the charts."""
    logs = db.query(schemas.RiskLog).filter(schemas.RiskLog.zone_id == zone_id).order_by(schemas.RiskLog.timestamp.asc()).limit(10).all()
    
    return [
        {
            "time": log.timestamp.strftime("%H:%M"),
            "risk": log.risk_score
        }
        for log in logs
    ]
# ---------------------------------------------
# WHATSAPP API INTEGRATION
# ---------------------------------------------

@app.post("/whatsapp/webhook")
def receive_whatsapp_message(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    This endpoint catches all incoming messages from farmers.
    """
    try:
        # Meta sends a deeply nested JSON payload. We have to dig into it.
        entry = payload.get("entry", [])[0]
        changes = entry.get("changes", [])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        
        if messages:
            message = messages[0]
            phone_number = message.get("from")
            text = message.get("text", {}).get("body", "").lower()
            
            print(f"📩 New message from {phone_number}: {text}")
            
            # --- PHASE 10: INTERACTIVE LOGIC ---
            if "sick" in text or "abnormal" in text:
                print("⚠️ Alerting Risk Engine: Updating Shed 2...")
                
                # Update the database directly based on the WhatsApp message
                shed2 = db.query(schemas.Zone).filter(schemas.Zone.id == "shed2").first()
                if shed2:
                    shed2.current_risk = 85.0
                    shed2.status = "🔴 Critical Risk"
                    shed2.note = "Reported via WhatsApp: Sick bird"
                    db.commit()
                    print("✅ Database updated successfully.")
                    
            elif text == "menu":
                print("🤖 (Mock) Replying via WhatsApp: 'What would you like to report? 1. Sick bird 2. Feed problem'")
                
    except Exception as e:
        print(f"❌ Error parsing WhatsApp webhook: {e}")
        
    # VERY IMPORTANT: You must always return 200 OK immediately.
    return {"status": "ok"}