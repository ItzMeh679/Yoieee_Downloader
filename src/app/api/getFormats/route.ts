// src/app/api/getFormats/route.ts
import { NextResponse } from "next/server";
import { authorize } from "../../../lib/auth";
import { spawn } from "child_process";
import fs from "fs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await authorize();

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const cookiesPath =
      (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";

    const args: string[] = [];
    if (fs.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }

    args.push("-j", url);

    // ---- FIXED spawn (no maxBuffer) ----
    const yt = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    // ---- FIXED TYPE ON data event ----
    yt.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    yt.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // ---- Await process end ----
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolve, reject) => {
        yt.on("close", (code) => {
          resolve({ code: code ?? 0, stdout, stderr });
        });

        yt.on("error", (err) => {
          reject(err);
        });
      }
    );

    if (result.code !== 0 && !result.stdout) {
      return NextResponse.json(
        { error: result.stderr || "yt-dlp failed" },
        { status: 500 }
      );
    }

    const json = JSON.parse(result.stdout);

    const formats = (json.formats || []).map((f: any) => ({
      format_id: f.format_id,
      ext: f.ext,
      format_note: f.format_note || f.format,
      height: f.height,
      abr: f.abr,
      vcodec: f.vcodec,
      acodec: f.acodec,
      filesize: f.filesize,
    }));

    return NextResponse.json({ formats });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
