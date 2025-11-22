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
  needs_audio_merge?: boolean;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const { url } = await req.json();
    if (!url) {
      logger.warn("getFormats request missing URL");
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    logger.info("Fetching REAL formats from yt-dlp", { url });

    const cookiesPath =
      (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";
    const cookiesExist = fs.existsSync(cookiesPath);

    // Build yt-dlp args to fetch REAL formats
    const args = [
      "--dump-json",
      "--no-warnings",
      "--no-playlist",
      "--skip-download",
    ];

    if (cookiesExist) {
      args.push("--cookies", cookiesPath);
      logger.info("Using cookies for format extraction", { path: cookiesPath });
    } else {
      // ENHANCED Bot bypass - ONLY bot bypass flags, NO other changes
      logger.info("No cookies - applying bot bypass for format extraction");
      args.push(
        // Multi-client strategy - THE KEY to bypassing bot detection
        "--extractor-args", "youtube:player_client=android,ios,web",
        
        // User agent
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--referer", "https://www.youtube.com/",
        
        // Aggressive retries
        "--extractor-retries", "10",
        "--retries", "10",
        
        // Sleep to avoid rate limiting
        "--sleep-interval", "1",
        "--max-sleep-interval", "3",
        
        // Network settings
        "--no-check-certificate",
        "--source-address", "0.0.0.0"
      );
    }

    args.push(url);

    logger.debug("Running yt-dlp with args", { args });

    // Spawn yt-dlp to get video info
    const yt = spawn("yt-dlp", args);

    let stdout = "";
    let stderr = "";

    yt.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    yt.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Wait for yt-dlp to finish
    await new Promise<void>((resolve, reject) => {
      yt.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        }
      });

      yt.on("error", (err) => {
        reject(err);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        yt.kill();
        reject(new Error("Format extraction timed out after 30s"));
      }, 30000);
    });

    // Parse the JSON output
    const videoInfo = JSON.parse(stdout);
    const allFormats = videoInfo.formats || [];

    logger.info("Raw formats fetched", { count: allFormats.length });

    // Filter and process formats
    // We want: video formats with resolution info + audio formats
    const processedFormats: Format[] = [];

    // Get all video formats with height info
    const videoFormats = allFormats.filter((f: any) => 
      f.vcodec && f.vcodec !== "none" && f.height && f.height >= 360
    );

    // Get all audio formats
    const audioFormats = allFormats.filter((f: any) => 
      f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none")
    );

    // Find best audio format
    const bestAudio = audioFormats.sort((a: any, b: any) => 
      (b.abr || 0) - (a.abr || 0)
    )[0];

    logger.info("Best audio format found", { 
      format_id: bestAudio?.format_id,
      abr: bestAudio?.abr,
      acodec: bestAudio?.acodec
    });

    // Process video formats and mark which need audio merging
    for (const format of videoFormats) {
      const hasAudio = format.acodec && format.acodec !== "none";
      
      processedFormats.push({
        format_id: format.format_id,
        ext: format.ext || "mp4",
        format_note: format.format_note || `${format.height}p`,
        filesize: format.filesize || null,
        vcodec: format.vcodec,
        acodec: format.acodec,
        height: format.height,
        width: format.width,
        fps: format.fps,
        abr: format.abr,
        // Custom flag to indicate this needs audio merging
        // ANY video without audio needs merging (typically all >480p on YouTube)
        needs_audio_merge: !hasAudio,
      });
    }

    // Sort by height (descending) and then by filesize (descending)
    processedFormats.sort((a, b) => {
      if (b.height !== a.height) {
        return (b.height || 0) - (a.height || 0);
      }
      return (b.filesize || 0) - (a.filesize || 0);
    });

    // Deduplicate by height - keep only the best format for each resolution
    const uniqueFormats: Format[] = [];
    const seenHeights = new Set<number>();
    
    for (const format of processedFormats) {
      if (format.height && !seenHeights.has(format.height)) {
        seenHeights.add(format.height);
        uniqueFormats.push(format);
      }
    }

    logger.info("Processed unique formats", { 
      count: uniqueFormats.length,
      resolutions: uniqueFormats.map(f => f.height)
    });

    const duration_ms = Date.now() - startTime;
    logger.info("Formats extraction complete", {
      count: uniqueFormats.length,
      durationMs: duration_ms
    });

    return NextResponse.json({
      formats: uniqueFormats,
      metadata: {
        title: videoInfo.title || "Video",
        duration: videoInfo.duration || 0,
        uploader: videoInfo.uploader || videoInfo.channel || "Unknown",
      },
      bestAudio: bestAudio ? {
        format_id: bestAudio.format_id,
        abr: bestAudio.abr,
        acodec: bestAudio.acodec,
      } : null,
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
