import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { videoService } from '../services/video.service';

export async function videoRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/videos
   * Upload video file and title via multipart/form-data
   */
  fastify.post('/api/videos', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No video file uploaded. Please select a video file.' });
      }

      // Extract title from multipart fields or fallback to original filename
      let title = '';
      if (data.fields.title) {
        const titleField = data.fields.title as any;
        title = Array.isArray(titleField) ? titleField[0]?.value : titleField?.value;
      }

      if (!title || !title.trim()) {
        title = data.filename || 'Untitled Video';
      }

      const video = await videoService.processUpload(
        title,
        data.file,
        data.filename
      );

      return reply.status(201).send(video);
    } catch (error: any) {
      console.error('[API] Error in POST /api/videos:', error);
      return reply.status(error.statusCode || 500).send({
        error: error.message || 'Failed to upload and process video',
      });
    }
  });

  /**
   * GET /api/videos
   * List all videos
   */
  fastify.get('/api/videos', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const videos = await videoService.getAllVideos();
      return reply.send(videos);
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch videos' });
    }
  });

  /**
   * POST /api/videos/sync
   * Manually check and sync all video statuses with Bunny Stream API
   */
  fastify.post('/api/videos/sync', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const videos = await videoService.syncAllVideosWithBunny();
      return reply.send(videos);
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to sync videos with Bunny API' });
    }
  });

  /**
   * POST /api/videos/:id/sync
   * Manually check single video status with Bunny Stream API
   */
  fastify.post('/api/videos/:id/sync', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const updatedVideo = await videoService.syncVideoWithBunny(id);
      return reply.send(updatedVideo);
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to sync video status' });
    }
  });

  /**
   * GET /api/videos/:id
   * Get single video details
   */
  fastify.get('/api/videos/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const video = await videoService.getVideoById(id);
      if (!video) {
        return reply.status(404).send({ error: 'Video not found' });
      }
      return reply.send(video);
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch video details' });
    }
  });

  /**
   * GET /api/videos/:id/playback
   * Generate temporary signed Bunny embed playback URL
   */
  fastify.get('/api/videos/:id/playback', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const playbackData = await videoService.getPlaybackUrl(id);
      return reply.send(playbackData);
    } catch (error: any) {
      return reply.status(error.statusCode || 500).send({ error: error.message || 'Failed to generate playback URL' });
    }
  });
  /**
   * GET /api/videos/:id/drm
   * Get MediaCage DRM protection metadata & FairPlay / Widevine license URLs
   */
  fastify.get('/api/videos/:id/drm', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const drmInfo = await videoService.getDrmInfo(id);
      return reply.send(drmInfo);
    } catch (error: any) {
      return reply.status(error.statusCode || 500).send({ error: error.message || 'Failed to fetch DRM info' });
    }
  });


  /**
   * GET /api/videos/:id/transcript
   * Fetch generated transcript text
   */
  fastify.get('/api/videos/:id/transcript', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const transcript = await videoService.getTranscriptText(id);
      if (!transcript) {
        return reply.status(404).send({ error: 'Transcript not available yet' });
      }
      return reply.send({ transcript });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch transcript text' });
    }
  });
}
