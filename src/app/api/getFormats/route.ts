// src/app/api/getFormats/route.ts
import { NextResponse } from "next/server";
import { authorize } from "../../../lib/auth";
import { spawn } from "child_process";
import fs from "fs";
import { logger } from "../../../lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60; // 1 minute timeout for format fetching

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    await authorize();

    const { url } = await req.json();
    if (!url) {
      logger.warn("getFormats request missing URL");
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    logger.info("Fetching formats", { url });

    const cookiesPath =
      (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";

    const args: string[] = [];
    
    // Use cookies if available
    if (fs.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }

    // Simple, reliable approach - let yt-dlp handle everything
    args.push(
      "-j",              // JSON output
      "--no-playlist",   // Single video only  
      url
    );

    // Spawn yt-dlp with timeout protection
    const yt = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    logger.debug("yt-dlp spawned for format fetch", { pid: yt.pid });

    let stdout = "";
    let stderr = "";
    const MAX_BUFFER_SIZE = 5 * 1024 * 1024; // 5MB max to prevent memory issues

    yt.stdout.on("data", (data: Buffer) => {
      if (stdout.length < MAX_BUFFER_SIZE) {
        stdout += data.toString();
      } else {
        logger.warn("stdout buffer limit reached");
        yt.kill("SIGTERM");
      }
    });

    yt.stderr.on("data", (data: Buffer) => {
      if (stderr.length < MAX_BUFFER_SIZE) {
        stderr += data.toString();
      }
    });

    // Await process end with timeout
    const TIMEOUT_MS = 45000; // 45 seconds
    const result = await Promise.race([
      new Promise<{ code: number; stdout: string; stderr: string }>(
        (resolve, reject) => {
          yt.on("close", (code) => {
            resolve({ code: code ?? 0, stdout, stderr });
          });

          yt.on("error", (err) => {
            reject(err);
          });
        }
      ),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          yt.kill("SIGKILL");
          reject(new Error("Format fetch timeout after 45s"));
        }, TIMEOUT_MS);
      })
    ]);

    if (result.code !== 0 && !result.stdout) {
      logger.error("yt-dlp format fetch failed", { 
        code: result.code, 
        stderr: result.stderr.slice(-500) 
      });
      
      // Return actual error for debugging
      const errorMsg = result.stderr.slice(-200) || "Unknown error";
      return NextResponse.json(
        { error: `yt-dlp error: ${errorMsg}` },
        { status: 500 }
      );
    }

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
