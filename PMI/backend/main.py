from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utils.startup import run_migrations, startup_populate
from routers.channels import router as channels_router
from routers.dashboard import router as dashboard_router
from routers.categories import router as categories_router
from routers.products import router as products_router
from routers.upload import router as upload_router
from routers.attributes import router as attributes_router

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    startup_populate()
    yield

app = FastAPI(title="PIM API Microservice", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(channels_router)
app.include_router(dashboard_router)
app.include_router(categories_router)
app.include_router(products_router)
app.include_router(upload_router)
app.include_router(attributes_router)
