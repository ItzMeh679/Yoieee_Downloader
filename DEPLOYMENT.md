# 🚀 Deployment Guide

## Overview

This guide covers deploying the YT Downloader to production environments with industry-level reliability and performance.

## Pre-Deployment Checklist

- [ ] Clerk account created with production keys
- [ ] Environment variables configured
- [ ] Docker installed (for containerized deployments)
- [ ] Domain/subdomain configured (optional)
- [ ] SSL/TLS certificates ready (handled by Railway/Vercel)

## Railway Deployment (Recommended)

### Why Railway?
- ✅ Built-in health checks
- ✅ Automatic SSL certificates
- ✅ Easy scaling
- ✅ Persistent storage for uploads
- ✅ Real-time logs and metrics

### Steps

1. **Create Railway Project**
   ```bash
   # Install Railway CLI (optional)
   npm install -g @railway/cli
   railway login
   ```

2. **Connect Repository**
   - Go to [Railway Dashboard](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

3. **Configure Environment Variables**
   
   In Railway dashboard, add:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   ```

4. **Deploy**
   - Railway auto-detects `railway.toml` and `Dockerfile`
   - Build starts automatically
   - Health checks run at `/api/health`

5. **Monitor Deployment**
   - Check build logs in Railway dashboard
   - Verify health check passes
   - Test download functionality

### Railway Configuration

The `railway.toml` includes:
- **Memory**: 2GB (adjust based on usage)
- **CPU**: 2 vCPUs
- **Health Check**: `/api/health` every 30s
- **Restart Policy**: On failure, max 5 retries

### Scaling on Railway

To handle more concurrent downloads:

1. **Vertical Scaling** (increase resources)
   - Edit `railway.toml`:
     ```toml
     [[deploy.resourceLimits]]
     memory = 4096  # 4GB
     cpu = 4        # 4 vCPUs
     ```

2. **Horizontal Scaling** (multiple instances)
   - Railway Pro plan required
   - Enable in dashboard: Settings → Replicas

## Docker Deployment (VPS/Cloud)

### Build and Run

1. **Build Image**
   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
     --build-arg CLERK_SECRET_KEY=sk_live_... \
     -t yt-downloader:latest .
   ```

2. **Run Container**
   ```bash
   docker run -d \
     --name yt-downloader \
     --restart unless-stopped \
     -p 6969:6969 \
     -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
     -e CLERK_SECRET_KEY=sk_live_... \
     -v /path/to/uploads:/app/uploads \
     --memory="2g" \
     --cpus="2" \
     yt-downloader:latest
   ```

3. **Verify Health**
   ```bash
   curl http://localhost:6969/api/health
   ```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  yt-downloader:
    build:
      context: .
      args:
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
    ports:
      - "6969:6969"
    environment:
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - NODE_ENV=production
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2'
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:6969/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Run:
```bash
docker-compose up -d
```

## Nginx Reverse Proxy

For production deployments behind Nginx:

```nginx
upstream yt_downloader {
    server localhost:6969;
    keepalive 64;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase timeouts for large downloads
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    # Increase buffer sizes
    proxy_buffering off;
    proxy_request_buffering off;
    client_max_body_size 10M;

    location / {
        proxy_pass http://yt_downloader;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://yt_downloader;
        access_log off;
    }
}
```

## Monitoring & Maintenance

### Health Monitoring

Set up automated health checks:

```bash
# Cron job to check health every 5 minutes
*/5 * * * * curl -f http://localhost:6969/api/health || systemctl restart yt-downloader
```

### Log Monitoring

View logs:
```bash
# Docker
docker logs -f yt-downloader

# Railway
railway logs

# Docker Compose
docker-compose logs -f
```

### Metrics to Monitor

1. **Memory Usage**
   - Alert if > 80% of allocated memory
   - Check for memory leaks

2. **CPU Usage**
   - yt-dlp is CPU-intensive during downloads
   - Scale up if consistently > 70%

3. **Download Success Rate**
   - Monitor error logs
   - Track failed downloads

4. **Response Times**
   - Health check should respond < 1s
   - Format fetch should complete < 45s

### Backup Strategy

1. **Cookie Files**
   ```bash
   # Backup uploads directory
   tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
   ```

2. **Environment Variables**
   - Store securely in password manager
   - Document in team wiki

## Troubleshooting

### Build Failures

**Issue**: Docker build fails at npm install
```bash
# Solution: Clear build cache
docker build --no-cache -t yt-downloader .
```

**Issue**: Missing standalone output
```bash
# Solution: Verify next.config.js has output: 'standalone'
grep "output.*standalone" next.config.js
```

### Runtime Issues

**Issue**: Downloads timeout after 5 minutes
```bash
# Solution: Increase maxDuration in route.ts
# Edit src/app/api/download/route.ts
export const maxDuration = 600; // 10 minutes
```

**Issue**: Out of memory errors
```bash
# Solution: Increase memory limit
docker update --memory="4g" yt-downloader
```

**Issue**: Health check fails
```bash
# Debug: Check yt-dlp installation
docker exec yt-downloader yt-dlp --version

# Debug: Check ffmpeg
docker exec yt-downloader ffmpeg -version
```

### Performance Issues

**Issue**: Slow downloads
1. Check network bandwidth
2. Monitor CPU usage: `docker stats yt-downloader`
3. Verify yt-dlp is up to date:
   ```bash
   docker exec yt-downloader yt-dlp -U
   ```

**Issue**: High memory usage
1. Check for memory leaks in logs
2. Restart container: `docker restart yt-downloader`
3. Increase memory if needed

## Security Best Practices

1. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm update
   docker pull node:20-alpine
   ```

2. **Rotate Secrets**
   - Rotate Clerk keys every 90 days
   - Update environment variables

3. **Monitor Access Logs**
   - Review Clerk dashboard for suspicious activity
   - Set up alerts for failed auth attempts

4. **Firewall Configuration**
   ```bash
   # Only allow necessary ports
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

5. **Regular Backups**
   - Automated daily backups of uploads
   - Test restore procedures monthly

## Cost Optimization

### Railway
- **Starter Plan**: $5/month - Good for personal use
- **Pro Plan**: $20/month - Recommended for production
- **Monitor usage**: Check Railway dashboard for resource consumption

### VPS Alternatives
- **DigitalOcean**: $12/month (2GB RAM, 2 vCPUs)
- **Hetzner**: €4.5/month (4GB RAM, 2 vCPUs)
- **AWS Lightsail**: $10/month (2GB RAM, 1 vCPU)

### Optimization Tips
1. Use multi-stage Docker builds (already implemented)
2. Enable gzip compression (Next.js default)
3. Implement rate limiting for API endpoints
4. Cache video metadata when possible

## Support

For issues or questions:
1. Check logs first
2. Review troubleshooting section
3. Open GitHub issue with:
   - Error logs
   - Environment details
   - Steps to reproduce
