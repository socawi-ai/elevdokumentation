import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Student, Assignment } from "@prisma/client";
import { PAGE_1_COURSES, PAGE_2_COURSES, NATIONAL_TEST_DELPROV, type CourseName } from "../courses.js";
import type { StudentDataBundle } from "../studentData.js";

const PAGE_MARGIN = 42.5; // 15mm
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
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

const NATIONAL_TEST_HEADING_HEIGHT = 14; // "Nationella prov" sub-heading + margins

const ACCENT_COLOR = "#2F5D3A";

// Notes word-wrap: react-pdf has no synchronous text-measurement API, so line
// capacity is estimated from an average Helvetica glyph width. The multiplier
// is biased high (wider average char) to *underestimate* chars-per-line —
// wasting a little blank space at a line's end is harmless, an overflowing
// glyph past the box border is the failure mode this must avoid.
const NOTES_FONT_SIZE = 9;
const NOTES_AVG_CHAR_WIDTH = NOTES_FONT_SIZE * 0.55;
const NOTES_HORIZONTAL_PADDING = 4;

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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gradeBoxText: {
    // Verified empirically (see PDF text-verification history): at this box's
    // 12pt height, react-pdf silently fails to render Text at fontSize 10 —
    // it needs fontSize <= ~8 to reliably fit and actually appear. Do not
    // raise this without re-verifying grade text actually appears in the
    // rendered PDF (pdftotext), not just checking the code compiles.
    fontSize: 8,
    fontWeight: 700,
  },
  emptyText: {
    flex: 1,
    fontSize: 9,
    color: "#888",
  },
  notesLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#999",
    justifyContent: "flex-end",
  },
  notesLineText: {
    fontSize: NOTES_FONT_SIZE,
    paddingLeft: NOTES_HORIZONTAL_PADDING,
    paddingRight: NOTES_HORIZONTAL_PADDING,
    overflow: "hidden",
  },
  nationalTestBlock: {
    marginTop: 4,
  },
  nationalTestHeading: {
    fontSize: 10,
    fontStyle: "italic",
    color: ACCENT_COLOR,
    marginBottom: 2,
  },
  nationalTestRow: {
    flexDirection: "row",
    height: ASSIGNMENT_ROW_HEIGHT,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT_COLOR,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingLeft: 6,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: 700,
    paddingRight: 6,
  },
  summaryGradeBox: {
    width: GRADE_BOX_WIDTH + 10,
    height: ASSIGNMENT_ROW_HEIGHT - 4,
    borderWidth: 1.5,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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

interface AssignmentItem {
  name: string;
  grade: string;
}

function groupByCourse(assignments: Pick<Assignment, "id" | "course" | "name">[]): Map<string, Pick<Assignment, "id" | "name">[]> {
  const map = new Map<string, Pick<Assignment, "id" | "name">[]>();
  for (const a of assignments) {
    if (!map.has(a.course)) map.set(a.course, []);
    map.get(a.course)!.push({ id: a.id, name: a.name });
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

function charsPerLine(lineWidth: number): number {
  return Math.max(1, Math.floor((lineWidth - NOTES_HORIZONTAL_PADDING * 2) / NOTES_AVG_CHAR_WIDTH));
}

function wrapNotes(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  function pushCurrent() {
    if (current) lines.push(current);
    current = "";
  }

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      pushCurrent();
      for (let i = 0; i < word.length; i += maxCharsPerLine) {
        lines.push(word.slice(i, i + maxCharsPerLine));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      pushCurrent();
      current = word;
    }
  }
  pushCurrent();

  if (lines.length <= maxLines) return lines;

  const truncated = lines.slice(0, maxLines);
  const ellipsis = "…";
  const keep = Math.max(0, maxCharsPerLine - ellipsis.length);
  truncated[maxLines - 1] = truncated[maxLines - 1].slice(0, keep) + ellipsis;
  return truncated;
}

function GradeBox({ grade, wide }: { grade: string; wide?: boolean }) {
  return (
    <View style={wide ? styles.summaryGradeBox : styles.gradeBox}>
      {grade && <Text style={styles.gradeBoxText}>{grade}</Text>}
    </View>
  );
}

function AssignmentColumn({ item }: { item: AssignmentItem | null }) {
  return (
    <View style={styles.assignmentColumn}>
      {item !== null && (
        <>
          <Text style={styles.assignmentName}>{item.name}</Text>
          <GradeBox grade={item.grade} />
        </>
      )}
    </View>
  );
}

function AssignmentPairRow({ pair }: { pair: [AssignmentItem, AssignmentItem | null] }) {
  return (
    <View style={styles.assignmentRow}>
      <View style={[styles.assignmentColumn, styles.assignmentColumnDivider]}>
        <Text style={styles.assignmentName}>{pair[0].name}</Text>
        <GradeBox grade={pair[0].grade} />
      </View>
      <AssignmentColumn item={pair[1]} />
    </View>
  );
}

function RuledNotes({ height, notes }: { height: number; notes: string }) {
  if (height <= 0) return null;
  const count = Math.max(1, Math.floor(height / NOTES_LINE_HEIGHT));
  const lineHeight = height / count;
  const trimmed = notes.trim();
  const wrapped = trimmed ? wrapNotes(trimmed, charsPerLine(CONTENT_WIDTH), count) : [];
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.notesLine, { height: lineHeight }]}>
          {wrapped[i] && <Text style={styles.notesLineText}>{wrapped[i]}</Text>}
        </View>
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

type NationalTestCell = { kind: "delprov"; name: string; grade: string } | { kind: "summary"; grade: string };

function NationalTestCellContent({ cell }: { cell: NationalTestCell }) {
  if (cell.kind === "summary") {
    return (
      <>
        <Text style={styles.summaryLabel}>Sammanfattande betyg</Text>
        <GradeBox grade={cell.grade} wide />
      </>
    );
  }
  return (
    <>
      <Text style={styles.assignmentName}>{cell.name}</Text>
      <GradeBox grade={cell.grade} />
    </>
  );
}

function NationalTestPairRow({ pair }: { pair: [NationalTestCell, NationalTestCell | null] }) {
  return (
    <View style={styles.nationalTestRow}>
      <View style={[styles.assignmentColumn, styles.assignmentColumnDivider]}>
        <NationalTestCellContent cell={pair[0]} />
      </View>
      <View style={styles.assignmentColumn}>{pair[1] && <NationalTestCellContent cell={pair[1]} />}</View>
    </View>
  );
}

function NationalTestSection({
  delprov,
  grades,
  summaryGrade,
}: {
  delprov: readonly string[];
  grades: Record<string, string>;
  summaryGrade: string;
}) {
  const cells: NationalTestCell[] = [
    ...delprov.map((name): NationalTestCell => ({ kind: "delprov", name, grade: grades[name] ?? "" })),
    { kind: "summary", grade: summaryGrade },
  ];
  return (
    <View style={styles.nationalTestBlock}>
      <Text style={styles.nationalTestHeading}>Nationella prov</Text>
      {chunkPairs(cells).map((pair, i) => (
        <NationalTestPairRow key={i} pair={pair} />
      ))}
    </View>
  );
}

function CourseSection({
  name,
  assignments,
  notesHeight,
  notes,
  nationalTestDelprov,
  nationalTestGrades,
  nationalTestSummaryGrade,
}: {
  name: string;
  assignments: AssignmentItem[];
  notesHeight: number;
  notes: string;
  nationalTestDelprov?: readonly string[];
  nationalTestGrades?: Record<string, string>;
  nationalTestSummaryGrade?: string;
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
      {nationalTestDelprov && (
        <NationalTestSection
          delprov={nationalTestDelprov}
          grades={nationalTestGrades ?? {}}
          summaryGrade={nationalTestSummaryGrade ?? ""}
        />
      )}
      <RuledNotes height={notesHeight} notes={notes} />
    </View>
  );
}

interface Props {
  student: Pick<Student, "firstName" | "lastName" | "group">;
  assignments: Pick<Assignment, "id" | "course" | "name">[];
  courseSettings: Record<string, boolean>;
  data: StudentDataBundle;
}

function nationalTestExtraHeight(course: CourseName, courseSettings: Record<string, boolean>): number {
  const delprov = NATIONAL_TEST_DELPROV[course];
  if (!delprov || !courseSettings[course]) return 0;
  // delprov + 1 synthetic "summary" cell, packed 2 per row like assignments
  const rowCount = Math.ceil((delprov.length + 1) / 2);
  return NATIONAL_TEST_HEADING_HEIGHT + rowCount * ASSIGNMENT_ROW_HEIGHT;
}

function StudentPages({ student, assignments, courseSettings, data }: Props) {
  const byCourse = groupByCourse(assignments);

  function buildCourses(courseNames: readonly CourseName[]) {
    return courseNames.map((course) => {
      const items: AssignmentItem[] = (byCourse.get(course) ?? []).map((a) => ({
        name: a.name,
        grade: data.assignmentGrades[a.id] ?? "",
      }));
      const courseNote = data.courseNotes[course];
      return {
        name: course,
        items,
        extraHeight: nationalTestExtraHeight(course, courseSettings),
        nationalTestDelprov: courseSettings[course] ? NATIONAL_TEST_DELPROV[course] : undefined,
        nationalTestGrades: data.nationalTestGrades[course] ?? {},
        notes: courseNote?.notes ?? "",
        summaryGrade: courseNote?.summaryGrade ?? "",
      };
    });
  }

  const page1Courses = buildCourses(PAGE_1_COURSES);
  const page2Courses = buildCourses(PAGE_2_COURSES);

  function notesPerCourse(courses: { items: AssignmentItem[]; extraHeight: number }[], fixedOverhead: number): number {
    const assignmentRowsTotal = courses.reduce((sum, c) => {
      const rowCount = c.items.length === 0 ? 1 : Math.ceil(c.items.length / 2);
      return sum + rowCount * ASSIGNMENT_ROW_HEIGHT + c.extraHeight;
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
    <>
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
          <CourseSection
            key={c.name}
            name={c.name}
            assignments={c.items}
            notesHeight={page1NotesHeight}
            notes={c.notes}
            nationalTestDelprov={c.nationalTestDelprov}
            nationalTestGrades={c.nationalTestGrades}
            nationalTestSummaryGrade={c.summaryGrade}
          />
        ))}
        <Footer generatedOn={generatedOn} />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.smallHeader}>
          {student.firstName} {student.lastName} — {student.group}
        </Text>
        {page2Courses.map((c) => (
          <CourseSection
            key={c.name}
            name={c.name}
            assignments={c.items}
            notesHeight={page2NotesHeight}
            notes={c.notes}
            nationalTestDelprov={c.nationalTestDelprov}
            nationalTestGrades={c.nationalTestGrades}
            nationalTestSummaryGrade={c.summaryGrade}
          />
        ))}
        <Footer generatedOn={generatedOn} />
      </Page>
    </>
  );
}

const EMPTY_BUNDLE: StudentDataBundle = { assignmentGrades: {}, nationalTestGrades: {}, courseNotes: {} };

export function StudentPdfDocument({ student, assignments, courseSettings, data }: Props) {
  return (
    <Document>
      <StudentPages student={student} assignments={assignments} courseSettings={courseSettings} data={data} />
    </Document>
  );
}

export function AllStudentsPdfDocument({
  students,
  assignments,
  courseSettings,
  dataByStudentId,
}: {
  students: Pick<Student, "id" | "firstName" | "lastName" | "group">[];
  assignments: Pick<Assignment, "id" | "course" | "name">[];
  courseSettings: Record<string, boolean>;
  dataByStudentId: Map<string, StudentDataBundle>;
}) {
  return (
    <Document>
      {students.map((student) => (
        <StudentPages
          key={student.id}
          student={student}
          assignments={assignments}
          courseSettings={courseSettings}
          data={dataByStudentId.get(student.id) ?? EMPTY_BUNDLE}
        />
      ))}
    </Document>
  );
}
