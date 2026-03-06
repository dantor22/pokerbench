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

  const benchmarkRuns = runs.filter(r => r !== 'Gemini_3_Flash_and_Pro_Heads_Up');
  const headsUpRuns = runs.filter(r => r === 'Gemini_3_Flash_and_Pro_Heads_Up');

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-slate-400 tracking-wider">RUN:</span>
      <div className="run-selector-wrapper ml-2">
        <select
          value={currentRunId || ''}
          onChange={handleChange}
          className="run-selector-select"
        >
          {benchmarkRuns.length > 0 && (
            <optgroup label="Latest" style={{ background: '#0f172a', color: '#94a3b8', fontSize: '10px' }}>
              {benchmarkRuns.map((run) => (
                <option key={run} value={run} style={{ background: '#0f172a', color: 'white', fontSize: '14px' }}>
                  {run.replace(/_/g, ' ')}
                </option>
              ))}
            </optgroup>
          )}
          {headsUpRuns.length > 0 && (
            <>
              <optgroup label="Outdated" style={{ background: '#0f172a', color: '#94a3b8', fontSize: '10px' }}>
                {headsUpRuns.map((run) => (
                  <option key={run} value={run} style={{ background: '#0f172a', color: 'white', fontSize: '14px' }}>
                    {run.replace(/_/g, ' ')}
                  </option>
                ))}
              </optgroup>
            </>
          )}
        </select>
        <ChevronDown 
          size={16} 
          className="run-selector-arrow" 
        />
      </div>
    </div>
  );
}
