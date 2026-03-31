import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// ── Collections ──

export async function fetchCollections() {
  const { data } = await api.get('/collections');
  return data;
}

export async function fetchCollection(id: string) {
  const { data } = await api.get(`/collections/${id}`);
  return data;
}

export async function fetchCollectionTree(id: string) {
  const { data } = await api.get(`/collections/${id}/tree`);
  return data;
}

export async function fetchCollectionItem(collectionId: string, itemPath: string) {
  const { data } = await api.get(`/collections/${collectionId}/item/${itemPath}`);
  return data;
}

export async function importCollectionJson(json: any) {
  const { data } = await api.post('/collections/import', json);
  return data;
}

export async function importCollectionFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/collections/import-file', formData);
  return data;
}

export async function deleteCollection(id: string) {
  const { data } = await api.delete(`/collections/${id}`);
  return data;
}

// ── Collection Items (CRUD) ──

export async function addCollectionItem(
  collectionId: string,
  parentPath: string | null,
  item: { name: string; request?: { method: string; url: string | { raw: string } }; item?: any[] }
) {
  const { data } = await api.post(`/collections/${collectionId}/items`, { parentPath, item });
  return data;
}

export async function updateCollectionItem(
  collectionId: string,
  itemPath: string,
  updates: {
    name?: string;
    method?: string;
    url?: string;
    headers?: Array<{ key: string; value: string; enabled: boolean }>;
    body?: {
      mode: string;
      raw?: string;
      urlencoded?: Array<{ key: string; value: string; enabled: boolean }>;
      formdata?: Array<{ key: string; value: string; type: string; enabled: boolean }>;
    };
  }
) {
  const { data } = await api.put(`/collections/${collectionId}/items/${itemPath}`, updates);
  return data;
}

export async function deleteCollectionItem(collectionId: string, itemPath: string) {
  const { data } = await api.delete(`/collections/${collectionId}/items/${itemPath}`);
  return data;
}

export async function moveCollectionItem(
  collectionId: string,
  fromPath: string,
  toParentPath: string | null,
  toIndex: number
) {
  const { data } = await api.put(`/collections/${collectionId}/items-move`, {
    fromPath,
    toParentPath,
    toIndex,
  });
  return data;
}

// ── Environments ──

export async function fetchEnvironments() {
  const { data } = await api.get('/environments');
  return data;
}

export async function fetchEnvironment(id: string) {
  const { data } = await api.get(`/environments/${id}`);
  return data;
}

export async function importEnvironmentJson(json: any) {
  const { data } = await api.post('/environments/import', json);
  return data;
}

export async function importEnvironmentFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/environments/import-file', formData);
  return data;
}

export async function updateEnvironmentVariables(
  id: string,
  variables: Array<{ key: string; value: string; enabled?: boolean }>
) {
  const { data } = await api.put(`/environments/${id}/variables`, { variables });
  return data;
}

export async function deleteEnvironment(id: string) {
  const { data } = await api.delete(`/environments/${id}`);
  return data;
}

// ── Globals ──

export async function fetchGlobals() {
  const { data } = await api.get('/globals');
  return data;
}

export async function saveGlobals(globals: Record<string, string>) {
  const { data } = await api.put('/globals', globals);
  return data;
}

// ── Run ──

export async function runRequest(
  collectionId: string,
  environmentId?: string,
  itemPath?: string,
  overrides?: {
    url?: string;
    headers?: Array<{ key: string; value: string; enabled: boolean }>;
    body?: {
      mode: string;
      raw?: string;
      urlencoded?: Array<{ key: string; value: string; enabled: boolean }>;
      formdata?: Array<{ key: string; value: string; type: string; enabled: boolean }>;
    };
  }
) {
  const { data } = await api.post('/run', { collectionId, environmentId, itemPath, overrides });
  return data;
}

// ── History ──

export async function fetchHistory() {
  const { data } = await api.get('/history');
  return data;
}

export async function fetchHistoryEntry(id: string) {
  const { data } = await api.get(`/history/${id}`);
  return data;
}

export async function deleteHistoryEntry(id: string) {
  const { data } = await api.delete(`/history/${id}`);
  return data;
}

export async function clearHistory() {
  const { data } = await api.delete('/history');
  return data;
}
