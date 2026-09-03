import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export interface VideoStorage {
  save(fileStream: Readable, filename: string): Promise<{ localPath: string; filename: string }>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
}

export class LocalVideoStorage implements VideoStorage {
  private uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Sanitizes filename and streams data to backend/uploads/
   */
  async save(fileStream: Readable, originalFilename: string): Promise<{ localPath: string; filename: string }> {
    const ext = path.extname(originalFilename) || '.mp4';
    const baseName = path.basename(originalFilename, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);

    const uniqueFilename = `${baseName}-${Date.now()}${ext}`;
    const destinationPath = path.join(this.uploadDir, uniqueFilename);

    // Prevent path traversal
    if (!destinationPath.startsWith(this.uploadDir)) {
      throw new Error('Invalid destination path - path traversal detected');
    }

    const writeStream = fs.createWriteStream(destinationPath);
    await pipeline(fileStream, writeStream);

    return {
      localPath: destinationPath,
      filename: uniqueFilename
    };
  }

  /**
   * Safely deletes local file if exists
   */
  async delete(filePath: string): Promise<void> {
    try {
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.error(`[STORAGE] Failed to delete file at ${filePath}:`, error);
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

export const defaultStorage = new LocalVideoStorage();
