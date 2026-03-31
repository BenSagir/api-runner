import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from './api';
import Sidebar from './components/Sidebar';
import RequestDetail, { RequestOverrides } from './components/RequestDetail';
import ResponsePanel from './components/ResponsePanel';
import EnvironmentEditor from './components/EnvironmentEditor';
import RunResults from './components/RunResults';
import ThemeCustomizer from './components/ThemeCustomizer';

type MainView = 'request' | 'environment' | 'results';

export interface CollectionSummary {
  id: string;
  name: string;
  importedAt: string;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  importedAt: string;
  variableCount: number;
}

export interface TreeNode {
  name: string;
  type: 'folder' | 'request';
  method?: string;
  path: string;
  children?: TreeNode[];
}

export interface ExecutionResult {
  requestName: string;
  requestPath: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  responseTime: number;
  responseSize: number;
  responseHeaders: Record<string, string>;
  responseBody: any;
  testResults: Array<{ name: string; passed: boolean; error?: string }>;
  error?: string;
  timestamp: string;
}

export default function App() {
  // Data
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentSummary[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);

  // Selection
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(null);
  const [selectedItemPath, setSelectedItemPath] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // UI state
  const [mainView, setMainView] = useState<MainView>('request');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [singleResponse, setSingleResponse] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showThemePanel, setShowThemePanel] = useState(false);

  // File input refs
  const collectionFileRef = useRef<HTMLInputElement>(null);
  const envFileRef = useRef<HTMLInputElement>(null);

  // Load collections and environments on mount
  useEffect(() => {
    loadCollections();
    loadEnvironments();
  }, []);

  // Load tree when collection changes
  useEffect(() => {
    if (activeCollectionId) {
      api.fetchCollectionTree(activeCollectionId).then(setTree).catch(console.error);
      setSelectedItemPath(null);
      setSelectedItem(null);
      setSingleResponse(null);
    } else {
      setTree([]);
    }
  }, [activeCollectionId]);

  // Load item detail when selected
  useEffect(() => {
    if (activeCollectionId && selectedItemPath) {
      setSingleResponse(null);
      api.fetchCollectionItem(activeCollectionId, selectedItemPath)
        .then(item => {
          setSelectedItem(item);
          setMainView('request');
        })
        .catch(console.error);
    }
  }, [activeCollectionId, selectedItemPath]);

  const loadCollections = useCallback(async () => {
    try {
      const data = await api.fetchCollections();
      setCollections(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const loadEnvironments = useCallback(async () => {
    try {
      const data = await api.fetchEnvironments();
      setEnvironments(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const handleImportCollection = useCallback(async (file: File) => {
    try {
      setError(null);
      const result = await api.importCollectionFile(file);
      await loadCollections();
      setActiveCollectionId(result.id);
    } catch (err: any) {
      setError(`Import failed: ${err.response?.data?.error || err.message}`);
    }
  }, [loadCollections]);

  const handleImportEnvironment = useCallback(async (file: File) => {
    try {
      setError(null);
      const result = await api.importEnvironmentFile(file);
      await loadEnvironments();
      setActiveEnvironmentId(result.id);
    } catch (err: any) {
      setError(`Import failed: ${err.response?.data?.error || err.message}`);
    }
  }, [loadEnvironments]);

  const handleDeleteCollection = useCallback(async (id: string) => {
    try {
      await api.deleteCollection(id);
      if (activeCollectionId === id) {
        setActiveCollectionId(null);
      }
      await loadCollections();
    } catch (err: any) {
      setError(err.message);
    }
  }, [activeCollectionId, loadCollections]);

  const handleDeleteEnvironment = useCallback(async (id: string) => {
    try {
      await api.deleteEnvironment(id);
      if (activeEnvironmentId === id) {
        setActiveEnvironmentId(null);
      }
      await loadEnvironments();
    } catch (err: any) {
      setError(err.message);
    }
  }, [activeEnvironmentId, loadEnvironments]);

  // ── Reload tree helper ──
  const reloadTree = useCallback(async () => {
    if (!activeCollectionId) return;
    const newTree = await api.fetchCollectionTree(activeCollectionId);
    setTree(newTree);
  }, [activeCollectionId]);

  // ── Item CRUD handlers ──

  const handleAddItem = useCallback(async (parentPath: string | null, type: 'request' | 'folder') => {
    if (!activeCollectionId) return;
    const name = prompt(`Enter name for new ${type}:`);
    if (!name?.trim()) return;
    try {
      const item = type === 'folder'
        ? { name: name.trim(), item: [] }
        : { name: name.trim(), request: { method: 'GET', url: { raw: '' }, header: [] } };
      const result = await api.addCollectionItem(activeCollectionId, parentPath, item);
      setTree(result.tree);
    } catch (err: any) {
      setError(`Add failed: ${err.response?.data?.error || err.message}`);
    }
  }, [activeCollectionId]);

  const handleRenameItem = useCallback(async (itemPath: string, newName: string) => {
    if (!activeCollectionId) return;
    try {
      const result = await api.updateCollectionItem(activeCollectionId, itemPath, { name: newName });
      setTree(result.tree);
      // If the renamed item is selected, refresh it
      if (selectedItemPath === itemPath) {
        const updatedItem = await api.fetchCollectionItem(activeCollectionId, itemPath);
        setSelectedItem(updatedItem);
      }
    } catch (err: any) {
      setError(`Rename failed: ${err.response?.data?.error || err.message}`);
    }
  }, [activeCollectionId, selectedItemPath]);

  const handleChangeMethod = useCallback(async (itemPath: string, method: string) => {
    if (!activeCollectionId) return;
    try {
      const result = await api.updateCollectionItem(activeCollectionId, itemPath, { method });
      setTree(result.tree);
      if (selectedItemPath === itemPath) {
        const updatedItem = await api.fetchCollectionItem(activeCollectionId, itemPath);
        setSelectedItem(updatedItem);
      }
    } catch (err: any) {
      setError(`Method change failed: ${err.response?.data?.error || err.message}`);
    }
  }, [activeCollectionId, selectedItemPath]);

  const handleDeleteItem = useCallback(async (itemPath: string) => {
    if (!activeCollectionId) return;
    try {
      const result = await api.deleteCollectionItem(activeCollectionId, itemPath);
      setTree(result.tree);
      if (selectedItemPath === itemPath) {
        setSelectedItemPath(null);
        setSelectedItem(null);
      }
    } catch (err: any) {
      setError(`Delete failed: ${err.response?.data?.error || err.message}`);
    }
  }, [activeCollectionId, selectedItemPath]);

  const handleMoveItem = useCallback(async (fromPath: string, toParentPath: string | null, toIndex: number) => {
    if (!activeCollectionId) return;
    try {
      const result = await api.moveCollectionItem(activeCollectionId, fromPath, toParentPath, toIndex);
      setTree(result.tree);
      // Clear selection since paths changed after move
      setSelectedItemPath(null);
      setSelectedItem(null);
    } catch (err: any) {
      setError(`Move failed: ${err.response?.data?.error || err.message}`);
    }
  }, [activeCollectionId]);

  const handleRun = useCallback(async (itemPath?: string, overrides?: RequestOverrides) => {
    if (!activeCollectionId) return;
    setRunning(true);
    setError(null);

    // Determine if this is a single request or a collection/folder run
    const isSingleRequest = !!itemPath && selectedItem?.request;

    if (isSingleRequest) {
      // Keep request view, show response below
      setSingleResponse(null);
      setMainView('request');
    } else {
      // Collection/folder run → use RunResults view
      setResults([]);
      setMainView('results');
    }

    try {
      const data = await api.runRequest(
        activeCollectionId,
        activeEnvironmentId || undefined,
        itemPath,
        overrides
      );
      if (isSingleRequest && data.results.length === 1) {
        setSingleResponse(data.results[0]);
      } else {
        setResults(data.results);
        setMainView('results');
      }
    } catch (err: any) {
      setError(`Run failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setRunning(false);
    }
  }, [activeCollectionId, activeEnvironmentId, selectedItem]);

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <h1>⚡ API Runner</h1>

        <div className="header-controls">
          {error && (
            <span style={{ color: 'var(--error)', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {error}
            </span>
          )}

          <select
            className="env-select"
            value={activeEnvironmentId || ''}
            onChange={e => setActiveEnvironmentId(e.target.value || null)}
          >
            <option value="">No Environment</option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>

          {activeEnvironmentId && (
            <button
              className="btn-secondary btn-sm"
              onClick={() => setMainView('environment')}
            >
              Edit Env
            </button>
          )}

          <button
            className="btn-secondary btn-sm"
            onClick={() => collectionFileRef.current?.click()}
          >
            Import Collection
          </button>
          <input
            ref={collectionFileRef}
            type="file"
            accept=".json"
            className="file-input-hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleImportCollection(file);
              e.target.value = '';
            }}
          />

          <button
            className="btn-secondary btn-sm"
            onClick={() => envFileRef.current?.click()}
          >
            Import Environment
          </button>
          <input
            ref={envFileRef}
            type="file"
            accept=".json"
            className="file-input-hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleImportEnvironment(file);
              e.target.value = '';
            }}
          />

          <button
            className="btn-secondary btn-sm"
            onClick={() => setShowThemePanel(true)}
            title="Customize theme"
          >
            🎨
          </button>

          {activeCollectionId && (
            <button
              className="btn-primary btn-sm"
              onClick={() => handleRun(undefined)}
              disabled={running}
            >
              {running ? 'Running...' : 'Run All'}
            </button>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        collections={collections}
        activeCollectionId={activeCollectionId}
        onSelectCollection={setActiveCollectionId}
        onDeleteCollection={handleDeleteCollection}
        tree={tree}
        selectedItemPath={selectedItemPath}
        onSelectItem={setSelectedItemPath}
        onRunItem={(path) => handleRun(path)}
        running={running}
        onAddItem={handleAddItem}
        onRenameItem={handleRenameItem}
        onChangeMethod={handleChangeMethod}
        onDeleteItem={handleDeleteItem}
        onMoveItem={handleMoveItem}
      />

      {/* Main Panel */}
      <div className="main-panel">
        {mainView === 'request' && selectedItem ? (
          <div className="request-response-split">
            {/* Request Pane (top) */}
            <div className="split-pane split-pane-request">
              <RequestDetail
                item={selectedItem}
                itemPath={selectedItemPath || ''}
                collectionId={activeCollectionId || ''}
                onRun={(overrides) => handleRun(selectedItemPath || undefined, overrides)}
                onRequestSaved={reloadTree}
                running={running}
              />
            </div>

            {/* Response Pane (bottom) — visible after sending */}
            {(singleResponse || running) && (
              <>
                <div className="split-divider" />
                <div className="split-pane split-pane-response">
                  {running && !singleResponse ? (
                    <div className="empty-state">
                      <div className="spinner" style={{ width: 24, height: 24 }} />
                      <div>Sending request...</div>
                    </div>
                  ) : singleResponse ? (
                    <ResponsePanel result={singleResponse} />
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : mainView === 'environment' && activeEnvironmentId ? (
          <EnvironmentEditor
            environmentId={activeEnvironmentId}
            onClose={() => setMainView('request')}
          />
        ) : mainView === 'results' ? (
          <RunResults results={results} running={running} />
        ) : (
          <div className="empty-state">
            <div className="icon">📋</div>
            <div>Import a Postman collection to get started</div>
            <div className="text-sm text-muted">
              Click "Import Collection" in the header, or select a request from the sidebar
            </div>
          </div>
        )}
      </div>

      {showThemePanel && (
        <ThemeCustomizer onClose={() => setShowThemePanel(false)} />
      )}
    </div>
  );
}
