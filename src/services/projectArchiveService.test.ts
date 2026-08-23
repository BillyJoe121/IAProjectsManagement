import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { buildProjectArchivePlan, ProjectArchiveService } from './projectArchiveService';
import { StorageService } from './storageService';
import { MeetingMinute, Project, ProjectDocument } from '../types';

const project: Project = {
  id: 'project-1', code: 'PMO', companyName: 'Coomeva', title: 'Asistente de proyectos', progressPct: 25,
  riskLevel: 'verde', minStudents: 2, maxStudents: 5, contacts: [], assignedStudents: [], aiType: ['IA'], complexityRating: 5,
  resourceLinks: [{ id: 'link-1', label: 'Tablero', url: 'https://example.com/tablero' }],
  briefFileName: 'brief.pdf', briefStoragePath: 'project-1/brief.pdf', lastActivityAt: '2026-08-22T00:00:00Z',
};

const minute: MeetingMinute = {
  id: 'minute-1', projectId: project.id, projectTitle: project.title, meetingDate: '2026-08-20', title: 'Acta semanal', summary: 'Avances',
  decisions: [], commitments: [], transcriptStoragePath: 'project-1/reunion.txt', uploadedBy: 'Ana', createdAt: '2026-08-20T00:00:00Z',
};

const document: ProjectDocument = {
  id: 'document-1', projectId: project.id, templateId: 'acta', title: 'Acta de reunión', status: 'aprobado', version: 2,
  generatedBy: 'Ana', htmlPreview: '<h1>Acta</h1>', documentType: 'acta_reunion', pdfStoragePath: 'project-1/document-1/v-2.pdf',
  sourceFiles: [{ name: 'reunion.txt', mimeType: 'text/plain', size: 30, storagePath: 'project-1/fuente.txt', extractedChars: 30 }],
  createdAt: '2026-08-20T00:00:00Z', updatedAt: '2026-08-20T00:00:00Z',
};

describe('buildProjectArchivePlan', () => {
  it('ordena todos los archivos de un proyecto en la estructura institucional', () => {
    const plan = buildProjectArchivePlan([project], [minute], [document]);

    expect(plan.rootFolder).toBe('Proyectos');
    expect(plan.projects).toEqual([expect.objectContaining({
      folder: 'PMO - Asistente-de-proyectos',
      brief: expect.objectContaining({ bucket: 'project-briefs', path: 'project-1/brief.pdf' }),
      transcripts: [expect.objectContaining({ bucket: 'project-transcripts', path: 'project-1/reunion.txt' })],
      documents: [expect.objectContaining({ folder: 'Actas', bucket: 'project-documents', path: 'project-1/document-1/v-2.pdf' })],
      sources: [expect.objectContaining({ bucket: 'project-source-files', path: 'project-1/fuente.txt' })],
    })]);
  });

  it('genera un único ZIP con todos los proyectos y sus archivos', async () => {
    const secondProject: Project = { ...project, id: 'project-2', code: 'CVE', title: 'Contexto comercial', briefFileName: undefined, briefStoragePath: undefined };
    vi.spyOn(StorageService, 'download').mockImplementation(async (_bucket, path) => new Blob([`contenido ${path}`], { type: 'text/plain' }));

    const result = await ProjectArchiveService.exportAll([project, secondProject], [minute], [document]);
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const names = Object.keys(zip.files);

    expect(result.fileName).toMatch(/^Proyectos-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(names).toContain('Proyectos/PMO - Asistente-de-proyectos/Información del proyecto/brief.pdf');
    expect(names).toContain('Proyectos/PMO - Asistente-de-proyectos/Transcripciones/reunion.txt');
    expect(names).toContain('Proyectos/PMO - Asistente-de-proyectos/Actas/Acta-de-reunion-v2.pdf');
    expect(names).toContain('Proyectos/CVE - Contexto-comercial/Enlaces/enlaces.txt');
  });
});
