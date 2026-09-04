import { describe, expect, it } from 'vitest';
import { buildWeeklyReport } from './weeklyReport';
import type { Project, ProjectIssue, ProjectMeeting } from '../types';

const projects: Project[] = [
  { id: 'alpha', code: 'ALPHA', companyName: 'Empresa A', title: 'Alpha', progressPct: 0, riskLevel: 'verde', minStudents: 1, maxStudents: 4, contacts: [], assignedStudents: [], aiType: [], complexityRating: 5, lastActivityAt: '2026-09-01T00:00:00' },
  { id: 'beta', code: 'BETA', companyName: 'Empresa B', title: 'Beta', progressPct: 0, riskLevel: 'verde', minStudents: 1, maxStudents: 4, contacts: [], assignedStudents: [], aiType: [], complexityRating: 5, lastActivityAt: '2026-09-01T00:00:00' },
  { id: 'gamma', code: 'GAMMA', companyName: 'Empresa C', title: 'Gamma', progressPct: 0, riskLevel: 'verde', minStudents: 1, maxStudents: 4, contacts: [], assignedStudents: [], aiType: [], complexityRating: 5, lastActivityAt: '2026-09-01T00:00:00' },
];

const meeting = (projectId: string, startsAt: string, status: ProjectMeeting['status'], patch: Partial<ProjectMeeting> = {}): ProjectMeeting => ({
  id: `${projectId}-${startsAt}-${status}`,
  projectId,
  title: 'Seguimiento',
  startsAt,
  durationMinutes: 45,
  attendees: [],
  status,
  calendarSync: 'simulado',
  createdAt: startsAt,
  ...patch,
});
const issue = (projectId: string, createdAt: string): ProjectIssue => ({
  id: `${projectId}-${createdAt}`,
  projectId,
  title: 'Bloqueo',
  description: 'Detalle',
  category: 'tecnico',
  priority: 'media',
  status: 'abierta',
  reportedBy: 'Equipo',
  createdAt,
  updatedAt: createdAt,
});

describe('buildWeeklyReport', () => {
  it('uses Monday through Sunday and counts only meetings actually held as weekly follow-up', () => {
    const report = buildWeeklyReport({
      projects,
      meetings: [
        meeting('alpha', '2026-09-07T09:00:00', 'realizada'),
        meeting('alpha', '2026-09-09T09:00:00', 'realizada'),
        meeting('beta', '2026-09-10T09:00:00', 'programada'),
        meeting('beta', '2026-09-13T09:00:00', 'cancelada'),
        meeting('gamma', '2026-09-14T09:00:00', 'realizada'),
      ],
      issues: [issue('alpha', '2026-09-07T12:00:00'), issue('beta', '2026-09-13T12:00:00'), issue('gamma', '2026-09-14T12:00:00')],
      referenceDate: new Date(2026, 8, 9, 12),
    });

    expect(report.weekStart).toBe('2026-09-07');
    expect(report.weekEnd).toBe('2026-09-13');
    expect(report.completedMeetings).toBe(2);
    expect(report.createdIssues).toBe(2);
    expect(report.mostFollowed.map((item) => item.project.id)).toEqual(['alpha']);
    expect(report.withoutMeetings.map((item) => item.project.id)).toEqual(['gamma']);
  });

  it('returns zeroes and keeps every project in the no-meetings group when the week has no activity', () => {
    const report = buildWeeklyReport({
      projects,
      meetings: [meeting('alpha', '2026-09-01T09:00:00', 'realizada')],
      issues: [issue('beta', '2026-09-15T12:00:00')],
      referenceDate: new Date(2026, 8, 9, 12),
    });

    expect(report.completedMeetings).toBe(0);
    expect(report.createdIssues).toBe(0);
    expect(report.mostFollowed).toEqual([]);
    expect(report.withoutMeetings.map((item) => item.project.id)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('includes meetings updated during the selected week, even when they were scheduled earlier', () => {
    const report = buildWeeklyReport({
      projects,
      meetings: [
        meeting('alpha', '2026-08-20T09:00:00', 'realizada', { updatedAt: '2026-09-09T10:00:00' }),
        meeting('beta', '2026-09-10T09:00:00', 'programada'),
      ],
      issues: [],
      referenceDate: new Date(2026, 8, 9, 12),
    });

    expect(report.meetings).toBe(2);
    expect(report.completedMeetings).toBe(1);
    expect(report.projects.find((item) => item.project.id === 'alpha')?.meetings).toBe(1);
    expect(report.projects.find((item) => item.project.id === 'beta')?.meetings).toBe(1);
    expect(report.withoutMeetings.map((item) => item.project.id)).toEqual(['gamma']);
  });
});
