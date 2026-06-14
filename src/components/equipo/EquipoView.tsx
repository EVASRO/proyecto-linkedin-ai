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
  "from-[#2563EB] to-[#06B6D4]",
  "from-[#06B6D4] to-[#2563EB]",
  "from-[#1D4ED8] to-[#0891B2]",
  "from-[#3B82F6] to-[#06B6D4]",
  "from-[#2563EB] to-[#0EA5E9]",
  "from-[#0369A1] to-[#06B6D4]",
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
  admin:      { label: "Admin",      color: "text-[#2563EB]",                 bg: "bg-[rgba(37,99,235,0.15)]",  icon: Crown,    desc: "Acceso total: configuración, facturación, equipo" },
  vendedor:   { label: "Vendedor",   color: "text-[#10B981]",                 bg: "bg-[rgba(16,185,129,0.15)]", icon: Target,   desc: "Gestiona leads y conversaciones asignadas" },
  observador: { label: "Observador", color: "text-[var(--foreground-muted)]", bg: "bg-[var(--border)]",         icon: BarChart3, desc: "Solo lectura: ve métricas y campañas" },
};

const PLAN_LIMITS = { growth: 1, pro: 3, enterprise: 999 };
const CURRENT_PLAN: keyof typeof PLAN_LIMITS = "pro";

function MetricPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-[var(--background)] px-3 py-2">
      <span className={`text-base font-black tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-[var(--foreground-muted)]">{label}</span>
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

  const canSend = email.trim() && email.includes("@");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Invitar miembro</h2>
            <p className="text-[11px] text-[var(--foreground-muted)]">El miembro recibirá un email con el enlace de acceso</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center py-10 px-6">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(16,185,129,0.15)]">
              <CheckCircle2 className="h-7 w-7 text-[#10B981]" />
            </div>
            <p className="text-base font-bold text-[var(--foreground)]">Invitación enviada</p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)] text-center">Se envió un email a <strong>{email}</strong></p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--foreground-muted)]">Email del miembro</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="asesor@empresa.com" autoFocus
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-[var(--foreground-muted)]">Rol</label>
              <div className="space-y-2">
                {(["admin", "vendedor", "observador"] as MemberRole[]).map((r) => {
                  const meta = ROLE_META[r];
                  const Icon = meta.icon;
                  return (
                    <button key={r} onClick={() => setRole(r)}
                      className={["flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                        role === r ? "border-[#2563EB] bg-[rgba(37,99,235,0.08)]" : "border-[var(--border)] bg-[var(--background)] hover:border-[rgba(37,99,235,0.4)]",
                      ].join(" ")}>
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{meta.label}</p>
                        <p className="text-[11px] text-[var(--foreground-muted)]">{meta.desc}</p>
                      </div>
                      {role === r && (
                        <div className="h-4 w-4 rounded-full bg-[#2563EB] flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button onClick={handleSend} disabled={!canSend}
              className={["w-full rounded-xl py-3 text-sm font-bold transition-opacity",
                canSend
                  ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white hover:opacity-90"
                  : "bg-[var(--border)] text-[var(--foreground-faint)] cursor-not-allowed",
              ].join(" ")}>
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
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-start">
      <div className="relative flex-shrink-0">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${member.avatarGrad} text-sm font-black text-white shadow-md`}>
          {initials(member.name)}
        </div>
        <div className={["absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)]",
          member.online ? "bg-[#10B981]" : "bg-[var(--foreground-faint)]",
        ].join(" ")} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-[var(--foreground)]">{member.name}</p>
          {isCurrentUser && <span className="rounded-full bg-[rgba(37,99,235,0.15)] px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">Tú</span>}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${roleMeta.bg} ${roleMeta.color}`}>
            <RoleIcon className="h-3 w-3" />
            {roleMeta.label}
          </span>
          {member.status === "invited" && (
            <span className="rounded-full bg-[rgba(245,158,11,0.15)] px-2 py-0.5 text-[10px] font-bold text-[#F59E0B]">Invitación pendiente</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{member.email}</p>
        <p className="mt-0.5 text-[11px] text-[var(--foreground-faint)]">
          {member.status === "invited" ? "Sin unirse aún" : `Último acceso: ${member.lastActiveAt}`}
        </p>
        {member.status === "active" && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            <MetricPill label="Leads"          value={member.metrics.leadsAssigned}       color="text-[#2563EB]"  />
            <MetricPill label="Conversaciones" value={member.metrics.conversations}       color="text-[#06B6D4]" />
            <MetricPill label="Reuniones"      value={member.metrics.meetings}            color="text-[#10B981]" />
            <MetricPill label="Resp. %"        value={`${member.metrics.responseRate}%`}  color="text-[#F59E0B]" />
          </div>
        )}
      </div>

      {!isCurrentUser && (
        <div className="relative flex-shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--foreground)]">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
                <button onClick={() => { setMenuOpen(false); setRoleMenuOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.05)]">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--foreground-muted)]" />
                  Cambiar rol
                </button>
                {member.status === "invited" && (
                  <button className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.05)]">
                    <Mail className="h-3.5 w-3.5 text-[var(--foreground-muted)]" />
                    Reenviar invitación
                  </button>
                )}
                <div className="my-1 h-px bg-[var(--border)]" />
                <button onClick={() => { onRemove(member.id); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]">
                  <UserMinus className="h-3.5 w-3.5" />
                  {member.status === "invited" ? "Cancelar invitación" : "Eliminar miembro"}
                </button>
              </div>
            </>
          )}
          {roleMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-muted)]">Cambiar rol</p>
                {(["admin", "vendedor", "observador"] as MemberRole[]).map((r) => {
                  const m = ROLE_META[r];
                  return (
                    <button key={r} onClick={() => { onRoleChange(member.id, r); setRoleMenuOpen(false); }}
                      className={["flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors",
                        member.role === r ? "bg-[rgba(37,99,235,0.1)] text-[#2563EB] font-semibold" : "text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.05)]",
                      ].join(" ")}>
                      {member.role === r && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                      <span className={member.role === r ? "" : "ml-5"}>{m.label}</span>
                      <span className="ml-auto text-[10px] text-[var(--foreground-muted)]">{m.desc.slice(0, 22)}…</span>
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
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Equipo</h1>
          <p className="text-xs text-[var(--foreground-muted)]">
            Gestiona asesores, roles y permisos · Plan {CURRENT_PLAN.charAt(0).toUpperCase() + CURRENT_PLAN.slice(1)}: {activeCount}/{seatLimit} asientos usados
          </p>
        </div>
        <button
          onClick={() => canInvite ? setInviteOpen(true) : null}
          disabled={!canInvite || isPending}
          className={["flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity",
            canInvite
              ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white shadow-[0_0_16px_rgba(37,99,235,0.3)] hover:opacity-90 disabled:opacity-60"
              : "cursor-not-allowed bg-[var(--border)] text-[var(--foreground-faint)]",
          ].join(" ")}
          title={!canInvite ? `Límite de ${seatLimit} asientos en Plan ${CURRENT_PLAN}` : undefined}
        >
          <UserPlus className="h-4 w-4" />
          Invitar miembro
        </button>
      </div>

      {!canInvite && (
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-6 py-2.5">
          <Zap className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
          <p className="text-xs font-medium text-[#F59E0B]">
            Alcanzaste el límite de <strong>{seatLimit} asientos</strong> del Plan {CURRENT_PLAN}.{" "}
            <button className="font-bold underline">Upgrade a Enterprise</button> para agregar asesores ilimitados.
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-6 py-2 text-sm text-[#EF4444]">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-[var(--background)] p-6 space-y-6">

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Miembros activos",   value: activeCount,          icon: Users,        color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.15)]"  },
            { label: "Invitaciones pend.", value: invitedCount,          icon: Mail,         color: "text-[#06B6D4]", bg: "bg-[rgba(6,182,212,0.15)]"   },
            { label: "Leads totales",      value: teamMetrics.leads,    icon: Target,       color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.15)]"  },
            { label: "Reuniones equipo",   value: teamMetrics.meetings, icon: CheckCircle2, color: "text-[#10B981]", bg: "bg-[rgba(16,185,129,0.15)]" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-[var(--foreground-muted)]">{label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              <p className="mt-2 text-3xl font-black tabular-nums text-[var(--foreground)]">{value}</p>
            </div>
          ))}
        </div>

        {/* Ranking */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--foreground-muted)]" />
            <h2 className="text-sm font-bold text-[var(--foreground)]">Ranking de rendimiento</h2>
          </div>
          {members.filter((m) => m.status === "active").length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)] text-center py-4">Sin datos de rendimiento aún</p>
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
                        idx === 0 ? "bg-[#F59E0B] text-white" : idx === 1 ? "bg-[var(--border)] text-[var(--foreground-muted)]" : "bg-[var(--background)] text-[var(--foreground-faint)]",
                      ].join(" ")}>{idx + 1}</span>
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${m.avatarGrad} text-[10px] font-black text-white`}>
                        {initials(m.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between">
                          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{m.name}</p>
                          <span className="ml-2 flex-shrink-0 text-sm font-black tabular-nums text-[#10B981]">{m.metrics.meetings} reuniones</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
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
            <h2 className="text-sm font-bold text-[var(--foreground)]">
              Miembros del equipo <span className="font-normal text-[var(--foreground-muted)]">({members.length})</span>
            </h2>
            <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              {(["all", "admin", "vendedor", "observador"] as const).map((r) => (
                <button key={r} onClick={() => setFilterRole(r)}
                  className={["rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors capitalize",
                    filterRole === r ? "bg-[#2563EB] text-white" : "bg-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
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
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="mb-4 text-sm font-bold text-[var(--foreground)]">Permisos por rol</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 text-left font-semibold text-[var(--foreground-muted)] pr-6">Permiso</th>
                  {(["admin", "vendedor", "observador"] as MemberRole[]).map((r) => (
                    <th key={r} className="py-2 text-center font-semibold text-[var(--foreground)] px-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${ROLE_META[r].bg} ${ROLE_META[r].color}`}>
                        {ROLE_META[r].label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ["Ver dashboard y analítica",      true,  true,  true  ],
                  ["Gestionar leads asignados",       true,  true,  false ],
                  ["Responder conversaciones",        true,  true,  false ],
                  ["Crear y editar campañas",         true,  true,  false ],
                  ["Configurar agentes IA",           true,  false, false ],
                  ["Gestionar equipo e invitaciones", true,  false, false ],
                  ["Acceso a configuración y plan",   true,  false, false ],
                ].map(([label, admin, vendedor, obs], rowIdx) => (
                  <tr key={label as string} className={rowIdx % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--background)]"}>
                    <td className="py-2.5 text-[var(--foreground)] pr-6">{label as string}</td>
                    {[admin, vendedor, obs].map((has, i) => (
                      <td key={i} className="py-2.5 text-center px-4">
                        {has
                          ? <Check className="mx-auto h-3.5 w-3.5 text-[#10B981]" />
                          : <X    className="mx-auto h-3.5 w-3.5 text-[var(--foreground-faint)]" />}
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
