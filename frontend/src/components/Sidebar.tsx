import { useState, useRef, useEffect } from 'react';
import type { CollectionSummary, TreeNode } from '../App';

interface SidebarProps {
  collections: CollectionSummary[];
  activeCollectionId: string | null;
  onSelectCollection: (id: string) => void;
  onDeleteCollection: (id: string) => void;
  tree: TreeNode[];
  selectedItemPath: string | null;
  onSelectItem: (path: string) => void;
  onRunItem: (path: string) => void;
  running: boolean;
  onAddItem: (parentPath: string | null, type: 'request' | 'folder') => void;
  onRenameItem: (path: string, newName: string) => void;
  onChangeMethod: (path: string, method: string) => void;
  onDeleteItem: (path: string) => void;
  onMoveItem: (fromPath: string, toParentPath: string | null, toIndex: number) => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function Sidebar({
  collections,
  activeCollectionId,
  onSelectCollection,
  onDeleteCollection,
  tree,
  selectedItemPath,
  onSelectItem,
  onRunItem,
  running,
  onAddItem,
  onRenameItem,
  onChangeMethod,
  onDeleteItem,
  onMoveItem,
}: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [methodMenuPath, setMethodMenuPath] = useState<string | null>(null);
  const [moveMenuPath, setMoveMenuPath] = useState<string | null>(null);

  // Close context menus on outside click
  useEffect(() => {
    const handler = () => {
      setContextMenu(null);
      setMethodMenuPath(null);
      setMoveMenuPath(null);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // Collect all folders for the move-to menu
  const allFolders = collectFolders(tree);

  return (
    <div className="sidebar">
      {/* Collections list */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Collections</span>
        </div>
        {collections.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            No collections imported
          </div>
        )}
        {collections.map(col => (
          <div
            key={col.id}
            className={`tree-item ${activeCollectionId === col.id ? 'active' : ''}`}
            onClick={() => onSelectCollection(col.id)}
          >
            <span style={{ fontSize: 14 }}>📁</span>
            <span className="name flex-1">{col.name}</span>
            <button
              className="btn-icon btn-sm"
              title="Delete collection"
              onClick={e => {
                e.stopPropagation();
                if (confirm(`Delete "${col.name}"?`)) onDeleteCollection(col.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Request tree */}
      {activeCollectionId && (
        <div className="sidebar-section" style={{ flex: 1, overflow: 'auto' }}>
          <div className="sidebar-section-header">
            <span>Requests</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                className="btn-icon btn-sm"
                title="New Request"
                onClick={() => onAddItem(null, 'request')}
              >
                +
              </button>
              <button
                className="btn-icon btn-sm"
                title="New Folder"
                onClick={() => onAddItem(null, 'folder')}
                style={{ fontSize: 11 }}
              >
                📁+
              </button>
            </div>
          </div>
          {tree.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              No requests yet — add one above
            </div>
          )}
          <TreeView
            nodes={tree}
            selectedPath={selectedItemPath}
            onSelect={onSelectItem}
            onRun={onRunItem}
            running={running}
            depth={0}
            onContextMenu={(e, node) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, node });
            }}
            renamingPath={renamingPath}
            renameValue={renameValue}
            onRenameValueChange={setRenameValue}
            onRenameSubmit={(path) => {
              if (renameValue.trim()) {
                onRenameItem(path, renameValue.trim());
              }
              setRenamingPath(null);
            }}
            onRenameCancel={() => setRenamingPath(null)}
          />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="ctx-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {/* Add sub-items for folders */}
          {contextMenu.node.type === 'folder' && (
            <>
              <button className="ctx-item" onClick={() => {
                onAddItem(contextMenu.node.path, 'request');
                setContextMenu(null);
              }}>
                + New Request
              </button>
              <button className="ctx-item" onClick={() => {
                onAddItem(contextMenu.node.path, 'folder');
                setContextMenu(null);
              }}>
                📁 New Folder
              </button>
              <div className="ctx-divider" />
            </>
          )}

          {/* Change method (requests only) */}
          {contextMenu.node.type === 'request' && (
            <>
              <button className="ctx-item" onClick={(e) => {
                e.stopPropagation();
                setMethodMenuPath(methodMenuPath ? null : contextMenu.node.path);
              }}>
                Method → {contextMenu.node.method || 'GET'}
                {methodMenuPath === contextMenu.node.path && (
                  <div className="ctx-submenu">
                    {METHODS.map(m => (
                      <button key={m} className="ctx-item" onClick={() => {
                        onChangeMethod(contextMenu.node.path, m);
                        setContextMenu(null);
                        setMethodMenuPath(null);
                      }}>
                        <span className={`method-badge ${m}`}>{m}</span>
                      </button>
                    ))}
                  </div>
                )}
              </button>
              <div className="ctx-divider" />
            </>
          )}

          {/* Rename */}
          <button className="ctx-item" onClick={() => {
            setRenamingPath(contextMenu.node.path);
            setRenameValue(contextMenu.node.name);
            setContextMenu(null);
          }}>
            ✏️ Rename
          </button>

          {/* Move */}
          <button className="ctx-item" onClick={(e) => {
            e.stopPropagation();
            setMoveMenuPath(moveMenuPath ? null : contextMenu.node.path);
          }}>
            📦 Move to…
            {moveMenuPath === contextMenu.node.path && (
              <div className="ctx-submenu ctx-submenu-move">
                <button className="ctx-item" onClick={() => {
                  onMoveItem(contextMenu.node.path, null, 0);
                  setContextMenu(null);
                  setMoveMenuPath(null);
                }}>
                  📂 Root (top)
                </button>
                {allFolders
                  .filter(f => f.path !== contextMenu.node.path)
                  .map(f => (
                    <button key={f.path} className="ctx-item" onClick={() => {
                      onMoveItem(contextMenu.node.path, f.path, 0);
                      setContextMenu(null);
                      setMoveMenuPath(null);
                    }}>
                      {'  '.repeat(f.depth)}📁 {f.name}
                    </button>
                  ))}
              </div>
            )}
          </button>

          <div className="ctx-divider" />

          {/* Delete */}
          <button className="ctx-item ctx-item-danger" onClick={() => {
            if (confirm(`Delete "${contextMenu.node.name}"?`)) {
              onDeleteItem(contextMenu.node.path);
            }
            setContextMenu(null);
          }}>
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function collectFolders(
  nodes: TreeNode[],
  depth: number = 0
): { name: string; path: string; depth: number }[] {
  const result: { name: string; path: string; depth: number }[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      result.push({ name: node.name, path: node.path, depth });
      if (node.children) {
        result.push(...collectFolders(node.children, depth + 1));
      }
    }
  }
  return result;
}

// ── Tree Components ──

function TreeView({
  nodes,
  selectedPath,
  onSelect,
  onRun,
  running,
  depth,
  onContextMenu,
  renamingPath,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRun: (path: string) => void;
  running: boolean;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renamingPath: string | null;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onRenameSubmit: (path: string) => void;
  onRenameCancel: () => void;
}) {
  return (
    <>
      {nodes.map(node => (
        <TreeNodeItem
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onRun={onRun}
          running={running}
          depth={depth}
          onContextMenu={onContextMenu}
          renamingPath={renamingPath}
          renameValue={renameValue}
          onRenameValueChange={onRenameValueChange}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
        />
      ))}
    </>
  );
}

function TreeNodeItem({
  node,
  selectedPath,
  onSelect,
  onRun,
  running,
  depth,
  onContextMenu,
  renamingPath,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  node: TreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRun: (path: string) => void;
  running: boolean;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renamingPath: string | null;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onRenameSubmit: (path: string) => void;
  onRenameCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFolder = node.type === 'folder';
  const isRenaming = renamingPath === node.path;
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [isRenaming]);

  return (
    <div>
      <div
        className={`tree-item ${isFolder ? 'folder' : ''} ${selectedPath === node.path ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => {
          if (isRenaming) return;
          if (isFolder) {
            setExpanded(!expanded);
          } else {
            onSelect(node.path);
          }
        }}
        onContextMenu={e => onContextMenu(e, node)}
      >
        {isFolder && (
          <span className="folder-icon">{expanded ? '▼' : '▶'}</span>
        )}
        {!isFolder && node.method && (
          <span className={`method-badge ${node.method}`}>{node.method}</span>
        )}
        {isRenaming ? (
          <input
            ref={renameRef}
            className="rename-input"
            value={renameValue}
            onChange={e => onRenameValueChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onRenameSubmit(node.path);
              if (e.key === 'Escape') onRenameCancel();
            }}
            onBlur={() => onRenameSubmit(node.path)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="name flex-1">{node.name}</span>
        )}
        {!isRenaming && (
          <button
            className="btn-icon btn-sm"
            title={isFolder ? 'Run folder' : 'Run request'}
            onClick={e => {
              e.stopPropagation();
              if (!running) onRun(node.path);
            }}
            disabled={running}
          >
            ▶
          </button>
        )}
      </div>

      {isFolder && expanded && node.children && (
        <TreeView
          nodes={node.children}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onRun={onRun}
          running={running}
          depth={depth + 1}
          onContextMenu={onContextMenu}
          renamingPath={renamingPath}
          renameValue={renameValue}
          onRenameValueChange={onRenameValueChange}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
        />
      )}
    </div>
  );
}
