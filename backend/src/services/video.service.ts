import crypto from 'crypto';
import { Readable } from 'stream';
import { VideoRepository } from '../db/database';
import { bunnyService } from './bunny.service';
import { defaultStorage, VideoStorage } from './storage.service';
import { Video, VideoStatus, TranscriptionStatus, PlaybackResponse } from '../types/video.types';

export class VideoService {
  private storage: VideoStorage;

  constructor(storage: VideoStorage = defaultStorage) {
    this.storage = storage;
  }

  /**
   * Process complete upload flow:
   * 1. Save video locally
   * 2. Create record in SQLite DB
   * 3. Create Bunny video object
   * 4. Upload raw binary to Bunny
   * 5. Clean up local file upon upload completion
   */
  async processUpload(
    title: string,
    fileStream: Readable,
    originalFilename: string
  ): Promise<Video> {
    console.log('[VIDEO] Upload started');

    // Step 1: Save local temporary file
    const { localPath, filename } = await this.storage.save(fileStream, originalFilename);
    console.log(`[VIDEO] Local file saved at ${localPath}`);

    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

    const bunnyLibraryId = parseInt(process.env.BUNNY_LIBRARY_ID || '0', 10);

    const videoRecord: Video = {
      id,
      title: title.trim(),
      originalFilename,
      localPath,
      bunnyVideoId: '',
      bunnyLibraryId,
      videoStatus: 'UPLOADING',
      encodeProgress: 0,
      transcriptionStatus: 'PROCESSING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save initial record to DB
    VideoRepository.create(videoRecord);

    try {
      // Step 2: Create video in Bunny Stream
      const bunnyVideoId = await bunnyService.createVideo(title);
      videoRecord.bunnyVideoId = bunnyVideoId;
      VideoRepository.update(id, { bunnyVideoId });

      // Step 3: Upload binary file to Bunny Stream
      await bunnyService.uploadVideo(bunnyVideoId, localPath);

      // Step 4: Clean up temporary local file after successful upload
      await this.storage.delete(localPath);
      console.log('[VIDEO] Local file deleted');

      // Update status to QUEUED
      VideoRepository.updateStatus(id, 'QUEUED', 0);
      videoRecord.videoStatus = 'QUEUED';

      return VideoRepository.findById(id)!;
    } catch (error: any) {
      console.error(`[VIDEO] Upload processing failed for ${id}:`, error.message);
      // Mark status as FAILED and retain local file temporarily for troubleshooting/retry
      VideoRepository.updateStatus(id, 'FAILED', 0);
      throw error;
    }
  }

  /**
   * List all video records
   */
  async getAllVideos(): Promise<Video[]> {
    return VideoRepository.findAll();
  }

  /**
   * Get single video by ID
   */
  async getVideoById(id: string): Promise<Video | null> {
    return VideoRepository.findById(id);
  }

  /**
   * Generate temporary signed embed URL for player
   */
  async getPlaybackUrl(id: string): Promise<PlaybackResponse> {
    const video = VideoRepository.findById(id);

    if (!video) {
      const error: any = new Error('Video not found');
      error.statusCode = 404;
      throw error;
    }

    if (video.videoStatus !== 'READY') {
      const error: any = new Error(`Video is not ready for playback. Current status: ${video.videoStatus}`);
      error.statusCode = 400;
      throw error;
    }

    return bunnyService.generatePlaybackUrl(video.bunnyVideoId);
  }

  /**
   * Get DRM Info and License Endpoint URLs for FairPlay / Widevine
   */
  async getDrmInfo(id: string) {
    const video = VideoRepository.findById(id);
    if (!video) {
      const error: any = new Error('Video not found');
      error.statusCode = 404;
      throw error;
    }

    const drmUrls = bunnyService.getDrmLicenseUrls(video.bunnyVideoId);
    return {
      videoId: video.id,
      bunnyVideoId: video.bunnyVideoId,
      libraryId: video.bunnyLibraryId,
      drmProtection: 'MediaCage Enterprise DRM (FairPlay & Widevine)',
      fairPlayLicenseUrl: drmUrls.fairPlayLicenseUrl,
      widevineLicenseUrl: drmUrls.widevineLicenseUrl,
    };
  }

  /**
   * Sync status directly with Bunny API if webhook was missed/delayed
   */
  async syncVideoWithBunny(id: string): Promise<Video | null> {
    const video = VideoRepository.findById(id);
    if (!video || !video.bunnyVideoId) return null;

    const bunnyData = await bunnyService.getVideoDetails(video.bunnyVideoId);
    if (bunnyData && bunnyData.status !== undefined) {
      await this.handleWebhookUpdate(video.bunnyVideoId, bunnyData.status);
      if (bunnyData.hasSubtitles || (bunnyData.captions && bunnyData.captions.length > 0)) {
        VideoRepository.updateTranscriptionStatus(video.id, 'READY');
      }
    }

    return VideoRepository.findById(id);
  }

  /**
   * Manually sync all processing/queued videos with Bunny Stream API
   */
  async syncAllVideosWithBunny(): Promise<Video[]> {
    const videos = VideoRepository.findAll();
    for (const v of videos) {
      if (v.bunnyVideoId) {
        await this.syncVideoWithBunny(v.id);
      }
    }
    return VideoRepository.findAll();
  }



  /**
   * Dispatch transcription request
   */
  async requestTranscription(id: string): Promise<Video> {
    const video = VideoRepository.findById(id);
    if (!video) {
      const error: any = new Error('Video not found');
      error.statusCode = 404;
      throw error;
    }

    if (video.videoStatus !== 'READY') {
      const error: any = new Error('Transcription can only be requested for videos in READY status');
      error.statusCode = 400;
      throw error;
    }

    VideoRepository.updateTranscriptionStatus(id, 'PROCESSING');
    await bunnyService.requestTranscription(video.bunnyVideoId);

    return VideoRepository.findById(id)!;
  }

  /**
   * Fetch caption/transcript text
   */
  async getTranscriptText(id: string): Promise<string | null> {
    const video = VideoRepository.findById(id);
    if (!video || !video.bunnyVideoId) return null;

    return bunnyService.getCaptions(video.bunnyVideoId);
  }

  /**
   * Handle Webhook Update from Bunny CDN
   * Bunny Status mappings:
   * 0 -> QUEUED
   * 1 -> PROCESSING
   * 2 -> ENCODING
   * 3 -> READY
   * 4 -> READY
   * 5 -> FAILED
   * 9 -> CaptionsGenerated -> transcriptionStatus = READY
   */
  async handleWebhookUpdate(bunnyVideoId: string, bunnyStatus: number): Promise<void> {
    const video = VideoRepository.findByBunnyVideoId(bunnyVideoId);

    if (!video) {
      console.warn(`[BUNNY WEBHOOK] Received status ${bunnyStatus} for unknown Bunny Video GUID: ${bunnyVideoId}`);
      return;
    }

    console.log(`[BUNNY WEBHOOK] Video ${bunnyVideoId} status: ${bunnyStatus}`);

    let newVideoStatus: VideoStatus | null = null;
    let newEncodeProgress: number | undefined = undefined;

    switch (bunnyStatus) {
      case 0:
        newVideoStatus = 'QUEUED';
        newEncodeProgress = 0;
        break;
      case 1:
        newVideoStatus = 'PROCESSING';
        newEncodeProgress = 25;
        break;
      case 2:
        newVideoStatus = 'ENCODING';
        newEncodeProgress = 60;
        break;
      case 3:
      case 4:
        newVideoStatus = 'READY';
        newEncodeProgress = 100;
        break;
      case 5:
        newVideoStatus = 'FAILED';
        break;
      case 9:
        console.log(`[BUNNY WEBHOOK] Captions generated for video ${bunnyVideoId}`);
        VideoRepository.updateTranscriptionStatus(video.id, 'READY');
        return;
      default:
        console.log(`[BUNNY WEBHOOK] Unhandled status code ${bunnyStatus} for ${bunnyVideoId}`);
        return;
    }

    if (newVideoStatus && video.videoStatus !== newVideoStatus) {
      VideoRepository.updateStatus(video.id, newVideoStatus, newEncodeProgress);
      console.log(`[VIDEO] Status updated: ${newVideoStatus}`);
    } else if (newEncodeProgress !== undefined && video.encodeProgress !== newEncodeProgress) {
      VideoRepository.updateStatus(video.id, video.videoStatus, newEncodeProgress);
    }
  }
}

export const videoService = new VideoService();
