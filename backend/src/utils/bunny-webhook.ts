import crypto from 'crypto';

/**
 * Validates the HMAC SHA256 signature sent by Bunny Stream Webhook.
 *
 * HMAC-SHA256(exact raw request body, BUNNY_READ_ONLY_API_KEY)
 */
export function validateWebhookSignature(
  rawBody: Buffer,
  signature: string,
  version: string,
  algorithm: string,
  secret: string
): boolean {
  if (!secret) {
    console.error('[BUNNY WEBHOOK] Signature validation failed: BUNNY_READ_ONLY_API_KEY is not configured');
    return false;
  }

  if (version !== 'v1') {
    console.warn(`[BUNNY WEBHOOK] Signature validation failed: Unsupported version "${version}"`);
    return false;
  }

  if (algorithm !== 'hmac-sha256') {
    console.warn(`[BUNNY WEBHOOK] Signature validation failed: Unsupported algorithm "${algorithm}"`);
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
    .toLowerCase();

  const cleanSignature = (signature || '').trim().toLowerCase();

  if (cleanSignature.length !== expected.length) {
    console.warn('[BUNNY WEBHOOK] Signature validation failed: Signature length mismatch');
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(cleanSignature, 'utf8')
    );
  } catch (error) {
    console.error('[BUNNY WEBHOOK] Error during timingSafeEqual:', error);
    return false;
  }
}
