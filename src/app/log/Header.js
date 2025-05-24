import Link from "next/link";

export default function Header({ totalRecords, displayedRecords, serialNumber, date }) {
  return (
    <div className=" border-b border-gray-200 px-4 pt-2 pb-6 z-10 shadow-sm">
      <div className="flex items-center justify-between">
        <Link href="/upload">
        <h1 className="text-3xl font-bold text-gray-800 text-white ">Log File Viewer</h1>
        </Link>
        
        <div className="flex gap-3 m-0 p-0">
          {serialNumber && (
            <div className="flex items-center">
              <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-sm text-sm font-medium">
                Device: alexa35-{serialNumber}
              </span>
            </div>
          )}
          <div className="flex items-center">
            <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-sm text-sm font-medium">
              Date: {date}
            </span>
          </div>
          
          <div className="flex items-center">
            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-sm text-sm font-medium">
              Total: {totalRecords.toLocaleString()} logs
            </span>
          </div>
          
          <div className="flex items-center">
            <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-sm text-sm font-medium">
              Showing: {displayedRecords.toLocaleString()} logs
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 