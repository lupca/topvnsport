# E2E Test Infra: Audit Log & Identity System

## Test Philosophy
- Requirement-driven testing verifying system functionality from an external perspective.
- Verifying authentication boundaries, Outbox pattern transactional guarantees, semantic diffing accuracy, and background worker concurrency safety.
- Test suites must be fully automated using pytest for Backend and Playwright/Vitest for Frontend.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) |
|---|---------|---------------------|:-----------------:|:-----------------:|
| F1 | User Authentication | ORIGINAL_REQUEST §R1 | 5 test cases | 5 test cases |
| F2 | Service Authentication | ORIGINAL_REQUEST §R1 | 5 test cases | 5 test cases |
| F3 | Identity Contextvars | ORIGINAL_REQUEST §R1 | 5 test cases | 5 test cases |
| F4 | Database Schema & Masking | ORIGINAL_REQUEST §R2 | 5 test cases | 5 test cases |
| F5 | Service Semantic Diffing | ORIGINAL_REQUEST §R3 | 5 test cases | 5 test cases |
| F6 | Action-Level Logging | ORIGINAL_REQUEST §R4 | 5 test cases | 5 test cases |
| F7 | Background Worker | ORIGINAL_REQUEST §R5 | 5 test cases | 5 test cases |
| F8 | Frontend Admin UI | ORIGINAL_REQUEST §R6 | 5 test cases | 5 test cases |

## Test Case Layout
The test cases will be distributed into 4 tiers:

### Tier 1 - Feature Coverage
Happy path tests checking each feature in isolation:
- JWT Login endpoint generates a valid token.
- Protected API returns 200 with valid JWT, 401 with invalid JWT.
- API Key authentication allows access to protected endpoints.
- Database records are stored with masked values for sensitive keys (`password`, `access_token`, etc.).
- Update product produces a log in `audit_outbox` showing the old and new states.
- Read-only actions (e.g. Export) record action log entries in `audit_outbox`.
- Background worker correctly moves processing outbox items to `audit_logs` table.
- Frontend displays audit logs page for user with `ADMIN` role.

### Tier 2 - Boundary & Corner Cases
Checking edge cases:
- Empty inputs for JWT authentication.
- Invalid token format, expired JWT tokens.
- Invalid API Key format and unauthorized keys.
- Masking logic handling nested dicts, list of dicts, or empty payloads.
- Background worker retry logic under simulated DB insertion failure (max attempts, status updates, exponential backoff/intervals).
- Concurrent requests with empty/missing context.
- Frontend role guarding (accessing settings/audit with `STAFF` role returns unauthorized/redirects).

### Tier 3 - Cross-Feature Combinations
Testing feature interactions:
- Transactional Outbox rollback: If product update fails mid-transaction, both product changes and audit log records must be rolled back.
- End-to-end flow: User authenticates -> performs action -> Outbox logs populated -> worker processes -> logs visible in Admin UI via paginated endpoint.
- Simultaneous user actions and service actions do not cross-contaminate contextvars.

### Tier 4 - Real-World Application Scenarios
- End-to-end multi-step workflow simulating typical admin session:
  - Admin login -> checks dashboard.
  - Admin changes product details (triggering semantic diff) -> worker moves log.
  - Admin views Audit log, filters by category/module/keyword, verifies diff is correctly rendered.
  - External service calls API with API Key to sync product stock -> verified in Outbox and Logs.

## Test Directory Structure
- `backend/tests/test_auth.py`: Tests for JWT & API Key authentication, contextvars.
- `backend/tests/test_audit.py`: Tests for outbox DB schema, masking utility, decorator, and service diffing.
- `backend/tests/test_worker.py`: Concurrency and retry tests for the background worker.
- `frontend/src/__tests__/audit_ui.test.tsx`: Unit tests for the audit page and DataTable pagination.
- `frontend/tests/audit_e2e.spec.ts`: Playwright E2E tests for auth, sidebar visibility, and page interaction.
