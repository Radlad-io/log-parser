"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!file.name.endsWith('.LOG')) {
      setError('Only .log files are allowed');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (data.exists) {
        setMessage('File already exists! Redirecting to log page...');
      } else {
        setMessage('Upload successful! Redirecting to log page...');
      }

      // Short delay to show the message before redirect
      setTimeout(() => {
        router.push(`/log?url=${encodeURIComponent(data.url)}`);
      }, 1500);

    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div>
        <h1>Upload Log File</h1>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            accept=".LOG"
            onChange={(e) => {
              const selectedFile = e.target.files[0];
              if (selectedFile && !selectedFile.name.endsWith('.LOG')) {
                setError('Only .LOG files are allowed');
                return;
              }
              setFile(selectedFile);
              setError('');
              setMessage('');
            }}
            disabled={uploading}
          />
          <button type="submit" disabled={!file || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </div>
    </div>
  );
}