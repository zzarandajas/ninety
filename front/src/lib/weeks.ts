export function mondayOf(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

export function lastNMondays(n: number, from: Date = new Date()): Date[] {
  const currentMonday = mondayOf(from);
  const mondays: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(currentMonday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    mondays.push(d);
  }
  return mondays;
}
