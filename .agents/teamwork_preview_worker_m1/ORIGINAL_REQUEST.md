## 2026-07-21T08:31:09Z
You are Worker M1 tasked with implementing Requirement R1: WMS Public API for Stock in topvnsport.
Your working directory is `/home/lupca/projects/topvnsport/.agents/teamwork_preview_worker_m1/`.

Instructions:
1. Read `/home/lupca/projects/topvnsport/PROJECT.md`, `/home/lupca/projects/topvnsport/.agents/orchestrator/plan.md`, and `/home/lupca/projects/topvnsport/.agents/teamwork_preview_explorer_init_1/analysis.md`.
2. Implement an unauthenticated public API endpoint `GET /public/stock` in `WMS/backend/routers/inventory.py` (or a public router mounted without `get_current_user` auth dependency in `WMS/backend/main.py`).
3. The endpoint must accept query parameter `sku_codes` (supporting single SKU or comma-separated list e.g. `?sku_codes=SKU1,SKU2` or list of query params).
4. Calculate `qty_available = SUM(qty_on_hand - qty_reserved)` for each requested SKU across all locations/warehouses in the WMS database. If a requested SKU is not in the database or has no inventory, return 0 as available stock.
5. Return JSON matching the contract in `PROJECT.md`, e.g., `{"stock": {"SKU1": 15, "SKU2": 0}}` or `{"items": [{"sku_code": "SKU1", "qty_available": 15}, ...]}`.
6. Run unit and integration tests for WMS backend (e.g. `pytest WMS/backend/test_main.py` or pytest inside docker compose/venv).
7. Record all modified files, test execution commands, and test output in `handoff.md` in your working directory.
