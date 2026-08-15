import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base

class Farm(Base):
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    location = Column(String)
    owner = Column(String)

class Zone(Base):
    __tablename__ = "zones"

    id = Column(String, primary_key=True, index=True) # e.g., 'shed1'
    farm_id = Column(Integer, ForeignKey("farms.id"))
    name = Column(String)
    zone_type = Column(String) # e.g., 'shed', 'waste', 'feed'
    latitude = Column(Float)
    longitude = Column(Float)
    current_risk = Column(Float, default=0.0)
    status = Column(String, default="🟢 Normal")
    note = Column(String, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class RiskLog(Base):
    __tablename__ = "risk_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String, index=True)
    risk_score = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.now)