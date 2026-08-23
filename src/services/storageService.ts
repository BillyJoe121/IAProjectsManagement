import { supabaseClient } from './supabaseClient';
import { SyncService } from './syncService';

const LOCAL_FILES_KEY = 'ia_hub_private_files';
const MAX_TRANSCRIPT_BYTES = 2_000_000;
const MAX_SOURCE_BYTES = 15_000_000;
const MAX_BRIEF_BYTES = 15_000_000;
type LocalFile = { path: string; projectId: string; name: string; type: string; text: string; createdAt: string };
export interface StoredFile { path: string; signedUrl?: string; mode: 'local' | 'supabase'; }
export type ProjectStorageBucket = 'project-transcripts' | 'project-documents' | 'project-source-files' | 'project-briefs';

const safeName = (name: string) => name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'archivo.txt';
const readLocal = (): LocalFile[] => { try { return JSON.parse(localStorage.getItem(LOCAL_FILES_KEY) || '[]'); } catch { return []; } };
const verifyProjectAccess = async (projectId: string) => {
  if (!supabaseClient) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabaseClient.rpc('can_access_project', { target_project_id: projectId });
  if (error || !data) throw new Error('No tienes acceso al almacenamiento de este proyecto.');
};

export const StorageService = {
  deleteBrief: async (path: string) => {
    if (!SyncService.isRemoteMode()) return;
    if (!supabaseClient) throw new Error('Supabase no está configurado.');
    const { error } = await supabaseClient.storage.from('project-briefs').remove([path]);
    if (error) throw error;
  },
  uploadBrief: async (projectId: string, file: File): Promise<StoredFile> => {
    if (file.type !== 'application/pdf' || !/\.pdf$/i.test(file.name)) throw new Error('El Brief debe ser un archivo PDF.');
    if (!file.size || file.size > MAX_BRIEF_BYTES) throw new Error('El Brief debe pesar entre 1 byte y 15 MB.');
    const path = `${projectId}/${Date.now()}-${safeName(file.name)}`;
    if (!SyncService.isRemoteMode()) return { path, mode: 'local' };
    if (!supabaseClient) throw new Error('Supabase no está configurado.');
    const { error } = await supabaseClient.storage.from('project-briefs').upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (error) throw error;
    const { data, error: signedError } = await supabaseClient.storage.from('project-briefs').createSignedUrl(path, 900);
    if (signedError) throw signedError;
    return { path, signedUrl: data.signedUrl, mode: 'supabase' };
  },
  uploadTranscript: async (projectId: string, file: File): Promise<StoredFile> => {
    if (!/\.(txt|vtt)$/i.test(file.name) || !['text/plain', 'text/vtt', ''].includes(file.type)) throw new Error('Sólo se admiten transcripciones TXT o VTT.');
    if (!file.size || file.size > MAX_TRANSCRIPT_BYTES) throw new Error('La transcripción debe pesar entre 1 byte y 2 MB.');
    const path = `${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    if (!SyncService.isRemoteMode()) {
      const item: LocalFile = { path, projectId, name: file.name, type: file.type || 'text/plain', text: await file.text(), createdAt: new Date().toISOString() };
      localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify([item, ...readLocal()]));
      return { path, mode: 'local' };
    }
    await verifyProjectAccess(projectId);
    const { error } = await supabaseClient!.storage.from('project-transcripts').upload(path, file, { contentType: file.type || 'text/plain', upsert: false });
    if (error) throw error;
    const { data, error: signedError } = await supabaseClient!.storage.from('project-transcripts').createSignedUrl(path, 900);
    if (signedError) throw signedError;
    return { path, signedUrl: data.signedUrl, mode: 'supabase' };
  },
  uploadGeneratedDocument: async (projectId: string, documentId: string, file: Blob, extension: 'pdf' | 'docx'): Promise<StoredFile> => {
    const path = `${projectId}/${documentId}/v-${Date.now()}.${extension}`;
    if (!SyncService.isRemoteMode()) return { path, mode: 'local' };
    await verifyProjectAccess(projectId);
    const contentType = extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const { error } = await supabaseClient!.storage.from('project-documents').upload(path, file, { contentType, upsert: false });
    if (error) throw error;
    const { data, error: signedError } = await supabaseClient!.storage.from('project-documents').createSignedUrl(path, 900);
    if (signedError) throw signedError;
    return { path, signedUrl: data.signedUrl, mode: 'supabase' };
  },
  uploadSourceFile: async (projectId: string, file: File, extractedText = ''): Promise<StoredFile> => {
    if (!/\.(pdf|docx|txt|vtt)$/i.test(file.name)) throw new Error('Sólo se admiten fuentes PDF, DOCX, TXT o VTT.');
    if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error('El archivo fuente debe pesar entre 1 byte y 15 MB.');
    const path = `${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    if (!SyncService.isRemoteMode()) {
      const item: LocalFile = { path, projectId, name: file.name, type: file.type || 'application/octet-stream', text: extractedText, createdAt: new Date().toISOString() };
      localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify([item, ...readLocal()]));
      return { path, mode: 'local' };
    }
    await verifyProjectAccess(projectId);
    const { error } = await supabaseClient!.storage.from('project-source-files').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    return { path, mode: 'supabase' };
  },
  download: async (bucket: ProjectStorageBucket, path: string): Promise<Blob | undefined> => {
    if (!SyncService.isRemoteMode()) {
      const item = readLocal().find((file) => file.path === path);
      return item ? new Blob([item.text], { type: item.type || 'text/plain' }) : undefined;
    }
    if (!supabaseClient) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabaseClient.storage.from(bucket).download(path);
    if (error) throw error;
    return data;
  },
  createSignedUrl: async (bucket: ProjectStorageBucket, path: string, expiresIn = 900) => {
    if (!SyncService.isRemoteMode()) return undefined;
    const { data, error } = await supabaseClient!.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },
  getLocalText: (path: string) => readLocal().find((item) => item.path === path)?.text,
};
