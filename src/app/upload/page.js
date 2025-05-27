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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-3xl w-full mx-auto p-6 bg-neutral-900 border-2 border-white/20 rounded-sm">
        <div className="bg-neutral-900 rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-8 text-center">Upload Log File</h1>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {message && (
            <div className="mb-6 p-4 bg-green-500/20 border-l-4 border-green-500 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-300">{message}</p>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <label className="block text-sm font-medium text-white/90">
                  Select a .LOG file to upload
                </label>
                <div className="relative">
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
                    className="block w-full text-sm text-white/80
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-500/20 file:text-blue-200
                      hover:file:bg-blue-500/30
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                </div>
                <button 
                  type="submit" 
                  disabled={!file || uploading}
                  className={`
                    relative w-full flex justify-center py-3 px-4 rounded-md text-sm font-semibold transition-all duration-200
                    ${!file || uploading 
                      ? 'bg-gray-700 text-white/40 cursor-not-allowed' 
                      : 'bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    }
                  `}
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : 'Upload File'}
                </button>
              </div>
            </div>
          </form>

          {recentFiles.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Recent Files</h2>
              <div className="space-y-3">
                {recentFiles.map((recentFile, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 bg-neutral-700/50 rounded-lg border border-white/10 hover:border-white/20 hover:bg-neutral-700 transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <svg className="h-5 w-5 text-white/60 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        <p className="font-medium text-white truncate">{recentFile.name}</p>
                      </div>
                      <p className="mt-1 text-sm text-white/60">{formatDate(recentFile.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/log?url=${encodeURIComponent(recentFile.url)}`)}
                      className="ml-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-200 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      View Logs
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}