 Let's Encrypt trên EC2:

  # 1. Cài certbot
  sudo yum install -y certbot   # Amazon Linux
  # hoặc: sudo apt install -y certbot   # Ubuntu

  # 2. Dừng gateway tạm (để certbot dùng port 80)
  cd ~/topvnsport
  sudo docker compose -f gateway/docker-compose.prod.yml down

  # 3. Lấy cert (thay YOUR_EMAIL)
  sudo certbot certonly --standalone \
    -d api-pim.voma.vn \
    -d api-oms.voma.vn \
    -d api-wms.voma.vn \
    -d pim.voma.vn \
    -d oms.voma.vn \
    -d wms.voma.vn \
    -d identity.voma.vn \
    -d api-identity.voma.vn \
    -d media.voma.vn \
    --email YOUR_EMAIL \
    --agree-tos

  # 4. Start lại gateway
  sudo docker compose -f gateway/docker-compose.prod.yml up -d

  Yêu cầu:
  - DNS các subdomain phải trỏ về IP server trước khi chạy certbot
  - Port 80 phải mở (certbot verify qua HTTP)

  Auto-renew (cron):
  echo "0 3 * * * certbot renew --quiet && docker compose -f ~/topvnsport/gateway/docker-compose.prod.yml restart" | sudo tee /etc/cron.d/certbot-renew
