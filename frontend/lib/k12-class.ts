/** Sort K-12 class names numerically (Class 3 before Class 10). */
export function k12ClassSortKey(name: string): number {
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 9999;
}

export function sortByClassName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = k12ClassSortKey(a.name);
    const kb = k12ClassSortKey(b.name);
    if (ka !== kb) return ka - kb;
    return a.name.localeCompare(b.name);
  });
}

/** Pass marks from full marks and the class grade scale pass threshold (%). */
export function computePassMarks(fullMarks: number, passThresholdPercent: number): number {
  const full = Number.isFinite(fullMarks) ? fullMarks : 0;
  const pct = Number.isFinite(passThresholdPercent) ? passThresholdPercent : 40;
  return Math.max(1, Math.round((full * pct) / 100));
}
