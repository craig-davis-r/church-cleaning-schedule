import { CleaningTask, MonthOption } from './types';

export const CLEANING_TASKS: CleaningTask[] = [
  // Shift 1
  {
    id: 'chapel-north',
    name: 'Chapel: north-side pews',
    description: 'Vacuum floor, aisle and benches',
    shift: 1,
    shiftLabel: 'Shift 1 - 8:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'chapel-south',
    name: 'Chapel: south-side pews',
    description: 'Vacuum floor, aisle and benches',
    shift: 1,
    shiftLabel: 'Shift 1 - 8:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'chapel-center',
    name: 'Chapel: center pews',
    description: 'Vacuum floor and benches',
    shift: 1,
    shiftLabel: 'Shift 1 - 8:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'entry-glass',
    name: 'Entryways: clean glass',
    description: 'Clean entryway glass doors and glass panels',
    shift: 1,
    shiftLabel: 'Shift 1 - 8:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'bath-sinks',
    name: 'Restrooms: clean sinks and mirrors',
    description: 'Clean sinks and mirrors',
    shift: 1,
    shiftLabel: 'Shift 1 - 8:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'bath-toilets',
    name: 'Restrooms: clean toilets',
    description: 'Sanitize toilet bowls, toilet seats, and surrounding areas',
    shift: 1,
    shiftLabel: 'Shift 1 - 8:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'cultural-spills',
    name: 'Cultural Hall: sweep and mop any spills',
    description: 'Sweep entire floor, focus-mop any spilled drinks or spots',
    shift: 1,
    shiftLabel: 'Shift 1 - 8:30 am',
    estimatedTime: 'Abt 30 min'
  },
  // Shift 2
  {
    id: 'hall-north',
    name: 'Hallway: north-side',
    description: 'Vacuum entryway, hallway, classrooms, mothers\' room',
    shift: 2,
    shiftLabel: 'Shift 2 - 9:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'hall-south',
    name: 'Hallway: south-side',
    description: 'Vacuum entryway, hallway, classrooms, stage',
    shift: 2,
    shiftLabel: 'Shift 2 - 9:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'hall-west',
    name: 'Hallway: west-side',
    description: 'Vacuum entryway, hallway, classrooms, RS and Primary rooms',
    shift: 2,
    shiftLabel: 'Shift 2 - 9:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'bath-kitchen-floors',
    name: 'Restrooms/Kitchen: sweep and mop floors',
    description: 'Sweep and mop tile floors in restrooms and kitchen areas',
    shift: 2,
    shiftLabel: 'Shift 2 - 9:30 am',
    estimatedTime: 'Abt 30 min'
  },
  {
    id: 'trash-empty',
    name: 'Trash: empty trash cans and replace liners',
    description: 'Empty all waste baskets and place clean liners in them',
    shift: 2,
    shiftLabel: 'Shift 2 - 9:30 am',
    estimatedTime: 'Abt 30 min'
  }
];

export function getSaturdaysInMonth(year: number, month1Based: number) {
  const saturdays = [];
  const d = new Date(year, month1Based - 1, 1);
  
  // Get first Saturday of the month
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  
  let weekIndex = 1;
  while (d.getMonth() === month1Based - 1) {
    const dateNum = d.getDate();
    const formattedNum = dateNum < 10 ? `0${dateNum}` : `${dateNum}`;
    const formattedMonth = month1Based < 10 ? `0${month1Based}` : `${month1Based}`;
    const id = `${year}-${formattedMonth}-${formattedNum}`;
    const isoDate = `${year}${formattedMonth}${formattedNum}`;
    
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    saturdays.push({
      id,
      dateStr: `Saturday, ${monthName} ${dateNum}, ${year}`,
      dateNum,
      dayName: 'SAT',
      label: `Week ${weekIndex}: ${monthName.substring(0, 3)} ${dateNum}`,
      isoDate
    });
    
    weekIndex++;
    d.setDate(d.getDate() + 7);
  }
  return saturdays;
}

export function getActiveMonths(baseDate: Date = new Date()): MonthOption[] {
  const activeMonthNumbers = [3, 6, 9, 12]; // March, June, September, December
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const options: MonthOption[] = [];
  let currentYear = baseDate.getFullYear();
  let currentMonth1Based = baseDate.getMonth() + 1;
  
  // Let's search forward month-by-month until we find 4 active months
  let checkYear = currentYear;
  let checkMonth = currentMonth1Based;
  
  // Note: if the current date is already in an active month, we should check if there are Saturdays remaining.
  // But generally, starting from the current month is standard.
  while (options.length < 4) {
    if (activeMonthNumbers.includes(checkMonth)) {
      const monthId = `${checkYear}-${checkMonth < 10 ? '0' + checkMonth : checkMonth}`;
      options.push({
        id: monthId,
        name: monthNames[checkMonth - 1],
        year: checkYear,
        monthNum: checkMonth,
        saturdays: getSaturdaysInMonth(checkYear, checkMonth)
      });
    }
    
    checkMonth++;
    if (checkMonth > 12) {
      checkMonth = 1;
      checkYear++;
    }
  }
  
  return options;
}

// Mock initial data to populate the applet so it does not look blank
export const MOCK_VOLUNTEER_NAMES = [
  'Emma Smith', 'David Johnson', 'Craig Davis', 'Mary Miller', 'James Taylor',
  'Patricia Anderson', 'Robert Thomas', 'Jennifer Jackson', 'Michael White'
];

export function getInitialSignupsForWeek(weekId: string): { [taskId: string]: string | null } {
  const signups: { [taskId: string]: string | null } = {};

  // Make every task start as available by default.
  CLEANING_TASKS.forEach((task) => {
    signups[task.id] = null;
  });

  return signups;
}
