import JSZip from 'jszip';
import { MeetingMinute, Project, ProjectDocument } from '../types';
import { ProjectStorageBucket, StorageService } from './storageService';

type StoredEntry = { bucket: ProjectStorageBucket; path: string; name: string; folder: string };
type PlannedProject = {
  project: Project;
  folder: string;
  brief?: StoredEntry;
  transcripts: StoredEntry[];
  documents: StoredEntry[];
  sources: StoredEntry[];
  htmlDocuments: { folder: string; name: string; html: string }[];
};

export type ProjectArchivePlan = { rootFolder: 'Proyectos'; projects: PlannedProject[] };
export type ProjectArchiveResult = { blob: Blob; fileName: string; warnings: string[] };

const safeSegment = (value: string, fallback: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 100) || fallback;

const fileNameFromPath = (path: string, fallback: string) => safeSegment(path.split('/').pop() || fallback, fallback);
const documentFolder = (document: ProjectDocument) => document.documentType === 'acta_reunion' ? 'Actas' : 'Información del proyecto';
const documentName = (document: ProjectDocument, extension: string) => `${safeSegment(document.title, 'documento')}-v${document.version}.${extension}`;

export const buildProjectArchivePlan = (projects: Project[], minutes: MeetingMinute[], documents: ProjectDocument[]): ProjectArchivePlan => ({
  rootFolder: 'Proyectos',
  projects: projects.map((project) => {
    const folder = `${safeSegment(project.code, 'PROYECTO')} - ${safeSegment(project.title, 'Sin-titulo')}`;
    const projectDocuments = documents.filter((document) => document.projectId === project.id);
    const usedDocumentPaths = new Set<string>();
    const plannedDocuments: StoredEntry[] = [];
    const htmlDocuments: PlannedProject['htmlDocuments'] = [];
    const sources: StoredEntry[] = [];

    for (const document of projectDocuments) {
      const folderName = documentFolder(document);
      const storagePath = document.pdfStoragePath || document.storagePath;
      if (storagePath && !usedDocumentPaths.has(storagePath)) {
        usedDocumentPaths.add(storagePath);
        const extension = /\.docx$/i.test(storagePath) ? 'docx' : 'pdf';
        plannedDocuments.push({ bucket: 'project-documents', path: storagePath, name: documentName(document, extension), folder: folderName });
      } else {
        htmlDocuments.push({ folder: folderName, name: documentName(document, 'html'), html: document.htmlPreview });
      }
      for (const source of document.sourceFiles || []) {
        sources.push({ bucket: 'project-source-files', path: source.storagePath, name: safeSegment(source.name, 'fuente'), folder: 'Información del proyecto/Fuentes' });
      }
    }

    const transcripts = minutes
      .filter((minute) => minute.projectId === project.id && minute.transcriptStoragePath)
      .map((minute) => ({
        bucket: 'project-transcripts' as const,
        path: minute.transcriptStoragePath!,
        name: fileNameFromPath(minute.transcriptStoragePath!, `${safeSegment(minute.title, 'transcripcion')}.txt`),
        folder: 'Transcripciones',
      }));

    return {
      project,
      folder,
      brief: project.briefStoragePath ? { bucket: 'project-briefs', path: project.briefStoragePath, name: safeSegment(project.briefFileName || 'brief.pdf', 'brief.pdf'), folder: 'Información del proyecto' } : undefined,
      transcripts,
      documents: plannedDocuments,
      sources,
      htmlDocuments,
    };
  }),
});

const textLinks = (project: Project) => {
  const links = [
    ['WhatsApp', project.whatsappUrl], ['Reunion', project.teamsMeetingUrl], ['Repositorio', project.githubUrl],
    ...((project.resourceLinks || []).map((link) => [link.label, link.url] as const)),
  ].filter(([, url]) => Boolean(url));
  return links.length ? links.map(([label, url]) => `${label}: ${url}`).join('\n') : 'No hay enlaces registrados para este proyecto.\n';
};

const projectSummary = (project: Project) => JSON.stringify({
  codigo: project.code,
  proyecto: project.title,
  empresa: project.companyName,
  reto: project.challengeDescription || null,
  avance: project.progressPct,
  riesgo: project.riskLevel,
  estudiantes: project.assignedStudents.map(({ name, email, code }) => ({ nombre: name, correo: email, codigo: code || null })),
  contactos: project.contacts,
  exportadoEn: new Date().toISOString(),
}, null, 2);

export const ProjectArchiveService = {
  buildPlan: buildProjectArchivePlan,
  exportAll: async (projects: Project[], minutes: MeetingMinute[], documents: ProjectDocument[]): Promise<ProjectArchiveResult> => {
    const plan = buildProjectArchivePlan(projects, minutes, documents);
    const zip = new JSZip();
    const warnings: string[] = [];
    const addedPaths = new Set<string>();

    const addStoredEntry = async (prefix: string, entry: StoredEntry) => {
      const identifier = `${entry.bucket}/${entry.path}`;
      if (addedPaths.has(identifier)) return;
      addedPaths.add(identifier);
      try {
        const file = await StorageService.download(entry.bucket, entry.path);
        if (!file) throw new Error('El archivo no está disponible en este dispositivo.');
        zip.file(`${prefix}/${entry.folder}/${entry.name}`, await file.arrayBuffer());
      } catch (error) {
        warnings.push(`${prefix}/${entry.folder}/${entry.name}: ${error instanceof Error ? error.message : 'no fue posible descargarlo'}`);
      }
    };

    for (const item of plan.projects) {
      const prefix = `${plan.rootFolder}/${item.folder}`;
      zip.file(`${prefix}/Enlaces/enlaces.txt`, textLinks(item.project));
      zip.file(`${prefix}/Resumen-del-proyecto.json`, projectSummary(item.project));
      if (item.brief) await addStoredEntry(prefix, item.brief);
      for (const entry of item.transcripts) await addStoredEntry(prefix, entry);
      for (const entry of item.documents) await addStoredEntry(prefix, entry);
      for (const entry of item.sources) await addStoredEntry(prefix, entry);
      for (const document of item.htmlDocuments) zip.file(`${prefix}/${document.folder}/${document.name}`, document.html);
    }

    if (warnings.length) zip.file(`${plan.rootFolder}/NOTAS-DE-EXPORTACION.txt`, `Algunos archivos no pudieron incluirse:\n\n${warnings.join('\n')}`);
    const date = new Date().toISOString().slice(0, 10);
    return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }), fileName: `Proyectos-${date}.zip`, warnings };
  },
  download: (result: ProjectArchiveResult) => {
    const url = URL.createObjectURL(result.blob);
    const link = window.document.createElement('a');
    link.href = url; link.download = result.fileName; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  },
};
