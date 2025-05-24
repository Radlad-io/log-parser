"use client"

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from './Header';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const DB_NAME = 'LogParserDB';
const STORE_NAME = 'logLines';

function LogViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL parameters
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [isCaseSensitive, setIsCaseSensitive] = useState(searchParams.get('caseSensitive') === 'true');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [filteredKeys, setFilteredKeys] = useState([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [logDate, setLogDate] = useState(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchParams.get('search') || '');
  const [logTypes, setLogTypes] = useState([]);
  const [selectedLogTypes, setSelectedLogTypes] = useState(
    searchParams.get('logTypes') ? searchParams.get('logTypes').split(',') : []
  );
  const [logTypeCounts, setLogTypeCounts] = useState({});
  const linesPerPage = 1000;
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  // Time handling functions
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
    if (!match) return null;
    
    let [_, hours, minutes, meridian] = match;
    hours = parseInt(hours);
    minutes = parseInt(minutes);
    
    if (meridian) {
      meridian = meridian.toLowerCase();
      if (meridian === 'pm' && hours < 12) hours += 12;
      if (meridian === 'am' && hours === 12) hours = 0;
    }
    
    console.log('Converting time to minutes:', { timeStr, hours, minutes, total: hours * 60 + minutes });
    return hours * 60 + minutes;
  };

  const formatTimeForUrl = (minutes) => {
    if (minutes === null) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Initialize time filters from URL
  useEffect(() => {
    const urlStartTime = searchParams.get('startTime');
    const urlEndTime = searchParams.get('endTime');
    
    console.log('Loading time filters from URL:', { urlStartTime, urlEndTime });
    
    if (urlStartTime) setStartTime(urlStartTime);
    if (urlEndTime) setEndTime(urlEndTime);
  }, [searchParams]);

  // Function to export current log data
  const exportLogData = async () => {
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const allRecords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Create a blob from the log data
      const logBlob = new Blob([JSON.stringify(allRecords)], { type: 'application/json' });
      return URL.createObjectURL(logBlob);
    } catch (err) {
      console.error('Error exporting log data:', err);
      throw err;
    }
  };

  // Function to generate shareable URL
  const generateShareableUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      
      // Preserve the original log file URL
      const originalFileUrl = params.get('url');
      if (!originalFileUrl) {
        throw new Error('No log file URL found');
      }

      // Create new params with the file URL
      const newParams = new URLSearchParams();
      newParams.set('url', originalFileUrl);
      
      // Add other parameters
      if (page !== 1) newParams.set('page', page.toString());
      if (searchTerm) newParams.set('search', searchTerm);
      if (isCaseSensitive) newParams.set('caseSensitive', 'true');
      
      // Format times in 24-hour format for consistency
      if (startTime) {
        const startMinutes = timeToMinutes(startTime);
        if (startMinutes !== null) {
          newParams.set('startTime', formatTimeForUrl(startMinutes));
        }
      }
      if (endTime) {
        const endMinutes = timeToMinutes(endTime);
        if (endMinutes !== null) {
          newParams.set('endTime', formatTimeForUrl(endMinutes));
        }
      }
      
      if (selectedLogTypes.length > 0) newParams.set('logTypes', selectedLogTypes.join(','));

      // Get the current URL without any search parameters
      const url = new URL(window.location.href);
      url.search = newParams.toString();

      console.log('Generated shareable URL:', {
        baseUrl: url.origin + url.pathname,
        params: newParams.toString(),
        fullUrl: url.href,
        originalFileUrl,
        startTime,
        endTime
      });

      return url.href;
    } catch (err) {
      console.error('Error generating shareable URL:', err);
      setError('Unable to generate shareable URL: No log file URL found');
      return window.location.href; // Fallback to current URL
    }
  };

  // Update search status with time range
  useEffect(() => {
    let status = `Showing ${lines.length} records`;
    if (searchTerm) {
      status += ` for "${searchTerm}"${isCaseSensitive ? ' (case-sensitive)' : ''}`;
    }
    if (startTime || endTime) {
      status += ` between ${startTime || 'start'} and ${endTime || 'end'}`;
    }
    setSearchStatus(status);
  }, [lines.length, searchTerm, isCaseSensitive, startTime, endTime]);

  // Utility functions
  const getBaseLogType = (logType) => {
    // Extract the base type without the numbers in brackets
    const baseType = logType.replace(/\[\d+\]$/, '').toLowerCase().trim();
    console.log('Original logType:', logType, 'Base type:', baseType);
    return baseType;
  };

  const getLogTypeColor = (logType) => {
    const baseType = getBaseLogType(logType);
    const colorMap = {
      // System processes
      'kernel': 'bg-red-50 text-red-600',
      'systemd': 'bg-purple-50 text-purple-600',
      'root': 'bg-purple-50 text-purple-600',
      'rsyslogd': 'bg-purple-50 text-purple-600',
      
      // Web/Network related
      'nginx': 'bg-green-50 text-green-600',
      'lighttpd': 'bg-green-50 text-green-600',
      'web': 'bg-green-50 text-green-600',
      'netmgr': 'bg-green-50 text-green-600',
      'sshd': 'bg-green-50 text-green-600',
      'rpcbind': 'bg-green-50 text-green-600',
      
      // Camera/Media related
      'canon': 'bg-blue-50 text-blue-600',
      'stillcap': 'bg-blue-50 text-blue-600',
      'streamer': 'bg-blue-50 text-blue-600',
      'medserv': 'bg-blue-50 text-blue-600',
      'auxmed': 'bg-blue-50 text-blue-600',
      
      // Control/Management
      'fancontrol': 'bg-yellow-50 text-yellow-600',
      'settingsmanager': 'bg-yellow-50 text-yellow-600',
      'inspector': 'bg-yellow-50 text-yellow-600',
      
      // Communication/Interface
      'comint': 'bg-indigo-50 text-indigo-600',
      'xcom': 'bg-indigo-50 text-indigo-600',
      'horus': 'bg-indigo-50 text-indigo-600',
      
      // System utilities
      'scrat': 'bg-orange-50 text-orange-600',
      'reaper': 'bg-orange-50 text-orange-600',
      'rip': 'bg-orange-50 text-orange-600',
      'super': 'bg-orange-50 text-orange-600',
      
      // Special cases
      'unknown': 'bg-gray-50 text-gray-600',
      'arrimount': 'bg-teal-50 text-teal-600',
      'concen': 'bg-pink-50 text-pink-600',
      'cap': 'bg-amber-50 text-amber-600'
    };
    const color = colorMap[baseType] || 'bg-gray-50 text-gray-600';
    console.log('Color mapping for', baseType, ':', color);
    return color;
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        return new Date(match[0]).getTime();
      }
    }
    return null;
  };

  const getBaseDate = (timestamp) => {
    const date = new Date(timestamp);
    // Keep the actual date, just zero out the time
    date.setHours(0, 0, 0, 0);
    console.log('Getting base date from timestamp:', {
      originalTimestamp: new Date(timestamp).toLocaleString(),
      baseDate: date.toLocaleString()
    });
    return date;
  };

  const parseTimeString = (timeStr) => {
    if (!timeStr) return null;
    
    // Handle both 12-hour and 24-hour formats
    const timeRegex = /^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i;
    const match = timeStr.trim().match(timeRegex);
    
    if (!match) {
      console.log('Failed to parse time string:', timeStr);
      return null;
    }
    
    let [_, hours, minutes, meridian] = match;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    
    // Convert 12-hour format to 24-hour if meridian is present
    if (meridian) {
      meridian = meridian.toLowerCase();
      if (meridian === 'pm' && hours < 12) hours += 12;
      if (meridian === 'am' && hours === 12) hours = 0;
    }
    
    console.log('Parsed time:', { timeStr, hours, minutes, meridian });
    return { hours, minutes };
  };

  // Function to create timestamp for a specific time on a given date
  const createTimestamp = (baseDate, timeStr) => {
    if (!baseDate || !timeStr) {
      console.log('Missing required data for timestamp:', { baseDate, timeStr });
      return null;
    }

    const parsedTime = parseTimeString(timeStr);
    if (!parsedTime) return null;

    const timestamp = new Date(baseDate);
    timestamp.setHours(parsedTime.hours);
    timestamp.setMinutes(parsedTime.minutes);
    timestamp.setSeconds(0);
    timestamp.setMilliseconds(0);

    console.log('Created timestamp:', {
      timeStr,
      parsedTime,
      baseDate: new Date(baseDate).toLocaleString(),
      result: new Date(timestamp).toLocaleString()
    });

    return timestamp.getTime();
  };

  const combineDateTime = (timeString) => {
    if (!timeString || !logDate) return null;
    
    const parsedTime = parseTimeString(timeString);
    if (!parsedTime) return null;

    const combined = new Date(logDate);
    combined.setHours(parsedTime.hours);
    combined.setMinutes(parsedTime.minutes);
    combined.setSeconds(0);
    combined.setMilliseconds(0);
    return combined.getTime();
  };

  const highlightText = (text, searchTerm) => {
    if (!searchTerm.trim()) return text;

    try {
      const trimmedSearchTerm = searchTerm.trim();
      const escapedSearchTerm = escapeRegExp(trimmedSearchTerm);
      const regex = new RegExp(`(${escapedSearchTerm})`, isCaseSensitive ? 'g' : 'gi');
      const parts = text.split(regex);

      return (
        <>
          {parts.map((part, i) => {
            if (isCaseSensitive ? part === trimmedSearchTerm : part.toLowerCase() === trimmedSearchTerm.toLowerCase()) {
              return (
                <mark 
                  key={i} 
                  className="bg-yellow-200 px-1 rounded"
                  style={{ backgroundColor: '#ebeb34' }}
                >
                  {part}
                </mark>
              );
            }
            return part;
          })}
        </>
      );
    } catch (e) {
      return text;
    }
  };

  // Function to copy URL to clipboard
  const copyShareableUrl = async () => {
    try {
      const url = generateShareableUrl();
      await navigator.clipboard.writeText(url);
      console.log('URL copied to clipboard:', url);
      
      // Show feedback
      setShowCopyFeedback(true);
      setTimeout(() => setShowCopyFeedback(false), 2000); // Hide after 2 seconds
    } catch (err) {
      console.error('Failed to copy URL:', err);
      setError('Failed to copy URL to clipboard');
    }
  };

  const updatePage = (newPage) => {
    setPage(newPage);
  };

  // Debounce search term updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Collect unique log types on initial load
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log('=== Starting initial load ===');
        console.log('Processing URL parameters:', {
          startTime,
          endTime,
          searchTerm,
          selectedLogTypes,
          page
        });

        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const allRecords = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        console.log('Total records loaded:', allRecords.length);

        // Find first record with timestamp to establish base date
        const firstValidRecord = allRecords.find(record => record.timestamp);
        if (!firstValidRecord) {
          console.error('No records with timestamps found');
          return;
        }

        // Set base date and serial number
        const baseDate = new Date(firstValidRecord.timestamp);
        baseDate.setHours(0, 0, 0, 0);
        setLogDate(baseDate.getTime());
        if (firstValidRecord.serialNumber) {
          setSerialNumber(firstValidRecord.serialNumber);
        }

        // Collect unique log types and count occurrences
        const uniqueLogTypes = [...new Set(allRecords.map(record => record.logType))].sort();
        const counts = allRecords.reduce((acc, record) => {
          acc[record.logType] = (acc[record.logType] || 0) + 1;
          return acc;
        }, {});
        
        setLogTypes(uniqueLogTypes);
        setLogTypeCounts(counts);

        // Apply filters
        let filtered = [...allRecords];
        console.log('Starting with records:', filtered.length);

        // Apply log type filter
        if (selectedLogTypes.length > 0) {
          filtered = filtered.filter(record => selectedLogTypes.includes(record.logType));
          console.log('After log type filter:', filtered.length);
        }

        // Apply search filter
        if (searchTerm) {
          filtered = filtered.filter(record => {
            const recordContent = isCaseSensitive ? record.content : record.content.toLowerCase();
            const recordLogType = isCaseSensitive ? record.logType : record.logType.toLowerCase();
            const searchFor = isCaseSensitive ? searchTerm : searchTerm.toLowerCase();
            return recordContent.includes(searchFor) || recordLogType.includes(searchFor);
          });
          console.log('After search filter:', filtered.length);
        }

        // Time range filter
        if (startTime || endTime) {
          console.log('=== Time Range Filtering ===');
          
          const startMinutes = timeToMinutes(startTime);
          const endMinutes = timeToMinutes(endTime);

          console.log('Time range in minutes:', { 
            startTime,
            endTime,
            startMinutes, 
            endMinutes 
          });

          filtered = filtered.filter(record => {
            const recordDate = new Date(record.timestamp);
            const recordMinutes = recordDate.getHours() * 60 + recordDate.getMinutes();

            const matchesStart = !startMinutes || recordMinutes >= startMinutes;
            const matchesEnd = !endMinutes || recordMinutes <= endMinutes;

            // Log first few records for debugging
            if (filtered.indexOf(record) < 3) {
              console.log('Record comparison:', {
                recordTime: recordDate.toLocaleTimeString(),
                recordMinutes,
                startMinutes,
                endMinutes,
                matches: matchesStart && matchesEnd
              });
            }

            return matchesStart && matchesEnd;
          });

          console.log('After time filter:', filtered.length);
        }

        // Sort and update state
        filtered.sort((a, b) => a.lineNumber - b.lineNumber);
        const filteredLineNumbers = filtered.map(record => record.lineNumber);
        setFilteredKeys(filteredLineNumbers);
        setTotalPages(Math.max(1, Math.ceil(filtered.length / linesPerPage)));

        const pageRecords = filtered.slice((page - 1) * linesPerPage, page * linesPerPage);
        setLines(pageRecords);

        // Status message
        let status = `Found ${filtered.length} records`;
        if (searchTerm) {
          status += ` for "${searchTerm}"${isCaseSensitive ? ' (case-sensitive)' : ''}`;
        }
        if (startTime || endTime) {
          status += ` between ${startTime || 'start'} and ${endTime || 'end'}`;
        }
        setSearchStatus(status);
        setLoading(false);

      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Effect to handle time range filtering
  useEffect(() => {
    const applyTimeFilter = async () => {
      if (!startTime && !endTime) return;

      try {
        setLoading(true);
        console.log('Applying time filter:', { startTime, endTime });

        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const allRecords = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        console.log('Time range in minutes:', {
          startTime,
          endTime,
          startMinutes,
          endMinutes
        });

        let filtered = allRecords;

        if (startMinutes !== null || endMinutes !== null) {
          filtered = filtered.filter(record => {
            const recordDate = new Date(record.timestamp);
            const recordMinutes = recordDate.getHours() * 60 + recordDate.getMinutes();

            // Log the first few records for debugging
            if (filtered.indexOf(record) < 3) {
              console.log('Record time check:', {
                recordTime: recordDate.toLocaleTimeString(),
                recordMinutes,
                startMinutes,
                endMinutes,
                isAfterStart: !startMinutes || recordMinutes >= startMinutes,
                isBeforeEnd: !endMinutes || recordMinutes <= endMinutes
              });
            }

            const matchesStart = startMinutes === null || recordMinutes >= startMinutes;
            const matchesEnd = endMinutes === null || recordMinutes <= endMinutes;

            return matchesStart && matchesEnd;
          });

          console.log('After time filtering:', {
            originalCount: allRecords.length,
            filteredCount: filtered.length,
            sampleTimes: filtered.slice(0, 3).map(r => new Date(r.timestamp).toLocaleTimeString())
          });
        }

        // Update the filtered results
        filtered.sort((a, b) => a.lineNumber - b.lineNumber);
        const filteredLineNumbers = filtered.map(record => record.lineNumber);
        setFilteredKeys(filteredLineNumbers);
        setTotalPages(Math.max(1, Math.ceil(filtered.length / linesPerPage)));
        setPage(1);
        setLines(filtered.slice(0, linesPerPage));

      } catch (err) {
        console.error('Error applying time filter:', err);
        setError('Failed to apply time filter');
      } finally {
        setLoading(false);
      }
    };

    applyTimeFilter();
  }, [startTime, endTime]);

  // Modify searchAllRecords to use the same time filtering logic
  const searchAllRecords = async (search = '') => {
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const allRecords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      let filtered = [...allRecords];
      const trimmedSearch = search.trim();

      // Apply log type filter
      if (selectedLogTypes.length > 0) {
        filtered = filtered.filter(record => selectedLogTypes.includes(record.logType));
      }

      // Apply search filter
      if (trimmedSearch !== '') {
        filtered = filtered.filter(record => {
          const recordContent = isCaseSensitive ? record.content : record.content.toLowerCase();
          const recordLogType = isCaseSensitive ? record.logType : record.logType.toLowerCase();
          const searchFor = isCaseSensitive ? trimmedSearch : trimmedSearch.toLowerCase();
          
          return recordContent.includes(searchFor) || recordLogType.includes(searchFor);
        });
      }

      // Apply time filter
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      if (startMinutes !== null || endMinutes !== null) {
        filtered = filtered.filter(record => {
          const recordDate = new Date(record.timestamp);
          const recordMinutes = recordDate.getHours() * 60 + recordDate.getMinutes();

          const matchesStart = startMinutes === null || recordMinutes >= startMinutes;
          const matchesEnd = endMinutes === null || recordMinutes <= endMinutes;

          return matchesStart && matchesEnd;
        });

        console.log('Time filtering in search:', {
          startTime,
          endTime,
          startMinutes,
          endMinutes,
          filteredCount: filtered.length,
          sampleTimes: filtered.slice(0, 3).map(r => new Date(r.timestamp).toLocaleTimeString())
        });
      }

      return filtered;
    } catch (err) {
      console.error('Error searching records:', err);
      throw err;
    }
  };

  // Modify the useEffect that handles search to properly trigger on time range changes
  useEffect(() => {
    const performSearch = async () => {
      setSearchLoading(true);
      
      try {
        const filtered = await searchAllRecords(debouncedSearchTerm);

        filtered.sort((a, b) => a.lineNumber - b.lineNumber);
        const filteredLineNumbers = filtered.map(record => record.lineNumber);
        setFilteredKeys(filteredLineNumbers);
        setTotalPages(Math.max(1, Math.ceil(filtered.length / linesPerPage)));
        setPage(1);
        setLines(filtered.slice(0, linesPerPage));

        const totalRecords = filtered.length;
        let status = `Found ${totalRecords} matching records`;
        if (debouncedSearchTerm.trim() !== '') {
          status += ` for "${debouncedSearchTerm}"${isCaseSensitive ? ' (case-sensitive)' : ''}`;
        }
        if (startTime || endTime) {
          status += ` between ${startTime || 'start'} and ${endTime || 'end'}`;
        }
        setSearchStatus(status);
      } catch (err) {
        console.error('Search failed:', err);
        setError(err.message);
      } finally {
        setSearchLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, startTime, endTime, isCaseSensitive, selectedLogTypes]);

  const handleClear = async () => {
    setSearchTerm('');
    setStartTime('');
    setEndTime('');
    setLoading(true);
    setPage(1);
    setError(null);
    setLogDate(null);
    
    try {
      await searchAllRecords('');
      await fetchPageOfResults(1);
    } catch (err) {
      console.error('Clear failed:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchPageOfResults = async (pageNum) => {
    try {
      console.log('Fetching page:', pageNum, 'with filteredKeys:', filteredKeys.length);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // Only fetch the filtered keys for the current page
      const start = (pageNum - 1) * linesPerPage;
      const end = start + linesPerPage;
      const pageKeys = filteredKeys.slice(start, end);
      console.log('Page keys:', pageKeys.length, 'from', start, 'to', end);

      if (pageKeys.length === 0) {
        console.log('No page keys found');
        setLines([]);
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        pageKeys.map(key => 
          new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          })
        )
      );

      const filteredResults = results.filter(Boolean);
      console.log('Fetched results:', filteredResults.length);
      setLines(filteredResults);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching page:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      const params = new URLSearchParams(window.location.search);
      const blobUrl = params.get('logData');
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  // Load log data from blob URL if present
  useEffect(() => {
    const loadLogDataFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const blobUrl = params.get('logData');
      
      if (!blobUrl) return;

      try {
        const response = await fetch(blobUrl);
        const logData = await response.json();
        
        // Open IndexedDB and store the log data
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // Clear existing data
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Store new data
        for (const record of logData) {
          await new Promise((resolve, reject) => {
            const request = store.add(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }

        // Revoke the blob URL after use
        URL.revokeObjectURL(blobUrl);
        
        // Trigger initial load
        await loadInitialData();
      } catch (err) {
        console.error('Error loading log data from URL:', err);
        setError('Failed to load log data from URL');
      }
    };

    loadLogDataFromUrl();
  }, []);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <Header 
        totalRecords={filteredKeys.length}
        displayedRecords={lines.length}
        serialNumber={serialNumber}
        date={new Date(logDate).toLocaleDateString()}
      />

      <div className="flex flex-row min-h-screen w-full">
        {/* Left Column - Search and Filters */}
        <aside className="w-1/4 min-w-[300px] p-4 border-r border-gray-200 bg-background sticky top-0">
          <div className="">
            <h2 className="text-xl font-semibold mb-4">Search & Filters</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search logs..."
                      className="w-full p-2 border rounded"
                    />
                    {searchLoading && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 whitespace-nowrap"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="caseSensitive"
                    checked={isCaseSensitive}
                    onChange={(e) => setIsCaseSensitive(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="caseSensitive" className="text-sm text-gray-600">
                    Case-sensitive search
                  </label>
                </div>
              </div>

              <span className="m-6" />

              {/* Log Type Filter */}
              <div className="space-y-2">
                <label className="block text-lg text-white font-medium">
                  Log Types
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                  {logTypes.map(logType => (
                    <div key={logType} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`logType-${logType}`}
                        checked={selectedLogTypes.includes(logType)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLogTypes([...selectedLogTypes, logType]);
                          } else {
                            setSelectedLogTypes(selectedLogTypes.filter(t => t !== logType));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`logType-${logType}`} className="text-sm text-gray-600 text-white">
                        {logType} ({logTypeCounts[logType] || 0})
                      </label>
                    </div>
                  ))}
                </div>
                {logTypes.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLogTypes(logTypes)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLogTypes([])}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              <span className="m-6" />

              {/* Time Range Filter */}
              <div className="space-y-2">
                <label className="block text-lg text-white font-medium">
                  Time Range
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>

              <span className="m-6" />

              {/* Pagination */}
              <div className="p-4 rounded-lg shadow-lg border border-gray-200">
                <Pagination>
                  <PaginationContent className="flex flex-wrap gap-1 text-sm">
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) {
                            setPage(page - 1);
                            fetchPageOfResults(page - 1);
                          }
                        }}
                        aria-disabled={page === 1}
                        className={`${page === 1 ? 'pointer-events-none opacity-50' : ''} text-sm`}
                      />
                    </PaginationItem>
                    
                    {/* First Page */}
                    {page > 2 && (
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(1);
                            fetchPageOfResults(1);
                          }}
                          className="h-8 w-8 p-0 flex items-center justify-center text-sm"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Ellipsis */}
                    {page > 3 && (
                      <PaginationItem>
                        <PaginationEllipsis className="h-8 w-6 p-0 text-sm" />
                      </PaginationItem>
                    )}

                    {/* Previous Page */}
                    {page > 1 && (
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(page - 1);
                            fetchPageOfResults(page - 1);
                          }}
                          className="h-8 w-8 p-0 flex items-center justify-center text-sm"
                        >
                          {page - 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Current Page */}
                    <PaginationItem>
                      <PaginationLink 
                        href="#" 
                        isActive
                        className="h-8 w-8 p-0 flex items-center justify-center text-sm"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>

                    {/* Next Page */}
                    {page < totalPages && (
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(page + 1);
                            fetchPageOfResults(page + 1);
                          }}
                          className="h-8 w-8 p-0 flex items-center justify-center text-sm"
                        >
                          {page + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Ellipsis */}
                    {page < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis className="h-8 w-6 p-0 text-sm" />
                      </PaginationItem>
                    )}

                    {/* Last Page */}
                    {page < totalPages - 1 && (
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(totalPages);
                            fetchPageOfResults(totalPages);
                          }}
                          className="h-8 w-8 p-0 flex items-center justify-center text-sm"
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < totalPages) {
                            setPage(page + 1);
                            fetchPageOfResults(page + 1);
                          }
                        }}
                        aria-disabled={page >= totalPages}
                        className={`${page >= totalPages ? 'pointer-events-none opacity-50' : ''} text-sm`}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>

              {/* Share Button */}
              <div className="mt-6 p-4 border-t border-gray-200">
                <div className="relative">
                  <button
                    onClick={copyShareableUrl}
                    className="group w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-sm hover:shadow-md active:scale-[0.98]"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                    Share Current View
                  </button>
                  
                  {/* Copy Feedback Toast */}
                  <div 
                    className={`
                      absolute left-1/2 -translate-x-1/2 -top-12 
                      px-4 py-2 bg-gray-900 text-white rounded-lg shadow-lg
                      flex items-center gap-2 whitespace-nowrap
                      transition-all duration-200
                      ${showCopyFeedback 
                        ? 'opacity-100 transform translate-y-0' 
                        : 'opacity-0 transform translate-y-2 pointer-events-none'}
                    `}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-5 w-5 text-green-400" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    URL Copied to Clipboard!
                    
                    {/* Arrow */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column - Log Output */}
        <main className="flex-1 overflow-y-auto relative">
          {loading ? (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="max-w-sm w-full p-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-lg font-medium text-gray-700">Updating Results</div>
                  <div className="text-sm text-gray-500">Applying filters...</div>
                </div>
              </div>
            </div>
          ) : lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No logs found matching the current filters
            </div>
          ) : (
            <div className="space-y-0.5 mb-4 text-sm">
              <div className="grid grid-cols-[80px_60px_100px_1fr] gap-2 items-start px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 border-y border-gray-200 sticky top-0 shadow-sm">
                <span className="text-right uppercase tracking-wider">Line #</span>
                <span className="uppercase tracking-wider">Time</span>
                <span className="uppercase tracking-wider">Type</span>
                <span className="uppercase tracking-wider">Message</span>
              </div>
              {lines.map((line) => (
                <div 
                  key={line.lineNumber} 
                  className="grid grid-cols-[80px_60px_100px_1fr] text-center gap-2 items-start px-3 py-2 bg-white border border-gray-100 hover:bg-gray-50 transition-colors font-mono text-xs leading-5"
                >
                  <span className="text-gray-400 select-none text-right font-medium">
                    <b>{line.lineNumber}</b>
                  </span>
                  <span className="text-gray-500 font-medium whitespace-nowrap">
                    {new Date(line.timestamp).toLocaleTimeString('en-US', { 
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false 
                    })}
                  </span>
                  <span 
                    className={`font-medium truncate px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${getLogTypeColor(line.logType)}`} 
                    title={line.logType}
                  >
                    {getBaseLogType(line.logType)}
                  </span>
                  <span className="text-gray-700 font-normal text-left break-words whitespace-pre-wrap overflow-x-auto">
                    {highlightText(line.content, searchTerm)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function LogViewer() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    }>
      <LogViewerContent />
    </Suspense>
  );
} 