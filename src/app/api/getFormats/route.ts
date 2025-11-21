// src/app/api/getFormats/route.ts
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import { logger } from "../../../lib/logger";

export const runtime = "nodejs";
export const maxDuration = 45;

interface Format {
  format_id: string;
  ext: string;
  format_note?: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  height?: number;
  width?: number;
  fps?: number;
  abr?: number;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { url } = await req.json();
    if (!url) {
      logger.warn("getFormats request missing URL");
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    logger.info("Fetching formats", { url });

    const cookiesPath =
      (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";

    // Build yt-dlp arguments - proven working approach
    const args: string[] = [
      "-J",                          // JSON output with full info
      "--no-playlist",               // Single video only
    ];
    
    // Add cookies only if file exists (for private videos)
    if (fs.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }
    
    args.push(url);

    // Execute yt-dlp with clean environment
    const yt = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    });

    // Collect output
    let stdout = "";
    let stderr = "";

    yt.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    yt.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    // Wait for completion with timeout
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        yt.kill();
        reject(new Error("Timeout"));
      }, 45000);

      yt.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ code: code || 0, stdout, stderr });
      });

      yt.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Check for errors
    if (result.code !== 0 || !result.stdout) {
      logger.error("yt-dlp failed", { code: result.code, stderr: result.stderr });
      return NextResponse.json(
        { error: "Unable to fetch video formats. Please try again." },
        { status: 500 }
      );
    }

    // Parse JSON output
    const json = JSON.parse(result.stdout);

    // Extract video metadata
    const videoTitle = json.title || "Unknown";
    const duration = json.duration || 0;
    const uploader = json.uploader || "Unknown";

    const formats = (json.formats || []).map((f: any) => ({
      format_id: f.format_id,
      ext: f.ext,
      format_note: f.format_note || f.format,
      height: f.height,
      width: f.width,
      fps: f.fps,
      abr: f.abr,
      vcodec: f.vcodec,
      acodec: f.acodec,
      filesize: f.filesize || f.filesize_approx,
      tbr: f.tbr, // total bitrate
      protocol: f.protocol,
    }));

    const duration_ms = Date.now() - startTime;
    logger.info("Formats fetched successfully", { 
      count: formats.length, 
      title: videoTitle,
      durationMs: duration_ms 
    });

    return NextResponse.json({ 
      formats,
      metadata: {
        title: videoTitle,
        duration,
        uploader,
      }
    });
  } catch (err: any) {
    logger.error("getFormats failed", { 
      error: err.message || String(err),
      stack: err.stack,
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
