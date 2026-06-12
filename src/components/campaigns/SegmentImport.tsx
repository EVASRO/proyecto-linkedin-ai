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
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-zinc-300 hover:border-indigo-400 hover:bg-indigo-50/50',
            ].join(' ')}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
              <UploadCloud className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">
                Arrastra tu archivo o <span className="text-indigo-600 underline">haz clic para seleccionarlo</span>
              </p>
              <p className="mt-1 text-xs text-zinc-400">CSV o Excel (.csv, .xlsx, .xls) — máx. 10,000 filas</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Columnas soportadas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['nombre / first_name', 'apellido / last_name', 'email', 'empresa / company',
                'cargo / title', 'teléfono / phone', 'linkedin_url'].map((col) => (
                <span key={col} className="rounded-full bg-white border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
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
          <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <FileUp className="h-4 w-4 flex-shrink-0 text-indigo-500" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-indigo-800">{fileName}</p>
              <p className="text-[10px] text-indigo-500">{rawRows.length} filas detectadas</p>
            </div>
            <button onClick={reset} className="text-indigo-400 hover:text-indigo-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Vista previa — primeras {previewRows.length} filas
            </p>
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    {headers.slice(0, 8).map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    {headers.length > 8 && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-zinc-300">
                        +{headers.length - 8} más
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {previewRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-zinc-50/50' : ''}>
                      {headers.slice(0, 8).map((h) => (
                        <td key={h} className="max-w-[180px] truncate px-3 py-2 text-zinc-700">
                          {row[h] || <span className="text-zinc-300">—</span>}
                        </td>
                      ))}
                      {headers.length > 8 && <td className="px-3 py-2 text-zinc-300">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={reset}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              ✕ Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-zinc-900">Importación completada</p>
              <p className="mt-0.5 text-xs text-zinc-400">Los leads han sido añadidos al segmento</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 rounded-xl border border-green-100 bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-2xl font-black tabular-nums text-green-700">{result.imported}</p>
              <p className="text-[10px] font-medium text-green-600">importados</p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-amber-100 bg-amber-50 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-2xl font-black tabular-nums text-amber-700">{result.duplicates}</p>
              <p className="text-[10px] font-medium text-amber-600">duplicados</p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-red-100 bg-red-50 p-4">
              <XCircle className="h-5 w-5 text-red-400" />
              <p className="text-2xl font-black tabular-nums text-red-600">{result.errors}</p>
              <p className="text-[10px] font-medium text-red-500">errores</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={reset}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Importar otro archivo
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
