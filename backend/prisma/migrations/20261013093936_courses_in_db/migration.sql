-- Courses move from a hardcoded list in the code into the database.

-- CreateTable
CREATE TABLE "Course" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "page" INTEGER NOT NULL DEFAULT 1,
    "nationalTestDelprov" TEXT NOT NULL DEFAULT '[]',
    "showNationalTest" BOOLEAN NOT NULL DEFAULT false
);

-- Seed with the courses that used to be hardcoded, carrying over the
-- nationella prov toggle from CourseSetting.
INSERT INTO "Course" ("name", "sortOrder", "page", "nationalTestDelprov", "showNationalTest") VALUES
    ('Svenska 1', 0, 1, '["Delprov A","Delprov B","Delprov C"]', COALESCE((SELECT "showNationalTest" FROM "CourseSetting" WHERE "course" = 'Svenska 1'), false)),
    ('Svenska 2', 1, 1, '[]', false),
    ('Svenska 3', 2, 1, '["Delprov A","Delprov B"]', COALESCE((SELECT "showNationalTest" FROM "CourseSetting" WHERE "course" = 'Svenska 3'), false)),
    ('Filosofi 1', 3, 2, '[]', false),
    ('Gymnasiearbete', 4, 2, '[]', false);

-- Safety net: any course name already referenced by existing data but not in
-- the list above still gets a row, so the new foreign keys can't fail.
INSERT OR IGNORE INTO "Course" ("name", "sortOrder", "page")
    SELECT DISTINCT "course", 100, 2 FROM (
        SELECT "course" FROM "Assignment"
        UNION SELECT "course" FROM "NationalTestGrade"
        UNION SELECT "course" FROM "CourseNote"
    );

-- DropTable
DROP TABLE "CourseSetting";

-- CreateTable
CREATE TABLE "GroupCourse" (
    "group" TEXT NOT NULL,
    "course" TEXT NOT NULL,

    PRIMARY KEY ("group", "course"),
    CONSTRAINT "GroupCourse_course_fkey" FOREIGN KEY ("course") REFERENCES "Course" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_course_fkey" FOREIGN KEY ("course") REFERENCES "Course" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Keep the existing creation order as the initial manual order.
INSERT INTO "new_Assignment" ("course", "createdAt", "id", "name", "sortOrder")
    SELECT "course", "createdAt", "id", "name",
        (SELECT COUNT(*) FROM "Assignment" a2 WHERE a2."course" = a."course" AND (a2."createdAt" < a."createdAt" OR (a2."createdAt" = a."createdAt" AND a2."id" < a."id")))
    FROM "Assignment" a;
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE TABLE "new_CourseNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "summaryGrade" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CourseNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseNote_course_fkey" FOREIGN KEY ("course") REFERENCES "Course" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseNote" ("course", "id", "notes", "studentId", "summaryGrade") SELECT "course", "id", "notes", "studentId", "summaryGrade" FROM "CourseNote";
DROP TABLE "CourseNote";
ALTER TABLE "new_CourseNote" RENAME TO "CourseNote";
CREATE UNIQUE INDEX "CourseNote_studentId_course_key" ON "CourseNote"("studentId", "course");
CREATE TABLE "new_NationalTestGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "delprov" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    CONSTRAINT "NationalTestGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NationalTestGrade_course_fkey" FOREIGN KEY ("course") REFERENCES "Course" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NationalTestGrade" ("course", "delprov", "grade", "id", "studentId") SELECT "course", "delprov", "grade", "id", "studentId" FROM "NationalTestGrade";
DROP TABLE "NationalTestGrade";
ALTER TABLE "new_NationalTestGrade" RENAME TO "NationalTestGrade";
CREATE UNIQUE INDEX "NationalTestGrade_studentId_course_delprov_key" ON "NationalTestGrade"("studentId", "course", "delprov");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
