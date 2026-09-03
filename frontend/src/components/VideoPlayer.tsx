import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Loader2, AlertCircle, Sparkles, CheckCircle, ShieldCheck, Clock } from 'lucide-react';
import { api, Video, PlaybackData } from '../services/api';

interface VideoPlayerProps {
  video: Video;
  onBack: () => void;
  onRefreshVideo: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  onBack,
  onRefreshVideo,
}) => {
  const [playbackData, setPlaybackData] = useState<PlaybackData | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchPlayback() {
      setLoadingPlayback(true);
      setPlaybackError(null);
      try {
        const data = await api.getPlaybackUrl(video.id);
        if (isMounted) {
          setPlaybackData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err.response?.data?.error || err.message || 'Failed to generate Bunny playback URL';
          setPlaybackError(msg);
        }
      } finally {
        if (isMounted) setLoadingPlayback(false);
      }
    }

    fetchPlayback();

    return () => {
      isMounted = false;
    };
  }, [video.id]);

  // If transcription is ready, load transcript text automatically or when requested
  const handleLoadTranscript = async () => {
    setLoadingTranscript(true);
    try {
      const data = await api.getTranscript(video.id);
      setTranscriptText(data.transcript);
      setShowTranscript(true);
    } catch (err: any) {
      setTranscriptText('No transcript text returned from Bunny Stream API yet. Ensure transcription is finished.');
      setShowTranscript(true);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const renderTranscriptContent = () => {
    if (!transcriptText) return null;

    const lines = transcriptText.split(/\r?\n/).filter(Boolean);
    const parsedItems = lines.map((line) => {
      const match = line.match(/^\[(.*?)\]\s*(.*)$/);
      if (match) {
        return { timestamp: match[1], text: match[2] };
      }
      return { timestamp: '', text: line };
    });

    return (
      <div className="transcript-cue-list">
        {parsedItems.map((item, idx) => (
          <div key={idx} className="transcript-cue-item">
            {item.timestamp && (
              <span className="transcript-timestamp-badge">
                <Clock size={12} /> {item.timestamp}
              </span>
            )}
            <span className="transcript-cue-text">{item.text}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="player-view">
      <div className="player-header">
        <button onClick={onBack} className="btn btn-secondary btn-sm back-btn">
          <ArrowLeft size={18} /> Back to Videos
        </button>
        <div className="player-title-group">
          <h1>{video.title}</h1>
          <span className="badge badge-success">READY</span>
        </div>
      </div>

      <div className="player-content-grid">
        {/* Main Left Column: Video Player + Transcript Below */}
        <div className="player-main-column">
          <div className="video-frame-container card">
            {loadingPlayback && (
              <div className="player-loading">
                <Loader2 size={40} className="spin text-primary" />
                <p>Authorizing & Requesting Bunny Stream Embed Token...</p>
              </div>
            )}

            {playbackError && (
              <div className="alert alert-error">
                <AlertCircle size={20} />
                <div>
                  <strong>Playback Authorization Error:</strong>
                  <p>{playbackError}</p>
                  <p className="hint">Ensure BUNNY_LIBRARY_ID and BUNNY_STREAM_API_KEY / BUNNY_TOKEN_SECURITY_KEY are configured in backend/.env.</p>
                </div>
              </div>
            )}

            {!loadingPlayback && playbackData && (
              <div className="responsive-iframe-wrapper">
                <iframe
                  src={playbackData.embedUrl}
                  loading="lazy"
                  title={video.title}
                  style={{ border: 'none', width: '100%', height: '100%', aspectRatio: '16 / 9' }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                ></iframe>
              </div>
            )}
          </div>

          {/* AI Transcript Panel BELOW Video */}
          <div className="card transcript-card-below">
            <div className="transcript-header">
              <Sparkles className="icon-sparkle" size={20} />
              <h3>Video Transcript & Timestamps</h3>
            </div>

            {(video.transcriptionStatus === 'PROCESSING' || video.transcriptionStatus === 'NOT_REQUESTED') && (
              <div className="transcript-state">
                <div className="processing-badge">
                  <Loader2 size={18} className="spin text-amber" />
                  <span>Auto-transcribing...</span>
                </div>
                <p className="hint-text">Bunny Stream is automatically transcribing the audio. The status will auto-update when completed.</p>
              </div>
            )}

            {video.transcriptionStatus === 'READY' && (
              <div className="transcript-state">
                <div className="ready-badge">
                  <CheckCircle size={18} className="text-emerald" />
                  <span>Transcript Ready</span>
                </div>

                {!showTranscript ? (
                  <button
                    onClick={handleLoadTranscript}
                    className="btn btn-secondary btn-sm"
                    disabled={loadingTranscript}
                  >
                    {loadingTranscript ? (
                      <>
                        <Loader2 size={16} className="spin" /> Loading Transcript...
                      </>
                    ) : (
                      <>
                        <FileText size={16} /> Show Transcript with Timestamps
                      </>
                    )}
                  </button>
                ) : (
                  renderTranscriptContent()
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Column: Video Info & DRM Protection */}
        <div className="player-sidebar">
          <div className="card sidebar-card">
            <h3>Video Information</h3>
            <div className="info-list">
              <div className="info-item">
                <span className="info-label">Title</span>
                <span className="info-val">{video.title}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Original File</span>
                <span className="info-val truncate">{video.originalFilename}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Bunny GUID</span>
                <span className="info-val code-text">{video.bunnyVideoId}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Library ID</span>
                <span className="info-val">{video.bunnyLibraryId}</span>
              </div>
            </div>
          </div>

          <div className="card sidebar-card drm-card">
            <div className="transcript-header">
              <ShieldCheck className="text-emerald" size={20} />
              <h3>DRM Protection</h3>
            </div>
            <div className="info-list">
              <div className="info-item">
                <span className="info-label">Security</span>
                <span className="badge badge-success">MediaCage DRM Active</span>
              </div>
              <div className="info-item column-item">
                <span className="info-label">FairPlay License Server</span>
                <code className="info-val code-text truncate-code">
                  https://video.bunnycdn.com/FairPlay/{video.bunnyLibraryId}/license/?videoId={video.bunnyVideoId}
                </code>
              </div>
              <div className="info-item column-item">
                <span className="info-label">Widevine License Server</span>
                <code className="info-val code-text truncate-code">
                  https://video.bunnycdn.com/Widevine/{video.bunnyLibraryId}/license/?videoId={video.bunnyVideoId}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
