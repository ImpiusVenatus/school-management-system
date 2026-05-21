/** Format API date for <input type="date" /> (YYYY-MM-DD). */
export function toDateInputValue(d: string | Date): string {
  if (typeof d === "string") {
    return d.includes("T") ? d.slice(0, 10) : d.slice(0, 10);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type AcademicYearSuggest = {
  academic_year_name: string;
  year_start_date: string;
  year_end_date: string;
  start_month: number;
  cycle_label: string;
};
