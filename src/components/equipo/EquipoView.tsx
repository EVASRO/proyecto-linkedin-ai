"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Check, CheckCircle2,
  Crown, Mail, MoreHorizontal,
  Shield, Target, UserCheck, UserMinus, UserPlus,
  Users, X, Zap,
} from "lucide-react";
import {
  inviteMember, revokeInvitation, removeMember, updateMemberRole,
} from "@/app/dashboard/equipo/actions";
import type { TeamMemberRow, InvitationRow } from "@/app/dashboard/equipo/actions";

// -- Types ---------------------------------------------------------------------

type MemberRole = "admin" | "vendedor" | "observador";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: "active" | "invited";
  avatarGrad: string;
  online: boolean;
  metrics: { leadsAssigned: number; conversations: number; meetings: number; responseRate: number };
  joinedAt: string;
  lastActiveAt: string;
}

// -- Helpers -------------------------------------------------------------------

const AVATAR_GRADS = [
  "from-indigo-500 to-purple-600", "from-pink-500 to-rose-500",
  "from-emerald-500 to-teal-500",  "from-amber-500 to-orange-500",
  "from-sky-500 to-blue-600",      "from-violet-500 to-purple-600",
];

function gradForIndex(i: number) { return AVATAR_GRADS[i % AVATAR_GRADS.length]; }

function mapMember(m: TeamMemberRow, i: number): TeamMember {
  return {
    id:            m.id,
    name:          m.full_name ?? m.email ?? "Usuario",
    email:         m.email    ?? "",
    role:          (m.role as MemberRole) ?? "vendedor",
    status:        "active",
    avatarGrad:    gradForIndex(m.avatar_gradient ?? i),
    online:        false,
    metrics:       m.metrics ?? { leadsAssigned: 0, conversations: 0, meetings: 0, responseRate: 0 },
    joinedAt:      "—",
    lastActiveAt:  "—",
  };
}

function mapInvitation(inv: InvitationRow): TeamMember {
  const namePart = inv.email.split("@")[0];
  return {
    id:           inv.id,
    name:         namePart.charAt(0).toUpperCase() + namePart.slice(1),
    email:        inv.email,
    role:         (inv.role as MemberRole) ?? "vendedor",
    status:       "invited",
    avatarGrad:   AVATAR_GRADS[3],
    online:       false,
    metrics:      { leadsAssigned: 0, conversations: 0, meetings: 0, responseRate: 0 },
    joinedAt:     "—",
    lastActiveAt: "Invitación pendiente",
  };
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const ROLE_META: Record<MemberRole, { label: string; color: string; bg: string; icon: React.ElementType; desc: string }> = {
  admin:      { label: "Admin",      color: "text-indigo-700", bg: "bg-indigo-100", icon: Crown,  desc: "Acceso total: configuración, facturación, equipo" },
  vendedor:   { label: "Vendedor",   color: "text-green-700",  bg: "bg-green-100",  icon: Target, desc: "Gestiona leads y conversaciones asignadas" },
  observador: { label: "Observador", color: "text-zinc-600",   bg: "bg-zinc-100",   icon: Shield, desc: "Solo lectura: ve métricas y campañas" },
};

const PLAN_LIMITS = { growth: 1, pro: 3, enterprise: 999 };
const CURRENT_PLAN: keyof typeof PLAN_LIMITS = "pro";

function MetricPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-zinc-50 px-3 py-2">
      <span className={`text-base font-black tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-zinc-400">{label}</span>
    </div>
  );
}

// -- Invite Modal --------------------------------------------------------------

function InviteModal({ onClose, onInvite }: {
  onClose: () => void;
  onInvite: (email: string, role: MemberRole) => void;
}) {
  const [email, setEmail] = useState("");
  const [role,  setRole]  = useState<MemberRole>("vendedor");
  const [sent,  setSent]  = useState(false);
  const [err,   setErr]   = useState("");

  function handleSend() {
    if (!email.trim() || !email.includes("@")) return;
    onInvite(email.trim(), role);
    setSent(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Invitar miembro</h2>
            <p className="text-[11px] text-zinc-400">El miembro recibirá un email con el enlace de acceso</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center py-10 px-6">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-base font-bold text-zinc-900">Invitación enviada</p>
            <p className="mt-1 text-sm text-zinc-400 text-center">Se envió un email a <strong>{email}</strong></p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">Email del miembro</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="asesor@empresa.com" autoFocus
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-zinc-700">Rol</label>
              <div className="space-y-2">
                {(["admin", "vendedor", "observador"] as MemberRole[]).map((r) => {
                  const meta = ROLE_META[r];
                  const Icon = meta.icon;
                  return (
                    <button key={r} onClick={() => setRole(r)}
                      className={["flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                        role === r ? "border-indigo-400 bg-indigo-50" : "border-zinc-200 hover:border-zinc-300",
                      ].join(" ")}>
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-800">{meta.label}</p>
                        <p className="text-[11px] text-zinc-400">{meta.desc}</p>
                      </div>
                      {role === r && (
                        <div className="h-4 w-4 rounded-full bg-indigo-600 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button onClick={handleSend} disabled={!email.trim() || !email.includes("@")}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              <UserPlus className="mr-2 inline h-4 w-4" />
              Enviar invitación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Member Row ----------------------------------------------------------------

function MemberRow({ member, onRoleChange, onRemove, isCurrentUser }: {
  member: TeamMember;
  onRoleChange: (id: string, role: MemberRole) => void;
  onRemove: (id: string) => void;
  isCurrentUser: boolean;
}) {
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMeta = ROLE_META[member.role];
  const RoleIcon = roleMeta.icon;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-start">
      <div className="relative flex-shrink-0">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${member.avatarGrad} text-sm font-black text-white shadow-md`}>
          {initials(member.name)}
        </div>
        <div className={["absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
          member.online ? "bg-green-500" : "bg-zinc-300",
        ].join(" ")} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-zinc-900">{member.name}</p>
          {isCurrentUser && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">Tú</span>}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${roleMeta.bg} ${roleMeta.color}`}>
            <RoleIcon className="h-3 w-3" />
            {roleMeta.label}
          </span>
          {member.status === "invited" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Invitación pendiente</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">{member.email}</p>
        <p className="mt-0.5 text-[11px] text-zinc-300">
          {member.status === "invited" ? "Sin unirse aún" : `Último acceso: ${member.lastActiveAt}`}
        </p>
        {member.status === "active" && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            <MetricPill label="Leads"          value={member.metrics.leadsAssigned}  color="text-blue-600"   />
            <MetricPill label="Conversaciones" value={member.metrics.conversations}  color="text-indigo-600" />
            <MetricPill label="Reuniones"      value={member.metrics.meetings}       color="text-green-600"  />
            <MetricPill label="Resp. %"        value={`${member.metrics.responseRate}%`} color="text-amber-600" />
          </div>
        )}
      </div>

      {!isCurrentUser && (
        <div className="relative flex-shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                <button onClick={() => { setMenuOpen(false); setRoleMenuOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50">
                  <UserCheck className="h-3.5 w-3.5 text-zinc-400" />
                  Cambiar rol
                </button>
                {member.status === "invited" && (
                  <button className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50">
                    <Mail className="h-3.5 w-3.5 text-zinc-400" />
                    Reenviar invitación
                  </button>
                )}
                <div className="my-1 h-px bg-zinc-100" />
                <button onClick={() => { onRemove(member.id); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50">
                  <UserMinus className="h-3.5 w-3.5" />
                  {member.status === "invited" ? "Cancelar invitación" : "Eliminar miembro"}
                </button>
              </div>
            </>
          )}
          {roleMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cambiar rol</p>
                {(["admin", "vendedor", "observador"] as MemberRole[]).map((r) => {
                  const m = ROLE_META[r];
                  return (
                    <button key={r} onClick={() => { onRoleChange(member.id, r); setRoleMenuOpen(false); }}
                      className={["flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors",
                        member.role === r ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}>
                      {member.role === r && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                      <span className={member.role === r ? "" : "ml-5"}>{m.label}</span>
                      <span className="ml-auto text-[10px] text-zinc-400">{m.desc.slice(0, 22)}…</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// -- Props ---------------------------------------------------------------------

interface EquipoViewProps {
  initialMembers:     TeamMemberRow[];
  initialInvitations: InvitationRow[];
}

// -- Main View -----------------------------------------------------------------

export function EquipoView({ initialMembers, initialInvitations }: EquipoViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [members, setMembers] = useState<TeamMember[]>([
    ...initialMembers.map((m, i) => mapMember(m, i)),
    ...initialInvitations.map(mapInvitation),
  ]);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [filterRole,  setFilterRole]  = useState<MemberRole | "all">("all");
  const [error,       setError]       = useState("");

  const activeCount  = members.filter((m) => m.status === "active").length;
  const invitedCount = members.filter((m) => m.status === "invited").length;
  const seatLimit    = PLAN_LIMITS[CURRENT_PLAN];
  const canInvite    = activeCount < seatLimit;

  const filtered = filterRole === "all" ? members : members.filter((m) => m.role === filterRole);

  const teamMetrics = members
    .filter((m) => m.status === "active")
    .reduce((acc, m) => ({
      leads:    acc.leads    + m.metrics.leadsAssigned,
      convs:    acc.convs    + m.metrics.conversations,
      meetings: acc.meetings + m.metrics.meetings,
    }), { leads: 0, convs: 0, meetings: 0 });

  function handleInvite(email: string, role: MemberRole) {
    const namePart = email.split("@")[0];
    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const tempMember: TeamMember = {
      id: `inv_${Date.now()}`, name, email, role,
      status: "invited", online: false,
      avatarGrad: AVATAR_GRADS[3],
      metrics: { leadsAssigned: 0, conversations: 0, meetings: 0, responseRate: 0 },
      joinedAt: "—", lastActiveAt: "Invitación pendiente",
    };
    setMembers((p) => [...p, tempMember]);

    startTransition(async () => {
      const res = await inviteMember({ email, role });
      if (!res.success) {
        setError(res.error ?? "Error al enviar invitación");
        setMembers((p) => p.filter((m) => m.id !== tempMember.id));
      } else {
        router.refresh();
      }
    });
  }

  function handleRoleChange(id: string, role: MemberRole) {
    setMembers((p) => p.map((m) => m.id === id ? { ...m, role } : m));
    startTransition(async () => {
      const res = await updateMemberRole(id, role);
      if (!res.success) setError(res.error ?? "Error al cambiar rol");
      else router.refresh();
    });
  }

  function handleRemove(id: string) {
    const member = members.find((m) => m.id === id);
    setMembers((p) => p.filter((m) => m.id !== id));
    startTransition(async () => {
      const res = member?.status === "invited"
        ? await revokeInvitation(id)
        : await removeMember(id);
      if (!res.success) {
        setError(res.error ?? "Error al eliminar miembro");
        setMembers((p) => (member ? [...p, member] : p));
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Equipo</h1>
          <p className="text-xs text-zinc-400">
            Gestiona asesores, roles y permisos · Plan {CURRENT_PLAN.charAt(0).toUpperCase() + CURRENT_PLAN.slice(1)}: {activeCount}/{seatLimit} asientos usados
          </p>
        </div>
        <button
          onClick={() => canInvite ? setInviteOpen(true) : null}
          disabled={!canInvite || isPending}
          className={["flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            canInvite ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-60"
                      : "cursor-not-allowed bg-zinc-100 text-zinc-400",
          ].join(" ")}
          title={!canInvite ? `Límite de ${seatLimit} asientos en Plan ${CURRENT_PLAN}` : undefined}
        >
          <UserPlus className="h-4 w-4" />
          Invitar miembro
        </button>
      </div>

      {!canInvite && (
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5">
          <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs font-medium text-amber-800">
            Alcanzaste el límite de <strong>{seatLimit} asientos</strong> del Plan {CURRENT_PLAN}.{" "}
            <button className="font-bold underline">Upgrade a Enterprise</button> para agregar asesores ilimitados.
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-shrink-0 items-center gap-3 bg-red-500 px-6 py-2 text-sm text-white">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 space-y-6">

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Miembros activos",   value: activeCount,          icon: Users,       color: "text-indigo-600", bg: "bg-indigo-50"  },
            { label: "Invitaciones pend.", value: invitedCount,          icon: Mail,        color: "text-amber-600",  bg: "bg-amber-50"   },
            { label: "Leads totales",      value: teamMetrics.leads,    icon: Target,      color: "text-blue-600",   bg: "bg-blue-50"    },
            { label: "Reuniones equipo",   value: teamMetrics.meetings, icon: CheckCircle2,color: "text-green-600",  bg: "bg-green-50"   },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-zinc-500">{label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              <p className="mt-2 text-3xl font-black tabular-nums text-zinc-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Ranking */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-bold text-zinc-900">Ranking de rendimiento</h2>
          </div>
          {members.filter((m) => m.status === "active").length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">Sin datos de rendimiento aún</p>
          ) : (
            <div className="space-y-3">
              {members
                .filter((m) => m.status === "active")
                .sort((a, b) => b.metrics.meetings - a.metrics.meetings)
                .map((m, idx) => {
                  const maxMeetings = Math.max(...members.map((x) => x.metrics.meetings), 1);
                  const pct = (m.metrics.meetings / maxMeetings) * 100;
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className={["flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                        idx === 0 ? "bg-amber-400 text-white" : idx === 1 ? "bg-zinc-300 text-zinc-700" : "bg-zinc-100 text-zinc-500",
                      ].join(" ")}>{idx + 1}</span>
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${m.avatarGrad} text-[10px] font-black text-white`}>
                        {initials(m.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{m.name}</p>
                          <span className="ml-2 flex-shrink-0 text-sm font-black tabular-nums text-green-600">{m.metrics.meetings} reuniones</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div className={`h-full rounded-full bg-gradient-to-r ${m.avatarGrad} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Members list */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">
              Miembros del equipo <span className="font-normal text-zinc-400">({members.length})</span>
            </h2>
            <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1">
              {(["all", "admin", "vendedor", "observador"] as const).map((r) => (
                <button key={r} onClick={() => setFilterRole(r)}
                  className={["rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors capitalize",
                    filterRole === r ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-700",
                  ].join(" ")}>
                  {r === "all" ? "Todos" : ROLE_META[r as MemberRole].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map((member, i) => (
              <MemberRow
                key={member.id}
                member={member}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
                isCurrentUser={i === 0 && member.status === "active"}
              />
            ))}
          </div>
        </div>

        {/* Permissions table */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-zinc-900">Permisos por rol</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="py-2 text-left font-semibold text-zinc-500 pr-6">Permiso</th>
                  {(["admin", "vendedor", "observador"] as MemberRole[]).map((r) => (
                    <th key={r} className="py-2 text-center font-semibold text-zinc-700 px-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${ROLE_META[r].bg} ${ROLE_META[r].color}`}>
                        {ROLE_META[r].label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {[
                  ["Ver dashboard y analítica",      true,  true,  true  ],
                  ["Gestionar leads asignados",       true,  true,  false ],
                  ["Responder conversaciones",        true,  true,  false ],
                  ["Crear y editar campañas",         true,  true,  false ],
                  ["Configurar agentes IA",           true,  false, false ],
                  ["Gestionar equipo e invitaciones", true,  false, false ],
                  ["Acceso a configuración y plan",   true,  false, false ],
                ].map(([label, admin, vendedor, obs]) => (
                  <tr key={label as string}>
                    <td className="py-2.5 text-zinc-600 pr-6">{label as string}</td>
                    {[admin, vendedor, obs].map((has, i) => (
                      <td key={i} className="py-2.5 text-center px-4">
                        {has
                          ? <Check className="mx-auto h-3.5 w-3.5 text-green-500" />
                          : <X    className="mx-auto h-3.5 w-3.5 text-zinc-200" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvite={handleInvite}
        />
      )}
    </div>
  );
}
