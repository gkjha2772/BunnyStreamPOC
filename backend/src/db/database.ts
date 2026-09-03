import fs from 'fs';
import path from 'path';
import { Video, VideoStatus, TranscriptionStatus } from '../types/video.types';

const dbPath = path.join(process.cwd(), 'videos.json');

// Initialize database file if it does not exist
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2), 'utf8');
}

function readDb(): Video[] {
  try {
    if (!fs.existsSync(dbPath)) {
      return [];
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('[DB] Error reading videos.json:', err);
    return [];
  }
}

function writeDb(videos: Video[]): void {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(videos, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error writing videos.json:', err);
  }
}

export const VideoRepository = {
  create(video: Video): Video {
    const videos = readDb();
    videos.unshift(video);
    writeDb(videos);
    return video;
  },

  findById(id: string): Video | null {
    const videos = readDb();
    return videos.find((v) => v.id === id) || null;
  },

  findByBunnyVideoId(bunnyVideoId: string): Video | null {
    const videos = readDb();
    return videos.find((v) => v.bunnyVideoId === bunnyVideoId) || null;
  },

  findAll(): Video[] {
    return readDb();
  },

  updateStatus(id: string, videoStatus: VideoStatus, encodeProgress?: number): void {
    const videos = readDb();
    const index = videos.findIndex((v) => v.id === id);
    if (index !== -1) {
      videos[index].videoStatus = videoStatus;
      if (encodeProgress !== undefined) {
        videos[index].encodeProgress = encodeProgress;
      }
      videos[index].updatedAt = new Date().toISOString();
      writeDb(videos);
    }
  },

  updateTranscriptionStatus(id: string, status: TranscriptionStatus): void {
    const videos = readDb();
    const index = videos.findIndex((v) => v.id === id);
    if (index !== -1) {
      videos[index].transcriptionStatus = status;
      videos[index].updatedAt = new Date().toISOString();
      writeDb(videos);
    }
  },

  update(id: string, updates: Partial<Video>): void {
    const videos = readDb();
    const index = videos.findIndex((v) => v.id === id);
    if (index !== -1) {
      videos[index] = {
        ...videos[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      writeDb(videos);
    }
  },
};
