"use client";

import {
  Background, BackgroundVariant, Controls, MiniMap,
  ReactFlow, addEdge, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node,
} from "@xyflow/react";
import { Trophy } from "lucide-react";
import { useCallback } from "react";
import { nodeTypes } from "./CustomNodes";
import type { ABVariant, FlowNode, FlowEdge, NodeData } from "./types";

// -- Types ---------------------------------------------------------------------

export interface ABStats {
  variantA: { sent: number; accepted: number; rate: number };
  variantB: { sent: number; accepted: number; rate: number };
  winner: "a" | "b" | null;
  sampleOk: boolean;
}

interface ABVariantCanvasProps {
  label: "A" | "B";
  color: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  splitPercent: number;
  onSplitChange: (pct: number) => void;
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, variant: "A" | "B") => void;
}

// -- Single variant canvas -----------------------------------------------------

function ABVariantCanvas({
  label, color, initialNodes, initialEdges,
  splitPercent, onSplitChange, onChange, onDrop,
}: ABVariantCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as Edge[]);

  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...conn, animated: true, style: { stroke: color, strokeWidth: 2 } }, eds);
        onChange(nodes as FlowNode[], next as FlowEdge[]);
        return next;
      });
    },
    [setEdges, nodes, onChange, color]
  );

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  const bgColor = label === "A" ? "rgba(37,99,235,0.04)" : "rgba(124,58,237,0.04)";

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Variant header */}
      <div className={[
        "flex flex-shrink-0 items-center gap-3 border-b px-4 py-2 border-[var(--border)]",
        label === "A" ? "bg-[rgba(37,99,235,0.08)]" : "bg-[rgba(124,58,237,0.08)]",
      ].join(" ")}>
        <span className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white",
          label === "A" ? "bg-[#2563EB]" : "bg-[#7C3AED]",
        ].join(" ")}>
          {label}
        </span>
        <span className={`text-xs font-bold ${label === "A" ? "text-[#2563EB]" : "text-[#7C3AED]"}`}>
          Variante {label}
        </span>

        {/* Split percent */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--foreground-faint)]">Distribución:</span>
          <input
            type="number"
            min={1}
            max={99}
            value={splitPercent}
            onChange={(e) => onSplitChange(Math.min(99, Math.max(1, parseInt(e.target.value) || 50)))}
            className={[
              "w-14 rounded border px-2 py-0.5 text-center text-xs font-bold bg-[var(--background)] focus:outline-none focus:ring-1",
              label === "A"
                ? "border-[rgba(37,99,235,0.4)] text-[#2563EB] focus:border-[#2563EB] focus:ring-[rgba(37,99,235,0.3)]"
                : "border-[rgba(124,58,237,0.4)] text-[#7C3AED] focus:border-[#7C3AED] focus:ring-[rgba(124,58,237,0.3)]",
            ].join(" ")}
          />
          <span className="text-[10px] text-[var(--foreground-faint)]">%</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0" style={{ background: bgColor }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            onChange(nodes as FlowNode[], edges as FlowEdge[]);
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes);
            onChange(nodes as FlowNode[], edges as FlowEdge[]);
          }}
          onConnect={onConnect}
          onDrop={(e) => onDrop(e, label)}
          onDragOver={handleDragOver}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: color, strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={label === "A" ? "rgba(37,99,235,0.25)" : "rgba(124,58,237,0.25)"} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={() => color}
            style={{ bottom: 8, right: 8, borderRadius: 6 }}
            maskColor="rgba(0,0,0,0.3)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// -- AB Test Panel (outer) -----------------------------------------------------

interface ABTestPanelProps {
  variantA: ABVariant;
  variantB: ABVariant;
  abStats?: ABStats;
  onVariantAChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onVariantBChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onSplitAChange: (pct: number) => void;
  onSplitBChange: (pct: number) => void;
  onDropToVariant: (e: React.DragEvent<HTMLDivElement>, variant: "A" | "B") => void;
  onDeclareWinner: (winner: "a" | "b") => void;
}

export function ABTestPanel({
  variantA, variantB, abStats,
  onVariantAChange, onVariantBChange,
  onSplitAChange, onSplitBChange,
  onDropToVariant, onDeclareWinner,
}: ABTestPanelProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Stats bar (when analytics exist) */}
      {abStats && (
        <div className="flex flex-shrink-0 items-center gap-6 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-2.5">
          {/* Variant A stats */}
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-[9px] font-black text-white">A</span>
            <div className="text-xs">
              <span className="font-bold text-[#2563EB]">{abStats.variantA.rate}%</span>
              <span className="text-[var(--foreground-faint)] ml-1">conversión ({abStats.variantA.accepted}/{abStats.variantA.sent})</span>
            </div>
          </div>

          <div className="h-3 w-px bg-[var(--border)]" />

          {/* Variant B stats */}
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED] text-[9px] font-black text-white">B</span>
            <div className="text-xs">
              <span className="font-bold text-[#7C3AED]">{abStats.variantB.rate}%</span>
              <span className="text-[var(--foreground-faint)] ml-1">conversión ({abStats.variantB.accepted}/{abStats.variantB.sent})</span>
            </div>
          </div>

          {/* Declare winner */}
          {abStats.sampleOk && !abStats.winner && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-[var(--foreground-faint)]">Declarar ganador:</span>
              <button
                onClick={() => onDeclareWinner("a")}
                className="flex items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1 text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
              >
                <Trophy className="h-3 w-3" /> Variante A
              </button>
              <button
                onClick={() => onDeclareWinner("b")}
                className="flex items-center gap-1 rounded-lg bg-[#7C3AED] px-3 py-1 text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
              >
                <Trophy className="h-3 w-3" /> Variante B
              </button>
            </div>
          )}
          {abStats.winner && (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.25)] px-3 py-1.5 text-xs font-bold text-[#10B981]">
              <Trophy className="h-3.5 w-3.5" />
              Ganadora: Variante {abStats.winner.toUpperCase()}
            </div>
          )}
          {!abStats.sampleOk && !abStats.winner && (
            <span className="ml-auto text-[10px] text-[var(--foreground-faint)]">Muestra insuficiente para declarar ganador</span>
          )}
        </div>
      )}

      {/* Dual canvas */}
      <div className="flex flex-1 overflow-hidden min-h-0 divide-x divide-[var(--border)]">
        <ABVariantCanvas
          label="A"
          color="#2563eb"
          initialNodes={variantA.nodes}
          initialEdges={variantA.edges}
          splitPercent={variantA.splitPercent}
          onSplitChange={onSplitAChange}
          onChange={onVariantAChange}
          onDrop={onDropToVariant}
        />
        <ABVariantCanvas
          label="B"
          color="#7c3aed"
          initialNodes={variantB.nodes}
          initialEdges={variantB.edges}
          splitPercent={variantB.splitPercent}
          onSplitChange={onSplitBChange}
          onChange={onVariantBChange}
          onDrop={onDropToVariant}
        />
      </div>
    </div>
  );
}
