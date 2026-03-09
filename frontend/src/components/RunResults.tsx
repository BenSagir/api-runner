import { useState } from 'react';
import type { ExecutionResult } from '../App';
import ResponsePanel from './ResponsePanel';

interface RunResultsProps {
  results: ExecutionResult[];
  running: boolean;
}

export default function RunResults({ results, running }: RunResultsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (running && results.length === 0) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <div>Running requests...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📭</div>
        <div>No results yet</div>
        <div className="text-sm text-muted">Run a request or collection to see results</div>
      </div>
    );
  }

  const totalRequests = results.length;
  const successRequests = results.filter(r => r.status >= 200 && r.status < 400).length;
  const failedRequests = totalRequests - successRequests;
  const totalTime = results.reduce((sum, r) => sum + r.responseTime, 0);
  const totalTests = results.reduce((sum, r) => sum + r.testResults.length, 0);
  const passedTests = results.reduce(
    (sum, r) => sum + r.testResults.filter(t => t.passed).length,
    0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary */}
      <div className="run-summary">
        <div className="stat">
          <span className="stat-value" style={{ color: 'var(--text-primary)' }}>{totalRequests}</span>
          <span className="stat-label">Requests</span>
        </div>
        <div className="stat">
          <span className="stat-value" style={{ color: 'var(--success)' }}>{successRequests}</span>
          <span className="stat-label">Passed</span>
        </div>
        <div className="stat">
          <span className="stat-value" style={{ color: failedRequests > 0 ? 'var(--error)' : 'var(--text-muted)' }}>{failedRequests}</span>
          <span className="stat-label">Failed</span>
        </div>
        <div className="stat">
          <span className="stat-value" style={{ color: 'var(--text-secondary)' }}>{totalTime}ms</span>
          <span className="stat-label">Total Time</span>
        </div>
        {totalTests > 0 && (
          <div className="stat">
            <span className="stat-value" style={{ color: passedTests === totalTests ? 'var(--success)' : 'var(--warning)' }}>
              {passedTests}/{totalTests}
            </span>
            <span className="stat-label">Tests</span>
          </div>
        )}
      </div>

      {/* Split: result list + detail */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Result list */}
        <div className="result-list" style={{ width: 320, borderRight: '1px solid var(--border)', flexShrink: 0 }}>
          {results.map((result, i) => {
            const isSuccess = result.status >= 200 && result.status < 400;
            return (
              <div
                key={i}
                className={`result-item ${selectedIndex === i ? 'active' : ''}`}
                onClick={() => setSelectedIndex(i)}
              >
                <span className={`status-dot ${isSuccess ? 'success' : 'error'}`} />
                <span className={`method-badge ${result.method}`}>{result.method}</span>
                <span className="req-name">{result.requestName}</span>
                <span className="req-status">{result.status}</span>
                <span className="req-time">{result.responseTime}ms</span>
              </div>
            );
          })}
        </div>

        {/* Detail */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {selectedIndex !== null && results[selectedIndex] ? (
            <ResponsePanel result={results[selectedIndex]} />
          ) : (
            <div className="empty-state">
              <div className="text-muted">Select a result to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
