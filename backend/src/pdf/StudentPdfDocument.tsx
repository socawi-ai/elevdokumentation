import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Student, Assignment } from "@prisma/client";
import { PAGE_1_COURSES, PAGE_2_COURSES, type CourseName } from "../courses.js";

const PAGE_MARGIN = 42.5; // 15mm
// Safety buffer: the fixed-height constants below are hand-measured estimates
// of react-pdf's actual rendered heights, not exact — reserving slack here
// absorbs that per-element drift so it can never accumulate into an overflow
// (which would silently spill a blank extra page).
const SAFETY_MARGIN = 40;
const CONTENT_HEIGHT = 841.89 - PAGE_MARGIN * 2 - SAFETY_MARGIN;

const TITLE_HEIGHT = 39;
const STUDENT_BLOCK_HEIGHT = 52;
const SMALL_HEADER_HEIGHT = 27;
const COURSE_HEADING_HEIGHT = 26; // heading text + margins, per course section

const ASSIGNMENT_ROW_HEIGHT = 14; // compact: assignment name + small grade box
const GRADE_BOX_SIZE = 11;
const NOTES_LINE_HEIGHT = 16; // target spacing for handwritten-note ruled lines

const styles = StyleSheet.create({
  page: {
    padding: PAGE_MARGIN,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 16,
  },
  studentBlock: {
    marginBottom: 20,
  },
  studentLine: {
    fontSize: 12,
    marginBottom: 2,
  },
  smallHeader: {
    fontSize: 11,
    color: "#444",
    marginBottom: 16,
  },
  courseHeading: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 4,
  },
  assignmentRow: {
    flexDirection: "row",
    alignItems: "center",
    height: ASSIGNMENT_ROW_HEIGHT,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  assignmentName: {
    flex: 1,
    fontSize: 9,
    paddingRight: 6,
  },
  gradeBox: {
    width: GRADE_BOX_SIZE,
    height: GRADE_BOX_SIZE,
    borderWidth: 1,
    borderColor: "#000",
  },
  emptyText: {
    flex: 1,
    fontSize: 9,
    color: "#888",
  },
  notesLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#999",
  },
});

function groupByCourse(assignments: Pick<Assignment, "course" | "name">[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const a of assignments) {
    if (!map.has(a.course)) map.set(a.course, []);
    map.get(a.course)!.push(a.name);
  }
  return map;
}

function AssignmentRow({ name }: { name: string }) {
  return (
    <View style={styles.assignmentRow}>
      <Text style={styles.assignmentName}>{name}</Text>
      <View style={styles.gradeBox} />
    </View>
  );
}

function RuledNotes({ height }: { height: number }) {
  if (height <= 0) return null;
  const count = Math.max(1, Math.floor(height / NOTES_LINE_HEIGHT));
  const lineHeight = height / count;
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.notesLine, { height: lineHeight }]} />
      ))}
    </View>
  );
}

function CourseSection({
  name,
  assignments,
  notesHeight,
}: {
  name: string;
  assignments: string[];
  notesHeight: number;
}) {
  return (
    <View>
      <Text style={styles.courseHeading}>{name}</Text>
      {assignments.length === 0 ? (
        <View style={styles.assignmentRow}>
          <Text style={styles.emptyText}>Inga uppgifter tillagda</Text>
        </View>
      ) : (
        assignments.map((a, i) => <AssignmentRow key={i} name={a} />)
      )}
      <RuledNotes height={notesHeight} />
    </View>
  );
}

interface Props {
  student: Pick<Student, "firstName" | "lastName" | "group">;
  assignments: Pick<Assignment, "course" | "name">[];
}

export function StudentPdfDocument({ student, assignments }: Props) {
  const byCourse = groupByCourse(assignments);

  const page1Courses = PAGE_1_COURSES.map((course: CourseName) => ({ name: course, items: byCourse.get(course) ?? [] }));
  const page2Courses = PAGE_2_COURSES.map((course: CourseName) => ({ name: course, items: byCourse.get(course) ?? [] }));

  function notesPerCourse(courses: { items: string[] }[], fixedOverhead: number): number {
    const assignmentRowsTotal = courses.reduce((sum, c) => sum + Math.max(c.items.length, 1) * ASSIGNMENT_ROW_HEIGHT, 0);
    const remaining = CONTENT_HEIGHT - fixedOverhead - assignmentRowsTotal;
    return Math.max(0, remaining / courses.length);
  }

  const page1Fixed = TITLE_HEIGHT + STUDENT_BLOCK_HEIGHT + page1Courses.length * COURSE_HEADING_HEIGHT;
  const page2Fixed = SMALL_HEADER_HEIGHT + page2Courses.length * COURSE_HEADING_HEIGHT;

  const page1NotesHeight = notesPerCourse(page1Courses, page1Fixed);
  const page2NotesHeight = notesPerCourse(page2Courses, page2Fixed);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Kursuppföljning</Text>
        <View style={styles.studentBlock}>
          <Text style={styles.studentLine}>
            Elev: {student.firstName} {student.lastName}
          </Text>
          <Text style={styles.studentLine}>Klass: {student.group}</Text>
        </View>
        {page1Courses.map((c) => (
          <CourseSection key={c.name} name={c.name} assignments={c.items} notesHeight={page1NotesHeight} />
        ))}
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.smallHeader}>
          {student.firstName} {student.lastName} — {student.group}
        </Text>
        {page2Courses.map((c) => (
          <CourseSection key={c.name} name={c.name} assignments={c.items} notesHeight={page2NotesHeight} />
        ))}
      </Page>
    </Document>
  );
}
