-- CreateTable
CREATE TABLE "AssignmentGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    CONSTRAINT "AssignmentGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignmentGrade_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NationalTestGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "delprov" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    CONSTRAINT "NationalTestGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "summaryGrade" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CourseNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentGrade_studentId_assignmentId_key" ON "AssignmentGrade"("studentId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "NationalTestGrade_studentId_course_delprov_key" ON "NationalTestGrade"("studentId", "course", "delprov");

-- CreateIndex
CREATE UNIQUE INDEX "CourseNote_studentId_course_key" ON "CourseNote"("studentId", "course");
