import { useEffect, useState } from 'react';

interface EvaluationSummary {
  total_evaluations: number;
  average_retrieval_relevance: number | null;
  average_faithfulness: number | null;
  average_latency_ms: number | null;
  citations: number;
}

interface EvaluationDashboardProps {
  apiUrl: string;
  token: string;
  onClose: () => void;
}

export default function EvaluationDashboard({ apiUrl, token, onClose }: EvaluationDashboardProps) {
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/evaluation/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Quality metrics are temporarily unavailable.');
        return response.json();
      })
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load quality metrics.'); });
    return () => { cancelled = true; };
  }, [apiUrl, token]);

  const percent = (value: number | null) => value == null ? '—' : `${(value * 100).toFixed(0)}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="evaluation-title" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Resume-ready quality view</p>
            <h2 id="evaluation-title" className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">AI evaluation dashboard</h2>
            <p className="mt-1.5 text-xs leading-5 text-gray-500 dark:text-gray-400">Metrics are collected from document-aware Q&A requests. Evidence overlap is a transparent heuristic, not a guarantee of factual correctness.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close evaluation dashboard" className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">×</button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : summary ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Evaluations', summary.total_evaluations.toString(), 'total Q&A requests'],
              ['Retrieval relevance', percent(summary.average_retrieval_relevance), 'lexical match score'],
              ['Evidence overlap', percent(summary.average_faithfulness), 'heuristic faithfulness'],
              ['Avg. latency', summary.average_latency_ms == null ? '—' : `${Math.round(summary.average_latency_ms)} ms`, 'request duration'],
              ['Citations', summary.citations.toString(), 'sources returned'],
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{value}</div>
                <div className="mt-1 text-[10px] text-gray-400">{detail}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 flex items-center justify-center py-8 text-sm text-gray-500">Loading quality metrics…</div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">Done</button>
        </div>
      </div>
    </div>
  );
}
