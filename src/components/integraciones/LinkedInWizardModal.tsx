"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ExternalLink, Loader2, X } from "lucide-react";

// ---------------------------------------------------------------------------

type WizardStep = 0 | 1 | 2 | 3;

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected: (account: { name: string | null }) => void;
};

// -- Stepper ------------------------------------------------------------------

const STEP_LABELS = [
  "Instala extensión",
  "Abre LinkedIn",
  "Activa extensión",
  "¡Listo!",
];

function Stepper({ current }: { current: WizardStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={
                  done
                    ? { backgroundColor: "#10b981", borderColor: "#10b981", color: "#fff" }
                    : active
                    ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff" }
                    : { backgroundColor: "transparent", borderColor: "var(--border)", color: "var(--foreground-faint)" }
                }
                transition={{ duration: 0.3 }}
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold"
              >
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </motion.div>
              <span
                className={`text-[10px] font-medium whitespace-nowrap ${
                  active ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className="w-10 h-px mb-5 mx-1 transition-colors duration-300"
                style={{
                  backgroundColor: i < current ? "#10b981" : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- Step 0: Install extension ------------------------------------------------

function StepInstall({ onNext }: { onNext: () => void }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/check-extension");
        const json = await res.json();
        if (json.connected) onNext();
      } catch {}
    }, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onNext]);

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {/* Chrome + puzzle icon illustration */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.08))" }}
        />
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" fill="#4285F4" />
          <circle cx="24" cy="24" r="8" fill="white" />
          <circle cx="24" cy="24" r="5" fill="#4285F4" />
          <path d="M24 8 L38 32 L10 32 Z" fill="none" stroke="#EA4335" strokeWidth="2.5" strokeLinejoin="round" opacity="0.9" />
          <path d="M24 8 L38 32" stroke="#FBBC05" strokeWidth="2.5" />
          <path d="M24 8 L10 32" stroke="#34A853" strokeWidth="2.5" />
          <rect x="31" y="28" width="12" height="12" rx="3" fill="#2563eb" />
          <path d="M34 34 h2 v-2 h2 v2 h2 M35 32 v-1.5 a1.5 1.5 0 0 1 3 0 v1.5" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm text-[var(--foreground)] font-medium">
          Necesitas la extensión de cazary.ai en Chrome para continuar
        </p>
        <p className="text-xs text-[var(--foreground-muted)]">
          Se detectará automáticamente una vez instalada
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => window.open("https://chrome.google.com/webstore/", "_blank")}
          className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(90deg, #2563eb, #06b6d4)" }}
        >
          <ExternalLink size={14} />
          Instalar extensión de Chrome
        </button>
        <button
          onClick={onNext}
          className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Ya la tengo instalada →
        </button>
      </div>
    </div>
  );
}

// -- Step 1: Open LinkedIn ----------------------------------------------------

function StepOpenLinkedIn({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.08))" }}
        />
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="8" fill="#0A66C2" />
          <path d="M10 15h5v15h-5zM12.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17 15h4.8v2h.1c.7-1.3 2.3-2.5 4.7-2.5C31.1 14.5 32 17.2 32 21v9h-5v-8c0-1.9-.03-4.3-2.6-4.3-2.6 0-3 2-3 4.2V30H17V15z" fill="white"/>
        </svg>
      </div>

      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm text-[var(--foreground)] font-medium">
          Abre LinkedIn en tu navegador de Chrome
        </p>
        <p className="text-xs text-[var(--foreground-muted)]">
          Asegúrate de estar logueado en tu cuenta
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => { window.open("https://www.linkedin.com", "_blank"); }}
          className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(90deg, #2563eb, #06b6d4)" }}
        >
          <ExternalLink size={14} />
          Abrir LinkedIn
        </button>
        <button
          onClick={onNext}
          className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          LinkedIn ya está abierto →
        </button>
      </div>
    </div>
  );
}

// -- Step 2: Activate extension (polls until connected) -----------------------

function StepActivate({ onConnected }: { onConnected: (account: { name: string | null }) => void }) {
  const [polling, setPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    setPolling(true);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/check-extension");
        const json = await res.json();
        if (json.connected) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onConnected({ name: json.name ?? null });
        }
      } catch {}
    }, 2000);
  }, [onConnected]);

  useEffect(() => {
    startPolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startPolling]);

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {/* Toolbar illustration */}
      <div className="relative w-full max-w-xs rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            {["bg-red-400","bg-yellow-400","bg-green-400"].map(c => (
              <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />
            ))}
          </div>
          <div className="flex-1 h-5 rounded-md bg-[var(--surface)] text-[10px] flex items-center px-2 text-[var(--foreground-faint)]">
            linkedin.com
          </div>
          {/* Extension icon highlight */}
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center ring-2 ring-[#2563eb] ring-offset-1"
            style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }}
          >
            <span className="text-white text-[10px] font-bold">C</span>
          </div>
        </div>
        <div className="text-[10px] text-center text-[var(--foreground-muted)]">
          ↑ Haz clic en el icono de cazary.ai en la barra de herramientas
        </div>
      </div>

      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm text-[var(--foreground)] font-medium">
          Activa la extensión en LinkedIn
        </p>
        <p className="text-xs text-[var(--foreground-muted)]">
          Haz clic en el icono de cazary.ai en la barra de Chrome mientras LinkedIn está abierto
        </p>
      </div>

      {polling && (
        <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
          <Loader2 size={14} className="animate-spin" />
          Esperando conexión...
        </div>
      )}
    </div>
  );
}

// -- Step 3: Success ----------------------------------------------------------

function StepSuccess({
  accountName,
  onClose,
}: {
  accountName: string | null;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
      >
        <Check size={36} strokeWidth={3} className="text-white" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-1.5"
      >
        <p className="text-base font-semibold text-[var(--foreground)]">
          LinkedIn conectado correctamente
        </p>
        {accountName && (
          <p className="text-sm text-[var(--foreground-muted)]">{accountName}</p>
        )}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        onClick={onClose}
        className="w-full max-w-xs rounded-xl py-2.5 text-sm font-semibold text-white"
        style={{ background: "linear-gradient(90deg, #2563eb, #06b6d4)" }}
      >
        Comenzar a prospectar
      </motion.button>
    </div>
  );
}

// -- Main modal ---------------------------------------------------------------

export function LinkedInWizardModal({ open, onClose, onConnected }: Props) {
  const [step, setStep] = useState<WizardStep>(0);
  const [connectedName, setConnectedName] = useState<string | null>(null);

  function reset() {
    setStep(0);
    setConnectedName(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleConnected(account: { name: string | null }) {
    setConnectedName(account.name);
    setStep(3);
    onConnected(account);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-6"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
        >
          <X size={16} />
        </button>

        <h2 className="text-base font-semibold text-[var(--foreground)] mb-6">
          Conecta tu LinkedIn
        </h2>

        <Stepper current={step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === 0 && <StepInstall onNext={() => setStep(1)} />}
            {step === 1 && <StepOpenLinkedIn onNext={() => setStep(2)} />}
            {step === 2 && <StepActivate onConnected={handleConnected} />}
            {step === 3 && <StepSuccess accountName={connectedName} onClose={handleClose} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}
