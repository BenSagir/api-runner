import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function listHistory(): any[] {
  ensureDir(HISTORY_DIR);
  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  return files.slice(0, 100).map(f => {
    const raw = fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8');
    const entry = JSON.parse(raw);
    return {
      id: entry.id,
      collectionId: entry.collectionId,
      timestamp: entry.timestamp,
      resultCount: entry.results?.length || 0,
    };
  });
}

export function getHistoryEntry(id: string): any | null {
  ensureDir(HISTORY_DIR);
  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function deleteHistoryEntry(id: string): boolean {
  ensureDir(HISTORY_DIR);
  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function clearHistory(): void {
  ensureDir(HISTORY_DIR);
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    fs.unlinkSync(path.join(HISTORY_DIR, f));
  }
}
