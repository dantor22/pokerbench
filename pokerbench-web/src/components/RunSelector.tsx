'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

interface RunSelectorProps {
  runs: string[];
  currentRunId?: string;
}

export default function RunSelector({ runs, currentRunId }: RunSelectorProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const runId = e.target.value;
    if (runId) {
      router.push(`/run/${runId}`);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-slate-400 tracking-wider">RUN:</span>
      <div className="run-selector-wrapper ml-2">
        <select
          value={currentRunId || ''}
          onChange={handleChange}
          className="run-selector-select"
        >
          {runs.map((run) => (
            <option key={run} value={run} style={{ background: '#0f172a' }}>
              {run.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <ChevronDown 
          size={16} 
          className="run-selector-arrow" 
        />
      </div>
    </div>
  );
}
