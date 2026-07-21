# Project: Audit Log & Identity System

## Architecture
The system consists of:
1. **Identity & Authentication**: JWT-based User Auth (Human) and API Key-based Service Auth (Service), with a request middleware tracking user identity, IP, and a Correlation ID using Python `contextvars`.
2. **Transactional Outbox**: Log entries are serialized and masked for PII/secrets, then written to `audit_outbox` in the same PostgreSQL transaction as the business operation.
3. **Service-Level Semantic Diff**: A snapshot mechanism at the Service layer diffs old and new states of entities (e.g., Products and variants) and constructs human-readable actions.
4. **Action-Level Logging**: A decorator `@audit_action` captures read-only or system events (like exporting/importing) safely without breaking transaction boundaries.
5. **Background Outbox Worker**: An async worker processes batches of outbox messages using `FOR UPDATE SKIP LOCKED` to safely move them to `audit_logs` without concurrency conflicts across multiple replicas.
6. **Frontend Admin UI**: An admin screen in Next.js showing audit history, with Server-Side Pagination and semantic diff rendering.

```
[Next.js Client] --(JWT / X-API-Key)--> [FastAPI App]
                                             |
                                    [Auth & Identity Middleware] -> Store contextvars
                                             |
                                    [Router / Service Layer]
                                    - Save business data
                                    - Create semantic diff
                                    - Write audit_outbox
                                             |
                                  +----------+----------+ (Transactional boundary)
                                  |                     |
                        [Business Tables]        [audit_outbox]
                                                        |
                                            (Background Worker: SKIP LOCKED)
                                                        |
                                                 [audit_logs]
```

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Test Suite & Infra Setup | Create E2E and integration test skeletons, define test runner configuration | None | DONE |
| M2 | Identity & Authentication | User Auth (JWT), Service Auth, and Identity Middleware with `contextvars` | M1 | DONE |
| M3 | Database Schema & Masking | Models `AuditOutbox` & `AuditLog`, migrations, sensitive data masking utility | M1 | DONE |
| M4 | Service Diffing & Action Logging | Product Service refactoring, semantic diff logic, `@audit_action` decorator | M2, M3 | DONE |
| M5 | Background Outbox Worker | Worker service processing batches via `FOR UPDATE SKIP LOCKED`, lifespan setup | M3 | DONE |
| M6 | Frontend UI & Admin API | `GET /api/audit-logs` endpoint (with role check), Next.js admin page with SSR pagination | M2, M5 | DONE |
| M7 | E2E Testing & Hardening | Final verification of test suites (Tiers 1-4) and white-box adversarial coverage (Tier 5) | M1-M6 | DONE |

## Interface Contracts
### 1. Identity Context
`contextvars` keys:
- `actor_username`: `str` (username or service name)
- `actor_type`: `str` (`USER` or `SERVICE`)
- `ip_address`: `str`
- `correlation_id`: `str` (UUIDv4)

### 2. Audit Outbox / Log JSON `changes` Schema
```json
{
  "before": {
    "field_name": "old_value"
  },
  "after": {
    "field_name": "new_value"
  }
}
```

### 3. Admin API Endpoint
`GET /api/audit-logs`
Query Parameters:
- `page`: `int` (default 1)
- `limit`: `int` (default 50)
- `module_filter`: `str` (optional)
- `actor_filter`: `str` (optional)
- `keyword`: `str` (optional)

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "correlation_id": "uuid",
      "actor_username": "string",
      "actor_type": "USER|SERVICE",
      "ip_address": "string",
      "method": "string",
      "path": "string",
      "source_service": "string",
      "module": "string",
      "action_type": "string",
      "entity_type": "string",
      "entity_id": "string",
      "changes": {},
      "raw_details": "string",
      "processed_at": "datetime"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 50
}
```

## Code Layout
### Backend
- `backend/models.py`: Model definitions for `User`, `AuditOutbox`, `AuditLog`.
- `backend/utils/auth.py`: Authentication helpers (JWT decoding, hashing).
- `backend/utils/context.py`: Contextvars utilities.
- `backend/utils/masking.py`: Masking policy implementation.
- `backend/utils/audit.py`: `@audit_action` decorator and `record_audit_event`.
- `backend/services/product_service.py`: Service logic for product aggregates and semantic diff.
- `backend/services/audit_worker.py`: Background worker logic.
- `backend/routers/auth.py`: Authentication routes.
- `backend/routers/audit.py`: Audit log API endpoints.
- `backend/routers/test.py`: Test and database reset endpoints.

### Frontend
- `frontend/src/app/settings/audit/page.tsx`: Audit log screen.
- `frontend/src/components/Sidebar.tsx`: Modified to include "Lịch sử hoạt động" for Admin role only.
