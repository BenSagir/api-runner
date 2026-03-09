import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

import {
  importCollectionFromJson,
  listCollections,
  getCollection,
  deleteCollection,
  buildCollectionTree,
  getItemByPath,
} from './engine/collectionLoader';
import {
  importEnvironmentFromJson,
  listEnvironments,
  getEnvironment,
  deleteEnvironment,
  updateEnvironmentVariables,
} from './engine/environmentLoader';
import {
  runCollection,
  loadGlobalVariables,
  saveGlobalVariables,
} from './engine/collectionRunner';
import {
  listHistory,
  getHistoryEntry,
  deleteHistoryEntry,
  clearHistory,
} from './engine/historyManager';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directories exist
const DATA_DIR = path.resolve(__dirname, '../data');
for (const sub of ['collections', 'environments', 'variables', 'history']) {
  const dir = path.join(DATA_DIR, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

// ──────────────────────────── COLLECTIONS ────────────────────────────

app.get('/api/collections', (_req, res) => {
  try {
    const collections = listCollections();
    res.json(collections.map(c => ({
      id: c.id,
      name: c.name,
      importedAt: c.importedAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections/:id', (req, res) => {
  try {
    const collection = getCollection(req.params.id);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    res.json(collection);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections/:id/tree', (req, res) => {
  try {
    const stored = getCollection(req.params.id);
    if (!stored) return res.status(404).json({ error: 'Collection not found' });
    const tree = buildCollectionTree(stored.collection.item);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections/:id/item/:itemPath(*)', (req, res) => {
  try {
    const stored = getCollection(req.params.id);
    if (!stored) return res.status(404).json({ error: 'Collection not found' });
    const item = getItemByPath(stored.collection.item, req.params.itemPath);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections/import', (req, res) => {
  try {
    const stored = importCollectionFromJson(req.body);
    res.json({ id: stored.id, name: stored.name, importedAt: stored.importedAt });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/collections/import-file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const json = JSON.parse(req.file.buffer.toString('utf-8'));
    const stored = importCollectionFromJson(json);
    res.json({ id: stored.id, name: stored.name, importedAt: stored.importedAt });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/collections/:id', (req, res) => {
  try {
    const deleted = deleteCollection(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Collection not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────── ENVIRONMENTS ────────────────────────────

app.get('/api/environments', (_req, res) => {
  try {
    const envs = listEnvironments();
    res.json(envs.map(e => ({
      id: e.id,
      name: e.name,
      importedAt: e.importedAt,
      variableCount: e.environment.values.length,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/environments/:id', (req, res) => {
  try {
    const env = getEnvironment(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });
    res.json(env);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/environments/import', (req, res) => {
  try {
    const stored = importEnvironmentFromJson(req.body);
    res.json({ id: stored.id, name: stored.name, importedAt: stored.importedAt });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/environments/import-file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const json = JSON.parse(req.file.buffer.toString('utf-8'));
    const stored = importEnvironmentFromJson(json);
    res.json({ id: stored.id, name: stored.name, importedAt: stored.importedAt });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/environments/:id/variables', (req, res) => {
  try {
    const updated = updateEnvironmentVariables(req.params.id, req.body.variables);
    if (!updated) return res.status(404).json({ error: 'Environment not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/environments/:id', (req, res) => {
  try {
    const deleted = deleteEnvironment(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Environment not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────── GLOBALS ────────────────────────────

app.get('/api/globals', (_req, res) => {
  try {
    const globals = loadGlobalVariables();
    res.json(globals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/globals', (req, res) => {
  try {
    saveGlobalVariables(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────── RUN ────────────────────────────

app.post('/api/run', async (req, res) => {
  try {
    const { collectionId, environmentId, itemPath, overrides } = req.body;

    if (!collectionId) {
      return res.status(400).json({ error: 'collectionId is required' });
    }

    const stored = getCollection(collectionId);
    if (!stored) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const results = await runCollection({
      collectionId,
      collection: stored.collection,
      environmentId: environmentId || undefined,
      itemPath: itemPath || undefined,
      overrides: overrides || undefined,
    });

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────── HISTORY ────────────────────────────

app.get('/api/history', (_req, res) => {
  try {
    res.json(listHistory());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/:id', (req, res) => {
  try {
    const entry = getHistoryEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: 'History entry not found' });
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/history/:id', (req, res) => {
  try {
    const deleted = deleteHistoryEntry(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'History entry not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/history', (_req, res) => {
  try {
    clearHistory();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────── START ────────────────────────────

app.listen(PORT, () => {
  console.log(`API Runner backend listening on http://localhost:${PORT}`);
});
