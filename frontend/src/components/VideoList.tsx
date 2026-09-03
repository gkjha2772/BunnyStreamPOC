import React from 'react';
import { Play, FileText, RefreshCw, AlertCircle, CheckCircle, Clock, Cpu } from 'lucide-react';
import { Video, VideoStatus } from '../services/api';

interface VideoListProps {
  videos: Video[];
  onSelectVideo: (video: Video) => void;
  onRefresh: () => void;
  isPolling?: boolean;
}

export const VideoList: React.FC<VideoListProps> = ({
  videos,
  onSelectVideo,
  onRefresh,
  isPolling = false,
}) => {
  const getStatusBadge = (status: VideoStatus) => {
    switch (status) {
      case 'READY':
        return (
          <span className="badge badge-success">
            <CheckCircle size={14} /> READY
          </span>
        );
      case 'ENCODING':
        return (
          <span className="badge badge-purple">
            <Cpu size={14} className="spin" /> ENCODING
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="badge badge-amber">
            <RefreshCw size={14} className="spin" /> PROCESSING
          </span>
        );
      case 'QUEUED':
        return (
          <span className="badge badge-blue">
            <Clock size={14} /> QUEUED
          </span>
        );
      case 'UPLOADING':
        return (
          <span className="badge badge-info">
            <UploadIcon size={14} className="spin" /> UPLOADING
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge badge-error">
            <AlertCircle size={14} /> FAILED
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getTranscriptionBadge = (transcriptionStatus: string) => {
    switch (transcriptionStatus) {
      case 'READY':
        return <span className="text-badge text-badge-success">Ready</span>;
      case 'PROCESSING':
        return <span className="text-badge text-badge-warning">Processing</span>;
      case 'FAILED':
        return <span className="text-badge text-badge-error">Failed</span>;
      default:
        return <span className="text-badge text-badge-muted">Not Generated</span>;
    }
  };

  return (
    <div className="card video-list-card">
      <div className="card-header video-list-header">
        <div className="header-title-group">
          <h2>Videos ({videos.length})</h2>
          {isPolling && (
            <span className="live-polling-indicator">
              <span className="pulse-dot"></span> Auto-syncing status...
            </span>
          )}
        </div>
        <button onClick={onRefresh} className="btn btn-secondary btn-sm" title="Manually check live status from Bunny API">
          <RefreshCw size={16} /> Sync Status
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="empty-state">
          <p>No videos uploaded yet. Upload a video above to demonstrate Bunny Stream lifecycle!</p>
        </div>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <div key={video.id} className={`video-card status-${video.videoStatus.toLowerCase()}`}>
              <div className="video-card-header">
                <h3 className="video-title" title={video.title}>
                  {video.title}
                </h3>
                {getStatusBadge(video.videoStatus)}
              </div>

              <div className="video-card-details">
                <div className="detail-row">
                  <span className="label">Original File:</span>
                  <span className="value truncate">{video.originalFilename}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Bunny Video ID:</span>
                  <span className="value code-text">{video.bunnyVideoId || 'Creating...'}</span>
                </div>

                {(video.videoStatus === 'ENCODING' || video.videoStatus === 'PROCESSING') && (
                  <div className="detail-row progress-row">
                    <span className="label">Progress:</span>
                    <div className="mini-progress-bar">
                      <div
                        className="mini-progress-fill"
                        style={{ width: `${video.encodeProgress || 15}%` }}
                      ></div>
                    </div>
                    <span className="progress-percent">{video.encodeProgress || 15}%</span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="label">Transcription:</span>
                  {getTranscriptionBadge(video.transcriptionStatus)}
                </div>
              </div>

              <div className="video-card-actions">
                <button
                  className="btn btn-primary btn-sm btn-block"
                  disabled={video.videoStatus !== 'READY'}
                  onClick={() => onSelectVideo(video)}
                >
                  <Play size={16} /> Watch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper icon
const UploadIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
