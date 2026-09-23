-- Two columns for the multilingual launch.
--
-- Child.schoolLanguage: the language of the worksheet, separate from
-- Parent.language, which is the language the coaching is written in. Null
-- means they are the same, which is the ordinary case.
ALTER TABLE "Child" ADD COLUMN IF NOT EXISTS "schoolLanguage" TEXT;

-- Standard.curriculum: which body's standards these are. Existing rows are
-- all Common Core, so the default backfills them correctly and the column can
-- be NOT NULL from the start.
ALTER TABLE "Standard" ADD COLUMN IF NOT EXISTS "curriculum" TEXT NOT NULL DEFAULT 'CCSS';

-- Retrieval filters on curriculum and then on grade, so the index leads with
-- curriculum. The existing grade-only index stays: the anonymous path has no
-- curriculum to filter by and still reads it.
CREATE INDEX IF NOT EXISTS "Standard_curriculum_grade_idx" ON "Standard" ("curriculum", "grade");
