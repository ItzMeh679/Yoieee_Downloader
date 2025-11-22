// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { spawn } from "child_process";

export const runtime = "nodejs";

async function checkYtDlp(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", ["--version"]);
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

async function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"]);
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

export async function GET(req: Request) {
  // Quick health check - just return 200 if server is running
  // Use ?full=true for detailed checks
  const url = new URL(req.url);
  const fullCheck = url.searchParams.get('full') === 'true';

  if (!fullCheck) {
    // Fast health check for Railway
    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 200 }
    );
  }

  // Full health check with external dependencies (slower)
  try {
    const [ytDlpOk, ffmpegOk] = await Promise.race([
      Promise.all([checkYtDlp(), checkFfmpeg()]),
      new Promise<[boolean, boolean]>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      )
    ]);

    const healthy = ytDlpOk && ffmpegOk;

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        checks: {
          ytDlp: ytDlpOk ? "ok" : "failed",
          ffmpeg: ffmpegOk ? "ok" : "failed",
        },
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (error) {
    // Return 200 even if external checks fail - app is still running
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: "External dependency checks failed",
        uptime: process.uptime(),
      },
      { status: 200 }
    );
  }
}
