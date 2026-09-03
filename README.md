# Bunny Stream Video Streaming Proof-of-Concept (POC)

A complete **Node.js (Fastify + TypeScript + SQLite)** backend and **React (Vite + TypeScript)** frontend proof-of-concept demonstrating the complete video lifecycle with **Bunny Stream**:

```text
Frontend (React)
   ↓ POST /api/videos (multipart/form-data)
Backend (Fastify API)
   ↓ Save temporary video file
Local Storage (backend/uploads/)
   ↓ POST /library/{libraryId}/videos (Create Video Object)
   ↓ PUT /library/{libraryId}/videos/{videoId} (Raw Binary PUT Upload)
Bunny Stream CDN
   ↓ Delete local file upon upload completion
   ↓ Asynchronous Video Encoding & Processing
Bunny Webhook → POST /api/webhooks/bunny
   ↓ Signature Verification (HMAC-SHA256 with Read-Only API Key)
Backend Database (SQLite update status to READY)
   ↓ GET /api/videos (Auto-polling status from Frontend)
Frontend (Displays READY status & "Watch" button)
   ↓ GET /api/videos/:id/playback (Server-signed token generation)
Bunny Iframe Player (https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?token=...&expires=...)
```

---

## Technical Stack

* **Backend**: Node.js, TypeScript, Fastify, `@fastify/multipart`, `fastify-raw-body`, `@fastify/cors`, SQLite (`better-sqlite3`), Axios, Node.js `crypto` for HMAC-SHA256 signatures.
* **Frontend**: React, TypeScript, Vite, Vanilla CSS with custom glassmorphism styling, Bunny Iframe Player.
* **Storage Abstraction**: `VideoStorage` interface with `LocalVideoStorage` implementation (ready to swap with `S3VideoStorage`).

---

## 1. Prerequisites & Installation

### Backend Setup
```bash
cd backend
npm install
```

### Frontend Setup
```bash
cd frontend
npm install
```

---

## 2. Environment Variables Configuration

Copy `backend/.env.example` to `backend/.env` and update with your real Bunny Stream credentials:

```env
PORT=4000

# Bunny Stream Library ID (e.g. 123456)
BUNNY_LIBRARY_ID=123456

# Bunny Stream API Key (used for creating & uploading videos)
BUNNY_STREAM_API_KEY=your_bunny_stream_api_key

# Bunny Read-Only API Key (used for verifying HMAC webhook signatures)
BUNNY_READ_ONLY_API_KEY=your_bunny_read_only_api_key

# Token Security Key (used for iframe embed token generation; defaults to BUNNY_STREAM_API_KEY if identical)
BUNNY_TOKEN_SECURITY_KEY=your_token_security_key

# Public Webhook URL (e.g. via ngrok tunnel)
BUNNY_WEBHOOK_URL=https://xxxx.ngrok-free.app/api/webhooks/bunny

# Bunny Embed Base URL
BUNNY_EMBED_BASE_URL=https://iframe.mediadelivery.net/embed
```

---

## 3. Bunny Dashboard Setup Instructions

1. **Log in to bunny.net** and navigate to **Stream**.
2. **Create a Video Library**:
   - Note down the **Video Library ID** (shown at top of library page).
3. **Retrieve API Keys**:
   - **Stream API Key**: Found under *Account Settings -> API Keys* or *Stream -> Library Settings -> API Key*.
   - **Read-Only API Key**: Found under *Account Settings -> API Keys*. This key acts as the secret for verifying webhook HMAC signatures.
   - **Token Security Key**: Found under *Stream -> Library Settings -> Security -> Token Authentication*. Enable "Token Authentication" if you want strict iframe token protection.
4. **Configure Webhook**:
   - Go to *Stream -> Library Settings -> Webhooks*.
   - Set **Webhook URL** to your public HTTPS endpoint:
     `https://<your-ngrok-domain>.ngrok-free.app/api/webhooks/bunny`
   - Enable events: *Video Encoding Finished*, *Captions Generated*, *Video Encoding Failed*.

---

## 4. Local Webhook Testing (via ngrok)

Because Bunny CDN sends webhooks over the public internet, you need an HTTPS tunnel to reach your local backend:

```bash
# Start cloudflared on backend port 4000
npx cloudflared tunnel --url http://localhost:4000
```

Copy the generated HTTPS forwarding URL (e.g. `https://a1b2c3.ngrok-free.app`) and configure:

* `BUNNY_WEBHOOK_URL` in `backend/.env`: `https://a1b2c3.ngrok-free.app/api/webhooks/bunny`
* Bunny Dashboard Webhook URL: `https://a1b2c3.ngrok-free.app/api/webhooks/bunny`

---

## 5. Running the Application

### Start Backend
```bash
cd backend
npm run dev
```
Backend will start on `http://localhost:4000`.

### Start Frontend
```bash
cd frontend
npm run dev
```
Frontend will start on `http://localhost:5173`.

---

## 6. Testing Step-by-Step Flow

1. Open `http://localhost:5173`.
2. **Select a Video**: Choose an `.mp4` file, enter a title, and click **Upload Video**.
3. **Observe Backend Flow**:
   - Backend saves video to `backend/uploads/`.
   - Backend creates Bunny Video object (`POST /library/{id}/videos`).
   - Backend uploads raw binary PUT stream (`PUT /library/{id}/videos/{guid}`).
   - Temporary local file in `backend/uploads/` is deleted upon upload completion.
4. **Processing & Webhooks**:
   - Bunny begins processing/encoding the video.
   - Bunny sends webhook to `POST /api/webhooks/bunny`.
   - Backend verifies HMAC-SHA256 signature using `BUNNY_READ_ONLY_API_KEY`.
   - SQLite status updates to `READY`. Frontend auto-syncs status every 3s.
5. **Playback**:
   - Click **Watch** on the READY video.
   - Backend generates temporary server-side signed URL with `token` and `expires` timestamp.
   - Bunny iframe player embeds and plays the video securely.
6. **AI Transcription**:
   - Click **Transcribe**. Backend calls `POST /library/{id}/videos/{guid}/transcribe`.
   - Bunny generates captions and sends status `9` webhook (`CaptionsGenerated`).
   - Transcription status updates to `READY` and transcript text is viewable on player page.

---

## 7. Webhook Security Verification Code

Backend validates signatures in constant-time using raw body buffers:

```ts
import crypto from 'crypto';

export function validateWebhookSignature(
  rawBody: Buffer,
  signature: string,
  version: string,
  algorithm: string,
  secret: string
): boolean {
  if (version !== 'v1' || algorithm !== 'hmac-sha256') return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
    .toLowerCase();

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(signature.toLowerCase(), 'utf8')
  );
}
```

---

## 8. API Reference

* `POST /api/videos` — Upload video (`title`, `video` multipart)
* `GET /api/videos` — List all videos
* `GET /api/videos/:id` — Get single video metadata
* `GET /api/videos/:id/playback` — Generate signed playback embed URL
* `POST /api/videos/:id/transcribe` — Request Bunny AI transcription
* `GET /api/videos/:id/transcript` — Fetch generated transcript text
* `POST /api/webhooks/bunny` — Bunny CDN webhook listener with HMAC validation

---

## 9. Security Audit & Architecture Notes

* **API Keys Protected**: `BUNNY_STREAM_API_KEY`, `BUNNY_READ_ONLY_API_KEY`, and `BUNNY_TOKEN_SECURITY_KEY` are kept strictly server-side.
* **Tokens Server-Generated**: Frontend never generates token signatures or reads keys.
* **No Video Proxying**: Student video streams flow directly from Bunny CDN to the browser player.
* **Local Storage Cleanup**: Uploaded files in `backend/uploads/` are purged immediately after binary upload to Bunny completes.
