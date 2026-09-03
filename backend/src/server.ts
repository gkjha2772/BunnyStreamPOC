import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.join(process.cwd(), '.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyRawBody from 'fastify-raw-body';
import { videoRoutes } from './routes/video.routes';
import { bunnyWebhookRoutes } from './routes/bunny-webhook.routes';

const PORT = parseInt(process.env.PORT || '4000', 10);

async function startServer() {
  const fastify = Fastify({
    logger: false, // We use custom clean formatted logs per requirements
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register Raw Body parser (required for Webhook signature verification, disabled globally for multipart uploads)
  await fastify.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: false,
    runFirst: true,
  });

  // Register Multipart support for video uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500 MB max upload size
    },
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register API routes
  await fastify.register(videoRoutes);
  await fastify.register(bunnyWebhookRoutes);

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n=================================================`);
    console.log(`  Bunny Stream POC Backend running on port ${PORT}`);
    console.log(`  Health Check: http://localhost:${PORT}/health`);
    console.log(`  Webhook Endpoint: http://localhost:${PORT}/api/webhooks/bunny`);
    console.log(`=================================================\n`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
