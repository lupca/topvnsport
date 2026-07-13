# TODO: Security - HTTPS & Database Exposure

## Mức độ: CRITICAL
## Estimated Effort: Medium (3-5 hours)

---

## Mô Tả Vấn Đề

### 1. Database Ports Exposed to Host

Tất cả database instances đang bind ports ra host, cho phép direct external access:

**PMI/docker-compose.prod.yml:**
```yaml
db:
  ports:
    - "15433:5432"  # Accessible from outside!
```

**OMS/docker-compose.prod.yml:**
```yaml
db:
  ports:
    - "15434:5432"
```

**WMS/docker-compose.prod.yml:**
```yaml
db:
  ports:
    - "15435:5432"
```

### 2. No HTTPS/TLS

**nginx/conf.d/default.conf:**
```nginx
server {
    listen 80;  # Only HTTP, no HTTPS
    # Port 443 exposed but not configured
}
```

---

## Impact

- **Database Risk:** Attacker có thể brute-force database credentials từ internet
- **Data Interception:** HTTP traffic có thể bị sniff (passwords, tokens, customer data)
- **Compliance:** Vi phạm PCI-DSS, GDPR requirements cho e-commerce

---

## Steps to Implement

### Part 1: Remove Database Port Exposure

**Step 1:** Remove port bindings trong production compose files

```yaml
# PMI/docker-compose.prod.yml
services:
  db:
    # REMOVE this section entirely in production:
    # ports:
    #   - "15433:5432"
    
    # Keep only internal network access
    networks:
      - pmi_network
```

**Step 2:** Nếu cần database access cho debugging, sử dụng SSH tunnel:

```bash
# Access production DB via SSH tunnel
ssh -L 15433:localhost:5432 user@production-server
psql -h localhost -p 15433 -U pmi -d pmi
```

### Part 2: Add HTTPS/TLS

**Step 1:** Obtain SSL certificate (Let's Encrypt hoặc commercial)

```bash
# Using certbot
sudo certbot certonly --standalone -d yourdomain.com
```

**Step 2:** Update nginx configuration

```nginx
# nginx/conf.d/default.conf

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # ... existing location blocks ...
}
```

**Step 3:** Update docker-compose để mount certificates

```yaml
# nginx service in docker-compose
nginx:
  volumes:
    - ./nginx/conf.d:/etc/nginx/conf.d:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

**Step 4:** Setup auto-renewal

```bash
# Crontab entry
0 12 * * * /usr/bin/certbot renew --quiet && docker compose restart nginx
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `PMI/docker-compose.prod.yml` | Remove db ports section |
| `OMS/docker-compose.prod.yml` | Remove db ports section |
| `WMS/docker-compose.prod.yml` | Remove db ports section |
| `nginx/conf.d/default.conf` | Add HTTPS configuration |
| `docker-compose.yml` (root) | Mount SSL certificates |
| `deploy_prod.sh` | Add certbot setup steps |

---

## Verification

### Database Security
```bash
# From external machine, this should FAIL:
psql -h production-ip -p 15433 -U pmi -d pmi
# Connection refused or timeout = SUCCESS

# From inside container, this should WORK:
docker compose exec api psql -h db -U pmi -d pmi
```

### HTTPS
```bash
# Check SSL configuration
curl -I https://yourdomain.com
# Should return 200 with HSTS header

# HTTP should redirect
curl -I http://yourdomain.com
# Should return 301 redirect to HTTPS

# SSL Labs test
# Visit: https://www.ssllabs.com/ssltest/
# Should score A or A+
```

---

## Notes

- Development compose files có thể giữ port bindings cho local development
- Tạo separate `docker-compose.dev.yml` cho development với ports exposed
- Cân nhắc sử dụng Traefik thay Nginx cho automatic HTTPS với Let's Encrypt
