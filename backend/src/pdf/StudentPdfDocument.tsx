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

const TITLE_HEIGHT = 46; // title text + accent rule + margins
const STUDENT_BLOCK_HEIGHT = 52;
const SMALL_HEADER_HEIGHT = 27;
const COURSE_HEADING_HEIGHT = 26; // heading text + margins, per course section

const ASSIGNMENT_ROW_HEIGHT = 16; // compact row holding 2 assignments side by side
const GRADE_BOX_WIDTH = 30;
const NOTES_LINE_HEIGHT = 16; // target spacing for handwritten-note ruled lines

const ACCENT_COLOR = "#2F5D3A";

const styles = StyleSheet.create({
  page: {
    padding: PAGE_MARGIN,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: ACCENT_COLOR,
    marginBottom: 6,
  },
  titleRule: {
    height: 2,
    backgroundColor: ACCENT_COLOR,
    marginBottom: 14,
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
    color: ACCENT_COLOR,
    marginTop: 8,
    marginBottom: 4,
  },
  assignmentRow: {
    flexDirection: "row",
    height: ASSIGNMENT_ROW_HEIGHT,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  assignmentColumn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  assignmentColumnDivider: {
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 0.5,
    borderRightColor: "#ddd",
  },
  assignmentName: {
    flex: 1,
    fontSize: 9,
    paddingRight: 6,
  },
  gradeBox: {
    width: GRADE_BOX_WIDTH,
    height: ASSIGNMENT_ROW_HEIGHT - 4,
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
  footer: {
    position: "absolute",
    bottom: 20,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
  },
  footerText: {
    fontSize: 8,
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

function chunkPairs<T>(items: T[]): [T, T | null][] {
  const pairs: [T, T | null][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push([items[i], items[i + 1] ?? null]);
  }
  return pairs;
}

function AssignmentColumn({ name }: { name: string | null }) {
  return (
    <View style={styles.assignmentColumn}>
      {name !== null && (
        <>
          <Text style={styles.assignmentName}>{name}</Text>
          <View style={styles.gradeBox} />
        </>
      )}
    </View>
  );
}

function AssignmentPairRow({ pair }: { pair: [string, string | null] }) {
  return (
    <View style={styles.assignmentRow}>
      <View style={[styles.assignmentColumn, styles.assignmentColumnDivider]}>
        <Text style={styles.assignmentName}>{pair[0]}</Text>
        <View style={styles.gradeBox} />
      </View>
      <AssignmentColumn name={pair[1]} />
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

function Footer({ generatedOn }: { generatedOn: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Utskriven: {generatedOn}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Sida ${pageNumber}/${totalPages}`} />
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
        chunkPairs(assignments).map((pair, i) => <AssignmentPairRow key={i} pair={pair} />)
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
    const assignmentRowsTotal = courses.reduce((sum, c) => {
      const rowCount = c.items.length === 0 ? 1 : Math.ceil(c.items.length / 2);
      return sum + rowCount * ASSIGNMENT_ROW_HEIGHT;
    }, 0);
    const remaining = CONTENT_HEIGHT - fixedOverhead - assignmentRowsTotal;
    return Math.max(0, remaining / courses.length);
  }

  const page1Fixed = TITLE_HEIGHT + STUDENT_BLOCK_HEIGHT + page1Courses.length * COURSE_HEADING_HEIGHT;
  const page2Fixed = SMALL_HEADER_HEIGHT + page2Courses.length * COURSE_HEADING_HEIGHT;

  const page1NotesHeight = notesPerCourse(page1Courses, page1Fixed);
  const page2NotesHeight = notesPerCourse(page2Courses, page2Fixed);

  const generatedOn = new Date().toISOString().slice(0, 10);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Kursuppföljning</Text>
        <View style={styles.titleRule} />
        <View style={styles.studentBlock}>
          <Text style={styles.studentLine}>
            Elev: {student.firstName} {student.lastName}
          </Text>
          <Text style={styles.studentLine}>Klass: {student.group}</Text>
        </View>
        {page1Courses.map((c) => (
          <CourseSection key={c.name} name={c.name} assignments={c.items} notesHeight={page1NotesHeight} />
        ))}
        <Footer generatedOn={generatedOn} />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.smallHeader}>
          {student.firstName} {student.lastName} — {student.group}
        </Text>
        {page2Courses.map((c) => (
          <CourseSection key={c.name} name={c.name} assignments={c.items} notesHeight={page2NotesHeight} />
        ))}
        <Footer generatedOn={generatedOn} />
      </Page>
    </Document>
  );
}
