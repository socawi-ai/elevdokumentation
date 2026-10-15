import type { Student, StatusFilter } from "./api/students";

export type SortField = "firstName" | "lastName" | "group";
export type SortDirection = "asc" | "desc";

// The student list's search/filter/sort state. Lives in the URL query string
// so it survives navigating to a student and back, and so the edit page's
// sidebar and prev/next can walk the exact same list.
export interface StudentFilters {
  q: string;
  klass: string;
  year: string;
  status: StatusFilter;
  sort: SortField;
  dir: SortDirection;
}

export const DEFAULT_FILTERS: StudentFilters = {
  q: "",
  klass: "",
  year: "",
  status: "active",
  sort: "lastName",
  dir: "asc",
};

export function readFilters(params: URLSearchParams): StudentFilters {
  const status = params.get("status");
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    klass: params.get("klass") ?? "",
    year: params.get("year") ?? "",
    status: status === "archived" || status === "all" ? status : "active",
    sort: sort === "firstName" || sort === "group" ? sort : "lastName",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
  };
}

export function filtersToParams(filters: StudentFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof StudentFilters)[]) {
    if (filters[key] !== DEFAULT_FILTERS[key]) params.set(key, filters[key]);
  }
  return params;
}

// "?klass=SA25" style suffix for links that should carry the filter along,
// or "" when every filter is at its default.
export function filtersQuery(filters: StudentFilters): string {
  const query = filtersToParams(filters).toString();
  return query ? `?${query}` : "";
}

// Klass codes follow a "<program><startyear>" convention (e.g. "SA25", "EK25"),
// so the trailing digits are the intake year shared across parallel programs.
export function extractYear(group: string): string | null {
  const match = group.match(/(\d+)$/);
  return match ? match[1] : null;
}

// Search/klass/year filtering and sorting. Status is applied server-side by
// which list was fetched (listStudents(status)).
export function applyFilters(students: Student[], filters: StudentFilters): Student[] {
  const q = filters.q.trim().toLowerCase();
  const filtered = students.filter((s) => {
    if (filters.klass && s.group !== filters.klass) return false;
    if (filters.year && extractYear(s.group) !== filters.year) return false;
    if (!q) return true;
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
    );
  });
  const collator = new Intl.Collator("sv");
  const sorted = filtered.sort((a, b) => collator.compare(a[filters.sort], b[filters.sort]));
  return filters.dir === "asc" ? sorted : sorted.reverse();
}
