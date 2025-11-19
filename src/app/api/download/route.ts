// src/app/api/download/route.ts
import { authorize } from "../../../lib/auth";
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await authorize();

    const { url, format } = await req.json();
    if (!url || !format) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const cookiesPath = (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";
    const formatArg = format === "best" ? "bestvideo+bestaudio/best" : format;

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
      "-", // STREAM to stdout
      url
    );

    // Spawn yt-dlp
    const yt = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });

    // Kill yt-dlp when client disconnects
    const abortController = new AbortController();

    req.signal.addEventListener("abort", () => {
      abortController.abort();
      yt.kill("SIGKILL");
    });

    // Return streaming response
    return new Response(yt.stdout as any, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="video_${Date.now()}.mp4"`
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
