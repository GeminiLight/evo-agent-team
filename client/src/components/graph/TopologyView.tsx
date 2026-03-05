import { useMemo, useState, useCallback } from 'react';
import type React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { TeamDetail, Task } from '../../types';
import { buildGraphElements, type LayoutMode } from './graphLayout';
import { AgentNode } from './AgentNode';
import { TaskNode } from './TaskNode';

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
  taskNode: TaskNode,
};

interface TopologyViewProps {
  team: TeamDetail;
  onTaskSelect: (taskId: string | null) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

function cssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

const LAYOUT_OPTIONS: { mode: LayoutMode; label: string; icon: string; desc: string }[] = [
  { mode: 'hierarchical', label: 'HIER', icon: '⊞', desc: 'Hierarchical' },
  { mode: 'force',        label: 'FORCE', icon: '⊛', desc: 'Force-directed' },
  { mode: 'circular',     label: 'CIRC', icon: '◎', desc: 'Circular' },
];

function LayoutToolbar({ layout, onChange }: { layout: LayoutMode; onChange: (m: LayoutMode) => void }) {
  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      gap: '2px',
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '3px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      fontFamily: 'var(--font-mono, monospace)',
    }}>
      {LAYOUT_OPTIONS.map(opt => {
        const isActive = layout === opt.mode;
        return (
          <button
            key={opt.mode}
            title={opt.desc}
            onClick={() => onChange(opt.mode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              background: isActive ? 'var(--active-bg-med)' : 'transparent',
              border: isActive ? '1px solid var(--active-border-hi)' : '1px solid transparent',
              borderRadius: '3px',
              color: isActive ? 'var(--active-text)' : 'var(--text-secondary)',
              fontSize: '9px',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-mono, monospace)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textShadow: isActive ? '0 0 6px var(--phosphor-glow)' : 'none',
              boxShadow: isActive ? 'var(--active-glow)' : 'none',
            }}
          >
            <span style={{ fontSize: '11px', opacity: 0.8 }}>{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TopologyViewInner({ team, onTaskSelect, containerRef }: TopologyViewProps) {
  const [layout, setLayout] = useState<LayoutMode>('hierarchical');
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(() => buildGraphElements(team, layout), [team, layout]);

  const handleLayoutChange = useCallback((mode: LayoutMode) => {
    setLayout(mode);
    // Fit view after layout change (next tick so nodes rerender first)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [fitView]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 'calc(100vh - 100px)',
        minHeight: '560px',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        position: 'relative',
      }}
    >
      <style>{`
        .react-flow__background { background: var(--graph-bg) !important; }
        .react-flow__controls {
          background: var(--surface-1) !important;
          border: 1px solid var(--border) !important;
          border-radius: 4px !important;
          box-shadow: none !important;
        }
        .react-flow__controls-button {
          background: var(--surface-1) !important;
          border-bottom: 1px solid var(--border) !important;
          color: var(--text-secondary) !important;
          fill: var(--text-secondary) !important;
          box-shadow: none !important;
        }
        .react-flow__controls-button:hover { background: var(--active-bg-med) !important; }
        .react-flow__minimap {
          background: var(--surface-0) !important;
          border: 1px solid var(--border) !important;
          border-radius: 4px !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4) !important;
        }
        .react-flow__minimap-svg { border-radius: 3px; }
        .react-flow__edge-path { filter: drop-shadow(0 0 2px var(--graph-edge-glow)); }
        .react-flow__node { cursor: pointer; }
        .react-flow__node:focus { outline: none; }
        /* Overflow visible on node wrappers so tooltips show above */
        .react-flow__node { overflow: visible !important; }
      `}</style>

      <LayoutToolbar layout={layout} onChange={handleLayoutChange} />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--graph-bg)' }}
        onNodeClick={(_event, node) => {
          if (node.type === 'taskNode') {
            onTaskSelect((node.data as { task: Task }).task.id);
          }
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={0.8}
          color={cssVar('--graph-dot-color', 'rgba(57,255,106,0.08)')}
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={2}
          zoomable
          pannable
          position="bottom-right"
          nodeColor={(node) => {
            if (node.type === 'agentNode') return cssVar('--phosphor', '#39ff6a');
            const status = (node.data as { derivedStatus?: string })?.derivedStatus;
            if (status === 'completed')   return cssVar('--color-completed',   '#39ff6a');
            if (status === 'in_progress') return cssVar('--color-in-progress', '#f5a623');
            if (status === 'blocked')     return cssVar('--crimson',            '#ff3b5c');
            return cssVar('--text-muted', '#4a6070');
          }}
          maskColor={cssVar('--minimap-mask', 'rgba(4,6,8,0.85)')}
          style={{ bottom: '12px', right: '12px' }}
        />
      </ReactFlow>
    </div>
  );
}

export function TopologyView(props: TopologyViewProps) {
  return (
    <ReactFlowProvider>
      <TopologyViewInner {...props} />
    </ReactFlowProvider>
  );
}
