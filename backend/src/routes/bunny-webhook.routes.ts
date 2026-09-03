import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateWebhookSignature } from '../utils/bunny-webhook';
import { videoService } from '../services/video.service';
import { BunnyWebhookPayload } from '../types/video.types';

export async function bunnyWebhookRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/webhooks/bunny
   * Bunny Stream Webhook Endpoint
   */
  fastify.post(
    '/api/webhooks/bunny',
    {
      config: {
        rawBody: true, // Enable rawBody access via @fastify/raw-body
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      console.log('[BUNNY WEBHOOK] Received');

      // 1. Extract raw body buffer
      let rawBody = (request as any).rawBody as Buffer | string | undefined;

      if (typeof rawBody === 'string') {
        rawBody = Buffer.from(rawBody, 'utf8');
      } else if (!rawBody && request.body) {
        rawBody = Buffer.from(JSON.stringify(request.body), 'utf8');
      }

      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        console.error('[BUNNY WEBHOOK] Error: Missing raw body buffer for signature validation');
        return reply.status(400).send({ error: 'Missing raw request body' });
      }

      // 2. Extract Bunny signature headers (case-insensitive)
      const version = (request.headers['x-bunnystream-signature-version'] as string) || '';
      const algorithm = (request.headers['x-bunnystream-signature-algorithm'] as string) || '';
      const signature = (request.headers['x-bunnystream-signature'] as string) || '';

      const readOnlyApiKey = process.env.BUNNY_READ_ONLY_API_KEY || '';

      // 3. Verify HMAC signature
      const isValid = validateWebhookSignature(
        rawBody,
        signature,
        version,
        algorithm,
        readOnlyApiKey
      );

      if (!isValid) {
        console.warn('[BUNNY WEBHOOK] Invalid signature! Returning 401 Unauthorized.');
        return reply.status(401).send({ error: 'Unauthorized: Invalid signature' });
      }

      console.log('[BUNNY WEBHOOK] Signature verified');

      // 4. Parse payload JSON safely from raw body
      let payload: BunnyWebhookPayload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (parseErr) {
        console.error('[BUNNY WEBHOOK] Failed to parse JSON payload from raw body:', parseErr);
        return reply.status(400).send({ error: 'Invalid JSON payload' });
      }

      const bunnyVideoId = payload.VideoGuid || payload.VideoId as string;
      const status = payload.Status;

      if (!bunnyVideoId || status === undefined) {
        console.warn('[BUNNY WEBHOOK] Webhook payload missing VideoGuid or Status:', payload);
        return reply.status(200).send({ message: 'Payload missing required fields' });
      }

      // 5. Update local video record idempotently
      await videoService.handleWebhookUpdate(bunnyVideoId, status);

      return reply.status(200).send({ success: true });
    }
  );
}
