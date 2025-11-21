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

export async function GET() {
  const [ytDlpOk, ffmpegOk] = await Promise.all([
    checkYtDlp(),
    checkFfmpeg(),
  ]);

  const healthy = ytDlpOk && ffmpegOk;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
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
}
