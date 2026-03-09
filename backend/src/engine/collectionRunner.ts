import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  PostmanCollection,
  PostmanItem,
  PostmanAuth,
  PostmanEvent,
  VariableScope,
  ExecutionResult,
  StoredEnvironment,
} from './types';
import { executeRequest } from './requestExecutor';
import {
  getItemByPath,
  getAllRequestsInItem,
  getAllRequests,
} from './collectionLoader';

const DATA_DIR = path.resolve(__dirname, '../../data');
const VARIABLES_DIR = path.join(DATA_DIR, 'variables');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const ENVIRONMENTS_DIR = path.join(DATA_DIR, 'environments');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadGlobalVariables(): Record<string, string> {
  ensureDir(VARIABLES_DIR);
  const filePath = path.join(VARIABLES_DIR, 'globals.json');
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function saveGlobalVariables(vars: Record<string, string>): void {
  ensureDir(VARIABLES_DIR);
  fs.writeFileSync(
    path.join(VARIABLES_DIR, 'globals.json'),
    JSON.stringify(vars, null, 2),
    'utf-8'
  );
}

export function loadCollectionVariables(collectionId: string): Record<string, string> {
  ensureDir(VARIABLES_DIR);
  const filePath = path.join(VARIABLES_DIR, `collection_${collectionId}.json`);
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function saveCollectionVariables(collectionId: string, vars: Record<string, string>): void {
  ensureDir(VARIABLES_DIR);
  fs.writeFileSync(
    path.join(VARIABLES_DIR, `collection_${collectionId}.json`),
    JSON.stringify(vars, null, 2),
    'utf-8'
  );
}

export function loadEnvironmentVariables(envId: string): Record<string, string> {
  ensureDir(ENVIRONMENTS_DIR);
  const filePath = path.join(ENVIRONMENTS_DIR, `${envId}.json`);
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8');
  const stored = JSON.parse(raw) as StoredEnvironment;
  const vars: Record<string, string> = {};
  for (const v of stored.environment.values) {
    if (v.enabled !== false) {
      vars[v.key] = v.value;
    }
  }
  return vars;
}

export function saveEnvironmentVariables(envId: string, vars: Record<string, string>): void {
  ensureDir(ENVIRONMENTS_DIR);
  const filePath = path.join(ENVIRONMENTS_DIR, `${envId}.json`);
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const stored = JSON.parse(raw) as StoredEnvironment;

  // Update existing values and add new ones
  const existingKeys = new Set(stored.environment.values.map(v => v.key));

  for (const v of stored.environment.values) {
    if (v.key in vars) {
      v.value = vars[v.key];
    }
  }

  // Add new keys
  for (const [key, value] of Object.entries(vars)) {
    if (!existingKeys.has(key)) {
      stored.environment.values.push({ key, value, enabled: true });
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(stored, null, 2), 'utf-8');
}

function saveHistory(results: ExecutionResult[], collectionId: string): void {
  ensureDir(HISTORY_DIR);
  const entry = {
    id: uuidv4(),
    collectionId,
    timestamp: new Date().toISOString(),
    results,
  };
  const filePath = path.join(HISTORY_DIR, `${entry.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
}

export interface RunOptions {
  collectionId: string;
  collection: PostmanCollection;
  environmentId?: string;
  itemPath?: string; // If provided, only run this item (request or folder)
}

/**
 * Build variable scope from persisted data + collection variables.
 */
function buildScope(
  collection: PostmanCollection,
  collectionId: string,
  environmentId?: string
): VariableScope {
  // Collection variables from the collection itself
  const collectionVars: Record<string, string> = {};
  if (collection.variable) {
    for (const v of collection.variable) {
      if (!v.disabled) {
        collectionVars[v.key] = v.value;
      }
    }
  }

  // Merge with persisted collection variables (persisted takes precedence)
  const persistedCollectionVars = loadCollectionVariables(collectionId);
  Object.assign(collectionVars, persistedCollectionVars);

  // Environment variables
  const envVars = environmentId ? loadEnvironmentVariables(environmentId) : {};

  // Global variables
  const globalVars = loadGlobalVariables();

  return {
    request: {},
    collection: collectionVars,
    environment: envVars,
    global: globalVars,
  };
}

/**
 * Gather parent auth and events by walking the path to a request.
 */
function gatherParentContext(items: PostmanItem[], itemPath: string): {
  parentAuth?: PostmanAuth;
  parentEvents: PostmanEvent[];
} {
  const parts = itemPath.split('/').map(Number);
  let current: PostmanItem[] = items;
  const parentEvents: PostmanEvent[] = [];
  let parentAuth: PostmanAuth | undefined;

  // Walk all but the last segment (those are parents)
  for (let i = 0; i < parts.length - 1; i++) {
    const idx = parts[i];
    if (!current || idx >= current.length) break;
    const folder = current[idx];

    if (folder.auth) {
      parentAuth = folder.auth;
    }

    if (folder.event) {
      parentEvents.push(...folder.event);
    }

    if (folder.item) {
      current = folder.item;
    }
  }

  return { parentAuth, parentEvents };
}

/**
 * Run requests: single request, folder, or entire collection.
 */
export async function runCollection(options: RunOptions): Promise<ExecutionResult[]> {
  const { collectionId, collection, environmentId, itemPath } = options;
  const scope = buildScope(collection, collectionId, environmentId);
  const results: ExecutionResult[] = [];

  let requestList: { item: PostmanItem; path: string }[];

  if (itemPath) {
    const targetItem = getItemByPath(collection.item, itemPath);
    if (!targetItem) {
      throw new Error(`Item not found at path: ${itemPath}`);
    }

    if (targetItem.request) {
      // Single request
      requestList = [{ item: targetItem, path: itemPath }];
    } else if (targetItem.item) {
      // Folder - get all nested requests
      requestList = getAllRequestsInItem(targetItem, itemPath);
    } else {
      throw new Error('Item has no request and no sub-items');
    }
  } else {
    // Run entire collection
    requestList = getAllRequests(collection.item);
  }

  // Execute sequentially so variables persist across requests
  for (const { item, path: reqPath } of requestList) {
    // Reset request-level variables for each request
    scope.request = {};

    // Gather parent context
    const { parentAuth, parentEvents } = gatherParentContext(collection.item, reqPath);

    const result = await executeRequest({
      item,
      scope,
      collectionAuth: collection.auth,
      collectionEvents: collection.event,
      parentAuth,
      parentEvents,
      requestPath: reqPath,
    });

    results.push(result);
  }

  // Persist updated variables
  saveCollectionVariables(collectionId, scope.collection);
  if (environmentId) {
    saveEnvironmentVariables(environmentId, scope.environment);
  }
  saveGlobalVariables(scope.global);

  // Save to history
  saveHistory(results, collectionId);

  return results;
}
