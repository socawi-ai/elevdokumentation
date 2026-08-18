export const COURSES = ["Svenska 1", "Svenska 2", "Svenska 3", "Filosofi 1", "Gymnasiearbete"] as const;

export type CourseName = (typeof COURSES)[number];
