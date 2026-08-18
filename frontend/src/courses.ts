export const COURSES = ["Svenska 1", "Svenska 2", "Svenska 3", "Filosofi 1", "Gymnasiearbete"] as const;

export type CourseName = (typeof COURSES)[number];

export const NATIONAL_TEST_COURSES: readonly CourseName[] = ["Svenska 1", "Svenska 3"];
