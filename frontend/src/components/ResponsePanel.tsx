import { useState } from 'react';
import type { ExecutionResult } from '../App';

interface ResponsePanelProps {
  result: ExecutionResult;
}

export default function ResponsePanel({ result }: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'tests'>('body');

  const statusClass = result.status >= 200 && result.status < 300
    ? 'success'
    : result.status >= 300 && result.status < 400
    ? 'redirect'
    : 'error';

  const formatBody = (body: any): string => {
    if (body === null || body === undefined) return '';
    if (typeof body === 'string') {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    return JSON.stringify(body, null, 2);
  };

  const passedTests = result.testResults.filter(t => t.passed).length;
  const totalTests = result.testResults.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Response meta */}
      <div className="response-meta" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span className={`method-badge ${result.method}`}>{result.method}</span>
        <span className={`status ${statusClass}`}>
          {result.status} {result.statusText}
        </span>
        <span className="detail">{result.responseTime}ms</span>
        <span className="detail">{formatSize(result.responseSize)}</span>
        {result.error && (
          <span style={{ color: 'var(--error)', fontSize: 12 }}>{result.error}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
        <button
          className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers ({Object.keys(result.responseHeaders).length})
        </button>
        <button
          className={`tab ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => setActiveTab('tests')}
        >
          Tests {totalTests > 0 && `(${passedTests}/${totalTests})`}
        </button>
      </div>

      {/* Tab content */}
      <div className="response-panel">
        {activeTab === 'body' && (
          <pre className="response-body">{formatBody(result.responseBody)}</pre>
        )}

        {activeTab === 'headers' && (
          <table className="kv-table">
            <thead>
              <tr><th>Header</th><th>Value</th></tr>
            </thead>
            <tbody>
              {Object.entries(result.responseHeaders).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td style={{ wordBreak: 'break-all' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'tests' && (
          <div className="test-results">
            {result.testResults.length === 0 ? (
              <div className="text-muted text-sm">No tests defined</div>
            ) : (
              result.testResults.map((test, i) => (
                <div key={i}>
                  <div className={`test-result ${test.passed ? 'pass' : 'fail'}`}>
                    <span className="icon">{test.passed ? '✓' : '✗'}</span>
                    <span className="test-name">{test.name}</span>
                  </div>
                  {test.error && (
                    <div className="test-result">
                      <span className="test-error">{test.error}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
