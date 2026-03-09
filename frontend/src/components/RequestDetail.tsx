import { useState } from 'react';

interface RequestDetailProps {
  item: any;
  itemPath: string;
  onRun: () => void;
  running: boolean;
}

export default function RequestDetail({ item, itemPath, onRun, running }: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState<'headers' | 'body' | 'auth' | 'scripts'>('headers');

  if (!item.request) {
    // It's a folder
    return (
      <div className="request-detail">
        <h2 style={{ marginBottom: 8 }}>{item.name}</h2>
        <p className="text-muted text-sm">This is a folder containing {item.item?.length || 0} items.</p>
        <button className="btn-primary" onClick={onRun} disabled={running} style={{ marginTop: 12 }}>
          {running ? 'Running...' : 'Run All in Folder'}
        </button>
      </div>
    );
  }

  const request = item.request;
  const method = request.method || 'GET';
  const url = typeof request.url === 'string'
    ? request.url
    : request.url?.raw || '';

  const headers = request.header || [];
  const body = request.body;
  const auth = request.auth;

  const preRequestScripts = (item.event || [])
    .filter((e: any) => e.listen === 'prerequest')
    .flatMap((e: any) => e.script.exec || []);

  const testScripts = (item.event || [])
    .filter((e: any) => e.listen === 'test')
    .flatMap((e: any) => e.script.exec || []);

  const methodColor = `var(--method-${method.toLowerCase()})`;

  return (
    <div className="request-detail">
      {/* URL bar */}
      <div className="request-url-bar">
        <div className="method" style={{ color: methodColor }}>{method}</div>
        <div className="url">{url}</div>
        <button className="btn-primary" onClick={onRun} disabled={running}>
          {running ? 'Running...' : 'Send'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers {headers.length > 0 && `(${headers.filter((h: any) => !h.disabled).length})`}
        </button>
        <button
          className={`tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
        <button
          className={`tab ${activeTab === 'auth' ? 'active' : ''}`}
          onClick={() => setActiveTab('auth')}
        >
          Auth
        </button>
        <button
          className={`tab ${activeTab === 'scripts' ? 'active' : ''}`}
          onClick={() => setActiveTab('scripts')}
        >
          Scripts
        </button>
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {activeTab === 'headers' && (
          <div>
            {headers.length === 0 ? (
              <div className="text-muted text-sm">No headers defined</div>
            ) : (
              <table className="kv-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h: any, i: number) => (
                    <tr key={i} style={{ opacity: h.disabled ? 0.4 : 1 }}>
                      <td>{h.key}</td>
                      <td>{h.value}</td>
                      <td>{h.disabled ? '✗' : '✓'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'body' && (
          <div>
            {!body ? (
              <div className="text-muted text-sm">No body</div>
            ) : (
              <div>
                <div className="text-muted text-sm mb-2">Mode: {body.mode}</div>
                {body.mode === 'raw' && (
                  <pre className="script-block">{body.raw || ''}</pre>
                )}
                {body.mode === 'urlencoded' && body.urlencoded && (
                  <table className="kv-table">
                    <thead>
                      <tr><th>Key</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {body.urlencoded.map((item: any, i: number) => (
                        <tr key={i} style={{ opacity: item.disabled ? 0.4 : 1 }}>
                          <td>{item.key}</td>
                          <td>{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {body.mode === 'formdata' && body.formdata && (
                  <table className="kv-table">
                    <thead>
                      <tr><th>Key</th><th>Value</th><th>Type</th></tr>
                    </thead>
                    <tbody>
                      {body.formdata.map((item: any, i: number) => (
                        <tr key={i} style={{ opacity: item.disabled ? 0.4 : 1 }}>
                          <td>{item.key}</td>
                          <td>{item.value || item.src || ''}</td>
                          <td>{item.type || 'text'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'auth' && (
          <div>
            {!auth ? (
              <div className="text-muted text-sm">No auth defined (inherits from parent/collection)</div>
            ) : (
              <div>
                <div className="text-muted text-sm mb-2">Type: {auth.type}</div>
                {auth.type === 'bearer' && auth.bearer && (
                  <table className="kv-table">
                    <thead>
                      <tr><th>Key</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {auth.bearer.map((p: any, i: number) => (
                        <tr key={i}><td>{p.key}</td><td>{p.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {auth.type === 'basic' && auth.basic && (
                  <table className="kv-table">
                    <thead>
                      <tr><th>Key</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {auth.basic.map((p: any, i: number) => (
                        <tr key={i}><td>{p.key}</td><td>{p.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {auth.type === 'apikey' && auth.apikey && (
                  <table className="kv-table">
                    <thead>
                      <tr><th>Key</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {auth.apikey.map((p: any, i: number) => (
                        <tr key={i}><td>{p.key}</td><td>{p.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'scripts' && (
          <div>
            {preRequestScripts.length > 0 && (
              <div className="request-section">
                <h3>Pre-request Script</h3>
                <pre className="script-block">{preRequestScripts.join('\n')}</pre>
              </div>
            )}
            {testScripts.length > 0 && (
              <div className="request-section">
                <h3>Test Script</h3>
                <pre className="script-block">{testScripts.join('\n')}</pre>
              </div>
            )}
            {preRequestScripts.length === 0 && testScripts.length === 0 && (
              <div className="text-muted text-sm">No scripts defined</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
