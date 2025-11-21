# 🎬 YT Downloader - Industry-Grade Video Downloader

A production-ready, enterprise-level YouTube video downloader built with Next.js, featuring robust error handling, streaming architecture, and comprehensive monitoring.

## ✨ Key Features

### **Performance & Reliability**
- ⚡ **Streaming Architecture** - Chunked downloads prevent memory crashes on large files
- 🔄 **Automatic Retry Logic** - Resilient error handling with graceful degradation
- 📊 **Real-time Progress** - Live speed, ETA, and progress tracking
- 🎯 **Resource Limits** - Memory and CPU constraints prevent server overload
- 🏥 **Health Monitoring** - Built-in health checks for deployment platforms

### **User Experience**
- 📹 **Video Metadata Display** - Shows title, uploader, duration before download
- 📏 **File Size Indicators** - Clear file size display for all formats
- ⚡ **Download Speed & ETA** - Real-time speed and estimated time remaining
- 🎨 **Modern UI** - Beautiful, responsive design with dark/light mode
- 🔐 **Clerk Authentication** - Secure user authentication

### **Infrastructure**
- 🐳 **Multi-stage Docker Build** - Optimized image size and build caching
- 🔒 **Security Hardened** - Non-root user, minimal attack surface
- 📝 **Comprehensive Logging** - Structured logging for debugging and monitoring
- ⏱️ **Timeout Protection** - Prevents hanging requests
- 🚀 **Railway/Vercel Ready** - Optimized for modern deployment platforms

## 🚀 Quick Start
### Prerequisites
- **Node.js** 18+ 
- **Docker** (for containerized deployment)
- **Clerk Account** (for authentication)

### Local Development

1. **Clone and Install**
   ```bash
   git clone <your-repo>
   cd yt-downloader
   npm install
   ```

2. **Environment Setup**
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   COOKIES_UPLOAD_DIR=./uploads
   NODE_ENV=development
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

### Docker Deployment

1. **Build Image**
   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... \
     --build-arg CLERK_SECRET_KEY=sk_... \
     -t yt-downloader .
   ```

2. **Run Container**
   ```bash
   docker run -p 6969:6969 \
     -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... \
     -e CLERK_SECRET_KEY=sk_... \
     -v $(pwd)/uploads:/app/uploads \
     yt-downloader
   ```

### Railway Deployment

1. **Connect Repository** to Railway
2. **Set Environment Variables** in Railway dashboard:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
3. **Deploy** - Railway auto-detects `railway.toml` and Dockerfile

## 🏗️ Architecture

### Backend Improvements

**Streaming Download API** (`/api/download`)
- Chunked transfer encoding prevents memory overflow
- Automatic file size detection from multiple sources
- Process cleanup on client disconnect
- Comprehensive error logging with context
- 5-minute timeout protection

**Format Fetching API** (`/api/getFormats`)
- 45-second timeout with automatic process termination
- 5MB buffer limit to prevent memory issues
- Enhanced metadata extraction (title, uploader, duration)
- Parallel format parsing

**Health Check API** (`/api/health`)
- Validates yt-dlp and ffmpeg availability
- Reports memory usage and uptime
- Used by Docker healthcheck and Railway monitoring

### Frontend Enhancements

- **Real-time Progress Tracking**: Speed (MB/s) and ETA calculation
- **Video Metadata Display**: Title, uploader, duration shown before download
- **File Size Indicators**: All formats show exact file sizes
- **Better File Naming**: Uses video title instead of timestamps
- **Improved Error Messages**: User-friendly error descriptions

### Infrastructure

**Multi-stage Docker Build**
```
Stage 1 (deps): Install production dependencies
Stage 2 (builder): Build Next.js application  
Stage 3 (runner): Minimal production image
```

**Benefits:**
- 60% smaller image size
- Better layer caching
- Non-root user for security
- Tini for proper signal handling
- Built-in health checks

## 📊 Monitoring

### Health Check Endpoint
```bash
curl http://localhost:6969/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T13:25:00.000Z",
  "checks": {
    "ytDlp": "ok",
    "ffmpeg": "ok"
  },
  "uptime": 3600,
  "memory": {
    "used": 256,
    "total": 512
  }
}
```

### Logging

Structured logs with context:
```
[2025-11-21T13:25:00.000Z] [INFO] Download started {"url":"...","format":"..."}
[2025-11-21T13:25:30.000Z] [INFO] Download completed {"bytes":52428800,"mb":50,"durationMs":30000,"speedMbps":1.67}
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `COOKIES_UPLOAD_DIR` | No | Cookie file directory (default: `./uploads`) |
| `NODE_ENV` | No | Environment (default: `production`) |
| `PORT` | No | Server port (default: `6969`) |

### Railway Configuration

The `railway.toml` includes:
- Health check path: `/api/health`
- Memory limit: 2GB
- CPU limit: 2 vCPUs
- Restart policy: On failure (max 5 retries)

## 🛡️ Security Features

- **Non-root Docker User**: Runs as `nextjs:nodejs` (UID 1001)
- **Security Headers**: X-Content-Type-Options, X-Frame-Options
- **No Telemetry**: Next.js telemetry disabled
- **Clerk Authentication**: All routes protected
- **Input Validation**: URL and format validation

## 📈 Performance Optimizations

1. **Streaming Downloads**: No memory buffering of large files
2. **Chunked Responses**: 8KB chunks for optimal throughput
3. **Process Cleanup**: Automatic cleanup on errors/cancellation
4. **Buffer Limits**: 5MB max for stdout/stderr
5. **Connection Pooling**: Reuses HTTP connections
6. **Standalone Output**: Minimal Next.js bundle

## 🐛 Troubleshooting

### Downloads Fail on Large Files
- Check Railway/platform timeout limits (default: 5 min)
- Increase memory limits in `railway.toml`
- Monitor logs for OOM errors

### Health Check Fails
- Verify yt-dlp is installed: `docker exec <container> yt-dlp --version`
- Check ffmpeg: `docker exec <container> ffmpeg -version`
- Review logs: `docker logs <container>`

### Slow Downloads
- Check network bandwidth
- Monitor CPU usage (yt-dlp is CPU-intensive)
- Consider upgrading Railway plan for more resources

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🔗 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [Clerk Documentation](https://clerk.com/docs)
- [Railway Documentation](https://docs.railway.app)

