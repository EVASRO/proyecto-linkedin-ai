'use client';

import { useState } from 'react';
import { CheckCircle2, FlaskConical } from 'lucide-react';
import { saveCampaignAbTest } from '@/app/dashboard/campanas/actions';

type Variant = { connection_note?: string; follow_up_message?: string };

interface AbTestEditorProps {
  campaignId: string;
  initialA?: Variant;
  initialB?: Variant;
  abEnabled?: boolean;
  onSave?: () => void;
}

export function AbTestEditor({
  campaignId, initialA, initialB, abEnabled, onSave,
}: AbTestEditorProps) {
  const [varA, setVarA]     = useState<Variant>(initialA ?? {});
  const [varB, setVarB]     = useState<Variant>(initialB ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await saveCampaignAbTest(campaignId, varA, varB);
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSave?.();
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(124,58,237,0.12)]">
          <FlaskConical className="h-3.5 w-3.5 text-[#7C3AED]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]">Editor A/B Test</h3>
          <p className="text-[10px] text-[var(--foreground-faint)]">
            {abEnabled ? 'Test activo — el motor asigna variantes automáticamente' : 'Configura y activa el test'}
          </p>
        </div>
        {abEnabled && (
          <span className="ml-auto rounded-full bg-[rgba(124,58,237,0.12)] px-2.5 py-0.5 text-[10px] font-bold text-[#7C3AED]">
            ACTIVO
          </span>
        )}
      </div>

      {/* Variant editors side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Variante A */}
        <VariantPanel
          label="A"
          sublabel="Control"
          color="blue"
          variant={varA}
          onChange={setVarA}
        />
        {/* Variante B */}
        <VariantPanel
          label="B"
          sublabel="Desafiante"
          color="violet"
          variant={varB}
          onChange={setVarB}
        />
      </div>

      {/* Hint */}
      <p className="mt-3 rounded-lg bg-[var(--background)] px-3 py-2 text-[10px] text-[var(--foreground-muted)] leading-relaxed">
        💡 Variables: <code className="rounded bg-[rgba(255,255,255,0.08)] px-1">{'{{nombre}}'}</code>{' '}
        <code className="rounded bg-[rgba(255,255,255,0.08)] px-1">{'{{empresa}}'}</code>{' '}
        <code className="rounded bg-[rgba(255,255,255,0.08)] px-1">{'{{cargo}}'}</code> · El motor asigna variante A o B
        aleatoriamente (50/50). Los resultados aparecen cuando cada variante tiene ≥ 30 leads.
      </p>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || saved}
        className={[
          'mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all',
          saved
            ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[rgba(16,185,129,0.3)]'
            : 'bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white disabled:opacity-60',
        ].join(' ')}
      >
        {saved ? (
          <><CheckCircle2 className="h-4 w-4" /> Guardado</>
        ) : saving ? (
          <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando...</>
        ) : (
          'Guardar configuración A/B'
        )}
      </button>
    </div>
  );
}

function VariantPanel({
  label, sublabel, color, variant, onChange,
}: {
  label: string;
  sublabel: string;
  color: 'blue' | 'violet';
  variant: Variant;
  onChange: (v: Variant) => void;
}) {
  const borderColor = color === 'blue' ? 'border-[rgba(37,99,235,0.35)]'   : 'border-[rgba(124,58,237,0.35)]';
  const bgColor     = color === 'blue' ? 'bg-[rgba(37,99,235,0.06)]'        : 'bg-[rgba(124,58,237,0.06)]';
  const badge       = color === 'blue' ? 'bg-[#2563EB]'                     : 'bg-[#7C3AED]';
  const labelColor  = color === 'blue' ? 'text-[#2563EB]'                   : 'text-[#7C3AED]';
  const focusClass  = color === 'blue'
    ? 'focus:border-[#2563EB] focus:ring-[rgba(37,99,235,0.3)]'
    : 'focus:border-[#7C3AED] focus:ring-[rgba(124,58,237,0.3)]';

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${badge}`}>
          {label}
        </span>
        <span className={`text-xs font-semibold ${labelColor}`}>Variante {label} ({sublabel})</span>
      </div>

      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--foreground-faint)]">
          Nota de conexión
        </label>
        <textarea
          value={variant.connection_note ?? ''}
          onChange={(e) => onChange({ ...variant, connection_note: e.target.value })}
          rows={3}
          placeholder={label === 'A' ? 'Hola {{nombre}}, vi tu perfil...' : '{{nombre}}, trabajo con empresas como {{empresa}}...'}
          className={[
            'mt-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2',
            'text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:outline-none focus:ring-1',
            focusClass,
          ].join(' ')}
        />
      </div>

      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--foreground-faint)]">
          Primer mensaje (follow-up)
        </label>
        <textarea
          value={variant.follow_up_message ?? ''}
          onChange={(e) => onChange({ ...variant, follow_up_message: e.target.value })}
          rows={3}
          placeholder={label === 'A' ? 'Hola {{nombre}}, gracias por conectar...' : 'Hola {{nombre}}, noté que en {{empresa}}...'}
          className={[
            'mt-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2',
            'text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:outline-none focus:ring-1',
            focusClass,
          ].join(' ')}
        />
      </div>
    </div>
  );
}
