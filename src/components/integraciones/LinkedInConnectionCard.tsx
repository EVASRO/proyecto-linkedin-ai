"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, RefreshCw, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { LinkedInWizardModal } from "./LinkedInWizardModal";
import type { LinkedInAccount } from "@/app/dashboard/configuracion/actions";

// -- LinkedIn SVG logo --------------------------------------------------------

function LinkedInLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#0A66C2" />
      <path
        d="M10 15h5v15h-5zM12.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17 15h4.8v2h.1c.7-1.3 2.3-2.5 4.7-2.5C31.1 14.5 32 17.2 32 21v9h-5v-8c0-1.9-.03-4.3-2.6-4.3-2.6 0-3 2-3 4.2V30H17V15z"
        fill="white"
      />
    </svg>
  );
}

// -- Time ago helper ----------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `Hace ${diff}s`;
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

// -- Props --------------------------------------------------------------------

type Props = {
  account: LinkedInAccount | null;
  onRefresh: () => Promise<void>;
  onDisconnect: () => Promise<void>;
};

// -- Disconnected state -------------------------------------------------------

function DisconnectedCard({ onOpenWizard }: { onOpenWizard: () => void }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(239,68,68,0.04)",
        border: "1px solid rgba(239,68,68,0.3)",
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <LinkedInLogo size={36} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#EF4444] text-base">
            LinkedIn no conectado
          </h3>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5">
            Conecta tu cuenta para comenzar a prospectar
          </p>

          <button
            onClick={onOpenWizard}
            className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg, #2563eb, #06b6d4)" }}
          >
            Conectar LinkedIn ahora
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Error state --------------------------------------------------------------

function ErrorCard({
  errorMessage,
  onOpenWizard,
}: {
  errorMessage: string | null;
  onOpenWizard: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(239,68,68,0.04)",
        border: "1px solid rgba(239,68,68,0.3)",
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <LinkedInLogo size={36} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[#EF4444] flex-shrink-0" />
            <h3 className="font-semibold text-[#EF4444] text-base">
              Error de conexión
            </h3>
          </div>
          {errorMessage && (
            <p className="text-xs text-[var(--foreground-muted)] mt-1 font-mono bg-[var(--background)] rounded px-2 py-1 mt-2">
              {errorMessage}
            </p>
          )}
          <button
            onClick={onOpenWizard}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg, #2563eb, #06b6d4)" }}
          >
            Reconectar LinkedIn
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Connected state ----------------------------------------------------------

function ConnectedCard({
  account,
  onRefresh,
  onDisconnect,
}: {
  account: LinkedInAccount;
  onRefresh: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  async function handleDisconnect() {
    if (!confirm("¿Seguro que quieres desconectar esta cuenta de LinkedIn?")) return;
    setDisconnecting(true);
    await onDisconnect();
    setDisconnecting(false);
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(16,185,129,0.04)",
        border: "1px solid rgba(16,185,129,0.3)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar or LinkedIn logo */}
        <div className="flex-shrink-0">
          {account.avatar_url ? (
            <img
              src={account.avatar_url}
              alt={account.name ?? "LinkedIn"}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[rgba(16,185,129,0.3)]"
            />
          ) : (
            <LinkedInLogo size={36} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-[#10B981] text-base truncate">
                LinkedIn conectado
              </h3>
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="flex-shrink-0 w-5 h-5 rounded-full bg-[#10b981] flex items-center justify-center"
              >
                <Check size={11} strokeWidth={3} className="text-white" />
              </motion.div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-[rgba(239,68,68,0.4)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors disabled:opacity-50"
            >
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : null}
              Desconectar
            </button>
          </div>

          {/* Profile info */}
          <div className="mt-2 space-y-0.5">
            {account.name && (
              <p className="text-sm font-medium text-[var(--foreground)]">{account.name}</p>
            )}
            {account.headline && (
              <p className="text-xs text-[var(--foreground-muted)]">{account.headline}</p>
            )}
            {account.profile_url && (
              <a
                href={account.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#2563EB] hover:underline mt-1"
              >
                Ver perfil <ExternalLink size={10} />
              </a>
            )}
          </div>

          {/* Last sync */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-[var(--foreground-muted)]">
              Última sincronización:{" "}
              {account.last_synced_at ? timeAgo(account.last_synced_at) : "nunca"}
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              title="Refrescar"
            >
              <RefreshCw
                size={12}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Main component -----------------------------------------------------------

export function LinkedInConnectionCard({ account, onRefresh, onDisconnect }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [localAccount, setLocalAccount] = useState<LinkedInAccount | null>(account);

  // Sync external prop changes (e.g., after server refresh)
  if (account !== localAccount && !wizardOpen) {
    setLocalAccount(account);
  }

  const handleConnected = useCallback(
    (connected: { name: string | null }) => {
      // Optimistically show connected state until parent refreshes
      setLocalAccount({
        id: "pending",
        name: connected.name,
        headline: null,
        profile_url: null,
        avatar_url: null,
        status: "connected",
        last_synced_at: new Date().toISOString(),
        error_message: null,
      });
      onRefresh();
    },
    [onRefresh]
  );

  const isConnected = localAccount?.status === "connected";
  const isError = localAccount?.status === "error";

  return (
    <>
      {isConnected ? (
        <ConnectedCard
          account={localAccount!}
          onRefresh={onRefresh}
          onDisconnect={onDisconnect}
        />
      ) : isError ? (
        <ErrorCard
          errorMessage={localAccount?.error_message ?? null}
          onOpenWizard={() => setWizardOpen(true)}
        />
      ) : (
        <DisconnectedCard onOpenWizard={() => setWizardOpen(true)} />
      )}

      <LinkedInWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConnected={handleConnected}
      />
    </>
  );
}
