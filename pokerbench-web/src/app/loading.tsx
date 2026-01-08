export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050505] text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xl font-medium text-slate-400 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
