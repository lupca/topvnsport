# E2E Test Suite Ready — TopVNSport Promotion Module

The end-to-end (E2E) test suite for the **TopVNSport Promotion Module** has been fully designed, implemented, and syntactically verified. All 4 tiers of testing (Feature Coverage, Boundary Value Analysis, Cross-Feature Combinations, and Real-World Scenarios) covering Features F1 through F6 are complete and ready for execution against live or containerized backend services.

---

## 1. Test Runner Instructions

### 1.1 Service Stack Startup

Before executing the E2E test suite, ensure the required microservices stack (PMI, OMS, WMS, Identity, Gateway, Web Storefront) is running:

```bash
# Option A: Start all services via full stack script (Docker Compose)
./start_all.sh

# Option B: Start without rebuilding images (faster restart)
./start_all.sh --no-build

# Option C: Start PMI subsystem only (if testing PMI API & UI in isolation)
cd PMI && docker compose up -d
```

Default Service Endpoints:
- **PMI Backend API**: `http://localhost:18100` (or `http://localhost:8080/api/pmi`)
- **Web Storefront**: `http://localhost:3000`
- **PMI Admin UI**: `http://localhost:13100`

### 1.2 Environment & Dependencies Setup

Install test runner dependencies and browser drivers in your Python environment:

```bash
# Install Python test dependencies (pytest 9.1.1, httpx, pytest-asyncio, pytest-playwright)
pip install -r e2e_tests/requirements.txt

# Install Playwright browser binaries (Chromium)
python -m playwright install --with-deps chromium
```

Environment Variable Overrides (Optional):
```bash
export E2E_PMI_API_URL="http://localhost:18100"
export E2E_OMS_API_URL="http://localhost:18101"
export E2E_WMS_API_URL="http://localhost:18102"
export E2E_WEB_BASE_URL="http://localhost:3000"
```

### 1.3 Pytest Execution Commands

```bash
# 1. Run the entire Promotion E2E Test Suite
pytest e2e_tests/tests/test_promotion_full_flow.py -v

# 2. Run specific test tiers using keyword filtering
pytest e2e_tests/tests/test_promotion_full_flow.py -k "test_tier1" -v  # Tier 1 (Feature happy paths)
pytest e2e_tests/tests/test_promotion_full_flow.py -k "test_tier2" -v  # Tier 2 (Boundary & negative cases)
pytest e2e_tests/tests/test_promotion_full_flow.py -k "test_tier3" -v  # Tier 3 (Cross-feature interactions)
pytest e2e_tests/tests/test_promotion_full_flow.py -k "test_tier4" -v  # Tier 4 (Real-world scenarios)

# 3. Run specific feature tests (e.g., F1 Promotion Lifecycle, F4 Computed Prices & Intent)
pytest e2e_tests/tests/test_promotion_full_flow.py -k "_f1_" -v
pytest e2e_tests/tests/test_promotion_full_flow.py -k "_f4_" -v

# 4. Verify Python AST syntax compilation without running network requests
python3 -m py_compile e2e_tests/tests/test_promotion_full_flow.py
```

---

## 2. Coverage Summary

The E2E test suite implements a **4-Tier Coverage Model** strictly complying with and exceeding the infrastructure requirements set in `TEST_INFRA.md`.

| Tier Level | Tier Name | Test Count | Target Requirement | Description | Status |
|---|---|:---:|:---:|---|:---:|
| **Tier 1** | Feature Coverage | **35** | >= 34 | Validates core happy paths and primary business logic for CRUD operations, lifecycle state machine, target scope matching, price calculation, bulk endpoints, natural language intent parser, auto-scheduler, and UI rendering. | **READY** |
| **Tier 2** | Boundary & Corner Cases | **35** | >= 34 | Employs Boundary Value Analysis (BVA) testing edge conditions: 0% and 100% discounts, discount exceeding original price, max cap limits, invalid date ranges, duplicate promotion codes, empty scope arrays, and clock skew resilience. | **READY** |
| **Tier 3** | Cross-Feature Combinations | **7** | >= 6 | Evaluates complex interactions across multiple features: nested scopes with exclusion overrides, priority competition between percentage and fixed amount discounts, auto-scheduler synchronization to bulk APIs, intent parser to wizard activation, live storefront recalculation on pause, and concurrent transaction isolation. | **READY** |
| **Tier 4** | Real-World Scenarios | **5** | = 5 | End-to-end multi-step user workflows: (1) Black Friday promotion campaign lifecycle, (2) Flash sale auto-activation and auto-expiry, (3) AI intent prompt-to-activation workflow, (4) Complex multi-category exclusion rules, (5) High-concurrency bulk price calculation under heavy load. | **READY** |
| **TOTAL** | **Promotion E2E Suite** | **82** | **>= 79** | **Complete end-to-end coverage across all Promotion Module capabilities.** | **READY** |

---

## 3. Feature Checklist

The 82 test functions map directly to the 6 functional areas (F1 through F6) of the Promotion Module:

| Feature ID | Feature Name | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross) | Tier 4 (Scenario) | Total Tests | Status |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **F1** | Promotion CRUD & Lifecycle Management | 8 | 8 | 2 | 1 | **19** | **READY** |
| **F2** | Scope Targeting & Exclusion Logic | 6 | 6 | 2 | 1 | **15** | **READY** |
| **F3** | Price Calculation Engine & Priority Resolution | 7 | 7 | 1 | 1 | **16** | **READY** |
| **F4** | Bulk & Single Computed Price APIs & Intent Parser | 5 | 5 | 1 | 1 | **12** | **READY** |
| **F5** | Background Auto-Scheduler & Status Expiry | 4 | 4 | 1 | 1 | **10** | **READY** |
| **F6** | PMI Admin UI & Web Storefront Price Rendering | 5 | 5 | 0 | 0 | **10** | **READY** |
| **TOTAL** | **TopVNSport Promotion E2E Suite** | **35** | **35** | **7** | **5** | **82** | **READY** |

---

## 4. Artifacts Location Links

The primary specifications, test suites, and utility modules for the Promotion Module E2E testing track are located at the following project paths:

1. **Infrastructure Specification**:
   - File Path: `/home/lupca/projects/topvnsport/TEST_INFRA.md`
   - Relative Link: [`TEST_INFRA.md`](./TEST_INFRA.md)
   - Content: Full architecture design, Opaque-Box philosophy, 4-tier coverage plan, and quality gates.

2. **E2E Test Suite**:
   - File Path: `/home/lupca/projects/topvnsport/e2e_tests/tests/test_promotion_full_flow.py`
   - Relative Link: [`e2e_tests/tests/test_promotion_full_flow.py`](./e2e_tests/tests/test_promotion_full_flow.py)
   - Content: 82 executable test functions (`test_tier1_*`, `test_tier2_*`, `test_tier3_*`, `test_tier4_*`).

3. **API Helpers Module**:
   - File Path: `/home/lupca/projects/topvnsport/e2e_tests/utils/api_helpers.py`
   - Relative Link: [`e2e_tests/utils/api_helpers.py`](./e2e_tests/utils/api_helpers.py)
   - Content: `PMIApi` class providing 13 encapsulated REST API methods for promotion CRUD, status state machine, scope preview, natural language intent parsing, and computed prices.

4. **Shared Pytest Fixtures**:
   - File Path: `/home/lupca/projects/topvnsport/e2e_tests/conftest.py`
   - Relative Link: [`e2e_tests/conftest.py`](./e2e_tests/conftest.py)
   - Content: Pytest fixtures (`api_clients`, `pmi_api`, environment base URL resolvers).
