"use client";

import "@xyflow/react/dist/style.css";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  useReactFlow, type Connection, type Node, type Edge,
} from "@xyflow/react";
import { Loader2, Rocket, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nodeTypes } from "./CustomNodes";
import { NodePalette } from "./NodePalette";
import { PropertyPanel } from "./PropertyPanel";
import { ABTestPanel, type ABStats } from "./ABTestPanel";
import {
  FlowToolbar, Toast, PreviewModal, ValidationModal,
  validateFlow, type ToastState, type ValidationResult,
} from "./FlowToolbar";
import type {
  Campaign, FlowConfig, FlowNode, FlowEdge,
  NodeData, Segment, Template, WorkflowJSON, ABVariant,
} from "./types";
import { updateCampaignWorkflow } from "@/app/dashboard/campanas/actions";

// -- Condition edge normalizer -------------------------------------------------

function normalizeEdge(edge: FlowEdge, allNodes: FlowNode[]): FlowEdge {
  const sourceNode = allNodes.find((n) => n.id === edge.source);
  if (sourceNode?.data?.nodeType !== "condition") return edge;

  if (edge.sourceHandle === "yes" && !edge.label) {
    return {
      ...edge,
      label: "✓ Sí",
      labelStyle: { fill: "#16a34a", fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: "#dcfce7", fillOpacity: 0.9 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: "#16a34a", strokeWidth: 2 },
    };
  }
  if (edge.sourceHandle === "no" && !edge.label) {
    return {
      ...edge,
      label: "✗ No",
      labelStyle: { fill: "#dc2626", fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: "#fee2e2", fillOpacity: 0.9 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: "#dc2626", strokeWidth: 2 },
    };
  }
  return edge;
}

// -- UID factory ---------------------------------------------------------------

function makeUidFactory(existingNodes: FlowNode[]) {
  const max = existingNodes
    .map((n) => parseInt(n.id.replace(/^[a-z]+_?/i, ""), 10))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 4);
  let counter = max + 1;
  return () => `n${counter++}`;
}

// -- Default flow --------------------------------------------------------------

function buildDefaultFlow(): { nodes: Node[]; edges: Edge[] } {
  const edgeSt = { stroke: "#6366f1", strokeWidth: 2 };
  return {
    nodes: [
      { id: "start_1", type: "start",   position: { x: 220, y: 40  }, data: { nodeType: "start",   label: "Inicio de Secuencia" } as NodeData },
      { id: "n2",      type: "connect", position: { x: 220, y: 180 }, data: { nodeType: "connect", label: "Enviar Conexión", addNote: false } as NodeData },
      { id: "n3",      type: "delay",   position: { x: 220, y: 320 }, data: { nodeType: "delay",   label: "Esperar respuesta", days: 3 } as NodeData },
      { id: "n4",      type: "message", position: { x: 220, y: 460 }, data: { nodeType: "message", label: "Enviar Mensaje", bodyA: "" } as NodeData },
    ],
    edges: [
      { id: "e1-2", source: "start_1", target: "n2", animated: true, style: edgeSt },
      { id: "e2-3", source: "n2",      target: "n3", animated: true, style: edgeSt },
      { id: "e3-4", source: "n3",      target: "n4", animated: true, style: edgeSt },
    ],
  };
}

function emptyVariant(splitPercent = 50): ABVariant {
  const { nodes, edges } = buildDefaultFlow();
  return {
    nodes: nodes as FlowNode[],
    edges: edges as FlowEdge[],
    splitPercent,
  };
}

// -- Build WorkflowJSON for persistence ---------------------------------------

function buildWorkflowJSON(
  nodes: FlowNode[],
  edges: FlowEdge[],
  abEnabled: boolean,
  variantA: ABVariant,
  variantB: ABVariant,
): WorkflowJSON {
  return {
    version:    "2.0",
    nodes,
    edges,
    ab_enabled: abEnabled,
    variant_a:  variantA,
    variant_b:  variantB,
    updated_at: new Date().toISOString(),
  };
}

// -- Launch modal --------------------------------------------------------------

interface LaunchModalProps {
  campaign: Campaign & { automationId: string };
  segments: Segment[];
  onClose: () => void;
  onConfirm: (status: "active" | "draft") => Promise<void>;
}

function LaunchModal({ campaign, segments, onClose, onConfirm }: LaunchModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function submit(status: "active" | "draft") {
    setLoading(true);
    setError("");
    try {
      await onConfirm(status);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  const totalLeads = segments.reduce((s, seg) => s + (seg.metrics?.totalLeads ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[var(--foreground)]">Finalizar campaña</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--background)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[var(--foreground-muted)]">Revisa el resumen antes de lanzar:</p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] divide-y divide-[var(--border)]">
            {([
              ["Campaña",      campaign.name],
              ["Tipo",         campaign.type.replace("_", " ")],
              ["Segmentos",    segments.length],
              ["Leads totales", totalLeads > 0 ? totalLeads.toLocaleString("es-PE") : "Pendiente"],
            ] as [string, string | number][]).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[var(--foreground-faint)]">{label}</span>
                <span className="text-xs font-semibold text-[var(--foreground)] capitalize">{value}</span>
              </div>
            ))}
          </div>
          {error && (
            <p className="rounded-lg bg-[rgba(239,68,68,0.12)] px-3 py-2 text-xs text-[#EF4444] border border-[rgba(239,68,68,0.25)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--background)] px-6 py-4">
          <button
            disabled={loading}
            onClick={() => submit("draft")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground-muted)] hover:bg-[var(--background)] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar borrador
          </button>
          <button
            disabled={loading}
            onClick={() => submit("active")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Lanzar campaña
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Empty canvas hint ---------------------------------------------------------

function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm px-8 py-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-[var(--foreground-muted)]">Arrastra un nodo para empezar tu secuencia</p>
        <p className="mt-1 text-xs text-[var(--foreground-faint)]">O usa los nodos del panel izquierdo</p>
      </div>
    </div>
  );
}

// -- Inner canvas --------------------------------------------------------------

interface FlowCanvasProps {
  campaign: Campaign & { automationId: string };
  segments: Segment[];
  initialFlow?: FlowConfig;
  abStats?: ABStats;
  onBack: () => void;
  onLaunched: (status: "active" | "draft", currentFlow: FlowConfig) => void;
  onSave?: (flowConfig: FlowConfig) => void;
}

function FlowCanvas({ campaign, segments, initialFlow, abStats, onBack, onLaunched, onSave }: FlowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  // -- Init from prop once -----------------------------------------------------
  const { startNodes, startEdges, uid, initVariantA, initVariantB, initAB } = useMemo(() => {
    const wf = campaign.workflow_json as Partial<WorkflowJSON> | undefined;
    const df  = buildDefaultFlow();

    const sNodes: FlowNode[] = (initialFlow?.nodes ?? wf?.nodes ?? df.nodes) as FlowNode[];
    const rawEdges = (initialFlow?.edges ?? wf?.edges ?? df.edges) as FlowEdge[];
    const sEdges: FlowEdge[] = rawEdges.map((e) => normalizeEdge(e, sNodes));

    const varA: ABVariant = (wf?.variant_a) ?? emptyVariant(50);
    const varB: ABVariant = (wf?.variant_b) ?? emptyVariant(50);
    const abOn: boolean   = wf?.ab_enabled ?? false;

    return {
      startNodes:    sNodes,
      startEdges:    sEdges,
      uid:           makeUidFactory(sNodes),
      initVariantA:  varA,
      initVariantB:  varB,
      initAB:        abOn,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- State --------------------------------------------------------------------
  const [nodes, setNodes, onNodesChange] = useNodesState(startNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startEdges as Edge[]);

  const [abEnabled,  setAbEnabled]  = useState(initAB);
  const [variantA,   setVariantA]   = useState<ABVariant>(initVariantA);
  const [variantB,   setVariantB]   = useState<ABVariant>(initVariantB);

  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);
  const [toast,        setToast]        = useState<ToastState>(null);
  const [launchOpen,   setLaunchOpen]   = useState(false);
  const [previewOpen,  setPreviewOpen]  = useState(false);
  const [validResult,  setValidResult]  = useState<ValidationResult | null>(null);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef     = useRef(false);

  const selectedNode = selectedId ? (nodes as FlowNode[]).find((n) => n.id === selectedId) ?? null : null;

  // -- Mark dirty on any node/edge change ---------------------------------------
  useEffect(() => {
    dirtyRef.current = true;
    setDirty(true);
  }, [nodes, edges]);

  // -- Auto-save every 30 seconds if dirty --------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current) {
        doPersist(nodes as FlowNode[], edges as FlowEdge[], false);
      }
    }, 30_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, abEnabled, variantA, variantB]);

  // -- Dismiss toast automatically -----------------------------------------------
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // -- Persistence ---------------------------------------------------------------

  async function doPersist(ns: FlowNode[], es: FlowEdge[], showToast: boolean) {
    setSaving(true);
    try {
      const wf = buildWorkflowJSON(ns, es, abEnabled, variantA, variantB);
      const res = await updateCampaignWorkflow(campaign.id, wf as Record<string, unknown>);
      if (res.success) {
        dirtyRef.current = false;
        setDirty(false);
        const fc: FlowConfig = { nodes: ns, edges: es };
        onSave?.(fc);
        if (showToast) setToast({ type: "success", msg: "Flujo guardado correctamente" });
      } else {
        if (showToast) setToast({ type: "error", msg: `Error al guardar: ${res.error ?? ""}` });
      }
    } catch (err) {
      if (showToast) setToast({ type: "error", msg: `Error: ${String(err)}` });
    } finally {
      setSaving(false);
    }
  }

  function saveFlow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doPersist(nodes as FlowNode[], edges as FlowEdge[], true);
  }

  // -- Handlers ------------------------------------------------------------------

  const onConnect = useCallback(
    (conn: Connection) => {
      const sourceNode = (nodes as FlowNode[]).find((n) => n.id === conn.source);
      const isCondition = sourceNode?.data?.nodeType === "condition";

      let extraProps: Partial<FlowEdge> = {};
      if (isCondition && conn.sourceHandle === "yes") {
        extraProps = {
          label: "✓ Sí",
          labelStyle: { fill: "#16a34a", fontWeight: 700, fontSize: 11 },
          labelBgStyle: { fill: "#dcfce7", fillOpacity: 0.9 },
          labelBgPadding: [4, 6],
          labelBgBorderRadius: 4,
          style: { stroke: "#16a34a", strokeWidth: 2 },
          animated: true,
        };
      } else if (isCondition && conn.sourceHandle === "no") {
        extraProps = {
          label: "✗ No",
          labelStyle: { fill: "#dc2626", fontWeight: 700, fontSize: 11 },
          labelBgStyle: { fill: "#fee2e2", fillOpacity: 0.9 },
          labelBgPadding: [4, 6],
          labelBgBorderRadius: 4,
          style: { stroke: "#dc2626", strokeWidth: 2 },
          animated: false,
        };
      } else {
        extraProps = { animated: true, style: { stroke: "#2563EB", strokeWidth: 2 } };
      }

      setEdges((eds) => addEdge({ ...conn, ...extraProps }, eds));
    },
    [setEdges, nodes]
  );

  function onNodeClick(_: React.MouseEvent, node: Node) { setSelectedId(node.id); }
  function onPaneClick() { setSelectedId(null); }

  function updateNode(id: string, partial: Partial<NodeData>) {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...partial } } : n)
    );
  }

  function deleteNode(id: string) {
    if (id === "start_1") return;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const rfType   = e.dataTransfer.getData("application/reactflow/type");
    const nodeType = e.dataTransfer.getData("application/reactflow/nodeType") as NodeData["nodeType"];
    const label    = e.dataTransfer.getData("application/reactflow/label");
    if (!rfType || !nodeType) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode: Node = {
      id:       uid(),
      type:     rfType,
      position,
      data:     buildDefaultData(nodeType, label),
    };
    setNodes((nds) => [...nds, newNode]);
  }

  // -- A/B drop handler ---------------------------------------------------------
  function onDropToVariant(e: React.DragEvent<HTMLDivElement>, variant: "A" | "B") {
    e.preventDefault();
    const rfType   = e.dataTransfer.getData("application/reactflow/type");
    const nodeType = e.dataTransfer.getData("application/reactflow/nodeType") as NodeData["nodeType"];
    const label    = e.dataTransfer.getData("application/reactflow/label");
    if (!rfType || !nodeType) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode: FlowNode = {
      id: uid(), type: rfType, position,
      data: { ...buildDefaultData(nodeType, label), abVariant: variant },
    };

    if (variant === "A") {
      setVariantA((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    } else {
      setVariantB((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    }
  }

  // -- Validate ------------------------------------------------------------------
  function handleValidate() {
    const result = validateFlow(nodes as FlowNode[], edges as FlowEdge[]);
    setValidResult(result);
  }

  // -- Toggle A/B ----------------------------------------------------------------
  function toggleAB() {
    setAbEnabled((prev) => !prev);
    setToast({ type: "info", msg: abEnabled ? "A/B Test desactivado" : "A/B Test activado — configura las variantes en el lienzo dividido" });
  }

  // -- Launch confirm ------------------------------------------------------------
  async function handleLaunchConfirm(status: "active" | "draft") {
    await doPersist(nodes as FlowNode[], edges as FlowEdge[], false);
    setLaunchOpen(false);
    onLaunched(status, { nodes: nodes as FlowNode[], edges: edges as FlowEdge[] });
  }

  // -- Render --------------------------------------------------------------------

  const isEmpty = nodes.filter((n) => n.type !== "start").length === 0;

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 flex-col">
      <FlowToolbar
        campaignName={campaign.name}
        campaignStatus={campaign.status}
        nodeCount={nodes.length}
        saving={saving}
        dirty={dirty}
        abEnabled={abEnabled}
        onBack={onBack}
        onSave={saveFlow}
        onValidate={handleValidate}
        onToggleAB={toggleAB}
        onPreview={() => setPreviewOpen(true)}
        onLaunch={() => setLaunchOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <NodePalette />

        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {abEnabled ? (
            <ABTestPanel
              variantA={variantA}
              variantB={variantB}
              abStats={abStats}
              onVariantAChange={(ns, es) => setVariantA((p) => ({ ...p, nodes: ns, edges: es }))}
              onVariantBChange={(ns, es) => setVariantB((p) => ({ ...p, nodes: ns, edges: es }))}
              onSplitAChange={(pct) => setVariantA((p) => ({ ...p, splitPercent: pct }))}
              onSplitBChange={(pct) => setVariantB((p) => ({ ...p, splitPercent: pct }))}
              onDropToVariant={onDropToVariant}
              onDeclareWinner={(winner) => {
                setToast({ type: "success", msg: `Variante ${winner.toUpperCase()} declarada ganadora` });
              }}
            />
          ) : (
            <div className="flex flex-1 min-h-0 relative">
              {/* Main canvas */}
              <div className="flex-1 min-h-0 relative" style={{ background: "var(--background)" }}>
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
                  defaultEdgeOptions={{
                    animated: true,
                    style: { stroke: "#2563EB", strokeWidth: 2 },
                  }}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1.5}
                    color="var(--border)"
                  />
                  <Controls
                    showInteractive={false}
                    style={{
                      bottom: 16, right: 16, left: "auto", top: "auto",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  />
                  <MiniMap
                    nodeColor={(n) => {
                      const t = n.type ?? "";
                      if (t === "start")                    return "#10B981";
                      if (t === "end")                      return "#10B981";
                      if (t === "delay" || t === "wait")    return "#F59E0B";
                      if (t === "condition")                return "#06B6D4";
                      if (t === "email" || t === "email_node") return "#3B82F6";
                      if (t === "message")                  return "#10B981";
                      if (t === "autopilot")                return "#8B5CF6";
                      return "#2563EB";
                    }}
                    style={{
                      bottom: 16, left: 16, top: "auto", right: "auto",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                    maskColor="rgba(0,0,0,0.25)"
                  />
                </ReactFlow>

                {isEmpty && <EmptyHint />}

                {/* Toast overlay */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="pointer-events-auto">
                    <Toast toast={toast} onDismiss={() => setToast(null)} />
                  </div>
                </div>
              </div>

              {/* Property panel */}
              {selectedNode && (
                <PropertyPanel
                  node={selectedNode}
                  onUpdate={updateNode}
                  onDelete={deleteNode}
                  onClose={() => setSelectedId(null)}
                />
              )}
            </div>
          )}

          {/* Toast for A/B mode */}
          {abEnabled && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0">
              <div className="pointer-events-auto">
                <Toast toast={toast} onDismiss={() => setToast(null)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {launchOpen && (
        <LaunchModal
          campaign={campaign}
          segments={segments}
          onClose={() => setLaunchOpen(false)}
          onConfirm={handleLaunchConfirm}
        />
      )}

      {previewOpen && (
        <PreviewModal
          nodes={nodes as FlowNode[]}
          edges={edges as FlowEdge[]}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {validResult && (
        <ValidationModal
          result={validResult}
          onClose={() => setValidResult(null)}
        />
      )}
    </div>
  );
}

// -- Default node data factory -------------------------------------------------

function buildDefaultData(nodeType: NodeData["nodeType"], label: string): NodeData {
  const base: NodeData = { nodeType, label };
  switch (nodeType) {
    case "connect":   return { ...base, addNote: false };
    case "delay":
    case "wait":      return { ...base, days: 3, delayUnit: "dias" };
    case "condition": return { ...base };
    case "email":
    case "email_node": return { ...base, subject: "" };
    default:          return base;
  }
}

// -- Public export -------------------------------------------------------------

export interface FlowBuilderProps {
  campaign: Campaign & { automationId: string };
  segments: Segment[];
  initialFlow?: FlowConfig;
  templates?: Template[];
  abStats?: ABStats;
  onBack: () => void;
  onLaunched: (status: "active" | "draft", currentFlow: FlowConfig) => void;
  onSave?: (flowConfig: FlowConfig) => void;
}

export function FlowBuilder({
  campaign, segments, initialFlow, abStats,
  onBack, onLaunched, onSave,
}: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas
        campaign={campaign}
        segments={segments}
        initialFlow={initialFlow}
        abStats={abStats}
        onBack={onBack}
        onLaunched={onLaunched}
        onSave={onSave}
      />
    </ReactFlowProvider>
  );
}
