# Original User Request

## Initial Request — 2026-06-29T19:56:19+07:00

Build Phase 1 (Foundation) and Phase 2 (OMS Core) of the OMS and WMS backends, as outlined in the Thiết Kế Hệ Thống.md system design document. 

Working directory: /home/lupca/projects
Integrity mode: development

## Requirements

### R1. Docker Compose Setup
Set up the `docker-compose.yml` for OMS (API port 8001, DB port 5434) and WMS (API port 8002, DB port 5435) inside their respective directories. Ensure they can communicate with the existing PMI services if needed.

### R2. WMS Backend Foundation (Phase 1)
Initialize the FastAPI backend for WMS with database connections, SQLAlchemy models (Warehouse, Location, Inventory, BarcodeMapping, InboundShipment, InboundItem, FulfillmentOrder_WMS, PickListItem, PackingSession), and Pydantic schemas. Write scripts to generate seed data.

### R3. OMS Backend Implementation (Phase 1 & Phase 2)
Implement the complete FastAPI backend for OMS. This includes:
- SQLAlchemy models (Customer, Channel, Order, OrderItem, FulfillmentOrder).
- CRUD APIs for Customers and Channels.
- Core Order APIs (create, list, detail, confirm, cancel).
- Order status flow logic (DRAFT → CONFIRMED → PROCESSING) and integration logic for sending fulfillment orders to WMS.

### R4. PMI API Update
Add a new API endpoint `GET /api/products/by-sku/{sku_code}` to the existing PMI backend (`/home/lupca/projects/PMI/backend/`).

## Acceptance Criteria

### Programmatic Verification
- A test script (`test_oms_wms.py` or equivalent pytest suite) must successfully insert seed data into the OMS and WMS databases.
- The test suite must programmatically call the OMS APIs to create a new customer, create an order, and transition its state to `CONFIRMED`.
- The WMS API models must be queryable without errors.
- The PMI endpoint `/api/products/by-sku/{sku_code}` must successfully return mock or real product data when queried by the test suite.

## Follow-up — 2026-06-30T00:37:26+07:00

Build the Frontend web applications for both the OMS (Order Management System) and WMS (Warehouse Management System) including the mobile-optimized scanning layout, using Next.js 14, Tailwind CSS, Recharts, and html5-qrcode, matching the design specifications.

Working directory: /home/lupca/projects
Integrity mode: development

## Requirements

### R1. Design System & Layouts
Implement a consistent design system matching the PMI style:
- Font: Plus Jakarta Sans
- Colors: Dark theme with `indigo-600` accent, slate tables (`bg-slate-900`), and clean overlays.
- Desktop layouts with sidebar navigation and mobile layout (`/m/*`) with a dark, clean bottom-nav interface and large tap targets.

### R2. OMS Desktop Frontend (`OMS/frontend`)
Implement the following Next.js pages:
- **Dashboard (`/`)**: 6 stat cards, 7-day order chart using Recharts, and table of 5 recent orders.
- **Orders (`/orders`)**: State-based switching view including:
  - List view with filters (status, channel, date, search), server-side pagination, status badges, and actions (View, Edit (DRAFT), Confirm (DRAFT), Cancel).
  - Form view (Create/Edit DRAFT orders) containing customer lookup/creation, channel select, and product search modal.
  - Detail view with status timeline progress, order item summaries, and actions.
- **Customers (`/customers`)**: Modal-based CRUD operations for customer records.
- **Channels (`/channels`)**: Modal-based CRUD operations for sales channels.

### R3. WMS Desktop Frontend (`WMS/frontend`)
Implement the following Next.js pages:
- **Dashboard (`/`)**: Inventory stats, low-stock warnings, and transaction logs.
- **Warehouses & Locations (`/warehouses`)**: Listing warehouses, drilling down to locations grid, and adding/editing locations.
- **Inventory (`/inventory`)**: Table showing quantities (available, reserved, total) with adjust and transfer modals.
- **Barcode Mappings (`/barcode-mappings`)**: Mapping product SKU to barcodes (EAN-13, Code 128, etc.).
- **Inbound Shipments (`/inbound`)**: Create and inspect receipt of shipments.
- **Fulfillment Orders (`/fulfillment`)**: Picking list view and packing verification detail.
- **Transactions (`/transactions`)**: Stock transaction audit logs.

### R4. WMS Mobile Scanner (`WMS/frontend/src/app/m`)
Implement a mobile-optimized scanning app using `html5-qrcode` to scan:
- **Pick Flow (`/m/pick/[id]`)**: Scan EAN-13 product barcode to pick items.
- **Pack Flow (`/m/pack/[id]`)**: Scan Code 128/QR shipping barcode to mark packed.
- **Receive Flow (`/m/receive/[id]`)**: Scan EAN-13 to receive inventory, and put-away to locations.
- **Lookup & Stock Check**: Scan any barcode to show info, or check location stocks.

### R5. Integration and Docker Setup
- Configure Next.js env variables (`NEXT_PUBLIC_OMS_API_URL` and `NEXT_PUBLIC_WMS_API_URL`) to connect to backend APIs (`http://localhost:8001` and `http://localhost:8002` respectively by default).
- Create `Dockerfile`s for the frontends and add them to the unified docker-compose configuration.

## Acceptance Criteria

### Programmatic Verification
- Both OMS and WMS frontend projects must build cleanly via `npm run build` without TypeScript or lint errors.
- A Playwright E2E integration test suite (`/home/lupca/projects/e2e-tests`) must run successfully, verifying:
  - Navigating the OMS dashboard, creating a customer/channel, placing a draft order, and confirming it.
  - Verifying the order appears in WMS fulfillment lists.
  - Simulating the mobile scan picking flow (`/m/pick/[id]`) and packing flow (`/m/pack/[id]`) via mock inputs/scans.
  - Verifying the final status callback transitions the order to completed or shipped in OMS.
- The E2E tests must verify CORS compatibility between the Next.js frontend running in the browser and the FastAPI backends.
