import { MeetingStatus, ProjectIssue, ProjectMeeting, ProjectTask, TaskPriority } from '../types';

export const isTaskOverdue = (task: ProjectTask, today = new Date().toISOString().slice(0, 10)): boolean =>
  Boolean(task.dueDate && task.dueDate < today && task.status !== 'completada');

export const needsMonitorAttention = (issue: ProjectIssue): boolean => issue.status !== 'resuelta';

export const meetingNeedsMinute = (meeting: ProjectMeeting): boolean => meeting.status === 'realizada' && !meeting.minuteId;

export const canChangeMeetingTo = (from: MeetingStatus, to: MeetingStatus): boolean => {
  if (from === 'cancelada' || from === 'no_realizada') return to === 'reprogramada';
  if (from === 'realizada') return false;
  return from !== to;
};

export const priorityLabel: Record<TaskPriority, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica'
};
