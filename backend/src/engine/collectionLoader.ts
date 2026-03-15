import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  PostmanCollection,
  PostmanItem,
  StoredCollection,
  CollectionTreeNode,
} from './types';

const DATA_DIR = path.resolve(__dirname, '../../data');
const COLLECTIONS_DIR = path.join(DATA_DIR, 'collections');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function importCollection(filePath: string): StoredCollection {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  // Handle both wrapped and unwrapped formats
  const collection: PostmanCollection = parsed.collection ?? parsed;

  if (!collection.info || !collection.item) {
    throw new Error('Invalid Postman Collection v2.1 format: missing info or item');
  }

  const id = collection.info._postman_id || uuidv4();
  const filename = `${id}.json`;

  ensureDir(COLLECTIONS_DIR);

  const stored: StoredCollection = {
    id,
    filename,
    name: collection.info.name,
    importedAt: new Date().toISOString(),
    collection,
  };

  fs.writeFileSync(
    path.join(COLLECTIONS_DIR, filename),
    JSON.stringify(stored, null, 2),
    'utf-8'
  );

  return stored;
}

export function importCollectionFromJson(json: any): StoredCollection {
  const collection: PostmanCollection = json.collection ?? json;

  if (!collection.info || !collection.item) {
    throw new Error('Invalid Postman Collection v2.1 format: missing info or item');
  }

  const id = collection.info._postman_id || uuidv4();
  const filename = `${id}.json`;

  ensureDir(COLLECTIONS_DIR);

  const stored: StoredCollection = {
    id,
    filename,
    name: collection.info.name,
    importedAt: new Date().toISOString(),
    collection,
  };

  fs.writeFileSync(
    path.join(COLLECTIONS_DIR, filename),
    JSON.stringify(stored, null, 2),
    'utf-8'
  );

  return stored;
}

export function listCollections(): StoredCollection[] {
  ensureDir(COLLECTIONS_DIR);
  const files = fs.readdirSync(COLLECTIONS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(COLLECTIONS_DIR, f), 'utf-8');
    return JSON.parse(raw) as StoredCollection;
  });
}

export function getCollection(id: string): StoredCollection | null {
  ensureDir(COLLECTIONS_DIR);
  const filePath = path.join(COLLECTIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as StoredCollection;
}

export function deleteCollection(id: string): boolean {
  ensureDir(COLLECTIONS_DIR);
  const filePath = path.join(COLLECTIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function buildCollectionTree(items: PostmanItem[], parentPath: string = ''): CollectionTreeNode[] {
  return items.map((item, index) => {
    const currentPath = parentPath ? `${parentPath}/${index}` : `${index}`;

    if (item.item && item.item.length > 0) {
      // It's a folder
      return {
        name: item.name,
        type: 'folder' as const,
        path: currentPath,
        children: buildCollectionTree(item.item, currentPath),
      };
    }

    // It's a request
    const method = item.request
      ? (typeof item.request === 'string' ? 'GET' : item.request.method || 'GET')
      : 'GET';

    return {
      name: item.name,
      type: 'request' as const,
      method: method.toUpperCase(),
      path: currentPath,
    };
  });
}

export function getItemByPath(items: PostmanItem[], itemPath: string): PostmanItem | null {
  const parts = itemPath.split('/').map(Number);
  let current: PostmanItem[] = items;

  for (let i = 0; i < parts.length; i++) {
    const idx = parts[i];
    if (!current || idx >= current.length) return null;

    if (i === parts.length - 1) {
      return current[idx];
    }

    const folder = current[idx];
    if (!folder.item) return null;
    current = folder.item;
  }

  return null;
}

export function getAllRequestsInItem(item: PostmanItem, parentPath: string): { item: PostmanItem; path: string }[] {
  const results: { item: PostmanItem; path: string }[] = [];

  if (item.request) {
    results.push({ item, path: parentPath });
  }

  if (item.item) {
    item.item.forEach((child, index) => {
      const childPath = `${parentPath}/${index}`;
      results.push(...getAllRequestsInItem(child, childPath));
    });
  }

  return results;
}

// ── Resolve parent array + index from an item path ──

function resolveParentAndIndex(
  items: PostmanItem[],
  itemPath: string
): { parent: PostmanItem[]; index: number } | null {
  const parts = itemPath.split('/').map(Number);
  let current: PostmanItem[] = items;

  for (let i = 0; i < parts.length - 1; i++) {
    const idx = parts[i];
    if (!current || idx < 0 || idx >= current.length) return null;
    const folder = current[idx];
    if (!folder.item) return null;
    current = folder.item;
  }

  const lastIdx = parts[parts.length - 1];
  if (lastIdx < 0 || lastIdx >= current.length) return null;
  return { parent: current, index: lastIdx };
}

// ── Save a stored collection back to disk ──

function saveCollection(stored: StoredCollection): void {
  ensureDir(COLLECTIONS_DIR);
  fs.writeFileSync(
    path.join(COLLECTIONS_DIR, stored.filename),
    JSON.stringify(stored, null, 2),
    'utf-8'
  );
}

// ── Add a new item (request or folder) ──

export function addItem(
  collectionId: string,
  parentPath: string | null,
  newItem: PostmanItem
): StoredCollection | null {
  const stored = getCollection(collectionId);
  if (!stored) return null;

  if (!parentPath) {
    // Add at root
    stored.collection.item.push(newItem);
  } else {
    const target = getItemByPath(stored.collection.item, parentPath);
    if (!target) return null;
    if (!target.item) target.item = [];
    target.item.push(newItem);
  }

  saveCollection(stored);
  return stored;
}

// ── Update an existing item (rename, change method, etc.) ──

export function updateItem(
  collectionId: string,
  itemPath: string,
  updates: { name?: string; method?: string }
): StoredCollection | null {
  const stored = getCollection(collectionId);
  if (!stored) return null;

  const item = getItemByPath(stored.collection.item, itemPath);
  if (!item) return null;

  if (updates.name !== undefined) {
    item.name = updates.name;
  }
  if (updates.method !== undefined && item.request) {
    item.request.method = updates.method.toUpperCase();
  }

  saveCollection(stored);
  return stored;
}

// ── Delete an item ──

export function deleteItem(
  collectionId: string,
  itemPath: string
): StoredCollection | null {
  const stored = getCollection(collectionId);
  if (!stored) return null;

  const parts = itemPath.split('/').map(Number);
  if (parts.length === 1) {
    // Root-level item
    const idx = parts[0];
    if (idx < 0 || idx >= stored.collection.item.length) return null;
    stored.collection.item.splice(idx, 1);
  } else {
    const resolved = resolveParentAndIndex(stored.collection.item, itemPath);
    if (!resolved) return null;
    resolved.parent.splice(resolved.index, 1);
  }

  saveCollection(stored);
  return stored;
}

// ── Move an item to a new parent and position ──

export function moveItem(
  collectionId: string,
  fromPath: string,
  toParentPath: string | null,
  toIndex: number
): StoredCollection | null {
  const stored = getCollection(collectionId);
  if (!stored) return null;

  // Extract the item from its current position
  const fromParts = fromPath.split('/').map(Number);
  let fromParent: PostmanItem[];
  let fromIdx: number;

  if (fromParts.length === 1) {
    fromParent = stored.collection.item;
    fromIdx = fromParts[0];
  } else {
    const resolved = resolveParentAndIndex(stored.collection.item, fromPath);
    if (!resolved) return null;
    fromParent = resolved.parent;
    fromIdx = resolved.index;
  }

  if (fromIdx < 0 || fromIdx >= fromParent.length) return null;
  const [movedItem] = fromParent.splice(fromIdx, 1);

  // Insert into destination
  let toParent: PostmanItem[];
  if (!toParentPath) {
    toParent = stored.collection.item;
  } else {
    const target = getItemByPath(stored.collection.item, toParentPath);
    if (!target) return null;
    if (!target.item) target.item = [];
    toParent = target.item;
  }

  const clampedIndex = Math.max(0, Math.min(toIndex, toParent.length));
  toParent.splice(clampedIndex, 0, movedItem);

  saveCollection(stored);
  return stored;
}

export function getAllRequests(items: PostmanItem[], parentPath: string = ''): { item: PostmanItem; path: string }[] {
  const results: { item: PostmanItem; path: string }[] = [];

  items.forEach((item, index) => {
    const currentPath = parentPath ? `${parentPath}/${index}` : `${index}`;
    results.push(...getAllRequestsInItem(item, currentPath));
  });

  return results;
}
