import { useState, useEffect, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { updateCollectionItem } from '../api';

export interface RequestOverrides {
  url?: string;
  headers?: Array<{ key: string; value: string; enabled: boolean }>;
  body?: {
    mode: string;
    raw?: string;
    urlencoded?: Array<{ key: string; value: string; enabled: boolean }>;
    formdata?: Array<{ key: string; value: string; type: string; enabled: boolean }>;
  };
}

interface RequestDetailProps {
  item: any;
  itemPath: string;
  collectionId: string;
  onRun: (overrides?: RequestOverrides) => void;
  onRequestSaved?: () => void;
  running: boolean;
}

function detectLanguage(body: any): string {
  if (!body) return 'plaintext';
  const lang = body.options?.raw?.language;
  if (lang === 'json') return 'json';
  if (lang === 'xml') return 'xml';
  if (lang === 'html') return 'html';
  if (lang === 'javascript') return 'javascript';
  const raw = body.raw || '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';
  return 'plaintext';
}

function formatRawBody(raw: string, lang: string): string {
  if (lang === 'json') {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  }
  return raw;
}

// Parse query params from URL
function parseQueryParams(url: string): Array<{ key: string; value: string; enabled: boolean }> {
  try {
    const questionIndex = url.indexOf('?');
    if (questionIndex === -1) return [];
    const queryString = url.slice(questionIndex + 1);
    const params: Array<{ key: string; value: string; enabled: boolean }> = [];
    const pairs = queryString.split('&');
    for (const pair of pairs) {
      if (!pair) continue;
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) {
        params.push({ key: decodeURIComponent(pair), value: '', enabled: true });
      } else {
        params.push({
          key: decodeURIComponent(pair.slice(0, eqIndex)),
          value: decodeURIComponent(pair.slice(eqIndex + 1)),
          enabled: true,
        });
      }
    }
    return params;
  } catch {
    return [];
  }
}

// Build URL from base and params
function buildUrlWithParams(baseUrl: string, params: Array<{ key: string; value: string; enabled: boolean }>): string {
  const questionIndex = baseUrl.indexOf('?');
  const base = questionIndex === -1 ? baseUrl : baseUrl.slice(0, questionIndex);
  const enabledParams = params.filter(p => p.enabled && p.key);
  if (enabledParams.length === 0) return base;
  const queryString = enabledParams
    .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
  return `${base}?${queryString}`;
}

export default function RequestDetail({ item, itemPath, collectionId, onRun, onRequestSaved, running }: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth' | 'scripts'>('body');
  const [saving, setSaving] = useState(false);

  // Editable state
  const [editUrl, setEditUrl] = useState('');
  const [editParams, setEditParams] = useState<Array<{ key: string; value: string; enabled: boolean }>>([]);
  const [editHeaders, setEditHeaders] = useState<Array<{ key: string; value: string; enabled: boolean }>>([]);
  const [editBodyMode, setEditBodyMode] = useState<string>('none');
  const [editRawBody, setEditRawBody] = useState('');
  const [editUrlEncoded, setEditUrlEncoded] = useState<Array<{ key: string; value: string; enabled: boolean }>>([]);
  const [editFormData, setEditFormData] = useState<Array<{ key: string; value: string; type: string; enabled: boolean }>>([]);

  // Sync from item when selection changes
  useEffect(() => {
    if (!item.request) return;
    const request = item.request;
    const url = typeof request.url === 'string' ? request.url : request.url?.raw || '';
    setEditUrl(url);
    setEditParams(parseQueryParams(url));
    setEditHeaders((request.header || []).map((h: any) => ({ key: h.key || '', value: h.value || '', enabled: !h.disabled })));
    const body = request.body;
    if (body) {
      setEditBodyMode(body.mode || 'none');
      setEditRawBody(formatRawBody(body.raw || '', detectLanguage(body)));
      setEditUrlEncoded((body.urlencoded || []).map((u: any) => ({ key: u.key || '', value: u.value || '', enabled: !u.disabled })));
      setEditFormData((body.formdata || []).map((f: any) => ({ key: f.key || '', value: f.value || f.src || '', type: f.type || 'text', enabled: !f.disabled })));
    } else {
      setEditBodyMode('none');
      setEditRawBody('');
      setEditUrlEncoded([]);
      setEditFormData([]);
    }
  }, [item, itemPath]);

  // Sync URL when params change
  const updateUrlFromParams = useCallback((params: Array<{ key: string; value: string; enabled: boolean }>) => {
    setEditParams(params);
    setEditUrl(prev => buildUrlWithParams(prev, params));
  }, []);

  // Sync params when URL changes manually
  const handleUrlChange = useCallback((newUrl: string) => {
    setEditUrl(newUrl);
    setEditParams(parseQueryParams(newUrl));
  }, []);

  const bodyLanguage = useMemo(() => detectLanguage(item.request?.body), [item]);

  if (!item.request) {
    return (
      <div className="request-detail">
        <h2 style={{ marginBottom: 8 }}>{item.name}</h2>
        <p className="text-muted text-sm">This is a folder containing {item.item?.length || 0} items.</p>
        <button className="btn-primary" onClick={() => onRun()} disabled={running} style={{ marginTop: 12 }}>
          {running ? 'Running...' : 'Run All in Folder'}
        </button>
      </div>
    );
  }

  const request = item.request;
  const method = request.method || 'GET';
  const auth = request.auth;
  const preRequestScripts = (item.event || []).filter((e: any) => e.listen === 'prerequest').flatMap((e: any) => e.script.exec || []);
  const testScripts = (item.event || []).filter((e: any) => e.listen === 'test').flatMap((e: any) => e.script.exec || []);
  const methodColor = `var(--method-${method.toLowerCase()})`;

  const buildOverrides = (): RequestOverrides => ({
    url: editUrl,
    headers: editHeaders,
    body: { mode: editBodyMode, raw: editRawBody, urlencoded: editUrlEncoded, formdata: editFormData },
  });

  const handleSend = () => onRun(buildOverrides());

  // Beautify JSON body
  const beautifyBody = () => {
    if (bodyLanguage === 'json') {
      try {
        const parsed = JSON.parse(editRawBody);
        setEditRawBody(JSON.stringify(parsed, null, 2));
      } catch {
        // Invalid JSON, do nothing
      }
    }
  };

  // Save request to collection
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCollectionItem(collectionId, itemPath, {
        url: editUrl,
        headers: editHeaders,
        body: { mode: editBodyMode, raw: editRawBody, urlencoded: editUrlEncoded, formdata: editFormData },
      });
      onRequestSaved?.();
    } catch (err) {
      console.error('Failed to save request:', err);
    } finally {
      setSaving(false);
    }
  };

  // Params helpers
  const updateParam = (i: number, field: string, value: any) => {
    const newParams = [...editParams];
    newParams[i] = { ...newParams[i], [field]: value };
    updateUrlFromParams(newParams);
  };
  const addParam = () => updateUrlFromParams([...editParams, { key: '', value: '', enabled: true }]);
  const removeParam = (i: number) => updateUrlFromParams(editParams.filter((_, idx) => idx !== i));

  // ── Header helpers ──
  const updateHeader = (i: number, field: string, value: any) => setEditHeaders(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });
  const addHeader = () => setEditHeaders(prev => [...prev, { key: '', value: '', enabled: true }]);
  const removeHeader = (i: number) => setEditHeaders(prev => prev.filter((_, idx) => idx !== i));

  // ── Urlencoded helpers ──
  const updateUrlEncoded = (i: number, field: string, value: any) => setEditUrlEncoded(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });
  const addUrlEncoded = () => setEditUrlEncoded(prev => [...prev, { key: '', value: '', enabled: true }]);
  const removeUrlEncoded = (i: number) => setEditUrlEncoded(prev => prev.filter((_, idx) => idx !== i));

  // ── Formdata helpers ──
  const updateFormData = (i: number, field: string, value: any) => setEditFormData(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });
  const addFormData = () => setEditFormData(prev => [...prev, { key: '', value: '', type: 'text', enabled: true }]);
  const removeFormData = (i: number) => setEditFormData(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="request-detail" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* URL bar */}
      <div className="request-url-bar">
        <div className="method" style={{ color: methodColor }}>{method}</div>
        <input
          className="url"
          value={editUrl}
          onChange={e => handleUrlChange(e.target.value)}
          placeholder="Enter request URL"
          style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13 }}
        />
        <button className="btn-secondary" onClick={handleSave} disabled={saving} style={{ marginRight: 4 }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn-primary" onClick={handleSend} disabled={running}>
          {running ? 'Running...' : 'Send'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>Params ({editParams.filter(p => p.enabled && p.key).length})</button>
        <button className={`tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>Body</button>
        <button className={`tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>Headers ({editHeaders.filter(h => h.enabled).length})</button>
        <button className={`tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveTab('auth')}>Auth</button>
        <button className={`tab ${activeTab === 'scripts' ? 'active' : ''}`} onClick={() => setActiveTab('scripts')}>Scripts</button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* ── Params Tab ── */}
        {activeTab === 'params' && (
          <div style={{ padding: 16 }}>
            <div className="editable-kv-header"><span>Key</span><span>Value</span><span></span><span></span></div>
            {editParams.map((p, i) => (
              <div key={i} className="editable-kv-row">
                <input value={p.key} onChange={e => updateParam(i, 'key', e.target.value)} placeholder="Parameter name" />
                <input value={p.value} onChange={e => updateParam(i, 'value', e.target.value)} placeholder="Value" />
                <input type="checkbox" checked={p.enabled} onChange={e => updateParam(i, 'enabled', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <button className="btn-icon btn-sm" onClick={() => removeParam(i)} title="Remove">✕</button>
              </div>
            ))}
            <button className="btn-secondary btn-sm" onClick={addParam} style={{ marginTop: 8 }}>+ Add Parameter</button>
          </div>
        )}

        {/* ── Body Tab ── */}
        {activeTab === 'body' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <span className="text-muted text-sm" style={{ marginRight: 4 }}>Mode:</span>
              {['none', 'raw', 'urlencoded', 'formdata'].map(mode => (
                <button key={mode} className={`btn-sm ${editBodyMode === mode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEditBodyMode(mode)}>
                  {mode === 'none' ? 'none' : mode === 'raw' ? 'raw' : mode === 'urlencoded' ? 'x-www-form-urlencoded' : 'form-data'}
                </button>
              ))}
            </div>

            {editBodyMode === 'none' && (
              <div className="empty-state" style={{ flex: 1, minHeight: 120 }}>
                <div className="text-muted text-sm">This request does not have a body</div>
              </div>
            )}

            {editBodyMode === 'raw' && (
              <div style={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={beautifyBody}
                    disabled={bodyLanguage !== 'json'}
                    title={bodyLanguage !== 'json' ? 'Beautify is only available for JSON' : 'Format JSON'}
                  >
                    Beautify
                  </button>
                </div>
                <Editor
                  height="100%"
                  language={bodyLanguage}
                  value={editRawBody}
                  onChange={val => setEditRawBody(val || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                    padding: { top: 8, bottom: 8 },
                    tabSize: 2,
                  }}
                />
              </div>
            )}

            {editBodyMode === 'urlencoded' && (
              <div style={{ padding: 16 }}>
                <div className="editable-kv-header"><span>Key</span><span>Value</span><span></span><span></span></div>
                {editUrlEncoded.map((row, i) => (
                  <div key={i} className="editable-kv-row">
                    <input value={row.key} onChange={e => updateUrlEncoded(i, 'key', e.target.value)} placeholder="Key" />
                    <input value={row.value} onChange={e => updateUrlEncoded(i, 'value', e.target.value)} placeholder="Value" />
                    <input type="checkbox" checked={row.enabled} onChange={e => updateUrlEncoded(i, 'enabled', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <button className="btn-icon btn-sm" onClick={() => removeUrlEncoded(i)} title="Remove">✕</button>
                  </div>
                ))}
                <button className="btn-secondary btn-sm" onClick={addUrlEncoded} style={{ marginTop: 8 }}>+ Add Parameter</button>
              </div>
            )}

            {editBodyMode === 'formdata' && (
              <div style={{ padding: 16 }}>
                <div className="editable-kv-header" style={{ gridTemplateColumns: '1fr 1fr 80px 28px 28px' }}><span>Key</span><span>Value</span><span>Type</span><span></span><span></span></div>
                {editFormData.map((row, i) => (
                  <div key={i} className="editable-kv-row" style={{ gridTemplateColumns: '1fr 1fr 80px 28px 28px' }}>
                    <input value={row.key} onChange={e => updateFormData(i, 'key', e.target.value)} placeholder="Key" />
                    <input value={row.value} onChange={e => updateFormData(i, 'value', e.target.value)} placeholder="Value" />
                    <select value={row.type} onChange={e => updateFormData(i, 'type', e.target.value)} style={{ fontSize: 12 }}>
                      <option value="text">text</option><option value="file">file</option>
                    </select>
                    <input type="checkbox" checked={row.enabled} onChange={e => updateFormData(i, 'enabled', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <button className="btn-icon btn-sm" onClick={() => removeFormData(i)} title="Remove">✕</button>
                  </div>
                ))}
                <button className="btn-secondary btn-sm" onClick={addFormData} style={{ marginTop: 8 }}>+ Add Field</button>
              </div>
            )}
          </div>
        )}

        {/* ── Headers Tab ── */}
        {activeTab === 'headers' && (
          <div style={{ padding: 16 }}>
            <div className="editable-kv-header"><span>Key</span><span>Value</span><span></span><span></span></div>
            {editHeaders.map((h, i) => (
              <div key={i} className="editable-kv-row">
                <input value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} placeholder="Header name" />
                <input value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} placeholder="Value" />
                <input type="checkbox" checked={h.enabled} onChange={e => updateHeader(i, 'enabled', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <button className="btn-icon btn-sm" onClick={() => removeHeader(i)} title="Remove">✕</button>
              </div>
            ))}
            <button className="btn-secondary btn-sm" onClick={addHeader} style={{ marginTop: 8 }}>+ Add Header</button>
          </div>
        )}

        {/* ── Auth Tab ── */}
        {activeTab === 'auth' && (
          <div style={{ padding: 16 }}>
            {!auth ? (
              <div className="text-muted text-sm">No auth defined (inherits from parent/collection)</div>
            ) : (
              <div>
                <div className="text-muted text-sm mb-2">Type: {auth.type}</div>
                {auth.type === 'bearer' && auth.bearer && (
                  <table className="kv-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>
                    {auth.bearer.map((p: any, i: number) => (<tr key={i}><td>{p.key}</td><td>{p.value}</td></tr>))}
                  </tbody></table>
                )}
                {auth.type === 'basic' && auth.basic && (
                  <table className="kv-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>
                    {auth.basic.map((p: any, i: number) => (<tr key={i}><td>{p.key}</td><td>{p.value}</td></tr>))}
                  </tbody></table>
                )}
                {auth.type === 'apikey' && auth.apikey && (
                  <table className="kv-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>
                    {auth.apikey.map((p: any, i: number) => (<tr key={i}><td>{p.key}</td><td>{p.value}</td></tr>))}
                  </tbody></table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Scripts Tab ── */}
        {activeTab === 'scripts' && (
          <div style={{ padding: 16 }}>
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
