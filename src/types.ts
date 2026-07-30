export interface CleaningTask {
  id: string;
  name: string;
  description: string;
  shift: 1 | 2;
  shiftLabel: string;
  estimatedTime: string;
}

export interface WeekAssignment {
  weekId: string; // e.g. "2026-09-05"
  dateStr: string; // e.g. "Saturday, September 5, 2026"
  monthId: string; // e.g. "2026-09"
  // Map of taskId to signed up volunteer's name. If null/empty, it is available.
  signups: { [taskId: string]: string | null };
}

export interface MonthOption {
  id: string; // e.g. "2026-09"
  name: string; // e.g. "September"
  year: number;
  monthNum: number; // 1-based (3, 6, 9, 12)
  saturdays: Array<{
    id: string; // "2026-09-05"
    dateStr: string; // "Saturday, September 5, 2026"
    dateNum: number;
    dayName: string; // "SAT"
    label: string; // "Week 1: Sept 5"
    isoDate: string; // "20260905"
  }>;
}

export interface SummarySelection {
  volunteerName: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  dateStr: string;
  timeStr: string;
  isoDate: string; // YYYYMMDD
  shift: 1 | 2;
}
