export type VideoStatus =
  | "UPLOADING"
  | "QUEUED"
  | "PROCESSING"
  | "ENCODING"
  | "READY"
  | "FAILED";

export type TranscriptionStatus =
  | "NOT_REQUESTED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

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

export interface BunnyWebhookPayload {
  VideoLibraryId?: number;
  VideoGuid?: string;
  Status?: number;
  [key: string]: unknown;
}

export interface PlaybackResponse {
  videoId: string;
  expires: number;
  embedUrl: string;
}
