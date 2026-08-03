import dayjs from 'dayjs';

/** e.g. "2026-Q3" for the calendar quarter containing today. */
export function currentQuarter(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${quarter}`;
}

/** The last day of the calendar quarter containing today. */
export function currentQuarterEndDate(): dayjs.Dayjs {
  const now = new Date();
  const quarterEndMonth = Math.floor(now.getMonth() / 3) * 3 + 2; // 0-indexed last month of current quarter
  return dayjs(new Date(now.getFullYear(), quarterEndMonth + 1, 0)); // day 0 of next month = last day of quarterEndMonth
}

/** The first day of the calendar quarter containing today. */
export function currentQuarterStartDate(): dayjs.Dayjs {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3; // 0-indexed first month of current quarter
  return dayjs(new Date(now.getFullYear(), quarterStartMonth, 1));
}
