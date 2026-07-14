from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import SessionLocal
from utils.seed import seed_initial_data
from fastapi.middleware.cors import CORSMiddleware
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:13100",
        "http://localhost:13101",
        "http://localhost:13102",
        "http://localhost:13103",
        "http://localhost:13110",
        "http://localhost:18100",
        "http://localhost:18101",
        "http://localhost:18102",
        "http://127.0.0.1:13100",
        "http://127.0.0.1:13101",
        "http://127.0.0.1:13102",
        "http://127.0.0.1:13103",
        "http://127.0.0.1:13110",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
