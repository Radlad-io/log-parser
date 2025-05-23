"use client"

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const DB_NAME = 'LogParserDB';
const STORE_NAME = 'logLines';

function LogViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL parameters
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [filteredKeys, setFilteredKeys] = useState([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [logDate, setLogDate] = useState(null);
  const linesPerPage = 300;

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // First perform the search to get filtered records
      const filtered = await searchAllRecords(searchTerm, {
        start: startTime,
        end: endTime
      });

      // Sort records by line number
      filtered.sort((a, b) => a.lineNumber - b.lineNumber);

      // Update filtered keys and total pages
      const filteredLineNumbers = filtered.map(record => record.lineNumber);
      setFilteredKeys(filteredLineNumbers);
      setTotalPages(Math.max(1, Math.ceil(filtered.length / linesPerPage)));

      // Set the first page of results directly
      setPage(1);
      setLines(filtered.slice(0, linesPerPage));

      // Update search status
      const totalRecords = filtered.length;
      const status = searchTerm.trim() !== '' 
        ? `Found ${totalRecords} matching records${isCaseSensitive ? ' (case-sensitive)' : ''}`
        : `Total ${totalRecords} records`;
      setSearchStatus(status);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setSearchTerm('');
    setStartTime('');
    setEndTime('');
    setLoading(true);
    setPage(1);
    setError(null);
    setLogDate(null);
    
    try {
      await searchAllRecords('', {
        start: '',
        end: ''
      });
      await fetchPageOfResults(1);
    } catch (err) {
      console.error('Clear failed:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Get all records first
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

        // Set serial number and base date from the first record with a timestamp
        if (!serialNumber && allRecords.length > 0) {
          const firstValidRecord = allRecords.find(record => record.serialNumber && record.timestamp);
          if (firstValidRecord) {
            setSerialNumber(firstValidRecord.serialNumber);
            setLogDate(getBaseDate(firstValidRecord.timestamp).getTime());
          }
        }

        // Sort records by line number
        allRecords.sort((a, b) => a.lineNumber - b.lineNumber);

        // Set filtered keys to all record line numbers initially
        const allLineNumbers = allRecords.map(record => record.lineNumber);
        setFilteredKeys(allLineNumbers);

        // Set total pages
        const totalPages = Math.ceil(allRecords.length / linesPerPage);
        setTotalPages(Math.max(1, totalPages));

        // Set search status
        setSearchStatus(`Total ${allRecords.length} records`);

        // Fetch first page
        const pageRecords = allRecords.slice(0, linesPerPage);
        setLines(pageRecords);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadInitialData();
  }, []); // Empty dependency array means this runs once on mount

  // Function to update URL parameters - now only used for sharing
  const updateUrlParams = (updates) => {
    if (!updates.page) return; // Only update URL for page changes
    
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  // Modified state setters to not update URL
  const updateSearchTerm = (value) => {
    setSearchTerm(value);
    setPage(1);
  };

  const updateCaseSensitive = (value) => {
    setIsCaseSensitive(value);
  };

  const updateTimeRange = (type, value) => {
    if (type === 'start') {
      setStartTime(value);
    } else {
      setEndTime(value);
    }
    setPage(1);
  };

  const updatePage = (newPage) => {
    setPage(newPage);
    updateUrlParams({ page: newPage.toString() });
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const highlightText = (text, searchTerm) => {
    if (!searchTerm.trim()) return text;

    try {
      const searchWords = searchTerm.split(/\s+/);
      const escapedSearchWords = searchWords.map(word => escapeRegExp(word));
      const regex = new RegExp(`(${escapedSearchWords.join('|')})`, isCaseSensitive ? 'g' : 'gi');
      const parts = text.split(regex);

      return (
        <>
          {parts.map((part, i) => {
            if (searchWords.some(word => {
              const searchFor = isCaseSensitive ? word : word.toLowerCase();
              const partToCheck = isCaseSensitive ? part : part.toLowerCase();
              return searchFor === partToCheck;
            })) {
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

  // Function to extract the base date from a timestamp
  const getBaseDate = (timestamp) => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Function to combine base date with time input
  const combineDateTime = (timeString) => {
    if (!timeString || !logDate) return null;
    
    const [hours, minutes] = timeString.split(':');
    const combined = new Date(logDate);
    combined.setHours(parseInt(hours, 10));
    combined.setMinutes(parseInt(minutes, 10));
    combined.setSeconds(0);
    combined.setMilliseconds(0);
    return combined.getTime();
  };

  const searchAllRecords = async (search = '', timeRange = {}) => {
    try {
      console.log('Starting searchAllRecords');
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

      console.log('Total records found:', allRecords.length);

      // Set serial number and base date from the first record with a timestamp
      if (!serialNumber || !logDate) {
        const firstValidRecord = allRecords.find(record => record.serialNumber && record.timestamp);
        if (firstValidRecord) {
          setSerialNumber(firstValidRecord.serialNumber);
          setLogDate(getBaseDate(firstValidRecord.timestamp).getTime());
        }
      }

      let filtered = [...allRecords];
      const trimmedSearch = search.trim();

      if (trimmedSearch !== '') {
        console.log('Filtering with search term:', trimmedSearch);
        filtered = filtered.filter(record => {
          const recordContent = isCaseSensitive ? record.content : record.content.toLowerCase();
          const recordLogType = isCaseSensitive ? record.logType : record.logType.toLowerCase();
          const searchFor = isCaseSensitive ? trimmedSearch : trimmedSearch.toLowerCase();
          
          const searchWords = searchFor.split(/\s+/);
          
          const matches = searchWords.every(word => {
            const matchesContent = recordContent.includes(word);
            const matchesLogType = recordLogType.includes(word);
            return matchesContent || matchesLogType;
          });

          return matches;
        });
      }

      if (timeRange.start || timeRange.end) {
        console.log('Applying time filter');
        filtered = filtered.filter(record => {
          if (!record.timestamp) return false;

          const startTime = combineDateTime(timeRange.start);
          const endTime = combineDateTime(timeRange.end);

          const matchesStart = !startTime || record.timestamp >= startTime;
          const matchesEnd = !endTime || record.timestamp <= endTime;

          return matchesStart && matchesEnd;
        });
      }

      filtered.sort((a, b) => a.lineNumber - b.lineNumber);
      console.log('Filtered and sorted records:', filtered.length);
      
      const filteredLineNumbers = filtered.map(record => record.lineNumber);
      setFilteredKeys(filteredLineNumbers);
      
      const totalPages = Math.ceil(filtered.length / linesPerPage);
      setTotalPages(Math.max(1, totalPages));

      const totalRecords = filtered.length;
      const searchStatus = trimmedSearch !== '' 
        ? `Found ${totalRecords} matching records${isCaseSensitive ? ' (case-sensitive)' : ''}`
        : `Total ${totalRecords} records`;
      setSearchStatus(searchStatus);
      
      return filtered;
    } catch (err) {
      console.error('Error searching records:', err);
      throw err;
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

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-row min-h-screen w-full">
      {/* Left Column - Search and Filters */}
      <aside className="w-1/4 min-w-[300px] p-4 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="sticky top-4">
          <h2 className="text-xl font-semibold mb-4">Search & Filters</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Search Logs
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search logs... (empty for all records)"
                  className="flex-1 p-2 border rounded"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap"
                >
                  Search
                </button>
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
              {searchStatus && (
                <p className="text-sm text-gray-600 mt-1">{searchStatus}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
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
                {logDate && (
                  <p className="text-sm text-gray-600">
                    Filtering logs from {new Date(logDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>
      </aside>

      {/* Right Column - Log Output */}
      <main className="flex-1 p-4 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Log Output</h2>
        {serialNumber && (
          <h2 className="text-lg font-medium mb-4 text-gray-700">
            Device: alexa35-{serialNumber}
          </h2>
        )}
        
        {/* Log Lines */}
        <div className="space-y-0.5 mb-4 text-sm">
          <div className="grid grid-cols-[80px_60px_150px_1fr] gap-2 items-start px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 border-y border-gray-200 sticky top-0 shadow-sm">
            <span className="text-right uppercase tracking-wider">Line #</span>
            <span className="uppercase tracking-wider">Time</span>
            <span className="uppercase tracking-wider">Type</span>
            <span className="uppercase tracking-wider">Message</span>
          </div>
          {lines.map((line) => (
            <div 
              key={line.lineNumber} 
              className="grid grid-cols-[80px_60px_150px_1fr] gap-2 items-start px-3 py-2 bg-white border border-gray-100 hover:bg-gray-50 transition-colors font-mono text-xs leading-5"
            >
              <span className="text-gray-400 select-none text-right font-medium mr-2">{line.lineNumber}</span>
              <span className="text-gray-500 font-medium">
                {new Date(line.timestamp).toLocaleTimeString('en-US', { 
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false 
                })}
              </span>
              <span className="text-blue-600 font-medium truncate px-2 py-0.5 bg-blue-50 rounded-full text-[10px] uppercase tracking-wider" title={line.logType}>
                {line.logType}
              </span>
              <span className="text-gray-700 font-normal">{highlightText(line.content, searchTerm)}</span>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="sticky bottom-4 flex justify-between items-center mt-4 bg-white p-2 rounded shadow">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300"
          >
            Previous
          </button>
          <span className="font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages || lines.length < linesPerPage}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300"
          >
            Next
          </button>
        </div>
      </main>
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