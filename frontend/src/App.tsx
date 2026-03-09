import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from './api';
import Sidebar from './components/Sidebar';
import RequestDetail from './components/RequestDetail';
import ResponsePanel from './components/ResponsePanel';
import EnvironmentEditor from './components/EnvironmentEditor';
import RunResults from './components/RunResults';

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

type MainView = 'request' | 'environment' | 'results';

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
  const [error, setError] = useState<string | null>(null);

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
    } else {
      setTree([]);
    }
  }, [activeCollectionId]);

  // Load item detail when selected
  useEffect(() => {
    if (activeCollectionId && selectedItemPath) {
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

  const handleRun = useCallback(async (itemPath?: string) => {
    if (!activeCollectionId) return;
    setRunning(true);
    setError(null);
    setResults([]);
    setMainView('results');

    try {
      const data = await api.runRequest(
        activeCollectionId,
        activeEnvironmentId || undefined,
        itemPath
      );
      setResults(data.results);
    } catch (err: any) {
      setError(`Run failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setRunning(false);
    }
  }, [activeCollectionId, activeEnvironmentId]);

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
      />

      {/* Main Panel */}
      <div className="main-panel">
        {mainView === 'request' && selectedItem ? (
          <RequestDetail
            item={selectedItem}
            itemPath={selectedItemPath || ''}
            onRun={() => handleRun(selectedItemPath || undefined)}
            running={running}
          />
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
    </div>
  );
}
