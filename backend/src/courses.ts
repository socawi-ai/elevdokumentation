export const COURSES = ["Svenska 1", "Svenska 2", "Svenska 3", "Filosofi 1", "Gymnasiearbete"] as const;

export type CourseName = (typeof COURSES)[number];

export const PAGE_1_COURSES: readonly CourseName[] = ["Svenska 1", "Svenska 2", "Svenska 3"];
export const PAGE_2_COURSES: readonly CourseName[] = ["Filosofi 1", "Gymnasiearbete"];
