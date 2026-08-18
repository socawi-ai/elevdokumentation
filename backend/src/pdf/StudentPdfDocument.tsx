import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Student, Assignment } from "@prisma/client";
import { PAGE_1_COURSES, PAGE_2_COURSES, type CourseName } from "../courses.js";

const PAGE_MARGIN = 42.5; // 15mm
const CONTENT_HEIGHT = 841.89 - PAGE_MARGIN * 2;

const TITLE_HEIGHT = 39;
const STUDENT_BLOCK_HEIGHT = 52;
const SMALL_HEADER_HEIGHT = 27;
const COURSE_HEADING_HEIGHT = 30; // heading text + margins, per course section

const MIN_ROW_HEIGHT = 14;
const MAX_ROW_HEIGHT = 34;
const MIN_GRADE_BOX = 12;
const MAX_GRADE_BOX = 22;

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
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#ccc",
  },
  assignmentName: {
    flex: 1,
    fontSize: 11,
    paddingRight: 8,
  },
  emptyText: {
    flex: 1,
    fontSize: 10,
    color: "#888",
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

function computeRowHeight(fixedHeight: number, totalSlots: number): number {
  if (totalSlots === 0) return MAX_ROW_HEIGHT;
  const available = CONTENT_HEIGHT - fixedHeight;
  const raw = available / totalSlots;
  return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, raw));
}

function AssignmentRow({ name, rowHeight }: { name: string; rowHeight: number }) {
  const boxSize = Math.max(MIN_GRADE_BOX, Math.min(MAX_GRADE_BOX, rowHeight - 10));
  return (
    <View style={[styles.row, { height: rowHeight }]}>
      <Text style={styles.assignmentName}>{name}</Text>
      <View style={{ width: boxSize, height: boxSize, borderWidth: 1.2, borderColor: "#000" }} />
    </View>
  );
}

function CourseSection({
  name,
  assignments,
  rowHeight,
}: {
  name: string;
  assignments: string[];
  rowHeight: number;
}) {
  return (
    <View>
      <Text style={styles.courseHeading}>{name}</Text>
      {assignments.length === 0 ? (
        <View style={[styles.row, { height: rowHeight }]}>
          <Text style={styles.emptyText}>Inga uppgifter tillagda</Text>
        </View>
      ) : (
        assignments.map((a, i) => <AssignmentRow key={i} name={a} rowHeight={rowHeight} />)
      )}
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

  const page1Slots = page1Courses.reduce((sum, c) => sum + Math.max(c.items.length, 1), 0);
  const page2Slots = page2Courses.reduce((sum, c) => sum + Math.max(c.items.length, 1), 0);

  const page1Fixed = TITLE_HEIGHT + STUDENT_BLOCK_HEIGHT + page1Courses.length * COURSE_HEADING_HEIGHT;
  const page2Fixed = SMALL_HEADER_HEIGHT + page2Courses.length * COURSE_HEADING_HEIGHT;

  const page1RowHeight = computeRowHeight(page1Fixed, page1Slots);
  const page2RowHeight = computeRowHeight(page2Fixed, page2Slots);

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
          <CourseSection key={c.name} name={c.name} assignments={c.items} rowHeight={page1RowHeight} />
        ))}
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.smallHeader}>
          {student.firstName} {student.lastName} — {student.group}
        </Text>
        {page2Courses.map((c) => (
          <CourseSection key={c.name} name={c.name} assignments={c.items} rowHeight={page2RowHeight} />
        ))}
      </Page>
    </Document>
  );
}
