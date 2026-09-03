import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { VideoList } from './components/VideoList';
import { VideoPlayer } from './components/VideoPlayer';
import { api, Video } from './services/api';
import { PlayCircle, ShieldCheck, Server } from 'lucide-react';

export const App: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVideos = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await api.getVideos();
      setVideos(data);
      setError(null);

      // Also update selectedVideo if currently playing
      if (selectedVideo) {
        const updated = data.find((v) => v.id === selectedVideo.id);
        if (updated) setSelectedVideo(updated);
      }
    } catch (err: any) {
      console.error('Failed to fetch videos:', err);
      setError('Cannot connect to backend API on http://localhost:4000. Ensure Fastify backend is running.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [selectedVideo]);

  const handleManualSync = useCallback(async () => {
    try {
      const data = await api.syncVideos();
      setVideos(data);
      if (selectedVideo) {
        const updated = data.find((v) => v.id === selectedVideo.id);
        if (updated) setSelectedVideo(updated);
      }
    } catch (err) {
      await fetchVideos(false);
    }
  }, [selectedVideo, fetchVideos]);

  // Initial load
  useEffect(() => {
    fetchVideos(true);
  }, []);

  // Poll automatically if any video is active in QUEUED, PROCESSING, ENCODING, or UPLOADING
  useEffect(() => {
    const hasActiveProcessing = videos.some(
      (v) =>
        v.videoStatus === 'QUEUED' ||
        v.videoStatus === 'PROCESSING' ||
        v.videoStatus === 'ENCODING' ||
        v.videoStatus === 'UPLOADING' ||
        v.transcriptionStatus === 'PROCESSING'
    );

    if (hasActiveProcessing) {
      setIsPolling(true);
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(() => {
          fetchVideos(false);
        }, 3000);
      }
    } else {
      setIsPolling(false);
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [videos, fetchVideos]);

  const handleUploadSuccess = (newVideo: Video) => {
    setVideos((prev) => [newVideo, ...prev]);
    fetchVideos(false);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="main-header">
        <div className="header-brand" onClick={() => setSelectedVideo(null)} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">
            <PlayCircle size={28} />
          </div>
          <div>
            <h1 className="brand-title">Bunny Stream POC</h1>
            <span className="brand-subtitle">Educational Video Platform</span>
          </div>
        </div>

        <div className="header-badges">
          <div className="system-badge">
            <Server size={14} />
            <span>Fastify API :4000</span>
          </div>
          <div className="system-badge secure">
            <ShieldCheck size={14} />
            <span>Bunny HMAC Webhooks</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {error && (
          <div className="alert alert-error main-error">
            <span>{error}</span>
            <button onClick={() => fetchVideos(true)} className="btn btn-secondary btn-sm">
              Retry Connection
            </button>
          </div>
        )}

        {selectedVideo ? (
          <VideoPlayer
            video={selectedVideo}
            onBack={() => setSelectedVideo(null)}
            onRefreshVideo={() => fetchVideos(false)}
          />
        ) : (
          <div className="dashboard-grid">
            <div className="dashboard-column">
              <VideoUpload onUploadSuccess={handleUploadSuccess} />
            </div>

            <div className="dashboard-column wide">
              {loading ? (
                <div className="card loading-card">
                  <span className="spinner large"></span>
                  <p>Loading video library...</p>
                </div>
              ) : (
                <VideoList
                  videos={videos}
                  onSelectVideo={(video) => setSelectedVideo(video)}
                  onRefresh={handleManualSync}
                  isPolling={isPolling}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="main-footer">
        <p>
          Bunny Stream Architecture POC &bull; Frontend React+Vite &bull; Backend Fastify+SQLite &bull; HMAC SHA256 Webhook Verification
        </p>
      </footer>
    </div>
  );
};
