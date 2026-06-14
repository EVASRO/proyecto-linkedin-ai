'use client';

import { useState, useRef, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, FileUp, UploadCloud, X, XCircle } from 'lucide-react';
import { importLeadsFromCsv } from '@/app/dashboard/campanas/actions';

export interface SegmentImportProps {
  segmentId: string;
  campaignId: string;
  onImportComplete?: (count: number) => void;
  onClose?: () => void;
}

type Step = 'upload' | 'preview' | 'result';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';

  // Simple CSV parser that handles quoted fields
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if ((ch === '"' || ch === "'") && !inQuote) { inQuote = true; continue; }
      if ((ch === '"' || ch === "'") && inQuote)  { inQuote = false; continue; }
      if (ch === sep && !inQuote) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  return lines
    .slice(1)
    .map((line) => {
      const values = splitLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    })
    .filter((row) => Object.values(row).some((v) => v.trim()));
}

export function SegmentImport({ segmentId, campaignId, onImportComplete, onClose }: SegmentImportProps) {
  const [step, setStep]         = useState<Step>('upload');
  const [rawRows, setRawRows]   = useState<Record<string, string>[]>([]);
  const [headers, setHeaders]   = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult]     = useState<{ imported: number; duplicates: number; errors: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        alert('No se detectaron filas válidas. Verifica que el archivo tenga encabezados en la primera línea.');
        return;
      }
      setHeaders(Object.keys(rows[0]));
      setRawRows(rows);
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImport() {
    setImporting(true);
    const res = await importLeadsFromCsv(rawRows, segmentId, campaignId);
    if (res.success) {
      setResult({ imported: res.imported, duplicates: res.duplicates, errors: res.errors });
      setStep('result');
      onImportComplete?.(res.imported);
    } else {
      alert(`Error al importar: ${res.error}`);
    }
    setImporting(false);
  }

  function reset() {
    setStep('upload');
    setRawRows([]);
    setHeaders([]);
    setFileName('');
    setResult(null);
  }

  const previewRows = rawRows.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* -- STEP: upload -- */}
      {step === 'upload' && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={[
              'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
              dragOver
                ? 'border-[#2563EB] bg-[rgba(37,99,235,0.08)]'
                : 'border-[var(--border)] hover:border-[#2563EB] hover:bg-[rgba(37,99,235,0.05)]',
            ].join(' ')}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(37,99,235,0.12)]">
              <UploadCloud className="h-6 w-6 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Arrastra tu archivo o <span className="text-[#2563EB] underline">haz clic para seleccionarlo</span>
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-faint)]">CSV o Excel (.csv, .xlsx, .xls) — máx. 10,000 filas</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-faint)]">
              Columnas soportadas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['nombre / first_name', 'apellido / last_name', 'email', 'empresa / company',
                'cargo / title', 'teléfono / phone', 'linkedin_url'].map((col) => (
                <span key={col} className="rounded-full bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--foreground-muted)]">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* -- STEP: preview -- */}
      {step === 'preview' && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[rgba(37,99,235,0.08)] px-4 py-3">
            <FileUp className="h-4 w-4 flex-shrink-0 text-[#2563EB]" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">{fileName}</p>
              <p className="text-[10px] text-[var(--foreground-muted)]">{rawRows.length} filas detectadas</p>
            </div>
            <button onClick={reset} className="text-[var(--foreground-faint)] hover:text-[var(--foreground-muted)] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-faint)]">
              Vista previa — primeras {previewRows.length} filas
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                    {headers.slice(0, 8).map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-faint)] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    {headers.length > 8 && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-[var(--foreground-faint)]">
                        +{headers.length - 8} más
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {previewRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-[rgba(255,255,255,0.02)]' : ''}>
                      {headers.slice(0, 8).map((h) => (
                        <td key={h} className="max-w-[180px] truncate px-3 py-2 text-[var(--foreground-muted)]">
                          {row[h] || <span className="text-[var(--foreground-faint)]">—</span>}
                        </td>
                      ))}
                      {headers.length > 8 && <td className="px-3 py-2 text-[var(--foreground-faint)]">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={reset}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              ✕ Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-5 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-opacity"
            >
              {importing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Importando...
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" />
                  Importar {rawRows.length} leads →
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* -- STEP: result -- */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(16,185,129,0.12)]">
              <CheckCircle2 className="h-7 w-7 text-[#10B981]" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-[var(--foreground)]">Importación completada</p>
              <p className="mt-0.5 text-xs text-[var(--foreground-faint)]">Los leads han sido añadidos al segmento</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[rgba(16,185,129,0.08)] p-4">
              <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
              <p className="text-2xl font-black tabular-nums text-[#10B981]">{result.imported}</p>
              <p className="text-[10px] font-medium text-[#10B981]">importados</p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[rgba(245,158,11,0.08)] p-4">
              <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
              <p className="text-2xl font-black tabular-nums text-[#F59E0B]">{result.duplicates}</p>
              <p className="text-[10px] font-medium text-[#F59E0B]">duplicados</p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[rgba(239,68,68,0.08)] p-4">
              <XCircle className="h-5 w-5 text-[#EF4444]" />
              <p className="text-2xl font-black tabular-nums text-[#EF4444]">{result.errors}</p>
              <p className="text-[10px] font-medium text-[#EF4444]">errores</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={reset}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              Importar otro archivo
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
