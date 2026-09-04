import type { Project, ProjectIssue, ProjectMeeting } from '../types';

export interface WeeklyProjectSummary {
  project: Project;
  meetings: number;
  completedMeetings: number;
  createdIssues: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  meetings: number;
  completedMeetings: number;
  createdIssues: number;
  projects: WeeklyProjectSummary[];
  mostFollowed: WeeklyProjectSummary[];
  withoutMeetings: WeeklyProjectSummary[];
}

interface BuildWeeklyReportInput {
  projects: Project[];
  meetings: ProjectMeeting[];
  issues: ProjectIssue[];
  referenceDate?: Date;
}

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const startOfWeek = (referenceDate: Date) => {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

const dateInWeek = (value: string, weekStart: string, weekEnd: string) => {
  const day = value.slice(0, 10);
  return day >= weekStart && day <= weekEnd;
};

const meetingHasWeeklyActivity = (meeting: ProjectMeeting, weekStart: string, weekEnd: string) =>
  [meeting.startsAt, meeting.createdAt, meeting.updatedAt]
    .filter((value): value is string => Boolean(value))
    .some((value) => dateInWeek(value, weekStart, weekEnd));

export const buildWeeklyReport = ({
  projects,
  meetings,
  issues,
  referenceDate = new Date(),
}: BuildWeeklyReportInput): WeeklyReport => {
  const start = startOfWeek(referenceDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const weekStart = localDateKey(start);
  const weekEnd = localDateKey(end);
  const weeklyMeetings = meetings.filter((meeting) => meetingHasWeeklyActivity(meeting, weekStart, weekEnd));
  const completedMeetings = weeklyMeetings.filter((meeting) => meeting.status === 'realizada');
  const createdIssues = issues.filter((issue) =>
    [issue.createdAt, issue.updatedAt].some((value) => dateInWeek(value, weekStart, weekEnd)),
  );
  const summaries = projects.map((project) => ({
    project,
    meetings: weeklyMeetings.filter((meeting) => meeting.projectId === project.id).length,
    completedMeetings: completedMeetings.filter((meeting) => meeting.projectId === project.id).length,
    createdIssues: createdIssues.filter((issue) => issue.projectId === project.id).length,
  }));

  return {
    weekStart,
    weekEnd,
    meetings: weeklyMeetings.length,
    completedMeetings: completedMeetings.length,
    createdIssues: createdIssues.length,
    projects: summaries,
    mostFollowed: summaries
      .filter((summary) => summary.completedMeetings > 0)
      .sort((first, second) => second.completedMeetings - first.completedMeetings),
    withoutMeetings: summaries.filter((summary) => summary.meetings === 0),
  };
};
