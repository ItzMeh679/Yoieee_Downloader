// src/app/api/uploadCookies/route.ts
import { NextResponse } from "next/server";
import { authorize } from "../../../lib/auth";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await authorize(); // <-- FIXED (no req)

    const formData = await req.formData();
    const file = formData.get("file") as unknown as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const dir = process.env.COOKIES_UPLOAD_DIR || "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const savePath = path.join(dir, "cookies.txt");
    fs.writeFileSync(savePath, buffer);

    return NextResponse.json({ ok: true, path: savePath });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 401 });
  }
}
