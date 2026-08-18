import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Student } from "@prisma/client";

const PAGE_MARGIN = 42.5; // 15mm

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
  courseBlock: {
    marginBottom: 16,
  },
  courseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: "#000",
    marginRight: 8,
  },
  courseName: {
    fontSize: 13,
    fontWeight: 700,
  },
  ruledLine: {
    height: 24,
    borderBottomWidth: 0.75,
    borderBottomColor: "#999",
  },
});

function RuledLines({ count }: { count: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.ruledLine} />
      ))}
    </View>
  );
}

function CourseSection({ name, lineCount }: { name: string; lineCount: number }) {
  return (
    <View style={styles.courseBlock}>
      <View style={styles.courseHeaderRow}>
        <View style={styles.checkbox} />
        <Text style={styles.courseName}>{name}</Text>
      </View>
      <RuledLines count={lineCount} />
    </View>
  );
}

interface Props {
  student: Pick<Student, "firstName" | "lastName" | "group">;
}

export function StudentPdfDocument({ student }: Props) {
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
        <CourseSection name="Svenska 1" lineCount={7} />
        <CourseSection name="Svenska 2" lineCount={7} />
        <CourseSection name="Svenska 3" lineCount={7} />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.smallHeader}>
          {student.firstName} {student.lastName} — {student.group}
        </Text>
        <CourseSection name="Filosofi 1" lineCount={12} />
        <CourseSection name="Gymnasiearbete" lineCount={12} />
      </Page>
    </Document>
  );
}
