# TODO: Security - Hardcoded Secrets

## Mức độ: CRITICAL
## Estimated Effort: Medium (2-4 hours)

---

## Mô Tả Vấn Đề

Secrets (passwords, API keys, JWT secrets) đang được hardcode trực tiếp trong docker-compose files và có thể bị leak qua git history.

### Vị trí cụ thể:

**PMI/docker-compose.prod.yml (lines 46-55):**
```yaml
POSTGRES_PASSWORD=postgres
JWT_SECRET_KEY=prod_secret_jwt_key_pmi_2026_must_change
MINIO_ROOT_PASSWORD=minioadmin
```

**OMS/docker-compose.yml (line 32):**
```yaml
FERNET_KEY=<hardcoded value>
```

**WMS/docker-compose.yml:**
- Tương tự pattern với hardcoded database passwords

---

## Impact

- **Security Risk:** Bất kỳ ai có access vào repo đều thấy production credentials
- **Compliance:** Vi phạm security best practices, có thể fail security audits
- **Git History:** Secrets đã commit vào git history, cần rotate sau khi fix

---

## Steps to Implement

### Step 1: Tạo .env.prod files (không commit)

```bash
# PMI/.env.prod
POSTGRES_PASSWORD=<generate-strong-password>
JWT_SECRET_KEY=<generate-256-bit-key>
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=<generate-strong-password>
API_KEY=<generate-api-key>
```

### Step 2: Update docker-compose.prod.yml

```yaml
# Thay hardcoded values bằng env_file
services:
  db:
    env_file:
      - .env.prod
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-pmi}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-pmi}
```

### Step 3: Tạo .env.prod.example với placeholder values

```bash
# PMI/.env.prod.example (commit file này)
POSTGRES_PASSWORD=change_me_in_production
JWT_SECRET_KEY=change_me_use_openssl_rand
MINIO_ROOT_PASSWORD=change_me_in_production
```

### Step 4: Update .gitignore

```gitignore
# Secrets
.env.prod
.env.local
*.secrets
```

### Step 5: Generate new secrets và rotate

```bash
# Generate strong passwords
openssl rand -base64 32  # For passwords
openssl rand -hex 32     # For JWT secret key
```

### Step 6: Update production deployment

Đảm bảo `.env.prod` được copy lên server riêng (không qua git):
```bash
# deploy_prod.sh - thêm step
scp .env.prod $EC2_HOST:/path/to/app/
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `PMI/docker-compose.prod.yml` | Remove hardcoded secrets, use env_file |
| `OMS/docker-compose.yml` | Remove hardcoded FERNET_KEY |
| `OMS/docker-compose.prod.yml` | Remove hardcoded secrets |
| `WMS/docker-compose.yml` | Remove hardcoded secrets |
| `WMS/docker-compose.prod.yml` | Remove hardcoded secrets |
| `.gitignore` | Add .env.prod patterns |
| `deploy_prod.sh` | Add secure env file deployment |

---

## Verification

1. `grep -r "POSTGRES_PASSWORD=" */docker-compose*.yml` - should return empty or only variable references
2. `grep -r "JWT_SECRET" */docker-compose*.yml` - should return empty or only variable references
3. `docker compose -f PMI/docker-compose.prod.yml config` - verify env substitution works
4. Test deployment: services start correctly with new env files

---

## Notes

- Sau khi fix, cần rotate TẤT CẢ secrets trong production vì chúng đã bị exposed trong git history
- Cân nhắc sử dụng Docker Secrets cho production (more secure than env files)
- Cân nhắc HashiCorp Vault cho enterprise-grade secret management
