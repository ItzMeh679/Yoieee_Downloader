// src/app/api/cleanup-temp/route.ts
// Cleanup old temp files to prevent disk space issues
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { logger } from "../../../lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const tempDir = path.resolve(process.env.TEMP_DIR || "./tmp");
    
    if (!fs.existsSync(tempDir)) {
      return NextResponse.json({ message: "Temp directory does not exist" });
    }

    const files = fs.readdirSync(tempDir);
    let deletedCount = 0;
    let totalSizeFreed = 0;
    const errors: string[] = [];

    logger.info("Starting temp cleanup", { totalFiles: files.length });

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      
      try {
        const stats = fs.statSync(filePath);
        const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
        
        // Delete files older than 30 minutes (safety buffer for large files)
        if (ageMinutes > 30) {
          const fileSize = stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
          totalSizeFreed += fileSize;
          logger.info("Deleted old temp file", { 
            file, 
            ageMinutes: Math.round(ageMinutes),
            sizeMB: Math.round(fileSize / 1024 / 1024)
          });
        }
      } catch (err: any) {
        errors.push(`${file}: ${err.message}`);
        logger.warn("Failed to delete temp file", { file, error: err.message });
      }
    }

    const result = {
      deletedFiles: deletedCount,
      totalSizeFreedMB: Math.round(totalSizeFreed / 1024 / 1024),
      errors: errors.length > 0 ? errors : undefined
    };

    logger.info("Temp cleanup complete", result);
    return NextResponse.json(result);

  } catch (err: any) {
    logger.error("Temp cleanup failed", { error: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Can also be called via GET for manual cleanup
export async function GET() {
  return POST(new Request("http://localhost/api/cleanup-temp", { method: "POST" }));
}
