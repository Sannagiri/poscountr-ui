/** The immediately preceding period of equal length — e.g. "this month" -> "last month" of the same day-count — for a KPI strip's period-over-period deltas. Shared by Sales and Purchase reports pages. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const lengthDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(fromDate.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (lengthDays - 1) * 86_400_000);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { from: format(prevFrom), to: format(prevTo) };
}
