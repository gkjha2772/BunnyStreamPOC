import axios from 'axios';

const API_BASE = '/api';

export type VideoStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'ENCODING'
  | 'READY'
  | 'FAILED';

export type TranscriptionStatus =
  | 'NOT_REQUESTED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export interface Video {
  id: string;
  title: string;
  originalFilename: string;
  localPath: string;
  bunnyVideoId: string;
  bunnyLibraryId: number;
  videoStatus: VideoStatus;
  encodeProgress: number;
  transcriptionStatus: TranscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackData {
  videoId: string;
  expires: number;
  embedUrl: string;
}

export interface DrmData {
  videoId: string;
  bunnyVideoId: string;
  libraryId: number;
  drmProtection: string;
  fairPlayLicenseUrl: string;
  widevineLicenseUrl: string;
}

export const api = {
  async getVideos(): Promise<Video[]> {
    const res = await axios.get<Video[]>(`${API_BASE}/videos`);
    return res.data;
  },

  async getVideo(id: string): Promise<Video> {
    const res = await axios.get<Video>(`${API_BASE}/videos/${id}`);
    return res.data;
  },

  async uploadVideo(
    title: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<Video> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('video', file);

    const res = await axios.post<Video>(`${API_BASE}/videos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });

    return res.data;
  },

  async getPlaybackUrl(id: string): Promise<PlaybackData> {
    const res = await axios.get<PlaybackData>(`${API_BASE}/videos/${id}/playback`);
    return res.data;
  },

  async getDrmInfo(id: string): Promise<DrmData> {
    const res = await axios.get<DrmData>(`${API_BASE}/videos/${id}/drm`);
    return res.data;
  },

  async syncVideos(): Promise<Video[]> {
    const res = await axios.post<Video[]>(`${API_BASE}/videos/sync`);
    return res.data;
  },

  async syncVideo(id: string): Promise<Video> {
    const res = await axios.post<Video>(`${API_BASE}/videos/${id}/sync`);
    return res.data;
  },

  async getTranscript(id: string): Promise<{ transcript: string }> {
    const res = await axios.get<{ transcript: string }>(`${API_BASE}/videos/${id}/transcript`);
    return res.data;
  },
};
