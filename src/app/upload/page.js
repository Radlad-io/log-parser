"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

const RECENT_FILES_KEY = 'recentLogFiles';
const MAX_RECENT_FILES = 5;

export default function Upload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recentFiles, setRecentFiles] = useState([]);
  const router = useRouter();

  // Load recent files from localStorage on component mount
  useEffect(() => {
    const savedFiles = localStorage.getItem(RECENT_FILES_KEY);
    if (savedFiles) {
      setRecentFiles(JSON.parse(savedFiles));
    }
  }, []);

  // Function to add a new file to recent files
  const addToRecentFiles = (fileName, fileUrl) => {
    const newFile = {
      name: fileName,
      url: fileUrl,
      timestamp: new Date().toISOString()
    };

    const updatedFiles = [newFile, ...recentFiles]
      .filter((file, index, self) => 
        index === self.findIndex((f) => f.url === file.url)
      )
      .slice(0, MAX_RECENT_FILES);

    setRecentFiles(updatedFiles);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updatedFiles));
  };

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

      // Add to recent files regardless of whether it existed or not
      addToRecentFiles(file.name, data.url);

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

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className={styles.page}>
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Upload Log File</h1>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {message && <p className="text-green-500 mb-4">{message}</p>}
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4 items-center">
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
              className="flex-1 p-2 border rounded"
            />
            <button 
              type="submit" 
              disabled={!file || uploading}
              className={`px-4 py-2 rounded ${
                !file || uploading 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>

        {recentFiles.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Files</h2>
            <div className="space-y-2">
              {recentFiles.map((recentFile, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
                >
                  <div className="flex-1">
                    <p className="font-medium">{recentFile.name}</p>
                    <p className="text-sm text-gray-500">{formatDate(recentFile.timestamp)}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/log?url=${encodeURIComponent(recentFile.url)}`)}
                    className="ml-4 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    View Logs
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}