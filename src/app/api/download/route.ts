// src/app/api/download/route.ts
import { authorize } from "../../../lib/auth";
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import { logger } from "../../../lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for Railway/Vercel

export async function POST(req: Request) {
  const startTime = Date.now();
  let ytProcess: any = null;

  try {
    await authorize();

    const { url, format } = await req.json();
    if (!url || !format) {
      logger.warn("Download request missing parameters");
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    logger.info("Download started", { url, format });

    const cookiesPath =
      (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";

    const formatArg =
      format === "best" ? "bestvideo+bestaudio/best" : format;

    const args: string[] = [];

    if (fs.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }

    args.push(
      "-f",
      formatArg,
      "--merge-output-format",
      "mp4",
      "-o",
      "-",
      url
    );

    // Spawn yt-dlp with resource limits
    const yt = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1", // Prevent Python buffering
      },
    });
    ytProcess = yt;

    logger.debug("yt-dlp process spawned", { pid: yt.pid });

    // Kill yt-dlp if client disconnects
    req.signal.addEventListener("abort", () => {
      logger.info("Client disconnected, killing yt-dlp", { pid: yt.pid });
      yt.stdout?.destroy();
      yt.stderr?.destroy();
      yt.kill("SIGKILL");
    });

    // Try extracting file size and metadata from stderr
    let contentLength: number | null = null;
    let errorBuffer = "";

    yt.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      errorBuffer += output;
      
      // Keep only last 10KB of error buffer to prevent memory issues
      if (errorBuffer.length > 10240) {
        errorBuffer = errorBuffer.slice(-10240);
      }

      // Match various file size patterns
      const sizeMatch = output.match(/file size.*?(\d+)/i) || 
                        output.match(/Content-Length.*?(\d+)/i) ||
                        output.match(/(\d+)\s*bytes/i);
      
      if (sizeMatch) {
        const parsed = parseInt(sizeMatch[1], 10);
        if (!isNaN(parsed) && parsed > 0) {
          contentLength = parsed;
          logger.debug("Detected file size", { bytes: parsed, mb: Math.round(parsed / 1024 / 1024) });
        }
      }
    });

    // Create streaming response with chunking and backpressure handling
    let bytesStreamed = 0;
    const stream = new ReadableStream({
      start(controller) {
        yt.stdout.on("data", (chunk: Buffer) => {
          try {
            controller.enqueue(chunk);
            bytesStreamed += chunk.length;
          } catch (err) {
            logger.error("Error enqueuing chunk", { error: String(err) });
            controller.error(err);
          }
        });

        yt.stdout.on("end", () => {
          const duration = Date.now() - startTime;
          logger.info("Download completed", { 
            bytes: bytesStreamed, 
            mb: Math.round(bytesStreamed / 1024 / 1024),
            durationMs: duration,
            speedMbps: Math.round((bytesStreamed / 1024 / 1024) / (duration / 1000))
          });
          controller.close();
        });

        yt.stdout.on("error", (err) => {
          logger.error("Stream error", { error: String(err), bytesStreamed });
          controller.error(err);
        });

        yt.on("error", (err) => {
          logger.error("yt-dlp process error", { error: String(err) });
          controller.error(err);
        });

        yt.on("exit", (code, signal) => {
          if (code !== 0 && code !== null) {
            const error = new Error(`yt-dlp exited with code ${code}: ${errorBuffer.slice(-500)}`);
            logger.error("yt-dlp failed", { code, signal, stderr: errorBuffer.slice(-500) });
            controller.error(error);
          }
        });
      },

      cancel() {
        logger.info("Stream cancelled", { bytesStreamed });
        yt.stdout?.destroy();
        yt.stderr?.destroy();
        yt.kill("SIGKILL");
      },
    });

    // Prepare headers with better caching and streaming support
    const headers: Record<string, string> = {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="video_${Date.now()}.mp4"`,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Transfer-Encoding": "chunked",
    };

    // Add Content-Length if we got it (helps with progress tracking)
    if (typeof contentLength === "number" && contentLength > 0) {
      headers["Content-Length"] = String(contentLength);
      logger.info("Streaming with known size", { bytes: contentLength, mb: Math.round(contentLength / 1024 / 1024) });
    } else {
      logger.warn("Streaming with unknown size");
    }

    // Return stream
    return new Response(stream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    logger.error("Download failed", { 
      error: err?.message || String(err),
      stack: err?.stack,
      duration: Date.now() - startTime
    });

    // Clean up process if it exists
    if (ytProcess) {
      try {
        ytProcess.kill("SIGKILL");
      } catch (killErr) {
        logger.error("Failed to kill yt-dlp process", { error: String(killErr) });
      }
    }

    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
