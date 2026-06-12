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

  const bgColor = label === "A" ? "#eff6ff" : "#f5f3ff";

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Variant header */}
      <div className={[
        "flex flex-shrink-0 items-center gap-3 border-b px-4 py-2",
        label === "A" ? "border-blue-200 bg-blue-50" : "border-violet-200 bg-violet-50",
      ].join(" ")}>
        <span className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white",
          label === "A" ? "bg-blue-600" : "bg-violet-600",
        ].join(" ")}>
          {label}
        </span>
        <span className={`text-xs font-bold ${label === "A" ? "text-blue-800" : "text-violet-800"}`}>
          Variante {label}
        </span>

        {/* Split percent */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500">Distribución:</span>
          <input
            type="number"
            min={1}
            max={99}
            value={splitPercent}
            onChange={(e) => onSplitChange(Math.min(99, Math.max(1, parseInt(e.target.value) || 50)))}
            className={[
              "w-14 rounded border px-2 py-0.5 text-center text-xs font-bold focus:outline-none focus:ring-1",
              label === "A"
                ? "border-blue-300 text-blue-700 focus:ring-blue-400"
                : "border-violet-300 text-violet-700 focus:ring-violet-400",
            ].join(" ")}
          />
          <span className="text-[10px] text-zinc-500">%</span>
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
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={label === "A" ? "#93c5fd" : "#c4b5fd"} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={() => color}
            style={{ bottom: 8, right: 8, borderRadius: 6 }}
            maskColor="rgba(0,0,0,0.1)"
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
        <div className="flex flex-shrink-0 items-center gap-6 border-b border-zinc-200 bg-white px-6 py-2.5">
          {/* Variant A stats */}
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-black text-white">A</span>
            <div className="text-xs">
              <span className="font-bold text-blue-700">{abStats.variantA.rate}%</span>
              <span className="text-zinc-400 ml-1">conversión ({abStats.variantA.accepted}/{abStats.variantA.sent})</span>
            </div>
          </div>

          <div className="h-3 w-px bg-zinc-200" />

          {/* Variant B stats */}
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[9px] font-black text-white">B</span>
            <div className="text-xs">
              <span className="font-bold text-violet-700">{abStats.variantB.rate}%</span>
              <span className="text-zinc-400 ml-1">conversión ({abStats.variantB.accepted}/{abStats.variantB.sent})</span>
            </div>
          </div>

          {/* Declare winner */}
          {abStats.sampleOk && !abStats.winner && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-zinc-500">Declarar ganador:</span>
              <button
                onClick={() => onDeclareWinner("a")}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
              >
                <Trophy className="h-3 w-3" /> Variante A
              </button>
              <button
                onClick={() => onDeclareWinner("b")}
                className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
              >
                <Trophy className="h-3 w-3" /> Variante B
              </button>
            </div>
          )}
          {abStats.winner && (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-bold text-green-700">
              <Trophy className="h-3.5 w-3.5" />
              Ganadora: Variante {abStats.winner.toUpperCase()}
            </div>
          )}
          {!abStats.sampleOk && !abStats.winner && (
            <span className="ml-auto text-[10px] text-zinc-400">Muestra insuficiente para declarar ganador</span>
          )}
        </div>
      )}

      {/* Dual canvas */}
      <div className="flex flex-1 overflow-hidden min-h-0 divide-x divide-zinc-300">
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
