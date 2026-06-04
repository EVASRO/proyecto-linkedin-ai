"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  useReactFlow, type Connection, type Node, type Edge,
} from "@xyflow/react";
import {
  ArrowLeft, BookmarkPlus, Check, CheckCircle2, Layers,
  Loader2, Rocket, Save, Sparkles, Trash2, X, XCircle,
} from "lucide-react";
import { nodeTypes } from "./CustomNodes";
import { PropertyPanel } from "./PropertyPanel";
import { Sidebar } from "./Sidebar";
import type { Campaign, FlowConfig, NodeData, Segment, Template } from "./types";
import { updateCampaignWorkflow } from "@/app/dashboard/campanas/actions";

// ── ID generator ──────────────────────────────────────────────────────────────
let _uid = 1;
const uid = () => `n${_uid++}`;

// ── Default flow: START → Enviar conexión → Esperar respuesta → Enviar mensaje ─

function buildDefaultFlow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "start_1",
      type: "start",
      position: { x: 220, y: 40 },
      data: { nodeType: "start", label: "Inicio de Secuencia" } satisfies NodeData,
    },
    {
      id: "n2",
      type: "connect",
      position: { x: 220, y: 180 },
      data: { nodeType: "connect", label: "Enviar conexión", addNote: false } satisfies NodeData,
    },
    {
      id: "n3",
      type: "wait",
      position: { x: 220, y: 320 },
      data: { nodeType: "wait", label: "Esperar respuesta", days: 3 } satisfies NodeData,
    },
    {
      id: "n4",
      type: "message",
      position: { x: 220, y: 460 },
      data: { nodeType: "message", label: "Enviar mensaje", bodyA: "" } satisfies NodeData,
    },
  ];
  const edgeStyle = { stroke: "#6366f1", strokeWidth: 2 };
  const edges: Edge[] = [
    { id: "e1-2", source: "start_1", target: "n2", animated: true, style: edgeStyle },
    { id: "e2-3", source: "n2",      target: "n3", animated: true, style: edgeStyle },
    { id: "e3-4", source: "n3",      target: "n4", animated: true, style: edgeStyle },
  ];
  _uid = 5;
  return { nodes, edges };
}

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastState = { type: "success" | "error"; msg: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      className={[
        "absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xl border transition-all",
        toast.type === "success"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800",
      ].join(" ")}
    >
      {toast.type === "success"
        ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
      {toast.msg}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",  cls: "bg-zinc-100 text-zinc-500" },
  active:    { label: "Activa",    cls: "bg-green-100 text-green-700" },
  paused:    { label: "Pausada",   cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completada",cls: "bg-blue-100 text-blue-700" },
};

// ── Templates panel ───────────────────────────────────────────────────────────

function TemplatesPanel({ onLoad, onClose }: { onLoad: (tpl: Template) => void; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <p className="text-xs font-bold text-zinc-900">Plantillas</p>
        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600">✕</button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
        {([] as Template[]).map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => { onLoad(tpl); onClose(); }}
            className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
          >
            <p className="text-xs font-semibold text-zinc-900">{tpl.name}</p>
            <p className="text-[10px] text-zinc-500 leading-snug">{tpl.description}</p>
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-500">
              {tpl.nodeCount} nodos
            </span>
          </button>
        ))}
        {/* Empty state */}
        <div className="py-8 text-center text-xs text-zinc-400">No hay plantillas disponibles</div>
      </div>
    </div>
  );
}

// ── Launch Modal ──────────────────────────────────────────────────────────────

interface LaunchModalProps {
  campaign: Campaign & { automationId: string };
  segments: Segment[];
  flowConfig: FlowConfig;
  onClose: () => void;
  onDone: (status: "active" | "draft") => void;
}

function LaunchModal({ campaign, segments, flowConfig, onClose, onDone }: LaunchModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function submit(status: "active" | "draft") {
    setLoading(true);
    setError("");
    await updateCampaignWorkflow(campaign.id, flowConfig as Record<string, unknown>);
    setLoading(false);
    onDone(status);
  }

  const nodeCount  = flowConfig.nodes.length;
  const segCount   = segments.length;
  const totalLeads = segments.reduce((s, seg) => s + (seg.metrics?.totalLeads ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-zinc-900">Finalizar campaña</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-600">Revisa el resumen antes de lanzar:</p>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100">
            {[
              ["Campaña", campaign.name],
              ["Tipo", campaign.type.replace("_", " ")],
              ["Segmentos", segCount],
              ["Leads totales", totalLeads > 0 ? totalLeads.toLocaleString("es-PE") : "Pendiente"],
              ["Nodos en el flow", nodeCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-zinc-500">{label}</span>
                <span className="text-xs font-semibold text-zinc-900 capitalize">{value}</span>
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-200">{error}</p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <button
            disabled={loading}
            onClick={() => submit("draft")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar borrador
          </button>
          <button
            disabled={loading}
            onClick={() => submit("active")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Lanzar campaña
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inner canvas (inside ReactFlowProvider) ───────────────────────────────────

interface InnerProps {
  campaign: Campaign & { automationId: string };
  segments: Segment[];
  initialFlow?: FlowConfig;
  onBack: () => void;
  onLaunched: (status: "active" | "draft") => void;
  onSave?: (flowConfig: FlowConfig) => void;
}

function FlowCanvas({ campaign, segments, initialFlow, onBack, onLaunched, onSave }: InnerProps) {
  const { screenToFlowPosition } = useReactFlow();

  const defaultFlow = buildDefaultFlow();
  const startNodes: Node[] = initialFlow?.nodes ?? defaultFlow.nodes;
  const startEdges: Edge[] = initialFlow?.edges ?? defaultFlow.edges;

  if (startNodes.length > 0) {
    const maxN = startNodes
      .map((n) => parseInt(n.id.replace(/^n/, ""), 10))
      .filter((n) => !isNaN(n))
      .reduce((a, b) => Math.max(a, b), 0);
    if (maxN >= _uid) _uid = maxN + 1;
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(startNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startEdges);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [toast, setToast]                   = useState<ToastState>(null);
  const [templatesOpen, setTemplatesOpen]   = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate]   = useState(false);
  const [launchOpen, setLaunchOpen]           = useState(false);
  const [campaignName, setCampaignName]       = useState(campaign.name);
  const [editingName, setEditingName]         = useState(false);
  const [, setCustomTemplates]                = useState<object[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
  const status       = campaign.status ?? "draft";
  const badge        = STATUS_BADGE[status] ?? STATUS_BADGE.draft;

  // ── Save to Supabase ──────────────────────────────────────────────────────

  async function persistFlow(ns: Node[], es: Edge[]) {
    setSaving(true);
    try {
      const flowConfig: FlowConfig = { nodes: ns as FlowConfig["nodes"], edges: es as FlowConfig["edges"] };
      const res = await updateCampaignWorkflow(campaign.id, flowConfig as Record<string, unknown>);
      if (res.success) {
        onSave?.(flowConfig);
        setToast({ type: "success", msg: "✓ Flujo guardado" });
      } else {
        setToast({ type: "error", msg: `✗ Error al guardar: ${res.error ?? ""}` });
      }
    } catch (err) {
      setToast({ type: "error", msg: `✗ Error al guardar: ${String(err)}` });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  function saveFlow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persistFlow(nodes, edges);
  }

  // ── Auto-save with 3s debounce on nodes/edges change ─────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistFlow(nodes, edges);
    }, 3000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) =>
        addEdge({ ...conn, animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }, eds)
      ),
    [setEdges]
  );

  function onNodeClick(_: React.MouseEvent, node: Node) { setSelectedId(node.id); }
  function onPaneClick() { setSelectedId(null); }

  function updateNode(id: string, partial: Partial<NodeData>) {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...partial } } : n));
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const type     = e.dataTransfer.getData("application/reactflow/type");
    const nodeType = e.dataTransfer.getData("application/reactflow/nodeType");
    const label    = e.dataTransfer.getData("application/reactflow/label");
    if (!type || !nodeType) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode: Node = {
      id: uid(), type, position,
      data: { nodeType: nodeType as NodeData["nodeType"], label } as NodeData,
    };
    setNodes((nds) => [...nds, newNode]);
  }

  function deleteSelectedNode() {
    if (!selectedId || selectedId === "start_1") return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  function loadTemplate(tpl: Template) {
    setNodes(tpl.flowConfig.nodes as Node[]);
    setEdges(tpl.flowConfig.edges as Edge[]);
    setSelectedId(null);
    _uid = 1;
  }

  function clearCanvas() {
    const df = buildDefaultFlow();
    setNodes(df.nodes);
    setEdges(df.edges);
    setSelectedId(null);
  }

  function saveAsTemplate() {
    if (nodes.length <= 1) return;
    setSavingTemplate(true);
    const flowConfig: FlowConfig = { nodes: nodes as FlowConfig["nodes"], edges: edges as FlowConfig["edges"] };
    const tpl = {
      id: `tpl_${Date.now()}`, name: campaignName,
      description: `Creada el ${new Date().toLocaleDateString("es")}`,
      nodeCount: nodes.length, types: [campaign.type], flowConfig, isCustom: true,
    };
    setCustomTemplates((prev) => [tpl, ...prev]);
    setSavingTemplate(false);
    setSavedAsTemplate(true);
    setTimeout(() => setSavedAsTemplate(false), 2500);
  }

  function currentFlowConfig(): FlowConfig {
    return { nodes: nodes as FlowConfig["nodes"], edges: edges as FlowConfig["edges"] };
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        {/* ── Toolbar ── */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-white px-4 py-2.5">
          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Campañas
          </button>

          <div className="h-4 w-px bg-zinc-200" />

          {/* Campaign name (editable) + status */}
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                autoFocus
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
                className="rounded-lg border border-indigo-300 px-2 py-0.5 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 w-48"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-bold text-zinc-900 hover:text-indigo-600 transition-colors"
                title="Clic para editar el nombre"
              >
                {campaignName}
              </button>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          {/* Node counter */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-500">
            <Layers className="h-3.5 w-3.5" />
            {nodes.length} nodo{nodes.length !== 1 ? "s" : ""}
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {selectedId && selectedId !== "start_1" && (
              <button
                onClick={deleteSelectedNode}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar nodo
              </button>
            )}

            {/* Templates */}
            <div className="relative">
              <button
                onClick={() => setTemplatesOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Plantillas
              </button>
              {templatesOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setTemplatesOpen(false)} />
                  <TemplatesPanel onLoad={loadTemplate} onClose={() => setTemplatesOpen(false)} />
                </>
              )}
            </div>

            {/* Save as template */}
            <button
              onClick={saveAsTemplate}
              disabled={savingTemplate}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                savedAsTemplate
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
              ].join(" ")}
            >
              {savingTemplate
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : savedAsTemplate
                ? <Check className="h-3.5 w-3.5" />
                : <BookmarkPlus className="h-3.5 w-3.5" />}
              {savedAsTemplate ? "¡Plantilla guardada!" : "Guardar plantilla"}
            </button>

            {/* Clear */}
            <button
              onClick={clearCanvas}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpiar
            </button>

            {/* Save flow */}
            <button
              onClick={saveFlow}
              disabled={saving}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                "bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-60",
              ].join(" ")}
            >
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />}
              {saving ? "Guardando…" : "Guardar flujo"}
            </button>

            {/* Launch */}
            <button
              onClick={() => setLaunchOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 transition-all"
            >
              <Rocket className="h-3.5 w-3.5" />
              Lanzar campaña
            </button>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div className="flex flex-1 min-h-0 relative">
          <div className="flex-1 min-h-0" style={{ background: "#0f0f0f" }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              deleteKeyCode="Delete"
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ animated: true, style: { stroke: "#818cf8", strokeWidth: 2 } }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={28}
                size={1}
                color="#2a2a2a"
              />
              <Controls
                showInteractive={false}
                style={{ bottom: 16, right: 16, left: "auto", top: "auto" }}
              />
              <MiniMap
                nodeColor={(n) =>
                  n.type === "start"     ? "#22c55e" :
                  n.type === "autopilot" ? "#9333ea" :
                  n.type === "end"       ? "#ef4444" :
                  n.type === "wait"      ? "#f59e0b" :
                  n.type === "condition" ? "#f97316" : "#6366f1"
                }
                style={{
                  bottom: 16, left: 16, top: "auto", right: "auto",
                  borderRadius: 8, border: "1px solid #2a2a2a",
                  background: "#1a1a1a",
                }}
                maskColor="rgba(0,0,0,0.5)"
              />
            </ReactFlow>

            <Toast toast={toast} onDismiss={() => setToast(null)} />
          </div>

          {selectedNode && (
            <PropertyPanel
              node={selectedNode as Node<NodeData>}
              onUpdate={updateNode}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      {launchOpen && (
        <LaunchModal
          campaign={campaign}
          segments={segments}
          flowConfig={currentFlowConfig()}
          onClose={() => setLaunchOpen(false)}
          onDone={(status) => {
            setLaunchOpen(false);
            onLaunched(status);
          }}
        />
      )}
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

interface FlowBuilderProps {
  campaign: Campaign & { automationId: string };
  segments: Segment[];
  initialFlow?: FlowConfig;
  onBack: () => void;
  onLaunched: (status: "active" | "draft") => void;
  onSave?: (flowConfig: FlowConfig) => void;
}

export function FlowBuilder({ campaign, segments, initialFlow, onBack, onLaunched, onSave }: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas
        campaign={campaign}
        segments={segments}
        initialFlow={initialFlow}
        onBack={onBack}
        onLaunched={onLaunched}
        onSave={onSave}
      />
    </ReactFlowProvider>
  );
}
