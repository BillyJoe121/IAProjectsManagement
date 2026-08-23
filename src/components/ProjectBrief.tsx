import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, FileText, Trash2, Upload, X } from 'lucide-react';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';
import { OperationsService } from '../services/operationsService';
import { StorageService } from '../services/storageService';
import { PdfPagePreview } from './DocumentPagePreview';

export const ProjectBrief: React.FC<{ project: Project; onChanged: () => void }> = ({ project, onChanged }) => {
  const { role } = useAuth();
  const canManage = role === 'superuser';
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!open || !project.briefStoragePath) return; void StorageService.createSignedUrl('project-briefs', project.briefStoragePath).then(setUrl).catch(() => setError('No fue posible abrir el Brief.')); }, [open, project.briefStoragePath]);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const stored = await StorageService.uploadBrief(project.id, file);
      OperationsService.setProjectBrief(project.id, { briefFileName: file.name, briefStoragePath: stored.path, briefUploadedAt: new Date().toISOString() });
      onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible cargar el Brief.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const remove = async () => {
    if (!project.briefStoragePath || !window.confirm('¿Eliminar el Brief actual? Esta acción no se puede deshacer.')) return;
    setBusy(true); setError('');
    try {
      await StorageService.deleteBrief(project.briefStoragePath);
      OperationsService.setProjectBrief(project.id, { briefFileName: undefined, briefStoragePath: undefined, briefUploadedAt: undefined });
      setOpen(false); setUrl(undefined); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible eliminar el Brief.'); }
    finally { setBusy(false); }
  };

  return <>
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 sm:flex-nowrap">
      <FileText className="h-4 w-4 shrink-0 text-[#0D9488]" />
      <div className="min-w-[10rem] flex-1"><p className="truncate text-sm font-bold text-[#0E2C40]">Brief del proyecto</p><p className="truncate text-[11px] text-slate-500">{project.briefFileName || 'Pendiente de cargar'}</p></div>
      {project.briefStoragePath && <button type="button" onClick={() => { setError(''); setUrl(undefined); setOpen(true); }} className="rounded-lg p-1.5 text-[#0D9488] hover:bg-teal-50" aria-label="Previsualizar Brief"><Eye className="h-4 w-4" /></button>}
      {canManage && <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Cargar Brief"><Upload className="h-4 w-4" /></button>}
      {canManage && project.briefStoragePath && <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" aria-label="Eliminar Brief"><Trash2 className="h-4 w-4" /></button>}
      <input ref={inputRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => void upload(event.target.files?.[0])} />
    </div>
    {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}
    {open && createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Brief del proyecto">
      <section className="flex h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[min(900px,calc(100vh-2rem))] sm:rounded-2xl">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 sm:flex-nowrap sm:px-5 sm:py-4"><div className="min-w-0 flex-1"><h2 className="text-base font-extrabold text-[#0E2C40]">Brief del proyecto</h2><p className="truncate text-xs text-slate-500">{project.briefFileName}</p></div><div className="flex shrink-0 gap-2">{url && <a href={url} download={project.briefFileName || 'brief.pdf'} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#0D9488] px-3 py-2 text-xs font-bold text-white"><Download className="h-4 w-4" /><span className="sm:hidden">PDF</span><span className="hidden sm:inline">Descargar PDF</span></a>}<button onClick={() => setOpen(false)} className="min-h-10 min-w-10 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button></div></header>
        <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">{url ? <PdfPagePreview title="Previsualización del Brief" url={url} /> : <div className="grid h-full place-items-center text-sm text-slate-500">Cargando Brief…</div>}</div>
      </section>
    </div>, document.body)}
  </>;
};
