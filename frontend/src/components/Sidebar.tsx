import { useState } from 'react';
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
}

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
}: SidebarProps) {
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
      {activeCollectionId && tree.length > 0 && (
        <div className="sidebar-section" style={{ flex: 1, overflow: 'auto' }}>
          <div className="sidebar-section-header">
            <span>Requests</span>
          </div>
          <TreeView
            nodes={tree}
            selectedPath={selectedItemPath}
            onSelect={onSelectItem}
            onRun={onRunItem}
            running={running}
            depth={0}
          />
        </div>
      )}
    </div>
  );
}

function TreeView({
  nodes,
  selectedPath,
  onSelect,
  onRun,
  running,
  depth,
}: {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRun: (path: string) => void;
  running: boolean;
  depth: number;
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
}: {
  node: TreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRun: (path: string) => void;
  running: boolean;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isFolder = node.type === 'folder';

  return (
    <div>
      <div
        className={`tree-item ${isFolder ? 'folder' : ''} ${selectedPath === node.path ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => {
          if (isFolder) {
            setExpanded(!expanded);
          } else {
            onSelect(node.path);
          }
        }}
      >
        {isFolder && (
          <span className="folder-icon">{expanded ? '▼' : '▶'}</span>
        )}
        {!isFolder && node.method && (
          <span className={`method-badge ${node.method}`}>{node.method}</span>
        )}
        <span className="name flex-1">{node.name}</span>
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
      </div>

      {isFolder && expanded && node.children && (
        <TreeView
          nodes={node.children}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onRun={onRun}
          running={running}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
