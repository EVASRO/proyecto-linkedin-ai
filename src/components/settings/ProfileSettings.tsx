"use client";

import { useState, useRef, useTransition } from "react";
import { Camera, Loader2, Check, AlertCircle, Lock } from "lucide-react";
import { saveUserProfile } from "@/app/dashboard/settings/actions";
import type { UserProfileData } from "@/app/dashboard/settings/actions";
import { createClient } from "@/lib/supabase/browser";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

type Props = { initial: UserProfileData };

export function ProfileSettings({ initial }: Props) {
  const [fullName, setFullName]   = useState(initial.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const fileRef                   = useRef<HTMLInputElement>(null);

  // Password change state
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwPending, setPwPending]   = useState(false);
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveUserProfile({ full_name: fullName, avatar_url: avatarUrl || undefined });
      if (res.success) setSaved(true);
      else setError(res.error ?? "Error al guardar");
    });
  }

  async function handlePwChange() {
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "Las contraseñas no coinciden" });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }
    setPwPending(true);
    setPwMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwPending(false);
    if (error) setPwMsg({ ok: false, text: error.message });
    else {
      setPwMsg({ ok: true, text: "Contraseña actualizada correctamente" });
      setNewPw("");
      setConfirmPw("");
      setShowPwForm(false);
    }
  }

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Perfil</h2>
        <p className="text-sm text-zinc-400">Tu información personal y de acceso</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-emerald-500/30"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-xl font-bold text-white">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="text-sm">
          <p className="font-medium text-zinc-200">{fullName || "Sin nombre"}</p>
          <p className="text-zinc-500">{initial.email}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Cambiar foto
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setAvatarUrl(URL.createObjectURL(file));
          }}
        />
      </div>

      {/* Fields */}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <Field label="Nombre completo">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre"
            className={inputCls}
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={initial.email ?? ""}
            readOnly
            className={`${inputCls} cursor-not-allowed opacity-60`}
          />
        </Field>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">
            <Check className="h-4 w-4 shrink-0" />
            Cambios guardados
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar cambios
        </button>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-200">Seguridad</p>
            <p className="text-xs text-zinc-500">Cambia tu contraseña de acceso</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPwForm(!showPwForm)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            Cambiar contraseña
          </button>
        </div>

        {showPwForm && (
          <div className="mt-4 space-y-3">
            <Field label="Nueva contraseña">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={inputCls}
              />
            </Field>
            <Field label="Confirmar contraseña">
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repite la contraseña"
                className={inputCls}
              />
            </Field>

            {pwMsg && (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  pwMsg.ok
                    ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-400"
                    : "border-red-800/50 bg-red-950/30 text-red-400"
                }`}
              >
                {pwMsg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {pwMsg.text}
              </div>
            )}

            <button
              type="button"
              onClick={handlePwChange}
              disabled={pwPending}
              className="flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-600 disabled:opacity-60"
            >
              {pwPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Actualizar contraseña
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
