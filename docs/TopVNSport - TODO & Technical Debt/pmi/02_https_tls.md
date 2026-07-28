# TODO: HTTPS/TLS Production

## Mức độ: HIGH
## Estimated Effort: Medium (2-4 hours)

## Audit 2026-07-28

❌ **Open.** Gateway chỉ expose port 80, port 443 đang comment. Chưa có TLS server block.

---

## Mô Tả Vấn Đề

### Current State

**gateway/docker-compose.prod.yml:15-18:**
```yaml
ports:
  - "80:80"
  # - "443:443"  # Uncomment khi có SSL cert
```

**gateway/nginx/conf.d/locations.prod.conf:**
- Không có `ssl_certificate` directive
- Không có HTTPS redirect
- Không có HSTS header

### Impact

- Traffic không encrypted
- Credentials (JWT, passwords) có thể bị intercept
- Không đạt security compliance

---

## Giải pháp

### Option A: Let's Encrypt + Certbot

```yaml
# docker-compose.prod.yml
services:
  gateway:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    command: certonly --webroot -w /var/www/certbot --email admin@topvnsport.vn -d topvnsport.vn -d api.topvnsport.vn --agree-tos
```

### Option B: AWS ACM + ALB

Nếu đã có ALB trước EC2, dùng AWS Certificate Manager (free, auto-renew).

---

## Implementation Steps

1. **Uncomment port 443** trong gateway/docker-compose.prod.yml

2. **Add TLS server block:**
```nginx
server {
    listen 443 ssl http2;
    server_name topvnsport.vn api.topvnsport.vn;
    
    ssl_certificate /etc/letsencrypt/live/topvnsport.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/topvnsport.vn/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # ... existing location blocks
}
```

3. **Add HTTP→HTTPS redirect:**
```nginx
server {
    listen 80;
    server_name topvnsport.vn api.topvnsport.vn;
    return 301 https://$host$request_uri;
}
```

4. **Setup cert renewal cron:**
```bash
0 12 * * * /usr/bin/docker compose -f /path/to/gateway/docker-compose.prod.yml run --rm certbot renew
```

---

## Verification

```bash
# Check redirect
curl -I http://topvnsport.vn
# Expected: 301 → https://

# Check HTTPS
curl -I https://topvnsport.vn
# Expected: 200 + Strict-Transport-Security header

# Check cert
openssl s_client -connect topvnsport.vn:443 -servername topvnsport.vn < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

---

## References

- Task: PMI-014
- Related: architecture/02_api_gateway.md
