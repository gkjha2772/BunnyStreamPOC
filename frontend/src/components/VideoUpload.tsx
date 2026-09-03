import React, { useState } from 'react';
import { Upload, Film, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, Video } from '../services/api';

interface VideoUploadProps {
  onUploadSuccess: (newVideo: Video) => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ onUploadSuccess }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        // Auto-fill title from filename (removing extension)
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file to upload.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    setSuccess(false);

    try {
      const newVideo = await api.uploadVideo(title, file, (percent) => {
        setProgress(percent);
      });

      setSuccess(true);
      setTitle('');
      setFile(null);

      // Reset file input element
      const fileInput = document.getElementById('video-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      onUploadSuccess(newVideo);

      setTimeout(() => {
        setSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error('Upload failed:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to upload video. Check backend configuration.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card upload-card">
      <div className="card-header">
        <Upload className="icon-header" size={24} />
        <h2>Upload Video</h2>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>Video uploaded successfully! Bunny CDN is processing the video.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="video-title">Video Title</label>
          <input
            id="video-title"
            type="text"
            placeholder="e.g. Introduction to Algebra - Lesson 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="video-file-input">Select Video File</label>
          <div className="file-drop-zone">
            <input
              id="video-file-input"
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
              onChange={handleFileChange}
              disabled={uploading}
              required
            />
            <div className="drop-zone-content">
              <Film size={32} className="drop-icon" />
              {file ? (
                <div className="selected-file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
              ) : (
                <p>Click or drag a video file here (.mp4, .mov, .mkv, .webm)</p>
              )}
            </div>
          </div>
        </div>

        {uploading && (
          <div className="progress-section">
            <div className="progress-labels">
              <span>Uploading to backend & Bunny CDN...</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={uploading || !file}
        >
          {uploading ? (
            <>
              <span className="spinner"></span>
              Uploading... {progress}%
            </>
          ) : (
            'Upload Video'
          )}
        </button>
      </form>
    </div>
  );
};
