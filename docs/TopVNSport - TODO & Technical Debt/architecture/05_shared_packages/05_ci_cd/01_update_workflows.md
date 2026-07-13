# CI/CD: Update GitHub Actions Workflows

## Task ID: CI-01
## Prerequisites: All migrations complete (MIG-01 to MIG-04)
## Estimated: 2 hours

---

## Mục Tiêu

Update CI/CD workflows để:
- Build và test shared packages trước
- Cache packages giữa jobs
- Update Docker builds

---

## Implementation

### 1. New Workflow: Package Tests

**File:** `.github/workflows/test-packages.yml`

```yaml
name: Test Shared Packages

on:
  push:
    paths:
      - 'packages/**'
      - '.github/workflows/test-packages.yml'
  pull_request:
    paths:
      - 'packages/**'

jobs:
  test-backend-package:
    name: Backend Package Tests
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: 'packages/backend-common/pyproject.toml'
      
      - name: Install backend package
        run: |
          cd packages/backend-common
          pip install -e ".[dev]"
      
      - name: Run backend package tests
        run: |
          cd packages/backend-common
          pytest tests/ -v --cov=topvnsport_common --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: packages/backend-common/coverage.xml
          flags: backend-common

  test-frontend-package:
    name: Frontend Package Tests
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: |
          cd packages/ui-kit
          pnpm install
      
      - name: Run typecheck
        run: |
          cd packages/ui-kit
          pnpm typecheck
      
      - name: Run tests
        run: |
          cd packages/ui-kit
          pnpm test:coverage
      
      - name: Build package
        run: |
          cd packages/ui-kit
          pnpm build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: packages/ui-kit/coverage/coverage-final.json
          flags: ui-kit
```

### 2. Update Main Test Workflow

**File:** `.github/workflows/test.yml` (update)

```yaml
name: Test Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Build packages first
  build-packages:
    name: Build Shared Packages
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      # Build frontend package
      - name: Build ui-kit
        run: |
          cd packages/ui-kit
          pnpm install
          pnpm build
      
      # Build backend package
      - name: Install backend-common
        run: |
          cd packages/backend-common
          pip install -e .
      
      # Cache for other jobs
      - name: Cache packages
        uses: actions/cache@v4
        with:
          path: |
            packages/ui-kit/dist
            packages/backend-common
          key: packages-${{ github.sha }}

  test-pmi-backend:
    name: PMI Backend Tests
    runs-on: ubuntu-latest
    needs: build-packages
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Restore packages cache
        uses: actions/cache@v4
        with:
          path: |
            packages/ui-kit/dist
            packages/backend-common
          key: packages-${{ github.sha }}
      
      - name: Install dependencies
        run: |
          pip install -e packages/backend-common
          pip install -r PMI/backend/requirements.txt
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      
      - name: Run tests
        run: |
          cd PMI/backend
          pytest tests/ -v
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          JWT_SECRET_KEY: test-secret-key

  test-pmi-frontend:
    name: PMI Frontend Tests
    runs-on: ubuntu-latest
    needs: build-packages
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Restore packages cache
        uses: actions/cache@v4
        with:
          path: |
            packages/ui-kit/dist
            packages/backend-common
          key: packages-${{ github.sha }}
      
      - name: Install dependencies
        run: |
          cd PMI/frontend
          pnpm install
      
      - name: Run tests
        run: |
          cd PMI/frontend
          pnpm test

  # Similar jobs for OMS and WMS...
```

### 3. Update Docker Build Workflow

**File:** `.github/workflows/cicd.yml` (update)

```yaml
name: CI/CD

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      # Build all Docker images with shared packages
      - name: Build PMI
        run: |
          docker compose -f PMI/docker-compose.yml build
        env:
          DOCKER_BUILDKIT: 1
      
      - name: Build OMS
        run: |
          docker compose -f OMS/docker-compose.yml build
      
      - name: Build WMS
        run: |
          docker compose -f WMS/docker-compose.yml build
      
      # Deploy...
```

### 4. Update docker-compose files for monorepo context

```yaml
# PMI/docker-compose.yml

services:
  api:
    build:
      context: ..  # Root for packages access
      dockerfile: PMI/backend/Dockerfile
    # ...

  frontend:
    build:
      context: ..  # Root for packages access
      dockerfile: PMI/frontend/Dockerfile
```

---

## Test Cases

### Workflow Tests

```yaml
# .github/workflows/test-workflows.yml

name: Test Workflows

on:
  pull_request:
    paths:
      - '.github/workflows/**'

jobs:
  validate-workflows:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate workflow syntax
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const yaml = require('js-yaml');
            
            const workflows = fs.readdirSync('.github/workflows');
            for (const file of workflows) {
              try {
                yaml.load(fs.readFileSync(`.github/workflows/${file}`, 'utf8'));
                console.log(`✓ ${file} is valid`);
              } catch (e) {
                core.setFailed(`${file} is invalid: ${e.message}`);
              }
            }
```

### Package Build Test

```bash
#!/bin/bash
# tests/ci/test_package_build.sh

set -e

echo "=== Test: CI Package Build ==="

# Test 1: Backend package builds
echo "Test 1: Backend package installs"
cd packages/backend-common
pip install -e . && echo "PASS" || (echo "FAIL" && exit 1)
cd ../..

# Test 2: Frontend package builds
echo "Test 2: Frontend package builds"
cd packages/ui-kit
pnpm install
pnpm build && echo "PASS" || (echo "FAIL" && exit 1)
cd ../..

# Test 3: PMI backend can use packages
echo "Test 3: PMI backend imports"
cd PMI/backend
pip install -r requirements.txt
python -c "from topvnsport_common import paginate" && echo "PASS" || (echo "FAIL" && exit 1)
cd ../..

# Test 4: PMI frontend can use packages
echo "Test 4: PMI frontend imports"
cd PMI/frontend
pnpm install
node -e "require('@topvnsport/ui-kit')" && echo "PASS" || (echo "FAIL" && exit 1)
cd ../..

echo "=== All CI tests passed ==="
```

### Docker Build Test

```bash
#!/bin/bash
# tests/ci/test_docker_build.sh

set -e

echo "=== Test: Docker Build with Packages ==="

# Test 1: PMI Docker builds
echo "Test 1: PMI Docker build"
docker compose -f PMI/docker-compose.yml build --no-cache
docker compose -f PMI/docker-compose.yml run --rm api \
  python -c "from topvnsport_common import paginate; print('PASS')"

# Test 2: OMS Docker builds
echo "Test 2: OMS Docker build"
docker compose -f OMS/docker-compose.yml build --no-cache

# Test 3: WMS Docker builds
echo "Test 3: WMS Docker build"
docker compose -f WMS/docker-compose.yml build --no-cache

echo "=== All Docker builds passed ==="
```

---

## Verification

```bash
# Run workflow tests locally
chmod +x tests/ci/test_package_build.sh
./tests/ci/test_package_build.sh

chmod +x tests/ci/test_docker_build.sh
./tests/ci/test_docker_build.sh

# Test workflow with act (optional)
act -j build-packages
```

---

## Checklist

- [ ] test-packages.yml created
- [ ] test.yml updated with build-packages job
- [ ] Package caching between jobs
- [ ] PMI tests wait for package build
- [ ] OMS tests wait for package build
- [ ] WMS tests wait for package build
- [ ] cicd.yml uses root context for Docker
- [ ] docker-compose files use root context
- [ ] All workflow tests pass
- [ ] All Docker builds succeed
