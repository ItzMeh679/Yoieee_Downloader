// src/app/api/getFormats/route.ts
import { NextResponse } from "next/server";
import { authorize } from "../../../lib/auth";
import { spawnSync } from "child_process";
import fs from "fs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await authorize(); // <-- FIXED (no req)

    const body = await req.json();
    const url = body.url;

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const cookiesPath = (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";

    const args: string[] = [];
    if (fs.existsSync(cookiesPath)) args.push("--cookies", cookiesPath);

    args.push("-j", url);

    const res = spawnSync("yt-dlp", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });

    if (res.error) throw res.error;
    if (res.status !== 0 && !res.stdout) {
      return NextResponse.json({ error: res.stderr || "yt-dlp failed" }, { status: 500 });
    }

    const json = JSON.parse(res.stdout);

    const formats = (json.formats || []).map((f: any) => ({
      format_id: f.format_id,
      ext: f.ext,
      format_note: f.format_note || f.format,
      height: f.height,
      abr: f.abr,
      vcodec: f.vcodec,
      acodec: f.acodec,
      filesize: f.filesize
    }));

    return NextResponse.json({ formats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
