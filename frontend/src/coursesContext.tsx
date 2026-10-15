import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { listCourses, listGroupCourses, type Course, type GroupCourses } from "./api/courses";

interface CoursesContextValue {
  courses: Course[];
  groupCourses: GroupCourses[];
  loading: boolean;
  reload: () => Promise<void>;
  // The courses a klass takes, in display order (every course if the klass
  // has no explicit selection).
  coursesForGroup: (group: string) => Course[];
}

const CoursesContext = createContext<CoursesContextValue | null>(null);

export function CoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [groupCourses, setGroupCourses] = useState<GroupCourses[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [c, g] = await Promise.all([listCourses(), listGroupCourses()]);
    setCourses(c);
    setGroupCourses(g);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const coursesForGroup = useCallback(
    (group: string) => {
      const selected = groupCourses.find((g) => g.group === group)?.courses;
      return selected ? courses.filter((c) => selected.includes(c.name)) : courses;
    },
    [courses, groupCourses],
  );

  return (
    <CoursesContext.Provider value={{ courses, groupCourses, loading, reload, coursesForGroup }}>
      {children}
    </CoursesContext.Provider>
  );
}

export function useCourses(): CoursesContextValue {
  const value = useContext(CoursesContext);
  if (!value) throw new Error("useCourses must be used inside CoursesProvider");
  return value;
}
