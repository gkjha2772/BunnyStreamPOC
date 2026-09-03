# Backend Architecture & API Documentation

## 📌 Executive Summary

This backend is a high-performance **Node.js + Fastify + TypeScript** REST API server designed to demonstrate a complete, production-ready integration with **Bunny Stream CDN**. It manages video uploads, signed tokenized playbacks, MediaCage DRM license delivery, automatic AI transcription retrieval, and real-time event-driven updates via HMAC-SHA256 verified webhooks.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Fastify](https://fastify.dev/) (High performance, low overhead web framework) |
| **Language** | TypeScript (Strict type safety) |
| **Database** | Pure JS File-backed JSON Repository (`videos.json`) |
| **File Storage** | Local Disk Storage (`backend/uploads/`) with automatic post-upload cleanup |
| **HTTP Client** | Axios |
| **Security & HMAC** | Node.js `crypto` (`timingSafeEqual` + `HMAC-SHA256`) |

---

## 📂 Architecture & Directory Structure

```text
backend/
├── src/
│   ├── db/
│   │   └── database.ts            # Persistence layer (videos.json repository)
│   ├── routes/
│   │   ├── bunny-webhook.routes.ts# Webhook listener (HMAC signature verification)
│   │   └── video.routes.ts        # REST endpoints for upload, playback, DRM, transcript
│   ├── services/
│   │   ├── bunny.service.ts       # Bunny Stream REST API client & VTT caption parser
│   │   ├── storage.service.ts     # Temporary local file storage manager
│   │   └── video.service.ts       # Main business logic orchestrator
│   ├── types/
│   │   └── video.types.ts         # TypeScript interfaces & types
│   ├── utils/
│   │   └── bunny-webhook.ts       # HMAC SHA256 signature verification algorithm
│   └── server.ts                  # Fastify app initialization & middleware registration
├── uploads/                       # Temporary local storage for incoming video files
├── videos.json                    # Active JSON database repository
└── package.json
```

---

## ⚙️ Backend Services Breakdown

### 1. `BunnyService` (`src/services/bunny.service.ts`)
Interacts directly with Bunny Stream's cloud infrastructure:
* **`createVideo(title)`**: Issues `POST https://video.bunnycdn.com/library/{libraryId}/videos` to generate a new Bunny Video Object GUID.
* **`uploadVideo(bunnyVideoId, localPath)`**: Streams binary video file contents via `PUT https://video.bunnycdn.com/library/{libraryId}/videos/{bunnyVideoId}`.
* **`generateEmbedUrl(bunnyVideoId, expirationSeconds)`**: Constructs SHA256-signed iframe playback URLs (`SHA256_HEX(securityKey + videoId + expires)`).
* **`getDrmLicenseUrls(bunnyVideoId)`**: Generates MediaCage Enterprise DRM FairPlay and Widevine license endpoint URLs.
* **`getVideoDetails(bunnyVideoId)`**: Queries `GET https://video.bunnycdn.com/library/{libraryId}/videos/{bunnyVideoId}` for real-time encoding and caption status.
* **`getCaptions(bunnyVideoId, preferredLang)`**: Dynamically extracts CDN origins (`thumbnailUrl`) to fetch raw WebVTT subtitle files (`.vtt`) and parses them into timestamped transcript text (`[00:00:00 - 00:00:02] Hello...`).

### 2. `VideoService` (`src/services/video.service.ts`)
Orchestrates business workflows between local storage, Bunny CDN, and the database:
* **`processUpload(title, fileStream, originalFilename)`**: Saves temporary local file, creates video on Bunny, streams binary data, cleans up local disk upon completion, and sets initial status to `QUEUED`.
* **`handleWebhookUpdate(bunnyVideoId, status)`**: Idempotently processes Bunny webhook status updates (`0: QUEUED`, `1: PROCESSING`, `2: ENCODING`, `3: FINISHED/READY`, `4: CAPTIONS_GENERATED`, `5: FAILED`).
* **`syncVideoWithBunny(id)`**: Fallback sync method to pull live status directly from Bunny CDN API if a webhook was missed due to tunnel drops.
* **`getTranscriptText(id)`**: Fetches and returns timestamped AI transcription text.

### 3. `VideoRepository` (`src/db/database.ts`)
Pure JS file-backed repository operating on `backend/videos.json`:
* Handles `create`, `findById`, `findByBunnyVideoId`, `findAll`, `updateStatus`, and `update` operations cleanly with zero native binary C++ dependencies.

### 4. `LocalVideoStorage` (`src/services/storage.service.ts`)
Manages disk streams:
* Streams incoming multipart files safely to `backend/uploads/` with sanitized, unique filenames.
* Safely deletes local files once Bunny CDN confirms binary upload completion.

---

## 📡 REST API Endpoint Documentation

### 1. Upload Video
* **Endpoint**: `POST /api/videos`
* **Content-Type**: `multipart/form-data`
* **Form Fields**:
  * `file`: Binary Video File (`.mp4`, `.mov`, `.mkv`, `.avi`)
  * `title` (optional): Custom video title
* **Response (`201 Created`)**:
```json
{
  "id": "e6fa6eb3-7453-406a-b98a-b6eb98ac8263",
  "title": "Calculus Lecture 1",
  "originalFilename": "calculus.mp4",
  "bunnyVideoId": "e66c5fa7-749d-4f60-9fba-404068c059e1",
  "bunnyLibraryId": 743245,
  "videoStatus": "UPLOADING",
  "encodeProgress": 0,
  "transcriptionStatus": "PROCESSING",
  "createdAt": "2026-09-03T09:52:03.369Z"
}
```

---

### 2. List All Videos
* **Endpoint**: `GET /api/videos`
* **Response (`200 OK`)**: Array of all stored video objects.

---

### 3. Get Video Details
* **Endpoint**: `GET /api/videos/:id`
* **Response (`200 OK`)**: Single video record.

---

### 4. Manually Sync Video Status from Bunny API
* **Endpoint**: `POST /api/videos/sync` (or `POST /api/videos/:id/sync`)
* **Description**: Directly queries Bunny Stream API (`GET /library/{libraryId}/videos/{videoId}`) to pull the live status and captions, updating `videos.json` immediately.

---

### 5. Generate Signed Playback Token & Embed URL
* **Endpoint**: `GET /api/videos/:id/playback`
* **Response (`200 OK`)**:
```json
{
  "embedUrl": "https://iframe.mediadelivery.net/embed/743245/e66c5fa7-749d-4f60-9fba-404068c059e1?token=a1b2c3d4...&expires=1788432800",
  "expiresAt": 1788432800,
  "videoTitle": "Calculus Lecture 1"
}
```

---

### 6. Get DRM License Server Metadata
* **Endpoint**: `GET /api/videos/:id/drm`
* **Response (`200 OK`)**:
```json
{
  "videoId": "e6fa6eb3-7453-406a-b98a-b6eb98ac8263",
  "bunnyVideoId": "e66c5fa7-749d-4f60-9fba-404068c059e1",
  "libraryId": 743245,
  "drmProtection": "MediaCage Enterprise DRM (FairPlay & Widevine)",
  "fairPlayLicenseUrl": "https://video.bunnycdn.com/FairPlay/743245/license/?videoId=e66c5fa7-749d-4f60-9fba-404068c059e1",
  "widevineLicenseUrl": "https://video.bunnycdn.com/Widevine/743245/license/?videoId=e66c5fa7-749d-4f60-9fba-404068c059e1"
}
```

---

### 7. Fetch AI Transcription & Timestamps
* **Endpoint**: `GET /api/videos/:id/transcript`
* **Response (`200 OK`)**:
```json
{
  "transcript": "[00:00:00 - 00:00:02] Hello friends, welcome to study nation.\n[00:00:02 - 00:00:11] My name is Dinesh Singh and I am going to start with engineering mathematics..."
}
```

---

### 8. Bunny Webhook Listener
* **Endpoint**: `POST /api/webhooks/bunny`
* **Headers**:
  * `x-bunnystream-signature`: HMAC-SHA256 signature string
  * `x-bunnystream-signature-expiration`: Unix timestamp
* **Description**: Receives real-time cloud events from Bunny CDN when encoding finishes or captions are generated. Uses `crypto.timingSafeEqual` to verify signature against `BUNNY_READ_ONLY_API_KEY`.

---

## 🌐 External Bunny Stream API Calls Summary

| Action | HTTP Method & URL | Header Required |
| :--- | :--- | :--- |
| **Create Video** | `POST https://video.bunnycdn.com/library/{libraryId}/videos` | `AccessKey: <BUNNY_STREAM_API_KEY>` |
| **Upload Binary** | `PUT https://video.bunnycdn.com/library/{libraryId}/videos/{bunnyVideoId}` | `AccessKey: <BUNNY_STREAM_API_KEY>` |
| **Get Video Info** | `GET https://video.bunnycdn.com/library/{libraryId}/videos/{bunnyVideoId}` | `AccessKey: <BUNNY_STREAM_API_KEY>` |
| **Fetch WebVTT** | `GET https://{cdnHost}/{bunnyVideoId}/captions/{srclang}.vtt` | None (Public CDN Host) |

---

## 🔒 Security Architecture Summary

1. **Signed Playback Tokens**: Prevents unauthorized websites or hotlinkers from stealing or embedding video links.
2. **HMAC Signature Validation**: Prevents malicious attackers from spoofing Bunny webhooks.
3. **Path Traversal & Multipart Protection**: Uploaded files are sanitized and restricted to `backend/uploads/`.
4. **MediaCage DRM Support**: Supports Apple FairPlay & Google Widevine L1 encryption.
