import axios from 'axios';
import fs from 'fs';
import crypto from 'crypto';
import { PlaybackResponse } from '../types/video.types';

export class BunnyService {
  private get libraryId(): string {
    return process.env.BUNNY_LIBRARY_ID || '';
  }

  private get apiKey(): string {
    return process.env.BUNNY_STREAM_API_KEY || '';
  }

  private get tokenSecurityKey(): string {
    return process.env.BUNNY_TOKEN_SECURITY_KEY || process.env.BUNNY_STREAM_API_KEY || '';
  }

  private get embedBaseUrl(): string {
    return process.env.BUNNY_EMBED_BASE_URL || 'https://iframe.mediadelivery.net/embed';
  }

  /**
   * Step 1: Create Video Object in Bunny Stream
   * POST https://video.bunnycdn.com/library/{libraryId}/videos
   */
  async createVideo(title: string): Promise<string> {
    if (!this.libraryId || !this.apiKey) {
      throw new Error('BUNNY_LIBRARY_ID or BUNNY_STREAM_API_KEY is not configured in backend environment variables.');
    }

    console.log('[BUNNY] Creating video object in Bunny CDN...');

    try {
      const response = await axios.post(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos`,
        { title },
        {
          headers: {
            AccessKey: this.apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      const bunnyVideoId = response.data?.guid;
      if (!bunnyVideoId) {
        throw new Error('Bunny API returned invalid response: missing guid');
      }

      console.log(`[BUNNY] Video created: ${bunnyVideoId}`);
      return bunnyVideoId;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error('[BUNNY] Authentication failed. Check BUNNY_STREAM_API_KEY and library ID.');
      }
      console.error('[BUNNY] Error creating video:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Step 2: Upload raw binary video stream to Bunny Stream
   * PUT https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
   */
  async uploadVideo(bunnyVideoId: string, filePath: string): Promise<void> {
    if (!this.libraryId || !this.apiKey) {
      throw new Error('BUNNY_LIBRARY_ID or BUNNY_STREAM_API_KEY is not configured.');
    }

    console.log(`[BUNNY] Upload started for video ${bunnyVideoId}...`);

    const fileStats = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    try {
      await axios.put(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${bunnyVideoId}`,
        fileStream,
        {
          headers: {
            AccessKey: this.apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileStats.size,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      console.log(`[BUNNY] Upload completed for video ${bunnyVideoId}`);
    } catch (error: any) {
      console.error(`[BUNNY] Upload failed for video ${bunnyVideoId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate temporary server-signed Bunny iframe embed URL
   * Token formula: SHA256_HEX(token_security_key + video_id + expiration)
   */
  generatePlaybackUrl(bunnyVideoId: string, expiresInSeconds: number = 7200): PlaybackResponse {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const hashString = `${this.tokenSecurityKey}${bunnyVideoId}${expires}`;
    const token = crypto.createHash('sha256').update(hashString).digest('hex');

    const embedUrl = `${this.embedBaseUrl}/${this.libraryId}/${bunnyVideoId}?token=${token}&expires=${expires}`;

    return {
      videoId: bunnyVideoId,
      expires,
      embedUrl,
    };
  }

  /**
   * Generates MediaCage Enterprise DRM License Endpoint URLs
   * FairPlay: https://video.bunnycdn.com/FairPlay/{libraryId}/license/?videoId={bunnyVideoId}
   * Widevine: https://video.bunnycdn.com/Widevine/{libraryId}/license/?videoId={bunnyVideoId}
   */
  getDrmLicenseUrls(bunnyVideoId: string) {
    return {
      libraryId: this.libraryId,
      videoId: bunnyVideoId,
      fairPlayLicenseUrl: `https://video.bunnycdn.com/FairPlay/${this.libraryId}/license/?videoId=${bunnyVideoId}`,
      widevineLicenseUrl: `https://video.bunnycdn.com/Widevine/${this.libraryId}/license/?videoId=${bunnyVideoId}`,
    };
  }

  /**
   * Dispatch automatic transcription request to Bunny Stream
   * POST https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}/transcribe
   */
  async requestTranscription(bunnyVideoId: string): Promise<void> {
    if (!this.libraryId || !this.apiKey) {
      throw new Error('BUNNY_LIBRARY_ID or BUNNY_STREAM_API_KEY is missing');
    }

    console.log(`[BUNNY] Transcription requested for video ${bunnyVideoId}`);

    try {
      await axios.post(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${bunnyVideoId}/transcribe`,
        {
          generateTitle: false,
          generateDescription: false,
          generateChapters: true,
        },
        {
          headers: {
            AccessKey: this.apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: any) {
      console.error(`[BUNNY] Transcription request failed for ${bunnyVideoId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch video details directly from Bunny CDN API
   * GET https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
   */
  async getVideoDetails(bunnyVideoId: string) {
    if (!this.libraryId || !this.apiKey) return null;
    try {
      const response = await axios.get(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${bunnyVideoId}`,
        {
          headers: {
            AccessKey: this.apiKey,
            Accept: 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }



  /**
   * Fetch Captions / Transcript details for a video from Bunny Stream API
   */
  /**
   * Fetch Captions / Transcript text for a video from Bunny Stream API
   */
  async getCaptions(bunnyVideoId: string, preferredLang: string = 'en'): Promise<string | null> {
    if (!this.libraryId || !this.apiKey) return null;

    try {
      // Step 1: Check video details for generated captions list
      const videoResponse = await axios.get(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${bunnyVideoId}`,
        {
          headers: {
            AccessKey: this.apiKey,
            Accept: 'application/json',
          },
        }
      );

      const videoData = videoResponse.data || {};
      const captionsList: Array<{ srclang: string; label: string }> = videoData.captions || [];

      console.log(`[BUNNY] Captions metadata for video ${bunnyVideoId}:`, captionsList);
      console.log(`[BUNNY] Thumbnail URL for video ${bunnyVideoId}:`, videoData.thumbnailUrl);

      // Extract dynamic CDN origin from thumbnailUrl if present (e.g. https://vz-67a57f17-1b5.b-cdn.net)
      let cdnOrigin = '';
      if (videoData.thumbnailUrl) {
        try {
          const parsedUrl = new URL(videoData.thumbnailUrl);
          cdnOrigin = parsedUrl.origin;
        } catch (e) {
          // Ignore invalid URL
        }
      }

      let targetLang = preferredLang;
      if (captionsList.length > 0) {
        // Find matching language or use first available generated caption
        const matched = captionsList.find(
          (c) => c.srclang.toLowerCase().startsWith(preferredLang.toLowerCase())
        );
        targetLang = matched ? matched.srclang : captionsList[0].srclang;
      }

      const candidateLangs = [
        targetLang,
        ...(captionsList.map((c) => c.srclang)),
        'en-auto',
        'en',
      ].filter((val, idx, self) => self.indexOf(val) === idx);

      const candidateUrls: string[] = [];

      // Prioritize exact CDN origin derived from thumbnailUrl
      if (cdnOrigin) {
        for (const lang of candidateLangs) {
          candidateUrls.push(`${cdnOrigin}/${bunnyVideoId}/captions/${lang}.vtt`);
          candidateUrls.push(`${cdnOrigin}/${bunnyVideoId}/captions/${lang}`);
        }
      }

      for (const lang of candidateLangs) {
        candidateUrls.push(`https://iframe.mediadelivery.net/${this.libraryId}/${bunnyVideoId}/captions/${lang}.vtt`);
        candidateUrls.push(`https://iframe.mediadelivery.net/captions/${bunnyVideoId}/${lang}.vtt`);
        candidateUrls.push(`https://vz-${this.libraryId}.b-cdn.net/${bunnyVideoId}/captions/${lang}.vtt`);
        candidateUrls.push(`https://iframe.mediadelivery.net/embed/${this.libraryId}/${bunnyVideoId}/captions/${lang}.vtt`);
      }

      console.log(`[BUNNY] Trying candidate caption URLs for video ${bunnyVideoId}:`, candidateUrls);

      for (const captionUrl of candidateUrls) {
        try {
          const res = await axios.get(captionUrl, {
            headers: captionUrl.includes('video.bunnycdn.com') ? { AccessKey: this.apiKey } : {},
            responseType: 'text',
            timeout: 5000,
          });

          if (res.data && typeof res.data === 'string' && res.data.trim().length > 0) {
            console.log(`[BUNNY] Successfully retrieved captions from: ${captionUrl}`);
            const formatted = this.formatVttTranscript(res.data);
            if (formatted) return formatted;
          }
        } catch (err: any) {
          console.log(`[BUNNY] Caption URL ${captionUrl} failed with status: ${err.response?.status || err.message}`);
        }
      }

      console.warn(`[BUNNY] All caption candidate URLs returned 404/failed for ${bunnyVideoId}`);
      return null;
    } catch (error: any) {
      console.error(`[BUNNY] Error fetching captions for video ${bunnyVideoId}:`, error.message);
      return null;
    }
  }

  /**
   * Helper to format raw WebVTT subtitle text into a clean timestamped transcript string
   */
  private formatVttTranscript(rawVtt: string): string {
    if (!rawVtt) return '';

    const blocks: Array<{ timestamp: string; text: string }> = [];
    const lines = rawVtt.split(/\r?\n/);

    let currentTimestamp = '';
    let currentTextLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.toUpperCase().startsWith('WEBVTT') || line.toUpperCase().startsWith('NOTE')) {
        continue;
      }

      // Check if timestamp line (contains -->)
      if (line.includes('-->')) {
        // Push accumulated previous cue block
        if (currentTimestamp && currentTextLines.length > 0) {
          const cueText = currentTextLines.join(' ').trim();
          if (cueText) {
            blocks.push({ timestamp: currentTimestamp, text: cueText });
          }
          currentTextLines = [];
        }

        // Clean up timestamp formatting (e.g., "00: 00: 00.031 --> 00: 00: 02.313" -> "00:00:00 - 00:00:02")
        const parts = line.split('-->').map((p) => p.trim().replace(/\s+/g, ''));
        const startTime = parts[0]?.split('.')[0] || parts[0] || '';
        const endTime = parts[1]?.split('.')[0] || parts[1] || '';
        currentTimestamp = startTime && endTime ? `${startTime} - ${endTime}` : line;
      } else if (!/^\d+$/.test(line)) {
        // Text line
        currentTextLines.push(line);
      }
    }

    if (currentTimestamp && currentTextLines.length > 0) {
      const cueText = currentTextLines.join(' ').trim();
      if (cueText) {
        blocks.push({ timestamp: currentTimestamp, text: cueText });
      }
    }

    if (blocks.length === 0) {
      return rawVtt;
    }

    return blocks
      .map((b) => `[${b.timestamp}] ${b.text}`)
      .join('\n');
  }
}

export const bunnyService = new BunnyService();
