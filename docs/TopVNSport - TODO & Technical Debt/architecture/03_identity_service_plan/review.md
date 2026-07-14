# Teamwork Project Prompt — Review

## Original Draft Issues

### 1. Thiếu thứ tự Phase dependencies
Plan có 5 phases với dependencies rõ ràng (Phase 1 → 2 → 3 → 4). Prompt không mention, agents có thể làm song song sai thứ tự.

### 2. R3 thiếu security requirement quan trọng
Header spoofing prevention là critical nhưng không được mention.

### 3. R4 thiếu chi tiết service-to-service
OMS/WMS gọi PMI qua X-API-Key phải giữ nguyên, không bị break.

### 4. Thiếu R5: Migration & Deployment
Không có migration script, Docker Compose, seed data.

### 5. Acceptance Criteria thiếu items
Không verify migration, service-to-service calls, health checks.

---

## Revised Prompt

```markdown
# Teamwork Project Prompt — Identity Service SSO

**Status:** Ready for delegation  
**Goal:** Build centralized SSO Identity Service for staff on PMI, OMS, and WMS

**Working directory:** /home/lupca/projects/topvnsport  
**Integrity mode:** development

## Reference Materials

- Architecture Plan: `/docs/TopVNSport - TODO & Technical Debt/architecture/03_identity_service_plan/00_overview.md`
- Sub-documents in the same directory (01 through 07)

## Requirements

### R1. Identity Service Backend
FastAPI backend with PostgreSQL:
- Auth endpoints: login, verify, refresh, logout
- CRUD for staff accounts and roles
- Seed data for default roles (admin, pmi_staff, oms_staff, wms_staff, viewer)
- Default admin account

### R2. Identity Management Frontend
Next.js frontend:
- Login page with redirect support
- Staff management UI (list, create, edit, deactivate)
- Role management UI with permission selector
- JWT token handling with refresh token flow

### R3. API Gateway
Nginx with auth_request to Identity Service:
- Protect /api/pmi/, /api/oms/, /api/wms/ routes
- **MUST strip client X-User-* headers** before injecting from /auth/verify response
- Allow /auth/* without authentication
- Allow /internal/* for service-to-service calls (X-API-Key auth, no auth_request)

### R4. System Integration
**Backends (PMI, OMS, WMS):**
- Update `get_current_identity()` to read X-User-* headers from Nginx
- Keep X-API-Key authentication for service-to-service calls (OMS→PMI, WMS→OMS)

**Frontends (PMI, OMS, WMS):**
- Redirect login to Identity Service
- Attach Bearer token via apiClient
- Handle 401 with token refresh, then redirect to login

### R5. Migration & Deployment
- User migration script (PMI users → Identity Service)
- Docker Compose configuration with correct networks
- Seed data script for default roles and admin account
- Health check script for all services

## Execution Order

```
Phase 1 (R1: Backend) 
    ↓
Phase 2 (R2: Frontend) 
    ↓
Phase 3 (R3: Gateway) 
    ↓
Phase 4 (R4: Integration) 
    ↓
Phase 5 (R5 + Testing)
```

## Verification Resources

Full testing strategy: `/docs/TopVNSport - TODO & Technical Debt/architecture/03_identity_service_plan/06_test_specifications.md`

## Acceptance Criteria

### Backend & API Gateway
- [ ] Pytest suite passes (>90% coverage on auth, staff, roles modules)
- [ ] /auth/verify returns correct X-User-* headers
- [ ] Nginx injects headers from verify response only (client headers stripped)
- [ ] /internal/* allows X-API-Key authentication without auth_request

### Frontend & Integration
- [ ] Vitest suite passes
- [ ] Playwright E2E: login flow works
- [ ] Playwright E2E: cross-system SSO works (login once, access PMI/OMS/WMS)
- [ ] Token refresh works on 401

### Migration & Deployment
- [ ] All PMI users migrated to Identity Service
- [ ] Existing service-to-service calls (OMS→PMI with X-API-Key) still work
- [ ] Health check script passes for all services
- [ ] Default roles and admin account seeded
```

---

## Key Differences from Original

| Aspect | Original | Revised |
|--------|----------|---------|
| Phase order | Not mentioned | Explicit execution order |
| Security | Missing | Header spoofing prevention required |
| Service-to-service | Missing | X-API-Key must keep working |
| Migration | Missing | R5 added with migration script |
| Seed data | Missing | Default roles + admin account |
| Acceptance criteria | 4 items | 11 items with specific checks |
