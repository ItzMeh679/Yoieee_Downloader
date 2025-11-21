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

    // WORKAROUND: Skip yt-dlp format fetching to avoid bot detection
    // Instead, return predefined quality options that work universally
    logger.info("Returning predefined formats (bot detection workaround)");
    
    // Predefined formats that work with YouTube's adaptive streaming
    // These format strings tell yt-dlp to download BEST video at each resolution + BEST audio
    // Audio is INDEPENDENT of video resolution - always gets highest quality audio available
    const predefinedFormats = [
      {
        format_id: "bestvideo+bestaudio/best",
        ext: "mp4",
        format_note: "⭐ Best Available (8K/4K/HDR)",
        height: 4320,
        width: 7680,
        vcodec: "vp9.2",
        acodec: "opus",
        filesize: null,
        tbr: 50000,
      },
      {
        format_id: "bestvideo[height<=4320]+bestaudio",
        ext: "mp4",
        format_note: "8K (4320p) Ultra HD",
        height: 4320,
        width: 7680,
        vcodec: "vp9",
        acodec: "opus",
        filesize: null,
        tbr: 45000,
      },
      {
        format_id: "bestvideo[height<=2160]+bestaudio",
        ext: "mp4",
        format_note: "4K (2160p) Ultra HD",
        height: 2160,
        width: 3840,
        vcodec: "vp9",
        acodec: "opus",
        filesize: null,
        tbr: 25000,
      },
      {
        format_id: "bestvideo[height<=1440]+bestaudio",
        ext: "mp4",
        format_note: "2K (1440p) QHD",
        height: 1440,
        width: 2560,
        vcodec: "vp9",
        acodec: "opus",
        filesize: null,
        tbr: 16000,
      },
      {
        format_id: "bestvideo[height<=1080]+bestaudio",
        ext: "mp4",
        format_note: "1080p Full HD",
        height: 1080,
        width: 1920,
        vcodec: "avc1",
        acodec: "mp4a",
        filesize: null,
        tbr: 8000,
      },
      {
        format_id: "bestvideo[height<=720]+bestaudio",
        ext: "mp4",
        format_note: "720p HD",
        height: 720,
        width: 1280,
        vcodec: "avc1",
        acodec: "mp4a",
        filesize: null,
        tbr: 5000,
      },
      {
        format_id: "bestvideo[height<=480]+bestaudio",
        ext: "mp4",
        format_note: "480p SD",
        height: 480,
        width: 854,
        vcodec: "avc1",
        acodec: "mp4a",
        filesize: null,
        tbr: 2500,
      },
    ];

    const duration_ms = Date.now() - startTime;
    logger.info("Formats returned", { 
      count: predefinedFormats.length,
      durationMs: duration_ms 
    });

    return NextResponse.json({ 
      formats: predefinedFormats,
      metadata: {
        title: "Video",
        duration: 0,
        uploader: "YouTube",
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
