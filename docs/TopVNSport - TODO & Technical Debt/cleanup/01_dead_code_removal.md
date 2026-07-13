# CLEANUP: Dead Code Removal

## Mức độ: LOW
## Estimated Effort: Low (1-2 hours)

---

## Unused Files To Remove

### 1. Unused/Refactor Files

| File | Lines | Reason |
|------|-------|--------|
| `web/src/App.refactor.tsx` | 335 | Duplicate của App.tsx, không được import |
| `PMI/backend/refactor_script.py` | 165 | One-time migration script, đã hoàn thành |
| `OMS/verify_oms.py` | 123 | Standalone verification script, không dùng |
| `PMI/backend/tests/timing_test_benchmark.py` | 113 | One-time security benchmark |

**Total: ~736 lines**

### 2. Backup Files

| File | Lines |
|------|-------|
| `OMS/backend/schemas.py.bak` | 186 |
| `PMI/backend/schemas.py.bak` | 446 |

**Total: ~632 lines**

### 3. Commands to Remove

```bash
# Remove unused files
rm web/src/App.refactor.tsx
rm PMI/backend/refactor_script.py
rm OMS/verify_oms.py
rm PMI/backend/tests/timing_test_benchmark.py

# Remove backup files
rm OMS/backend/schemas.py.bak
rm PMI/backend/schemas.py.bak
```

---

## Unused NPM Dependencies

### web/package.json

```json
{
  "dependencies": {
    "@google/genai": "...",  // REMOVE - not imported anywhere
    "express": "...",         // REMOVE - no server.js exists
    "dotenv": "..."           // REMOVE - not imported in any .ts/.tsx
  },
  "devDependencies": {
    "@types/express": "..."   // REMOVE - express is unused
  }
}
```

### Command to Remove

```bash
cd web
npm uninstall @google/genai express dotenv @types/express
```

---

## Unused Environment Variables

### web/.env.example

```bash
# These are defined but never used:
GEMINI_API_KEY=...  # @google/genai not imported
APP_URL=...         # Not referenced in code
```

**Action:** Remove these lines from `.env.example`

---

## Redundant Code Patterns

### 1. Worker Re-export

**File:** `PMI/backend/services/worker.py`

```python
# Current - single line re-export
from services.audit_worker import process_outbox_batch, AuditWorker
```

**Issue:** Tests import từ `services.worker`, `main.py` import từ `services.audit_worker`. Không consistent.

**Fix:** Consolidate to use one import path:
```python
# In main.py and tests, always use:
from services.audit_worker import AuditWorker
```

Then remove `services/worker.py`

### 2. Test Data File Location

**File:** `web/src/data.ts`

**Current usage:** Only used in tests (`flow.test.ts`, `headerSearchLogic.test.ts`)

**Recommendation:** Move to `web/src/__tests__/fixtures/mockData.ts`

---

## Summary

| Category | Files | Lines |
|----------|-------|-------|
| Unused files | 4 | ~736 |
| Backup files | 2 | ~632 |
| NPM packages | 4 | - |
| Env variables | 2 | - |
| Redundant code | 1 file + 1 move | ~10 |

**Total dead code: ~1,368 lines + 4 npm packages**

---

## Verification After Cleanup

```bash
# Verify builds still work
cd PMI/backend && python -c "import main"
cd OMS/backend && python -c "import main"
cd WMS/backend && python -c "import main"

cd web && npm run build
cd PMI/frontend && npm run build
cd OMS/frontend && npm run build
cd WMS/frontend && npm run build

# Run tests
cd PMI/backend && pytest
cd web && npm test
```

---

## Git Commit Message

```
chore: remove dead code and unused dependencies

- Remove unused files: App.refactor.tsx, refactor_script.py, verify_oms.py, timing_test_benchmark.py
- Remove backup files: schemas.py.bak (OMS, PMI)
- Remove unused npm packages: @google/genai, express, dotenv
- Clean up unused env variables from .env.example

Total removed: ~1,368 lines of dead code
```
