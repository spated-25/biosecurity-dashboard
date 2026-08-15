from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ⚠️ UPDATE THIS LINE with your actual PostgreSQL credentials
# Format: postgresql://username:password@localhost:5432/database_name
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:admin@localhost:5432/poultry_db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get the DB session for our routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()