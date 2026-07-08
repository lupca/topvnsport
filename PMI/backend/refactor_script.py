import os

def read_lines(filepath):
    with open(filepath, 'r') as f:
        return f.readlines()

def write_lines(filepath, lines):
    with open(filepath, 'w') as f:
        f.writelines(lines)

def main():
    base_dir = '/home/lupca/projects/topvnsport/PMI/backend'
    main_file = os.path.join(base_dir, 'main.py')
    
    lines = read_lines(main_file)
    
    # helper to get lines (1-indexed to 0-indexed)
    def get(start, end):
        return lines[start-1:end]

    # --- 1. utils/startup.py ---
    startup_imports = [
        "from sqlalchemy import text\n",
        "from sqlalchemy.orm import Session\n",
        "from database import engine, Base, get_db\n",
        "import models\n",
        "import minio_client\n\n"
    ]
    
    migrations_func = ["def run_migrations():\n"] + ["    " + l for l in get(14, 90)]
    seed_mappings = get(260, 402)
    startup_pop = get(406, 554)
    
    write_lines(os.path.join(base_dir, 'utils/startup.py'), 
                startup_imports + migrations_func + ["\n"] + seed_mappings + ["\n"] + startup_pop)

    # --- 2. services/product_service.py ---
    service_imports = [
        "from typing import List, Optional\n",
        "from sqlalchemy.orm import Session\n",
        "from fastapi import HTTPException\n",
        "import models\n",
        "import schemas\n\n"
    ]
    
    parse_attr = get(106, 118)
    upsert_attr = get(121, 147)
    save_chan = get(150, 257)
    
    write_lines(os.path.join(base_dir, 'services/product_service.py'),
                service_imports + parse_attr + ["\n"] + upsert_attr + ["\n"] + save_chan)

    # --- 3. routers/dashboard.py ---
    dashboard_imports = [
        "from fastapi import APIRouter, Depends, HTTPException\n",
        "from sqlalchemy.orm import Session\n",
        "from database import get_db\n",
        "import models\n",
        "import schemas\n\n",
        "router = APIRouter(prefix='/dashboard', tags=['Dashboard'])\n\n"
    ]
    dashboard_code = get(557, 628)
    # replace @app.get with @router.get, stripping /dashboard from prefix
    dashboard_code[0] = dashboard_code[0].replace("@app.get(\"/dashboard/stats\"", "@router.get(\"/stats\"")
    write_lines(os.path.join(base_dir, 'routers/dashboard.py'), dashboard_imports + dashboard_code)

    # --- 4. routers/categories.py ---
    cat_imports = [
        "from fastapi import APIRouter, Depends, HTTPException, status\n",
        "from sqlalchemy.orm import Session\n",
        "from typing import List\n",
        "from database import get_db\n",
        "import models\n",
        "import schemas\n\n",
        "router = APIRouter(prefix='/categories', tags=['Categories'])\n\n"
    ]
    cat_code = get(631, 766)
    # replace @app. methods
    for i in range(len(cat_code)):
        if cat_code[i].startswith("@app."):
            cat_code[i] = cat_code[i].replace("@app.", "@router.").replace("\"/categories", "\"").replace("\"\"", "\"/\"")
    write_lines(os.path.join(base_dir, 'routers/categories.py'), cat_imports + cat_code)

    # --- 5. routers/products.py ---
    prod_imports = [
        "from fastapi import APIRouter, Depends, HTTPException, status\n",
        "from sqlalchemy.orm import Session, selectinload\n",
        "from typing import List, Optional\n",
        "from database import get_db\n",
        "import models\n",
        "import schemas\n",
        "from services.product_service import _upsert_product_attribute_values, _save_product_channel_listings\n\n",
        "router = APIRouter(tags=['Products'])\n\n"
    ]
    prod_code = get(768, 1140)
    for i in range(len(prod_code)):
        if prod_code[i].startswith("@app."):
            prod_code[i] = prod_code[i].replace("@app.", "@router.")
    write_lines(os.path.join(base_dir, 'routers/products.py'), prod_imports + prod_code)

    # --- 6. routers/upload.py ---
    up_imports = [
        "import uuid\n",
        "from fastapi import APIRouter, HTTPException, File, UploadFile\n",
        "import minio_client\n\n",
        "router = APIRouter(tags=['Upload'])\n\n"
    ]
    up_code = get(1142, 1158)
    for i in range(len(up_code)):
        if up_code[i].startswith("@app."):
            up_code[i] = up_code[i].replace("@app.", "@router.")
    write_lines(os.path.join(base_dir, 'routers/upload.py'), up_imports + up_code)

    # --- 7. routers/attributes.py ---
    attr_imports = [
        "from fastapi import APIRouter, Depends, HTTPException, status\n",
        "from sqlalchemy.orm import Session\n",
        "from typing import List\n",
        "from database import get_db\n",
        "import models\n",
        "import schemas\n\n",
        "router = APIRouter(tags=['Attributes'])\n\n"
    ]
    attr_code = get(1160, 1352)
    for i in range(len(attr_code)):
        if attr_code[i].startswith("@app."):
            attr_code[i] = attr_code[i].replace("@app.", "@router.")
    write_lines(os.path.join(base_dir, 'routers/attributes.py'), attr_imports + attr_code)

    # --- 8. Rewrite main.py ---
    new_main = [
        "from fastapi import FastAPI\n",
        "from fastapi.middleware.cors import CORSMiddleware\n\n",
        "from utils.startup import run_migrations, startup_populate\n",
        "from routers.channels import router as channels_router\n",
        "from routers.dashboard import router as dashboard_router\n",
        "from routers.categories import router as categories_router\n",
        "from routers.products import router as products_router\n",
        "from routers.upload import router as upload_router\n",
        "from routers.attributes import router as attributes_router\n\n",
        "run_migrations()\n\n",
        "app = FastAPI(title=\"PIM API Microservice\")\n\n",
        "app.add_middleware(\n",
        "    CORSMiddleware,\n",
        "    allow_origins=[\"*\"],\n",
        "    allow_credentials=True,\n",
        "    allow_methods=[\"*\"],\n",
        "    allow_headers=[\"*\"],\n",
        ")\n\n",
        "@app.on_event(\"startup\")\n",
        "def on_startup():\n",
        "    startup_populate()\n\n",
        "app.include_router(channels_router)\n",
        "app.include_router(dashboard_router)\n",
        "app.include_router(categories_router)\n",
        "app.include_router(products_router)\n",
        "app.include_router(upload_router)\n",
        "app.include_router(attributes_router)\n"
    ]
    write_lines(main_file, new_main)
    print("Refactoring completed successfully.")

if __name__ == '__main__':
    main()
