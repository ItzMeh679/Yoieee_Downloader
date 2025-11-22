// src/app/api/download-progress/route.ts
// Server-Sent Events endpoint for real-time progress updates
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../../../lib/logger";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 minutes for large files

interface ProgressUpdate {
  stage: 'downloading' | 'merging' | 'streaming' | 'complete' | 'error';
  progress: number; // 0-100
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: number;
  eta?: number;
  message: string;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { url, format, bestAudioId, needsAudioMerge } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });
    }

    // Build format string
    let formatString = format || "bestvideo+bestaudio/best";
    if (needsAudioMerge && bestAudioId) {
      formatString = `${format}+${bestAudioId}`;
    }

    const needsTempFile = needsAudioMerge || formatString.includes("+");
    const tempDir = path.resolve(process.env.TEMP_DIR || "./tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outputTemplate = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.%(ext)s`;
    const tempFileBase = outputTemplate.replace('.%(ext)s', '');
    const expectedMergedFile = path.join(tempDir, `${tempFileBase}.mp4`);

    logger.info("Starting download with progress", { url, formatString, needsTempFile });

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (update: ProgressUpdate) => {
          const data = `data: ${JSON.stringify(update)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        try {
          // Build yt-dlp args
          const args = [
            "-f", formatString,
            "-o", needsTempFile ? path.join(tempDir, outputTemplate) : "-",
            "--merge-output-format", "mp4",
            "--newline",  // Critical for parsing progress
            "--no-playlist",
          ];

          const cookiesPath = path.join(process.env.COOKIES_UPLOAD_DIR || "./uploads", "cookies.txt");
          if (fs.existsSync(cookiesPath)) {
            args.push("--cookies", cookiesPath);
          } else {
            args.push(
              "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "--referer", "https://www.youtube.com/",
              "--extractor-retries", "5"
            );
          }

          args.push(url);

          sendProgress({ stage: 'downloading', progress: 0, message: 'Starting download...' });

          const yt = spawn("yt-dlp", args, {
            cwd: process.cwd(),
            env: { ...process.env, YTDLP_NO_BUFFER: "true" },
          });

          let totalBytes = 0;
          let downloadedBytes = 0;
          let currentSpeed = 0;

          // Parse yt-dlp output for progress
          yt.stdout.on("data", (data: Buffer) => {
            const output = data.toString();
            
            // Parse download progress: [download]  45.2% of 381.10MiB at 2.34MiB/s ETA 02:15
            const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+(?:~)?(\d+\.?\d*)(MiB|KiB|GiB)/);
            const speedMatch = output.match(/at\s+(\d+\.?\d*)(MiB|KiB|GiB)\/s/);
            const etaMatch = output.match(/ETA\s+(\d{2}):(\d{2})/);

            if (progressMatch) {
              const percent = parseFloat(progressMatch[1]);
              const size = parseFloat(progressMatch[2]);
              const unit = progressMatch[3];
              
              // Convert to bytes
              const multiplier = unit === 'GiB' ? 1024*1024*1024 : unit === 'MiB' ? 1024*1024 : 1024;
              totalBytes = size * multiplier;
              downloadedBytes = (percent / 100) * totalBytes;
            }

            if (speedMatch) {
              const speed = parseFloat(speedMatch[1]);
              const unit = speedMatch[2];
              const multiplier = unit === 'GiB' ? 1024*1024*1024 : unit === 'MiB' ? 1024*1024 : 1024;
              currentSpeed = speed * multiplier;
            }

            let eta = 0;
            if (etaMatch) {
              const minutes = parseInt(etaMatch[1]);
              const seconds = parseInt(etaMatch[2]);
              eta = minutes * 60 + seconds;
            }

            if (progressMatch) {
              sendProgress({
                stage: 'downloading',
                progress: parseFloat(progressMatch[1]),
                downloadedBytes,
                totalBytes,
                speed: currentSpeed,
                eta,
                message: `Downloading... ${progressMatch[1]}%`
              });
            }
          });

          // Wait for download to complete
          await new Promise<void>((resolve, reject) => {
            yt.on("close", (code) => {
              if (code === 0) resolve();
              else reject(new Error(`yt-dlp failed with code ${code}`));
            });
            yt.on("error", reject);
          });

          if (needsTempFile) {
            // Check if merge needed
            const files = fs.readdirSync(tempDir);
            const videoFile = files.find(f => f.startsWith(tempFileBase) && (f.includes('.webm') || f.includes('.mp4')));
            const audioFile = files.find(f => f.startsWith(tempFileBase) && (f.includes('.m4a') || f.includes('.mp3')));

            if (!fs.existsSync(expectedMergedFile) && videoFile && audioFile) {
              sendProgress({ stage: 'merging', progress: 0, message: 'Merging video and audio...' });

              const videoPath = path.join(tempDir, videoFile);
              const audioPath = path.join(tempDir, audioFile);

              // Manual ffmpeg merge with progress
              await new Promise<void>((resolve, reject) => {
                const ffmpeg = spawn("ffmpeg", [
                  "-i", videoPath,
                  "-i", audioPath,
                  "-c:v", "copy",
                  "-c:a", "copy",
                  "-movflags", "+faststart",
                  "-max_muxing_queue_size", "9999",
                  "-progress", "pipe:1",  // Output progress to stdout
                  "-y",
                  expectedMergedFile
                ]);

                let duration = 0;
                ffmpeg.stdout.on("data", (data: Buffer) => {
                  const output = data.toString();
                  
                  // Parse duration
                  const durationMatch = output.match(/duration=(\d+):(\d+):(\d+\.\d+)/);
                  if (durationMatch) {
                    const hours = parseInt(durationMatch[1]);
                    const minutes = parseInt(durationMatch[2]);
                    const seconds = parseFloat(durationMatch[3]);
                    duration = hours * 3600 + minutes * 60 + seconds;
                  }

                  // Parse time (current position)
                  const timeMatch = output.match(/out_time=(\d+):(\d+):(\d+\.\d+)/);
                  if (timeMatch && duration > 0) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const currentTime = hours * 3600 + minutes * 60 + seconds;
                    const progress = Math.min((currentTime / duration) * 100, 100);
                    
                    sendProgress({
                      stage: 'merging',
                      progress,
                      message: `Merging... ${progress.toFixed(1)}%`
                    });
                  }
                });

                ffmpeg.on("close", (code) => {
                  if (code === 0) {
                    sendProgress({ stage: 'merging', progress: 100, message: 'Merge complete!' });
                    // Cleanup intermediate files
                    try {
                      fs.unlinkSync(videoPath);
                      fs.unlinkSync(audioPath);
                    } catch (err) {
                      logger.warn("Failed to cleanup intermediate files", { error: String(err) });
                    }
                    resolve();
                  } else {
                    reject(new Error(`ffmpeg failed with code ${code}`));
                  }
                });

                ffmpeg.on("error", reject);
              });
            }

            // Stream the merged file
            sendProgress({ stage: 'streaming', progress: 0, message: 'Preparing file for download...' });

            if (fs.existsSync(expectedMergedFile)) {
              const fileStats = fs.statSync(expectedMergedFile);
              const finalSize = fileStats.size;

              sendProgress({
                stage: 'complete',
                progress: 100,
                totalBytes: finalSize,
                message: 'Download ready!'
              });

              // Send file path so frontend can download it
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'file_ready',
                filePath: expectedMergedFile,
                fileName: `video_${Date.now()}.mp4`,
                size: finalSize
              })}\n\n`));
            }
          }

          controller.close();

        } catch (error: any) {
          sendProgress({
            stage: 'error',
            progress: 0,
            message: error.message || 'Download failed'
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err: any) {
    logger.error("Download progress failed", { error: err.message });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
