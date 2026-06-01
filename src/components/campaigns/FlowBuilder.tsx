"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  useReactFlow, type Connection, type Node, type Edge,
} from "@xyflow/react";
import {
  ArrowLeft, BookmarkPlus, Check, Loader2, Rocket, Save,
  Sparkles, Trash2, X,
} from "lucide-react";
import { nodeTypes } from "./CustomNodes";
import { PropertyPanel } from "./PropertyPanel";
import { Sidebar } from "./Sidebar";
import type { Campaign, FlowConfig, NodeData, Segment, Template } from "./types";
import { updateCampaignWorkflow, updateCampaignStatus } from "@/app/dashboard/campanas/actions";


// ── ID generator ──────────────────────────────────────────────────────────────
let _uid = 1;
const uid = () => `n${_uid++}`;

const INITIAL_NODES: Node[] = [
  {
    id: "start_1",
    type: "start",
    position: { x: 240, y: 60 },
    data: { nodeType: "start", label: "Inicio de Secuencia" } satisfies NodeData,
  },
];

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
    await updateCampaignStatus(campaign.id, status);
    setLoading(false);
    onDone(status);
  }

  const nodeCount = flowConfig.nodes.length;
  const segCount  = segments.length;
  const totalLeads = segments.reduce((s, seg) => s + (seg.metrics?.totalLeads ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-zinc-900">Finalizar campaña</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Resumen */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-600">
            Revisa el resumen antes de lanzar:
          </p>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-zinc-500">Campaña</span>
              <span className="text-xs font-semibold text-zinc-900">{campaign.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-zinc-500">Tipo</span>
              <span className="text-xs font-semibold text-zinc-900 capitalize">
                {campaign.type.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-zinc-500">Segmentos</span>
              <span className="text-xs font-semibold text-zinc-900">{segCount}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-zinc-500">Leads totales</span>
              <span className="text-xs font-semibold text-zinc-900">
                {totalLeads > 0 ? totalLeads.toLocaleString("es-PE") : "Pendiente de extracción"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-zinc-500">Nodos en el flow</span>
              <span className="text-xs font-semibold text-zinc-900">{nodeCount}</span>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-200">
              {error}
            </p>
          )}
        </div>

        {/* Acciones */}
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

  const startNodes: Node[] = initialFlow?.nodes ?? INITIAL_NODES;
  const startEdges: Edge[] = initialFlow?.edges ?? [];

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
  const [saved, setSaved]                   = useState(false);
  const [templatesOpen, setTemplatesOpen]   = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate]   = useState(false);
  const [launchOpen, setLaunchOpen]           = useState(false);
  // Custom templates en memoria (no persisten entre sesiones — OK por ahora)
  const [, setCustomTemplates] = useState<object[]>([]);

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;

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
    setNodes(INITIAL_NODES);
    setEdges([]);
    setSelectedId(null);
    _uid = 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function currentFlowConfig(): FlowConfig { return { nodes: nodes as any, edges: edges as any }; }

  function saveFlow() {
    setSaving(true);
    const flowConfig = currentFlowConfig();
    onSave?.(flowConfig);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function saveAsTemplate() {
    if (nodes.length <= 1) return;
    setSavingTemplate(true);
    const flowConfig = currentFlowConfig();
    const tpl = {
      id: `tpl_${Date.now()}`, name: campaign.name,
      description: `Creada el ${new Date().toLocaleDateString("es")}`,
      nodeCount: nodes.length, types: [campaign.type], flowConfig, isCustom: true,
    };
    setCustomTemplates((prev) => [tpl, ...prev]);
    setSavingTemplate(false);
    setSavedAsTemplate(true);
    setTimeout(() => setSavedAsTemplate(false), 2500);
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        {/* Toolbar */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-2.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Campañas
          </button>

          <div className="h-4 w-px bg-zinc-200" />

          <div>
            <p className="text-sm font-bold text-zinc-900 leading-tight">{campaign.name}</p>
            <p className="text-[10px] text-zinc-400 capitalize">{campaign.type.replace("_", " ")}</p>
          </div>

          <div className="ml-auto flex items-center gap-2 relative">
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
              {savedAsTemplate ? "¡Plantilla guardada!" : "Guardar como plantilla"}
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
                saved
                  ? "bg-green-500 text-white shadow-md shadow-green-200"
                  : "bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-60",
              ].join(" ")}
            >
              {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Guardando…" : saved ? "¡Guardado!" : "Guardar flujo"}
            </button>

            {/* Launch */}
            <button
              onClick={() => setLaunchOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 transition-all"
            >
              <Rocket className="h-3.5 w-3.5" />
              Finalizar
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-h-0">
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
              defaultEdgeOptions={{ animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d4d4d8" />
              <Controls showInteractive={false} style={{ bottom: 16, right: 16, left: "auto", top: "auto" }} />
              <MiniMap
                nodeColor={(n) => n.type === "start" ? "#22c55e" : n.type === "autopilot" ? "#9333ea" : "#6366f1"}
                style={{ bottom: 16, left: 16, top: "auto", right: "auto", borderRadius: 8, border: "1px solid #e4e4e7" }}
                maskColor="rgba(244,244,245,0.7)"
              />
            </ReactFlow>
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

      {/* Launch modal */}
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
