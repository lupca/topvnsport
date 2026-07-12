from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    translated_errors = []
    for err in exc.errors():
        err_type = err.get("type")
        ctx = err.get("ctx") or {}
        msg = err.get("msg", "")
        
        if err_type == "missing":
            translated_msg = "Trường này là bắt buộc"
        elif err_type == "greater_than_equal":
            limit = ctx.get("limit_value") or ctx.get("ge")
            translated_msg = f"Giá trị phải lớn hơn hoặc bằng {limit}"
        elif err_type == "less_than_equal":
            limit = ctx.get("limit_value") or ctx.get("le")
            translated_msg = f"Giá trị phải nhỏ hơn hoặc bằng {limit}"
        elif err_type == "string_too_short":
            min_length = ctx.get("min_length")
            translated_msg = f"Độ dài tối thiểu là {min_length} ký tự"
        elif err_type == "value_error":
            if msg.startswith("Value error, "):
                translated_msg = msg[len("Value error, "):]
            else:
                translated_msg = msg
        else:
            translated_msg = msg
            
        translated_errors.append({
            "loc": err.get("loc"),
            "msg": translated_msg,
            "type": err_type
        })
        
    return JSONResponse(
        status_code=422,
        content={"detail": translated_errors}
    )



app.include_router(channels_router)
app.include_router(dashboard_router)
app.include_router(categories_router)
app.include_router(products_router)
app.include_router(upload_router)
app.include_router(attributes_router)
