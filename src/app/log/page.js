import { Suspense } from 'react';
import LogPageContent from './LogPageContent';

export default function LogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    }>
      <LogPageContent />
    </Suspense>
  );
}
