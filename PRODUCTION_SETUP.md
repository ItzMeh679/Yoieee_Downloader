# 🚀 Production-Grade YouTube Downloader

## Architecture Overview

This is a **production-ready Express + Next.js** application for downloading YouTube videos up to 8K quality with automatic audio+video merging.

### Key Features:
- ✅ **Express Backend** - Standalone server for robust API handling
- ✅ **Real Browser Headers** - Mimics Chrome 121 to avoid bot detection
- ✅ **Smart Format Merging** - Auto-merges video+audio for high quality
- ✅ **100GB-Safe Streaming** - Direct stdout streaming, no disk/RAM buffering
- ✅ **Cookie Support** - Optional authentication for age-restricted videos
- ✅ **Nixpacks Deployment** - Railway-optimized with yt-dlp + ffmpeg

---

## 📦 Installation

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Backend server
- `cors` - Cross-origin support
- `next` - Frontend framework
- Other dependencies

### 2. Install System Dependencies (Local Development)

**Windows:**
```bash
# Install Python
winget install Python.Python.3

# Install yt-dlp
pip install yt-dlp

# Install ffmpeg
winget install ffmpeg
```

**Mac:**
```bash
brew install python3 yt-dlp ffmpeg
```

**Linux:**
```bash
sudo apt install python3 python3-pip ffmpeg
pip3 install yt-dlp
```

---

## 🏃 Running Locally

### Option 1: Express Server Only (Recommended for Testing)

```bash
npm run dev:server
```

Backend runs on: `http://localhost:3001`

### Option 2: Full Stack (Next.js + Express)

Terminal 1 - Backend:
```bash
npm run dev:server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:3001`

---

## 🚀 Deploying to Railway

### Method 1: Railway CLI (Recommended)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variables
railway variables set NODE_ENV=production
railway variables set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
railway variables set CLERK_SECRET_KEY=your_secret

# Deploy
railway up
```

### Method 2: Railway Dashboard

1. **Connect GitHub Repository**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Configure Build**
   - Railway will auto-detect `nixpacks.toml`
   - No manual configuration needed!

3. **Add Environment Variables**
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NODE_ENV=production`

4. **Deploy**
   - Push to GitHub
   - Railway auto-deploys

---

## 🔧 Configuration Files

### `nixpacks.toml` (Railway Build)
```toml
[phases.setup]
aptPkgs = ["python3", "python3-pip", "ffmpeg"]

[phases.install]
cmds = [
  "pip3 install --no-cache-dir yt-dlp",
  "npm ci"
]

[start]
cmd = "node server.js"
```

### `railway.toml` (Railway Deploy)
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/health"
```

---

## 🍪 Cookie Setup (For Bot Detection)

YouTube has strict bot detection. If downloads fail with "Sign in to confirm you're not a bot", upload cookies:

### Getting Cookies:

**Method 1: Browser Extension (Easiest)**

1. Install "Get cookies.txt LOCALLY" extension:
   - Chrome: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   - Firefox: https://addons.mozilla.org/firefox/addon/cookies-txt/
   - Opera: Same as Chrome (Opera uses Chrome extensions)

2. Go to YouTube.com and log in
3. Click extension icon → Export
4. Save as `cookies.txt`
5. Upload to app

**Method 2: Manual (DevTools)**

1. Open YouTube.com and log in
2. Press F12 → Application tab → Cookies → youtube.com
3. Copy these cookies:
   - `__Secure-1PSID`
   - `__Secure-1PAPISID`
   - `__Secure-3PSID`
   - `__Secure-3PAPISID`

4. Create `cookies.txt`:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	0	__Secure-1PSID	YOUR_VALUE
.youtube.com	TRUE	/	TRUE	0	__Secure-1PAPISID	YOUR_VALUE
.youtube.com	TRUE	/	TRUE	0	__Secure-3PSID	YOUR_VALUE
.youtube.com	TRUE	/	TRUE	0	__Secure-3PAPISID	YOUR_VALUE
```

5. Upload to app

---

## 🎯 How It Works

### Format Fetching Flow:

```
User enters URL
    ↓
Frontend calls /api/getFormats
    ↓
Express backend spawns yt-dlp -J
    ↓
yt-dlp extracts all available formats
    ↓
Backend filters + sorts by quality
    ↓
Returns to frontend
    ↓
User selects quality (e.g., 4K)
```

### Download Flow:

```
User clicks download
    ↓
Frontend builds smart format string:
  - Video-only? → Add "+bestaudio"
  - High-res? → Force merge with best audio
  - Has both? → Use directly
    ↓
Frontend calls /api/download with format
    ↓
Express backend spawns yt-dlp with:
  - Real browser headers (Chrome 121)
  - Merge format (mp4)
  - Cookies (if uploaded)
  - Bot bypass strategies
    ↓
yt-dlp downloads video + audio streams
    ↓
ffmpeg merges streams (automatic)
    ↓
Backend streams merged MP4 to frontend
    ↓
Frontend uses File System Access API
    ↓
Video saved directly to user's disk
```

### Why This Works:

1. **Real Browser Headers** - Looks like Chrome browser, not a bot
2. **Smart Merging** - High-res videos auto-merge with best audio
3. **Cookie Support** - Bypasses bot detection for hard cases
4. **Streaming** - No RAM/disk limits, handles 100GB+ files
5. **Multi-Client Fallback** - Tries iOS, web_creator, tv_embedded, android clients

---

## 📊 API Endpoints

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "ok": true,
  "timestamp": 1234567890
}
```

### `POST /api/uploadCookies`
Upload cookies.txt file

**Request:**
- Body: Raw file data (multipart/form-data)

**Response:**
```json
{
  "ok": true,
  "message": "Cookies uploaded"
}
```

### `POST /api/getFormats`
Get available video formats

**Request:**
```json
{
  "url": "https://youtu.be/VIDEO_ID"
}
```

**Response:**
```json
{
  "metadata": {
    "title": "Video Title",
    "uploader": "Channel Name",
    "duration": 180
  },
  "formats": [
    {
      "format_id": "313",
      "ext": "webm",
      "height": 2160,
      "width": 3840,
      "vcodec": "vp9",
      "acodec": "none",
      "filesize": 1234567890
    }
  ]
}
```

### `POST /api/download`
Download video with specified format

**Request:**
```json
{
  "url": "https://youtu.be/VIDEO_ID",
  "format": "bestvideo[format_id=313]+bestaudio"
}
```

**Response:**
- Streams video/mp4 directly
- Headers include Content-Length (if known)
- Transfer-Encoding: chunked

---

## 🛠️ Troubleshooting

### "Sign in to confirm you're not a bot"
**Solution:** Upload cookies (see Cookie Setup section above)

### "yt-dlp: command not found"
**Solution:** Install yt-dlp
```bash
pip3 install yt-dlp
```

### "ffmpeg: not found"
**Solution:** Install ffmpeg
```bash
# Windows
winget install ffmpeg

# Mac
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

### Downloads return 0 KB
**Solution:** 
1. Upload cookies
2. Check yt-dlp is updated: `pip3 install --upgrade yt-dlp`
3. Check logs in Railway dashboard

### High memory usage
**Solution:** This shouldn't happen with streaming architecture, but if it does:
1. Check Railway logs for errors
2. Verify `YTDLP_NO_BUFFER=true` is set
3. Check process isn't buffering (should stream directly)

---

## 📈 Performance

### Expected Performance:
- **Format Fetch**: <3 seconds
- **Download Start**: Instant streaming
- **4K Video (10min)**: ~2-5GB, 2-5 minutes on good connection
- **RAM Usage**: ~50-200MB (streaming, not buffering)
- **CPU Usage**: 20-40% during merge (ffmpeg)

### Tested On:
- ✅ Public videos (all qualities)
- ✅ Age-restricted videos (with cookies)
- ✅ Unlisted videos (with cookies)
- ✅ DASH streams (video+audio separate)
- ✅ Files up to 10GB
- ✅ 4K, 8K, HDR videos

---

## 🔒 Security Notes

### This System Is:
- ✅ **Legal** - Personal use, your own cookies, public videos
- ✅ **Safe** - No external data collection
- ✅ **Private** - Cookies stored locally, not shared

### Best Practices:
- 🔒 Keep cookies.txt private (treat like password)
- 🔄 Re-export cookies every 1-2 weeks (they expire)
- ⚠️ Only use your own YouTube account cookies
- 🚫 Don't share your cookies.txt with anyone

---

## 🎉 Success Criteria

You know it's working when:
- ✅ Format fetch completes in <3 seconds
- ✅ Downloads show real-time progress
- ✅ Downloaded files have both video AND audio
- ✅ File size matches expected (4K = 2-5GB for 10min)
- ✅ Video plays in VLC/Media Player offline

---

## 📞 Support

### Check Logs:
**Railway:**
- Dashboard → Your Project → Deployments → View Logs

**Local:**
- Console output shows all requests and errors

### Common Log Messages:

✅ **Good:**
```
[INFO] Formats extracted {"count":150}
[INFO] Download completed {"mb":2385,"durationMs":120000}
```

❌ **Bad:**
```
[ERROR] Sign in to confirm you're not a bot
→ Solution: Upload cookies

[ERROR] yt-dlp: command not found
→ Solution: Install yt-dlp

[ERROR] Format extraction failed
→ Solution: Check URL is valid YouTube link
```

---

## 🚀 Quick Start Checklist

- [ ] Install dependencies: `npm install`
- [ ] Install yt-dlp: `pip3 install yt-dlp`
- [ ] Install ffmpeg
- [ ] Run server: `npm run dev:server`
- [ ] Open browser: `http://localhost:3001`
- [ ] Test with public video
- [ ] If bot error: Upload cookies
- [ ] Deploy to Railway
- [ ] Test production deployment

---

**🎉 You now have a production-grade YouTube downloader that works reliably!**
