# Deploy the Afaan Oromo backend to an Oracle Cloud Always Free VM

This deploys the FastAPI backend to an Oracle Always Free instance (Ubuntu 22.04/24.04),
running under systemd behind nginx, with HTTPS via a domain (or plain HTTP via the VM IP).

## 0. Prerequisites
- An Oracle Cloud account with an Always Free VM (Ubuntu 22.04+), SSH access.
- A domain name (optional, for HTTPS). Without it, use `http://<VM_PUBLIC_IP>`.
- Your Supabase + Cloudflare R2 credentials ready.

## 1. Point DNS (only if using a domain)
Create an A record: `api.yourdomain.com` -> `<VM_PUBLIC_IP>`.

## 2. Open ports on the VM
- Oracle Cloud Console -> your instance -> Networking -> Security List -> add
  ingress rules for **TCP 80** and **TCP 443** (source 0.0.0.0/0).
- Also open them in the OS firewall (commands below).

## 3. SSH in and install packages
```bash
ssh ubuntu@<VM_PUBLIC_IP>
sudo apt update
sudo apt install -y python3-venv python3-pip nginx git
```

## 4. Get the code
```bash
sudo mkdir -p /opt/afan-oromo
sudo chown $USER:$USER /opt/afan-oromo
git clone <YOUR_REPO_URL> /opt/afan-oromo
# (or scp your local backend/ folder up)
```

## 5. Python virtualenv + dependencies
```bash
cd /opt/afan-oromo/backend
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

## 6. Configure environment
```bash
cp .env.example .env
nano .env
```
Fill in:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- (optional) `R2_PUBLIC_BASE_URL`

## 7. Install the systemd service
```bash
sudo cp /opt/afan-oromo/deploy/afan-api.service /etc/systemd/system/afan-api.service
# The file uses User/Group 'ubuntu' (the default Oracle Ubuntu user). If you
# created a different user, edit User=/Group= accordingly.
sudo nano /etc/systemd/system/afan-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now afan-api
sudo systemctl status afan-api
```
Logs: `journalctl -u afan-api -f`

## 8. Configure nginx
```bash
sudo cp /opt/afan-oromo/deploy/nginx-afan-api.conf /etc/nginx/sites-available/afan-api
sudo nano /etc/nginx/sites-available/afan-api   # set server_name
sudo ln -s /etc/nginx/sites-available/afan-api /etc/nginx/sites-enabled/afan-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## 10. HTTPS (only with a domain)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## 11. Verify
```bash
curl http://127.0.0.1:8000/api/health        # on the VM
curl https://api.yourdomain.com/api/health   # from anywhere
```
Expect `{"storage":true,"supabase":true}` (storage=true once R2 creds are set).

## 12. Point the mobile app at it
Set `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```
(or `http://<VM_PUBLIC_IP>` if no domain). Rebuild/restart the app.

## Updating later
```bash
cd /opt/afan-oromo && git pull
.venv/bin/pip install -r backend/requirements.txt
sudo systemctl restart afan-api
```

## Notes
- The free VM is small (1-2 vCPU, 1 GB RAM). `--workers 2` is fine; lower to 1 if memory is tight.
- Keep `.env` secret (chmod 600). Never commit it.
- CORS is currently `*`; tighten `allow_origins` in `app/main.py` for production.