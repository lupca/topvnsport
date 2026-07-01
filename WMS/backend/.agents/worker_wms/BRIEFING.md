# BRIEFING — 2026-06-29T14:14:55Z

## Mission
Modify PMI backend (R1) and WMS backend database & endpoints (R3), verify with tests, and write handoff.

## 🔒 My Identity
- Archetype: Implementer
- Roles: implementer, qa, specialist
- Working directory: /home/lupca/projects/WMS/backend/.agents/worker_wms
- Original parent: c8ac75ac-e5e3-490b-a5e7-81470e242214
- Milestone: Implementation

## 🔒 Key Constraints
- CODE_ONLY network mode
- Write handoff to /home/lupca/projects/WMS/backend/.agents/worker_wms/handoff.md
- Genuine implementation, no cheating/hardcoding

## Current Parent
- Conversation ID: c8ac75ac-e5e3-490b-a5e7-81470e242214
- Updated: not yet

## Task Summary
- **What to build**:
  - PMI R1: Add `category` to `ProductBySkuResponse` in PMI backend `schemas.py` and `main.py`.
  - WMS R3:
    - Implement `StockTransaction` model. Any stock change (inbound, outbound, reserve, unreserve, adjust, transfer) MUST write to this ledger.
    - Add `qty_available` computed field on Inventory.
    - Add `created_at` field to `Warehouse`.
    - Make `PickListItem.location_id` nullable.
    - Fix `status.HTTP_444_NOT_FOUND` typo to standard `HTTP_404_NOT_FOUND` in WMS backend.
    - Correct cancel endpoint to `/fulfillment-orders/{id}/cancel`.
    - Seed standard locations and multiple positions.
    - Implement Locations API, Barcode Mapping API, Inventory API, Inbound API, Fulfillment API, product sync API, and stock transaction logs fetch.
    - In WMS Dockerfile, remove `--reload`.
    - Ensure CORS middleware is present.
- **Success criteria**: All code changes successfully compile, run, and pass local tests.
- **Interface contracts**: backend code files.
- **Code layout**: /home/lupca/projects/PMI/backend, /home/lupca/projects/WMS/backend.

## Change Tracker
- **Files modified**: [None]
- **Build status**: [TBD]
- **Pending issues**: [TBD]

## Quality Status
- **Build/test result**: [TBD]
- **Lint status**: [TBD]
- **Tests added/modified**: [TBD]

## Loaded Skills
[None]

## Key Decisions Made
- [TBD]

## Artifact Index
- /home/lupca/projects/WMS/backend/.agents/worker_wms/original_prompt.md — Original prompt
