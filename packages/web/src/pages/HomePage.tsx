import { useEffect, useState } from 'react';
import { healthCheckResponseSchema, type HealthCheckResponse } from '@docquiz/shared';

export function HomePage() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHealthCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/healthz');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const parsed = healthCheckResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(`Invalid response schema: ${parsed.error.message}`);
      }
      setHealthData(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthCheck();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-white">DocQuiz AI</h1>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Health Check:</span>
            <button
              onClick={fetchHealthCheck}
              disabled={loading}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          {loading && !healthData && !error && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-center text-slate-400 text-sm animate-pulse">
              Querying /api/healthz...
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-lg space-y-1">
              <div className="flex items-center space-x-2 text-red-400 font-medium text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                <span>Health check failed</span>
              </div>
              <p className="text-xs text-red-300/80 font-mono break-all">{error}</p>
            </div>
          )}

          {healthData && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {healthData.status}
                </span>
              </div>

              <div className="text-xs space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Endpoint:</span>
                  <span className="font-mono text-slate-300">GET /api/healthz</span>
                </div>
                <div className="flex justify-between">
                  <span>Timestamp:</span>
                  <span className="font-mono text-slate-300">{healthData.timestamp}</span>
                </div>
                {healthData.uptime !== undefined && (
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span className="font-mono text-slate-300">{healthData.uptime}s</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Raw Payload</span>
                <pre className="text-xs font-mono bg-slate-900/60 p-2.5 rounded border border-slate-800/60 text-slate-300 overflow-x-auto">
                  {JSON.stringify(healthData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
