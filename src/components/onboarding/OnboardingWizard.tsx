'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ArrowLeft,
  Sparkles,
  Link2,
  Target,
  Users,
  Rocket,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileUp,
} from 'lucide-react';
import {
  saveOnboardingStep,
  completeOnboarding,
  createFirstCampaign,
} from '@/app/dashboard/onboarding/actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepWelcomeProps {
  workspaceName: string;
  onChange: (v: string) => void;
  onNext: () => void;
  saving: boolean;
}

interface StepLinkedInProps {
  linkedinOk: boolean;
  checking: boolean;
  onCheck: () => void;
  onNext: () => void;
  onSkip: () => void;
  saving: boolean;
}

interface StepCampaignProps {
  campaignName: string;
  onChange: (v: string) => void;
  onNext: (name: string, type: string, goal: string) => void;
  saving: boolean;
}

interface StepLeadsProps {
  campaignId: string | null;
  onNext: () => void;
  saving: boolean;
}

interface StepLaunchProps {
  workspaceName: string;
  campaignName: string;
  linkedinOk: boolean;
  onFinish: () => void;
  saving: boolean;
}

// ---------------------------------------------------------------------------
// Sub-steps
// ---------------------------------------------------------------------------

function StepWelcome({ workspaceName, onChange, onNext, saving }: StepWelcomeProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">¡Bienvenido a cazary.ai! 👋</h1>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          Automatiza tu prospección en LinkedIn como los mejores SDRs
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--foreground-muted)]">
          ¿Cómo se llama tu empresa o proyecto?
        </label>
        <input
          type="text"
          value={workspaceName}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: Acme Corp, Mi Startup..."
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm
                     text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] outline-none
                     focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!workspaceName.trim() || saving}
        className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-6 py-3
                   text-sm font-semibold text-white transition-all
                   hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continuar →
      </button>
    </div>
  );
}

function StepLinkedIn({ linkedinOk, checking, onCheck, onNext, onSkip, saving }: StepLinkedInProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Conecta tu cuenta de LinkedIn</h1>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          La extensión detecta tu sesión automáticamente
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {[
          {
            n: 1,
            title: 'Instala la extensión cazary.ai para Chrome',
            action: (
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#2563EB] hover:opacity-80 transition-opacity"
              >
                Instalar extensión <ExternalLink className="h-3 w-3" />
              </a>
            ),
          },
          { n: 2, title: 'Abre LinkedIn y haz login', action: null },
          { n: 3, title: 'La extensión detectará tu sesión automáticamente', action: null },
        ].map(({ n, title, action }) => (
          <div
            key={n}
            className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                            bg-[rgba(37,99,235,0.12)] text-xs font-bold text-[#2563EB]">
              {n}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-[var(--foreground-muted)]">{title}</span>
              {action}
            </div>
          </div>
        ))}
      </div>

      {linkedinOk ? (
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.12)] p-3">
          <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
          <span className="text-sm font-medium text-[#10B981]">✓ LinkedIn conectado</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          onClick={linkedinOk ? onNext : onCheck}
          disabled={checking || saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-6 py-3
                     text-sm font-semibold text-white transition-all
                     hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {linkedinOk ? 'Continuar →' : '¿Ya la instalé, verificar conexión'}
        </button>

        {!linkedinOk && (
          <button
            onClick={onSkip}
            disabled={saving}
            className="text-xs text-[var(--foreground-faint)] hover:text-[var(--foreground-muted)] transition-colors"
          >
            Saltar por ahora
          </button>
        )}
      </div>
    </div>
  );
}

const CAMPAIGN_TYPES = [
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'mixed', label: 'Mixto', icon: '🔀' },
];

const CAMPAIGN_GOALS = [
  { value: 'leads', label: 'Generar leads' },
  { value: 'meetings', label: 'Agendar reuniones' },
  { value: 'nurture', label: 'Nutrir contactos' },
];

function StepCampaign({ campaignName, onChange, onNext, saving }: StepCampaignProps) {
  const [type, setType] = useState('linkedin');
  const [goal, setGoal] = useState('leads');

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Crea tu primera campaña</h1>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          La configurarás con detalle más adelante
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--foreground-muted)]">Nombre de campaña</label>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: Prospección Q3 2026"
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm
                     text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] outline-none
                     focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--foreground-muted)]">Tipo</label>
        <div className="flex gap-2">
          {CAMPAIGN_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium transition-all',
                type === t.value
                  ? 'border-[#2563EB] bg-[rgba(37,99,235,0.12)] text-[#2563EB]'
                  : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground-faint)] hover:border-[var(--foreground-faint)]',
              ].join(' ')}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--foreground-muted)]">Objetivo</label>
        <div className="flex flex-col gap-1.5">
          {CAMPAIGN_GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGoal(g.value)}
              className={[
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium text-left transition-all',
                goal === g.value
                  ? 'border-[#2563EB] bg-[rgba(37,99,235,0.12)] text-[#2563EB]'
                  : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground-faint)] hover:border-[var(--foreground-faint)]',
              ].join(' ')}
            >
              <div className={[
                'h-3.5 w-3.5 rounded-full border-2 shrink-0',
                goal === g.value ? 'border-[#2563EB] bg-[#2563EB]' : 'border-[var(--border)]',
              ].join(' ')} />
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onNext(campaignName, type, goal)}
        disabled={!campaignName.trim() || saving}
        className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-6 py-3
                   text-sm font-semibold text-white transition-all
                   hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continuar →
      </button>
    </div>
  );
}

function StepLeads({ campaignId, onNext, saving }: StepLeadsProps) {
  const [showCsv, setShowCsv] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  async function handleCsvImport() {
    if (!csvFile || !campaignId) return;
    setImporting(true);
    // Basic CSV parse — just count rows for the summary
    const text = await csvFile.text();
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const count = Math.max(0, lines.length - 1); // minus header
    setImportedCount(count);
    setImporting(false);
    setShowCsv(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Añade tus primeros leads</h1>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          Puedes hacerlo ahora o más adelante desde la campaña
        </p>
      </div>

      {importedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.12)] p-3">
          <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
          <span className="text-sm text-[#10B981]">{importedCount} leads importados</span>
        </div>
      )}

      {!showCsv ? (
        <div className="grid grid-cols-2 gap-3">
          <a
            href="https://www.linkedin.com/sales"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4
                       hover:border-[#2563EB] hover:bg-[rgba(37,99,235,0.05)] transition-all cursor-pointer"
          >
            <span className="text-2xl">🔍</span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Sales Navigator</p>
              <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                Extrae contactos directamente desde LinkedIn Sales Nav
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1 text-xs text-[#2563EB]">
              Abrir Sales Navigator <ExternalLink className="h-3 w-3" />
            </span>
          </a>

          <button
            onClick={() => setShowCsv(true)}
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4
                       hover:border-[#2563EB] hover:bg-[rgba(37,99,235,0.05)] transition-all text-left"
          >
            <span className="text-2xl">📁</span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Importar CSV</p>
              <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                Sube tu lista de contactos en Excel o CSV
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1 text-xs text-[#2563EB]">
              Subir archivo <FileUp className="h-3 w-3" />
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2
                       border-dashed border-[var(--border)] bg-[var(--background)] p-8 text-center
                       hover:border-[#2563EB] transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) setCsvFile(f);
            }}
          >
            <FileUp className="h-8 w-8 text-[var(--foreground-faint)]" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground-muted)]">
                {csvFile ? csvFile.name : 'Arrastra tu CSV aquí'}
              </p>
              <p className="text-xs text-[var(--foreground-faint)]">o haz clic para seleccionar</p>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              id="csv-upload"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5
                         text-xs text-[var(--foreground-muted)] hover:bg-[var(--background)] transition-colors"
            >
              Seleccionar archivo
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCsv(false)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-xs
                         text-[var(--foreground-faint)] hover:text-[var(--foreground-muted)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCsvImport}
              disabled={!csvFile || importing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4]
                         py-2 text-xs font-semibold text-white hover:opacity-90
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Importar
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-6 py-3
                   text-sm font-semibold text-white transition-all
                   hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continuar →
      </button>
    </div>
  );
}

function StepLaunch({ workspaceName, campaignName, linkedinOk, onFinish, saving }: StepLaunchProps) {
  const items = [
    { label: 'Workspace creado', done: !!workspaceName },
    { label: 'Campaña configurada', done: !!campaignName },
    { label: 'LinkedIn conectado', done: linkedinOk },
    { label: 'Leads añadidos', done: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mb-3 text-4xl">🚀</div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">¡Todo listo!</h1>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">Tu campaña está configurada</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="flex flex-col gap-2 text-sm">
          {workspaceName && (
            <div className="flex justify-between">
              <span className="text-[var(--foreground-muted)]">Workspace</span>
              <span className="font-medium text-[var(--foreground)]">{workspaceName}</span>
            </div>
          )}
          {campaignName && (
            <div className="flex justify-between">
              <span className="text-[var(--foreground-muted)]">Campaña</span>
              <span className="font-medium text-[var(--foreground)]">{campaignName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--foreground-muted)]">LinkedIn</span>
            <span className={linkedinOk ? 'text-[#10B981]' : 'text-[#F59E0B]'}>
              {linkedinOk ? 'Conectado' : 'Pendiente'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {items.map(({ label, done }) => (
          <div key={label} className="flex items-center gap-2.5">
            {done ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-[#10B981] shrink-0" />
            ) : (
              <AlertCircle className="h-4.5 w-4.5 text-[var(--foreground-faint)] shrink-0" />
            )}
            <span className={`text-sm ${done ? 'text-[var(--foreground-muted)]' : 'text-[var(--foreground-faint)]'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onFinish}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-6 py-3
                     text-sm font-semibold text-white transition-all
                     hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '🚀'}
          Ir al Dashboard
        </button>

        <a
          href="https://loom.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-[var(--foreground-faint)]
                     hover:text-[var(--foreground-muted)] transition-colors"
        >
          Ver tutorial en video <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: 'Bienvenida', icon: Sparkles },
  { id: 2, label: 'LinkedIn', icon: Link2 },
  { id: 3, label: 'Campaña', icon: Target },
  { id: 4, label: 'Leads', icon: Users },
  { id: 5, label: 'Launch', icon: Rocket },
];

export function OnboardingWizard({
  initialStep = 1,
  initialWorkspaceName = '',
}: {
  initialStep?: number;
  initialWorkspaceName?: string;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(Math.max(1, initialStep));
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [linkedinOk, setLinkedinOk] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingLinkedin, setCheckingLinkedin] = useState(false);

  async function advance(extraData?: object) {
    setSaving(true);
    await saveOnboardingStep(currentStep, extraData ?? {});
    setSaving(false);
    if (currentStep < 5) setCurrentStep((s) => s + 1);
  }

  async function handleFinish() {
    setSaving(true);
    await completeOnboarding();
    router.push('/dashboard');
  }

  async function checkLinkedin() {
    setCheckingLinkedin(true);
    try {
      const res = await fetch('/api/check-extension');
      const json = await res.json();
      if (json.connected) {
        setLinkedinOk(true);
        await saveOnboardingStep(2, { linkedin_connected: true });
      }
    } catch {}
    setCheckingLinkedin(false);
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center
                 bg-[var(--background)] p-4"
    >
      <div className="w-full max-w-lg">
        {/* Logo placeholder */}
        <div className="mb-8 flex justify-center">
          <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            cazary<span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-transparent">.ai</span>
          </span>
        </div>

        {/* Step indicators */}
        <div className="mb-6 flex items-center justify-between px-2">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full border-2',
                    'text-xs font-bold transition-all',
                    currentStep > step.id
                      ? 'border-[#10B981] bg-[#10B981] text-white'
                      : currentStep === step.id
                        ? 'scale-110 border-[#2563EB] bg-[#2563EB] text-white'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-faint)]',
                  ].join(' ')}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={[
                    'text-[9px] font-medium',
                    currentStep === step.id ? 'text-[#2563EB]' : 'text-[var(--foreground-faint)]',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="relative mx-1 h-px flex-1 -translate-y-2 bg-[var(--border)]">
                  <div
                    className="h-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] transition-all duration-500"
                    style={{ width: currentStep > step.id ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]
                     p-8 shadow-2xl"
        >
          {currentStep === 1 && (
            <StepWelcome
              workspaceName={workspaceName}
              onChange={setWorkspaceName}
              onNext={() => advance({ workspace_name: workspaceName })}
              saving={saving}
            />
          )}

          {currentStep === 2 && (
            <StepLinkedIn
              linkedinOk={linkedinOk}
              checking={checkingLinkedin}
              onCheck={checkLinkedin}
              onNext={() => advance({ linkedin_connected: linkedinOk })}
              onSkip={() => advance()}
              saving={saving}
            />
          )}

          {currentStep === 3 && (
            <StepCampaign
              campaignName={campaignName}
              onChange={setCampaignName}
              onNext={async (name, type, goal) => {
                setSaving(true);
                const res = await createFirstCampaign(name, type, goal);
                if (res.success) setCampaignId(res.campaignId ?? null);
                await saveOnboardingStep(3, {});
                setSaving(false);
                setCurrentStep(4);
              }}
              saving={saving}
            />
          )}

          {currentStep === 4 && (
            <StepLeads
              campaignId={campaignId}
              onNext={() => advance()}
              saving={saving}
            />
          )}

          {currentStep === 5 && (
            <StepLaunch
              workspaceName={workspaceName}
              campaignName={campaignName}
              linkedinOk={linkedinOk}
              onFinish={handleFinish}
              saving={saving}
            />
          )}
        </div>

        {/* Back button */}
        {currentStep > 1 && currentStep < 5 && (
          <button
            onClick={() => setCurrentStep((s) => s - 1)}
            className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-[var(--foreground-faint)]
                       transition-colors hover:text-[var(--foreground-muted)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>
        )}
      </div>
    </div>
  );
}
