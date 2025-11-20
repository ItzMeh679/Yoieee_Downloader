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

    // Spawn yt-dlp
    const yt = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Kill yt-dlp if client disconnects
    req.signal.addEventListener("abort", () => {
      yt.stdout?.destroy();
      yt.stderr?.destroy();
      yt.kill("SIGKILL");
    });

    // Try extracting file size from stderr
    let contentLength: number | null = null;

    yt.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      // Example matched pattern: "file size 12345678"
      const match = output.match(/file size.*?(\d+)/i);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed)) {
          contentLength = parsed;
        }
      }
    });

    // Create streaming response
    const stream = new ReadableStream({
      start(controller) {
        yt.stdout.on("data", (chunk: Buffer) => {
          controller.enqueue(chunk);
        });

        yt.stdout.on("end", () => {
          controller.close();
        });

        yt.stdout.on("error", (err) => {
          controller.error(err);
        });
      },

      cancel() {
        yt.stdout?.destroy();
        yt.stderr?.destroy();
        yt.kill("SIGKILL");
      },
    });

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="video_${Date.now()}.mp4"`,
    };

    // Add Content-Length if we got it
    if (typeof contentLength === "number" && contentLength > 0) {
      headers["Content-Length"] = String(contentLength);
    }

    // Return stream
    return new Response(stream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
