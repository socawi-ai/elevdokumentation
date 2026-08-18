export const COURSES = ["Svenska 1", "Svenska 2", "Svenska 3", "Filosofi 1", "Gymnasiearbete"] as const;

export type CourseName = (typeof COURSES)[number];

export const PAGE_1_COURSES: readonly CourseName[] = ["Svenska 1", "Svenska 2", "Svenska 3"];
export const PAGE_2_COURSES: readonly CourseName[] = ["Filosofi 1", "Gymnasiearbete"];

export const NATIONAL_TEST_DELPROV: Partial<Record<CourseName, readonly string[]>> = {
  "Svenska 1": ["Delprov A", "Delprov B", "Delprov C"],
  "Svenska 3": ["Delprov A", "Delprov B"],
};

export const NATIONAL_TEST_COURSES: readonly CourseName[] = Object.keys(NATIONAL_TEST_DELPROV) as CourseName[];
