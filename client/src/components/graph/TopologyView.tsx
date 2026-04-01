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
import { buildGraphElements, type LayoutMode, type StatusFilter } from './graphLayout';
import { AgentNode } from './AgentNode';
import { TaskNode } from './TaskNode';
import CRTEmptyState from '../shared/CRTEmptyState';

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
  taskNode: TaskNode,
};

interface TopologyViewProps {
  team: TeamDetail;
  onTaskSelect: (taskId: string | null) => void;
  onAgentSelect?: (agentId: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  selectedAgentId?: string | null;
  alertedAgentNames?: Set<string>;
}

function cssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

const LAYOUT_OPTIONS: { mode: LayoutMode; label: string; icon: string; desc: string }[] = [
  { mode: 'hierarchical', label: 'SWIM', icon: '▥', desc: 'Swimlane — tasks grouped under each agent' },
  { mode: 'force',        label: 'CLUSTER', icon: '⊞', desc: 'Cluster — 2-column grid per agent' },
  { mode: 'circular',     label: 'RADIAL', icon: '◎', desc: 'Radial — agents in ring, tasks fan outward' },
];

function LayoutToolbar({ layout, onChange, statusFilter, onStatusFilterChange }: {
  layout: LayoutMode;
  onChange: (m: LayoutMode) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
}) {
  const STATUS_FILTER_OPTIONS: { mode: StatusFilter; label: string; desc: string }[] = [
    { mode: 'all',     label: 'ALL',     desc: 'Show all tasks including completed' },
    { mode: 'active',  label: 'ACTIVE',  desc: 'Hide completed tasks (default)' },
    { mode: 'blocked', label: 'BLOCKED', desc: 'Show only blocked tasks' },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '3px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      fontFamily: 'var(--font-mono, monospace)',
      backdropFilter: 'blur(8px)',
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
              padding: '5px 12px',
              background: isActive ? 'var(--active-bg-med)' : 'transparent',
              border: isActive ? '1px solid var(--active-border-hi)' : '1px solid transparent',
              borderRadius: '6px',
              color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-mono, monospace)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textShadow: isActive ? '0 0 6px var(--phosphor-glow)' : 'none',
              boxShadow: isActive ? 'var(--active-glow)' : 'none',
              fontWeight: isActive ? 600 : 400,
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            <span style={{ fontSize: '12px', opacity: isActive ? 1 : 0.5 }}>{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}

      {/* Separator */}
      <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

      {/* Status filter */}
      {STATUS_FILTER_OPTIONS.map(opt => {
        const isActive = statusFilter === opt.mode;
        return (
          <button
            key={opt.mode}
            title={opt.desc}
            onClick={() => onStatusFilterChange(opt.mode)}
            style={{
              padding: '5px 10px',
              background: isActive ? 'var(--active-bg-med)' : 'transparent',
              border: isActive ? '1px solid var(--active-border-hi)' : '1px solid transparent',
              borderRadius: '6px',
              color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-mono, monospace)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textShadow: isActive ? '0 0 6px var(--phosphor-glow)' : 'none',
              boxShadow: isActive ? 'var(--active-glow)' : 'none',
              fontWeight: isActive ? 600 : 400,
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TopologyViewInner({ team, onTaskSelect, onAgentSelect, containerRef, selectedAgentId, alertedAgentNames }: TopologyViewProps) {
  const [layout, setLayout] = useState<LayoutMode>('hierarchical');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const { fitView } = useReactFlow();

  const { nodes: rawNodes, edges } = useMemo(() => buildGraphElements(team, layout, selectedAgentId ?? undefined, statusFilter), [team, layout, selectedAgentId, statusFilter]);

  const nodes = useMemo(() => {
    const hasSelection = !!selectedAgentId;
    return rawNodes.map(node => {
      if (node.type === 'agentNode') {
        const member = (node.data as { member: { agentId: string; name: string } }).member;
        return {
          ...node,
          data: {
            ...node.data,
            isSelected: hasSelection && member.agentId === selectedAgentId,
            hasSelection,
            isAlerted: alertedAgentNames ? alertedAgentNames.has(member.name) : false,
          },
        };
      }
      return node;
    });
  }, [rawNodes, selectedAgentId, alertedAgentNames]);

  const handleLayoutChange = useCallback((mode: LayoutMode) => {
    setLayout(mode);
    setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 80);
  }, [fitView]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 'calc(100vh - 100px)',
        minHeight: '320px',
        borderRadius: '6px',
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
          border-radius: 6px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
          overflow: hidden;
        }
        .react-flow__controls-button {
          background: var(--surface-1) !important;
          border-bottom: 1px solid var(--border) !important;
          color: var(--text-secondary) !important;
          fill: var(--text-secondary) !important;
          box-shadow: none !important;
          width: 26px !important;
          height: 26px !important;
        }
        .react-flow__controls-button:hover {
          background: var(--active-bg-med) !important;
          color: var(--active-text) !important;
          fill: var(--active-text) !important;
        }
        .react-flow__minimap {
          background: var(--surface-0) !important;
          border: 1px solid var(--border) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
        }
        .react-flow__minimap-svg { border-radius: 5px; }
        .react-flow__edge-path { filter: drop-shadow(0 0 3px var(--graph-edge-glow)); }
        .react-flow__node { cursor: pointer; overflow: visible !important; }
        .react-flow__node:focus { outline: none; }
        .react-flow__node:hover { z-index: 10 !important; }
      `}</style>

      <LayoutToolbar layout={layout} onChange={handleLayoutChange} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />

      {nodes.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--graph-bg)',
        }}>
          <CRTEmptyState title="NO TOPOLOGY" subtitle="Agent nodes will appear when the team forms" />
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.15}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--graph-bg)' }}
        onNodeClick={(_event, node) => {
          if (node.type === 'taskNode') {
            onTaskSelect((node.data as { task: Task }).task.id);
          } else if (node.type === 'agentNode') {
            const member = (node.data as { member: { agentId: string } }).member;
            onAgentSelect?.(member.agentId);
          }
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={0.6}
          color={cssVar('--graph-dot-color', 'rgba(57,255,106,0.08)')}
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={2}
          zoomable
          pannable
          position="bottom-right"
          nodeColor={(node) => {
            if (node.type === 'agentNode') {
              const data = node.data as { isLead?: boolean; isAlerted?: boolean };
              if (data.isAlerted) return cssVar('--crimson', '#ff4466');
              if (data.isLead) return cssVar('--amber', '#f5a623');
              return cssVar('--phosphor', '#39ff6a');
            }
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
