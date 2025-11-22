// src/app/api/download/route.ts
import { NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../../../lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

let ytProcess: ChildProcess | null = null;

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { url, format, bestAudioId, needsAudioMerge } = await req.json();
    
    if (!url) {
      logger.warn("Download request missing URL");
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    // Build the proper format string with audio merging if needed
    let formatString = format || "bestvideo+bestaudio/best";
    
    if (needsAudioMerge && bestAudioId) {
      // For high-res videos (>720p) that don't have audio, merge with best audio
      formatString = `${format}+${bestAudioId}`;
      logger.info("Using video+audio merge", { video: format, audio: bestAudioId, merged: formatString });
    } else if (needsAudioMerge) {
      // Fallback if we don't have specific audio ID - use bestaudio
      formatString = `${format}+bestaudio`;
      logger.info("Using video+bestaudio merge", { video: format, merged: formatString });
    }

    logger.info("Starting download", { url, format: formatString, needsAudioMerge });

    const cookiesPath =
      (process.env.COOKIES_UPLOAD_DIR || "./uploads") + "/cookies.txt";
    const cookiesExist = fs.existsSync(cookiesPath);

    // CRITICAL: yt-dlp CANNOT merge to stdout properly!
    // When merging video+audio, we MUST use a temp file, then stream it
    const needsTempFile = needsAudioMerge || formatString.includes("+");
    
    // Use ABSOLUTE path for temp directory
    const tempDir = path.resolve(process.env.TEMP_DIR || "./tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    // Check available disk space for large files
    try {
      const { exec } = require('child_process');
      const drive = tempDir.substring(0, 2); // e.g., "F:"
      exec(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace`, (err: any, stdout: string) => {
        if (!err && stdout) {
          const freeSpaceBytes = parseInt(stdout.split('\n')[1]?.trim() || '0');
          const freeSpaceGB = Math.round(freeSpaceBytes / 1024 / 1024 / 1024);
          logger.info("Disk space check", { drive, freeSpaceGB: `${freeSpaceGB} GB` });
          
          if (freeSpaceGB < 20) {
            logger.warn("Low disk space detected!", { freeSpaceGB: `${freeSpaceGB} GB` });
          }
        }
      });
    } catch (err) {
      // Non-critical, continue anyway
    }
    
    // Use output TEMPLATE for yt-dlp, not a hardcoded filename
    // This allows yt-dlp to properly name intermediate files and merge them
    const outputTemplate = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.%(ext)s`;
    const tempFileBase = outputTemplate.replace('.%(ext)s', '');
    const expectedMergedFile = path.join(tempDir, `${tempFileBase}.mp4`);
    
    logger.info("Temp file setup", { needsTempFile, outputTemplate, expectedMergedFile, tempDir });

    // Build yt-dlp arguments
    const args = [
      "-f",
      formatString,
      
      // Output to temp file with template if merging, stdout otherwise
      "-o", needsTempFile ? path.join(tempDir, outputTemplate) : "-",
      
      // Merge into MP4 container (only works with file output!)
      "--merge-output-format", "mp4",
      
      "--no-playlist",
    ];

    if (cookiesExist) {
      args.push("--cookies", cookiesPath);
      logger.info("Using cookies file", { path: cookiesPath });
    }

    // ENHANCED Bot bypass - ONLY bot bypass flags, NO other changes
    if (!cookiesExist) {
      logger.info("No cookies found, applying bot bypass measures");
      args.push(
        // Multi-client strategy - THE KEY to bypassing bot detection
        "--extractor-args", "youtube:player_client=android,ios,web",
        "--extractor-args", "youtube:player_skip=webpage,configs",
        
        // User agent
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--referer", "https://www.youtube.com/",
        
        // Aggressive retries
        "--extractor-retries", "10",
        "--retries", "10",
        "--fragment-retries", "10",
        
        // Sleep to avoid rate limiting
        "--sleep-interval", "1",
        "--max-sleep-interval", "3",
        
        // Network settings
        "--no-check-certificate",
        "--no-warnings",
        "--source-address", "0.0.0.0",
        
        // Headers
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "--add-header", "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      );
    }

    args.push(url);

    // Get project root directory for consistent paths
    const projectRoot = process.cwd();
    
    logger.info("yt-dlp command", { 
      args: args.join(" "), 
      cwd: projectRoot,
      needsTempFile,
      outputPath: needsTempFile ? expectedMergedFile : "stdout"
    });

    // Spawn yt-dlp with no-buffer environment
    const yt = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: projectRoot,  // Ensure yt-dlp runs from project root
      env: {
        ...process.env,
        YTDLP_NO_BUFFER: "true",
      },
    });
    ytProcess = yt;

    logger.debug("yt-dlp process spawned", { pid: yt.pid, cwd: projectRoot });

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

      // Log ALL output when in temp file mode to debug merge issues
      if (needsTempFile) {
        logger.debug("yt-dlp output", { output: output.trim() });
      }

      // Log merge operations for debugging
      if (output.includes("Merging formats")) {
        logger.info("🎵 yt-dlp merging video+audio streams...", { needsAudioMerge });
      }
      if (output.includes("Deleting original file")) {
        logger.info("Merge cleanup in progress");
      }
      if (output.match(/\[ffmpeg\].*Merging/i) || output.includes("ffmpeg")) {
        logger.info("ffmpeg activity detected", { output: output.trim() });
      }
      if (output.match(/\[Merger\]/i)) {
        logger.info("Merger activity", { output: output.trim() });
      }
      
      // Log download progress and file destinations
      if (output.includes("Destination:") || output.includes("has already been downloaded")) {
        logger.info("yt-dlp file operation", { output: output.trim() });
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

    // Wait for yt-dlp to finish if using temp file
    if (needsTempFile) {
      await new Promise<void>((resolve, reject) => {
        yt.on("close", (code) => {
          logger.info("yt-dlp process exited", { 
            code, 
            expectedMergedFile,
            lastStderr: errorBuffer.slice(-500)
          });
          
          if (code === 0) {
            // Check if merge actually happened by looking for .mp4 file
            const actualFiles = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
            const mergedExists = fs.existsSync(expectedMergedFile);
            
            logger.info("Post-download file check", { 
              mergedExists,
              expectedFile: path.basename(expectedMergedFile),
              actualFiles: actualFiles.filter(f => f.startsWith(tempFileBase))
            });
            
            resolve();
          } else {
            const stderr = errorBuffer.slice(-500);
            logger.error("yt-dlp failed", { code, stderr });
            reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
          }
        });

        yt.on("error", (err) => {
          logger.error("yt-dlp process error", { error: String(err) });
          reject(err);
        });
      });

      // Verify the file actually exists - if not, manually merge with ffmpeg
      if (!fs.existsSync(expectedMergedFile)) {
        logger.warn("Merged file not found, attempting manual ffmpeg merge", { expectedMergedFile });
        
        // Find the video and audio files
        const files = fs.readdirSync(tempDir);
        const videoFile = files.find(f => f.startsWith(tempFileBase) && (f.includes('.webm') || f.includes('.mp4')));
        const audioFile = files.find(f => f.startsWith(tempFileBase) && (f.includes('.m4a') || f.includes('.mp3')));
        
        if (videoFile && audioFile) {
          logger.info("Found separate video and audio files, merging manually", { videoFile, audioFile });
          
          const videoPath = path.join(tempDir, videoFile);
          const audioPath = path.join(tempDir, audioFile);
          
          // Run ffmpeg to merge them (optimized for large files)
          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn("ffmpeg", [
              "-i", videoPath,
              "-i", audioPath,
              "-c:v", "copy",  // Copy video codec (no re-encoding, FAST!)
              "-c:a", "copy",  // Copy audio codec (no re-encoding)
              "-movflags", "+faststart",  // Enable streaming (moves metadata to front)
              "-max_muxing_queue_size", "9999",  // Handle large files better
              "-y",  // Overwrite output file
              expectedMergedFile
            ], {
              // Increase memory for large files
              env: {
                ...process.env,
                FFREPORT: "level=24"  // Reduce log verbosity for large files
              }
            });
            
            let ffmpegOutput = "";
            ffmpeg.stderr.on("data", (data) => {
              ffmpegOutput += data.toString();
            });
            
            ffmpeg.on("close", (code) => {
              if (code === 0) {
                logger.info("✓ Manual ffmpeg merge successful", { expectedMergedFile });
                // Delete intermediate files
                try {
                  fs.unlinkSync(videoPath);
                  fs.unlinkSync(audioPath);
                  logger.info("Cleaned up intermediate files");
                } catch (err) {
                  logger.warn("Failed to cleanup intermediate files", { error: String(err) });
                }
                resolve();
              } else {
                logger.error("ffmpeg merge failed", { code, output: ffmpegOutput.slice(-500) });
                reject(new Error(`ffmpeg merge failed with code ${code}`));
              }
            });
            
            ffmpeg.on("error", (err) => {
              logger.error("ffmpeg process error", { error: String(err) });
              reject(new Error(`ffmpeg not found or failed to start: ${err.message}`));
            });
          });
        } else {
          logger.error("Could not find video/audio files for manual merge!", { 
            tempFileBase,
            filesInDir: files.filter(f => f.startsWith(tempFileBase))
          });
          throw new Error("Merge failed: output file not found and cannot locate intermediate files.");
        }
      }

      // Now stream the temp file to client
      logger.info("Streaming merged file to client", { expectedMergedFile });
      
      const fileStats = fs.statSync(expectedMergedFile);
      const fileStream = fs.createReadStream(expectedMergedFile);
      
      const headers: Record<string, string> = {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="video_${Date.now()}.mp4"`,
        "Content-Length": String(fileStats.size),
        "Cache-Control": "no-cache",
      };

      // Clean up temp file after streaming
      fileStream.on("end", () => {
        setTimeout(() => {
          try {
            fs.unlinkSync(expectedMergedFile);
            logger.info("Temp file cleaned up", { expectedMergedFile });
          } catch (err) {
            logger.error("Failed to cleanup temp file", { expectedMergedFile, error: String(err) });
          }
        }, 1000);
      });

      return new Response(fileStream as any, {
        status: 200,
        headers,
      });
    }

    // For non-merged videos, stream directly from stdout
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
            const stderr = errorBuffer.slice(-500);
            const error = new Error(`Download failed: ${stderr}`);
            logger.error("yt-dlp failed", { code, signal, stderr });
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

    // Clean up temp file if it exists
    try {
      const tempDir = path.resolve(process.env.TEMP_DIR || "./tmp");
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          const filePath = path.join(tempDir, file);
          try {
            const stats = fs.statSync(filePath);
            // Delete files older than 5 minutes
            if (Date.now() - stats.mtimeMs > 5 * 60 * 1000) {
              fs.unlinkSync(filePath);
              logger.info("Cleaned up old temp file", { filePath });
            }
          } catch (fileErr) {
            // Skip files that can't be accessed
          }
        });
      }
    } catch (cleanupErr) {
      logger.error("Temp file cleanup failed", { error: String(cleanupErr) });
    }

    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
