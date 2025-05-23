"use client"

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import LogViewer from './LogViewer';

// IndexedDB setup
const DB_NAME = 'LogParserDB';
const STORE_NAME = 'logLines';
const DB_VERSION = 4;

export default function LogPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isProcessed, setIsProcessed] = useState(false);

  useEffect(() => {
    const fileUrl = searchParams.get('url');
    if (!fileUrl) {
      setError('No file URL provided');
      setLoading(false);
      return;
    }

    const initDB = () => {
      return new Promise((resolve, reject) => {
        console.log('Initializing database');
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          console.log('Database initialized successfully');
          resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
          console.log('Database upgrade needed');
          const db = event.target.result;
          
          // If old store exists, delete it
          if (db.objectStoreNames.contains(STORE_NAME)) {
            db.deleteObjectStore(STORE_NAME);
          }
          
          // Create new store with updated schema
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'lineNumber' });
          
          // Add indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('serialNumber', 'serialNumber', { unique: false });
          store.createIndex('logType', 'logType', { unique: false });
          store.createIndex('composite', ['timestamp', 'logType'], { unique: false });
          console.log('Database schema updated');
        };
      });
    };

    const parseTimestamp = (line) => {
      // Common timestamp patterns in log files
      const patterns = [
        // ISO format: 2024-03-14T12:34:56.789Z
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
        // Common log format: [14/Mar/2024:12:34:56 +0000]
        /\[(\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [-+]\d{4})\]/,
        // Simple format: 2024-03-14 12:34:56
        /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
        // Unix timestamp
        /\d{10}/
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          return {
            timestamp: new Date(match[0]).getTime(),
            pattern: match[0]
          };
        }
      }
      return { timestamp: null, pattern: null };
    };

    const extractSerialNumber = (line) => {
      const patterns = [
        /alexa35-([A-Za-z0-9]+)/i,  // Standard format
        /alexa35[_\s-]([A-Za-z0-9]+)/i,  // Allow underscore or space
        /alexa35:\s*([A-Za-z0-9]+)/i  // Allow colon format
      ];
      
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          return {
            serialNumber: match[1],
            pattern: match[0]
          };
        }
      }
      return { serialNumber: null, pattern: null };
    };

    const extractLogType = (content) => {
      // Match patterns like "kernel:" or "concern[371]:"
      const match = content.match(/^([a-zA-Z]+(?:\[\d+\])?):(?:\s+|$)/);
      if (match) {
        return {
          logType: match[1],
          pattern: match[0]
        };
      }
      return { logType: 'unknown', pattern: null };
    };

    const cleanContent = (line, timestampPattern, serialNumberPattern) => {
      let cleanedContent = line;
      
      // Remove timestamp if found
      if (timestampPattern) {
        cleanedContent = cleanedContent.replace(timestampPattern, '');
      }
      
      // Remove serial number if found
      if (serialNumberPattern) {
        cleanedContent = cleanedContent.replace(serialNumberPattern, '');
      }
      
      // Remove floating point numbers from the start of the line
      cleanedContent = cleanedContent.replace(/^\s*-?\d*\.?\d+\s*/, '');

      // Extract and remove log type
      const { logType, pattern: logTypePattern } = extractLogType(cleanedContent);
      if (logTypePattern) {
        cleanedContent = cleanedContent.replace(logTypePattern, '');
      }
      
      // Clean up extra spaces and trim
      return {
        cleanedContent: cleanedContent.replace(/\s+/g, ' ').trim(),
        logType
      };
    };

    const fetchAndStoreLog = async () => {
      try {
        console.log('Starting log processing');
        const db = await initDB();
        
        // Clear existing data
        const clearTx = db.transaction(STORE_NAME, 'readwrite');
        const store = clearTx.objectStore(STORE_NAME);
        await store.clear();
        console.log('Cleared existing data');

        // Fetch the file
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch log file');
        
        const text = await response.text();
        const lines = text.split('\n');
        console.log('Fetched log file, total lines:', lines.length);
        
        // Store lines in batches
        const batchSize = 1000;
        const totalLines = lines.length;
        
        for (let i = 0; i < totalLines; i += batchSize) {
          const batch = lines.slice(i, i + batchSize).map((line, index) => {
            // Extract timestamp and serial number from the line content
            const { timestamp, pattern: timestampPattern } = parseTimestamp(line);
            const { serialNumber, pattern: serialPattern } = extractSerialNumber(line);
            
            // Clean the content and extract log type
            const { cleanedContent, logType } = cleanContent(line, timestampPattern, serialPattern);
            
            return {
              lineNumber: i + index + 1,  // Primary key
              timestamp: timestamp || new Date().getTime(),  // Secondary key
              serialNumber: serialNumber || '',  // Third key
              logType,  // Fourth key
              content: cleanedContent  // Cleaned content
            };
          });

          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          
          await Promise.all(batch.map(line => {
            return new Promise((resolve, reject) => {
              const request = store.put(line);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          }));

          setProgress({
            current: Math.min(i + batchSize, totalLines),
            total: totalLines
          });
        }

        console.log('Finished processing log file');
        setIsProcessed(true);
        setLoading(false);
      } catch (err) {
        console.error('Error processing log file:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchAndStoreLog();
  }, [searchParams]);

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Loading Log File</h1>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ 
              width: `${(progress.current / progress.total) * 100}%` 
            }}
          ></div>
        </div>
        <p className="mt-2">
          Processing lines: {progress.current} / {progress.total}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Log File Viewer</h1>
      {isProcessed && <LogViewer key="log-viewer" />}
    </div>
  );
} 