import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import next from "next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, dir: __dirname });
const handle = nextApp.getRequestHandler();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// ==========================
// CONFIG
// ==========================
const COOKIES_PATH = "./uploads/cookies.txt";

// Real browser headers - mimics Chrome 121 on Windows
const HEADERS = [
  "--add-header", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "--add-header", "Accept-Language: en-US,en;q=0.9",
  "--add-header", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "--add-header", "sec-ch-ua: \"Not A(Brand\";v=\"99\", \"Google Chrome\";v=\"121\", \"Chromium\";v=\"121\"",
  "--add-header", "sec-ch-ua-mobile: ?0",
  "--add-header", "sec-ch-ua-platform: \"Windows\"",
  "--add-header", "Sec-Fetch-Dest: document",
  "--add-header", "Sec-Fetch-Mode: navigate",
  "--add-header", "Sec-Fetch-Site: none",
];

// ==========================
// LOGGING
// ==========================
function log(level, msg, meta = {}) {
  console.log(JSON.stringify({ 
    timestamp: new Date().toISOString(), 
    level, 
    message: msg, 
    ...meta 
  }));
}

// ==========================
// HEALTH CHECK
// ==========================
app.get("/health", (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// ==========================
// UPLOAD COOKIES
// ==========================
app.post("/api/uploadCookies", async (req, res) => {
  try {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const data = Buffer.concat(chunks);

      if (!fs.existsSync("./uploads")) {
        fs.mkdirSync("./uploads", { recursive: true });
      }

      fs.writeFileSync(COOKIES_PATH, data);
      log("info", "Cookies uploaded successfully", { size: data.length });
      res.json({ ok: true, message: "Cookies uploaded" });
    });
  } catch (e) {
    log("error", "Cookie upload failed", { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ==========================
// GET FORMATS (Safe + Fallback)
// ==========================
app.post("/api/getFormats", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });

  log("info", "Fetching formats", { url });

  const args = [
    "-J",
    "--no-playlist",
    "--skip-download",
    ...HEADERS
  ];

  // Add cookies if available
  if (fs.existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
    log("info", "Using cookies for format extraction");
  }

  // Add bot bypass strategies
  args.push(
    "--extractor-args", "youtube:player_client=ios,web_creator,tv_embedded,android",
    "--extractor-retries", "3"
  );

  args.push(url);

  const proc = spawn("yt-dlp", args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "", stderr = "";

  proc.stdout.on("data", d => stdout += d.toString());
  proc.stderr.on("data", d => stderr += d.toString());

  proc.on("close", code => {
    if (code !== 0) {
      log("error", "Format extraction failed", { code, stderr: stderr.slice(-500) });
      return res.status(500).json({ error: stderr.slice(-500) });
    }

    try {
      const data = JSON.parse(stdout);
      
      // Filter and sort formats
      const formats = (data.formats || [])
        .filter(f => {
          // Keep video formats with reasonable resolution
          const hasVideo = f.vcodec && f.vcodec !== "none";
          const hasAudio = f.acodec && f.acodec !== "none";
          const hasHeight = f.height && f.height >= 144;
          
          return (hasVideo && hasHeight) || (hasAudio && !hasVideo);
        })
        .sort((a, b) => {
          // Sort by height (video quality) descending
          const heightA = a.height || 0;
          const heightB = b.height || 0;
          return heightB - heightA;
        });

      log("info", "Formats extracted", { count: formats.length });

      res.json({
        metadata: {
          title: data.title || "Video",
          uploader: data.uploader || "Unknown",
          duration: data.duration || 0,
        },
        formats: formats
      });
    } catch (e) {
      log("error", "Failed to parse formats", { error: e.message });
      res.status(500).json({ error: "Failed to parse formats: " + e.message });
    }
  });

  // Timeout after 30 seconds
  setTimeout(() => {
    if (!proc.killed) {
      proc.kill("SIGKILL");
      log("error", "Format extraction timed out");
      res.status(504).json({ error: "Request timed out" });
    }
  }, 30000);
});

// ==========================
// DOWNLOAD (Production-Safe with Merging)
// ==========================
app.post("/api/download", async (req, res) => {
  const { url, format } = req.body;

  if (!url || !format) {
    return res.status(400).json({ error: "Missing params" });
  }

  log("info", "Download started", { url, format });

  const args = [
    "-f", format,
    "--merge-output-format", "mp4",
    "--no-cache-dir",
    "--no-resize-buffer",
    "--newline",
    "-o", "-",
    ...HEADERS
  ];

  // Add cookies if available
  if (fs.existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
    log("info", "Using cookies for download");
  } else {
    // Bot bypass if no cookies
    args.push(
      "--extractor-args", "youtube:player_client=ios,web_creator,tv_embedded,android",
      "--extractor-retries", "5"
    );
  }

  args.push(url);

  const proc = spawn("yt-dlp", args, { 
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      YTDLP_NO_BUFFER: "true"
    }
  });

  let contentLength = null;
  let bytesStreamed = 0;
  const startTime = Date.now();

  // Parse stderr for metadata
  proc.stderr.on("data", (d) => {
    const line = d.toString();
    
    // Try to extract content length
    const match = line.match(/Content-Length:\s*(\d+)/i) || 
                  line.match(/file size.*?(\d+)/i) ||
                  line.match(/(\d+)\s*bytes/i);
    
    if (match && !contentLength) {
      contentLength = parseInt(match[1]);
      log("info", "Detected file size", { bytes: contentLength, mb: Math.round(contentLength / 1024 / 1024) });
    }
  });

  // Set response headers
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="video_${Date.now()}.mp4"`);
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");

  if (contentLength) {
    res.setHeader("Content-Length", contentLength);
  }

  // Stream video data to client
  proc.stdout.on("data", (chunk) => {
    bytesStreamed += chunk.length;
    res.write(chunk);
  });

  proc.stdout.on("end", () => {
    const duration = Date.now() - startTime;
    log("info", "Download completed", { 
      bytes: bytesStreamed, 
      mb: Math.round(bytesStreamed / 1024 / 1024),
      durationMs: duration,
      speedMbps: Math.round((bytesStreamed / 1024 / 1024) / (duration / 1000))
    });
    res.end();
  });

  proc.on("error", (err) => {
    log("error", "Process error", { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  proc.on("close", (code) => {
    if (code !== 0 && code !== null) {
      log("error", "yt-dlp failed", { code });
      if (!res.headersSent) {
        res.status(500).json({ error: `yt-dlp exited with code ${code}` });
      }
    }
  });

  // Handle client disconnect
  req.on("close", () => {
    if (!proc.killed) {
      log("info", "Client disconnected, killing process");
      proc.kill("SIGKILL");
    }
  });
});

// ==========================
// NEXT.JS CATCH-ALL (Must be last!)
// ==========================
app.get("*", (req, res) => {
  return handle(req, res);
});

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 3001;

nextApp.prepare().then(() => {
  app.listen(PORT, () => {
    log("info", "Express + Next.js server started", { port: PORT });
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
