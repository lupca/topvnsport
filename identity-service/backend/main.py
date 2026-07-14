from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import SessionLocal
from utils.seed import seed_initial_data
from routers import auth, staff, roles

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed database on startup
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="SSO Identity Service",
    description="Centralized authentication and identity service for topvnsport systems.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(auth.router)
app.include_router(staff.router)
app.include_router(roles.router)


@app.get("/")
def read_root():
    return {"message": "SSO Identity Service is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
