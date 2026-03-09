import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PostmanEnvironment, StoredEnvironment } from './types';

const DATA_DIR = path.resolve(__dirname, '../../data');
const ENVIRONMENTS_DIR = path.join(DATA_DIR, 'environments');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function importEnvironment(filePath: string): StoredEnvironment {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const env: PostmanEnvironment = JSON.parse(raw);
  return importEnvironmentFromJson(env);
}

export function importEnvironmentFromJson(json: any): StoredEnvironment {
  const env: PostmanEnvironment = json;

  if (!env.name || !env.values) {
    throw new Error('Invalid Postman Environment format: missing name or values');
  }

  const id = env.id || uuidv4();
  const filename = `${id}.json`;

  ensureDir(ENVIRONMENTS_DIR);

  // Normalize values - ensure enabled defaults to true
  for (const v of env.values) {
    if (v.enabled === undefined) {
      v.enabled = true;
    }
  }

  const stored: StoredEnvironment = {
    id,
    filename,
    name: env.name,
    importedAt: new Date().toISOString(),
    environment: env,
  };

  fs.writeFileSync(
    path.join(ENVIRONMENTS_DIR, filename),
    JSON.stringify(stored, null, 2),
    'utf-8'
  );

  return stored;
}

export function listEnvironments(): StoredEnvironment[] {
  ensureDir(ENVIRONMENTS_DIR);
  const files = fs.readdirSync(ENVIRONMENTS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(ENVIRONMENTS_DIR, f), 'utf-8');
    return JSON.parse(raw) as StoredEnvironment;
  });
}

export function getEnvironment(id: string): StoredEnvironment | null {
  ensureDir(ENVIRONMENTS_DIR);
  const filePath = path.join(ENVIRONMENTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as StoredEnvironment;
}

export function deleteEnvironment(id: string): boolean {
  ensureDir(ENVIRONMENTS_DIR);
  const filePath = path.join(ENVIRONMENTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function updateEnvironmentVariables(
  id: string,
  variables: Array<{ key: string; value: string; enabled?: boolean }>
): StoredEnvironment | null {
  const stored = getEnvironment(id);
  if (!stored) return null;

  stored.environment.values = variables.map(v => ({
    key: v.key,
    value: v.value,
    enabled: v.enabled !== false,
    type: 'default',
  }));

  ensureDir(ENVIRONMENTS_DIR);
  fs.writeFileSync(
    path.join(ENVIRONMENTS_DIR, `${id}.json`),
    JSON.stringify(stored, null, 2),
    'utf-8'
  );

  return stored;
}
