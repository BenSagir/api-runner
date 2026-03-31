import { useState, useCallback } from 'react';
import type { ExecutionResult } from '../App';

interface ResponsePanelProps {
  result: ExecutionResult;
}

// Collapsible JSON Viewer Component
interface JsonNodeProps {
  data: any;
  keyName?: string;
  isLast?: boolean;
  depth?: number;
  defaultExpanded?: boolean;
}

function JsonNode({ data, keyName, isLast = true, depth = 0, defaultExpanded = true }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 3);

  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const isArray = Array.isArray(data);
  const isExpandable = isObject || isArray;

  const toggleExpand = useCallback(() => setExpanded(e => !e), []);

  const indent = { paddingLeft: depth * 16 };
  const comma = isLast ? '' : ',';

  if (!isExpandable) {
    // Primitive value
    let valueClass = 'json-value';
    let displayValue: string;

    if (typeof data === 'string') {
      valueClass += ' json-string';
      displayValue = `"${data}"`;
    } else if (typeof data === 'number') {
      valueClass += ' json-number';
      displayValue = String(data);
    } else if (typeof data === 'boolean') {
      valueClass += ' json-boolean';
      displayValue = String(data);
    } else if (data === null) {
      valueClass += ' json-null';
      displayValue = 'null';
    } else {
      displayValue = String(data);
    }

    return (
      <div className="json-line" style={indent}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span className="json-colon">: </span>}
        <span className={valueClass}>{displayValue}</span>
        <span className="json-comma">{comma}</span>
      </div>
    );
  }

  const entries: [string | number, any][] = isArray
    ? data.map((v: any, i: number) => [i, v] as [number, any])
    : Object.entries(data);
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';
  const isEmpty = entries.length === 0;

  if (isEmpty) {
    return (
      <div className="json-line" style={indent}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span className="json-colon">: </span>}
        <span className="json-bracket">{bracketOpen}{bracketClose}</span>
        <span className="json-comma">{comma}</span>
      </div>
    );
  }

  return (
    <div className="json-node">
      <div className="json-line json-expandable" style={indent} onClick={toggleExpand}>
        <span className="json-toggle">{expanded ? '▼' : '▶'}</span>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span className="json-colon">: </span>}
        <span className="json-bracket">{bracketOpen}</span>
        {!expanded && (
          <>
            <span className="json-collapsed-preview">
              {isArray ? `${entries.length} items` : `${entries.length} keys`}
            </span>
            <span className="json-bracket">{bracketClose}</span>
            <span className="json-comma">{comma}</span>
          </>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([key, value], index) => (
            <JsonNode
              key={key}
              data={value}
              keyName={isArray ? undefined : String(key)}
              isLast={index === entries.length - 1}
              depth={depth + 1}
              defaultExpanded={depth < 2}
            />
          ))}
          <div className="json-line" style={indent}>
            <span className="json-bracket">{bracketClose}</span>
            <span className="json-comma">{comma}</span>
          </div>
        </>
      )}
    </div>
  );
}

function CollapsibleJsonViewer({ data }: { data: any }) {
  const [allExpanded, setAllExpanded] = useState(true);
  const [key, setKey] = useState(0);

  const expandAll = () => {
    setAllExpanded(true);
    setKey(k => k + 1);
  };

  const collapseAll = () => {
    setAllExpanded(false);
    setKey(k => k + 1);
  };

  return (
    <div className="json-viewer">
      <div className="json-viewer-toolbar">
        <button className="btn-secondary btn-sm" onClick={expandAll}>Expand All</button>
        <button className="btn-secondary btn-sm" onClick={collapseAll}>Collapse All</button>
      </div>
      <div className="json-viewer-content" key={key}>
        <JsonNode data={data} defaultExpanded={allExpanded} />
      </div>
    </div>
  );
}

export default function ResponsePanel({ result }: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'tests'>('body');
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');

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

  const parseJsonBody = (body: any): any | null => {
    if (body === null || body === undefined) return null;
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return null;
      }
    }
    if (typeof body === 'object') return body;
    return null;
  };

  const jsonBody = parseJsonBody(result.responseBody);
  const isJson = jsonBody !== null;

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
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {isJson && (
              <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <button
                  className={`btn-sm ${viewMode === 'pretty' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('pretty')}
                >
                  Pretty
                </button>
                <button
                  className={`btn-sm ${viewMode === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('raw')}
                >
                  Raw
                </button>
              </div>
            )}
            {isJson && viewMode === 'pretty' ? (
              <CollapsibleJsonViewer data={jsonBody} />
            ) : (
              <pre className="response-body">{formatBody(result.responseBody)}</pre>
            )}
          </div>
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
