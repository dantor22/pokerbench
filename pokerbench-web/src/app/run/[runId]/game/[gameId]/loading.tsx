import { ArrowLeft } from 'lucide-react';

export default function Loading() {
  return (
    <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
      <div className="flex-responsive mb-6 !gap-2">
        <div className="back-link !bg-white/5 !border-white/5 opacity-50 cursor-wait">
          <ArrowLeft className="w-5 h-5" />
          <span className="sm-visible">Back to Run Dashboard</span>
          <span className="sm-hidden">Back</span>
        </div>
        <div className="h-8 w-48 bg-white/5 animate-pulse rounded" />
      </div>

      <div className="card text-white relative overflow-hidden p-0 bg-black mb-0 poker-scene-container">
        <div className="loading-overlay">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <div className="text-blue-400 font-bold tracking-widest text-sm uppercase animate-pulse">
              Loading...
            </div>
          </div>
        </div>
      </div>

      <div className="layout-split mt-4 mb-4">
        <div className="h-32 bg-white/5 animate-pulse rounded flex-1" />
        <div className="h-32 bg-white/5 animate-pulse rounded flex-1" />
      </div>

      <div className="h-24 bg-white/5 animate-pulse rounded" />
    </div>
  );
}
