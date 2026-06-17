-- Web-based Gradebook — full database schema
-- Idempotent: safe to run on an empty database.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep the role check in sync on existing databases (idempotent).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin'));

CREATE TABLE IF NOT EXISTS groups (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- One-to-one extension of users for students.
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expelled', 'new')),
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS subjects (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- A subject taught to a group by a teacher.
CREATE TABLE IF NOT EXISTS courses (
  id         SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (subject_id, group_id, teacher_id)
);

-- Hardcoded lesson timings (bell schedule) used for automatic late detection.
CREATE TABLE IF NOT EXISTS bell_schedule (
  id        SERIAL PRIMARY KEY,
  period_no INTEGER NOT NULL UNIQUE,
  starts_at TIME NOT NULL,
  ends_at   TIME NOT NULL
);

-- Weekly recurring timetable (used for the "schedule" home pages).
CREATE TABLE IF NOT EXISTS timetable_slots (
  id        SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  weekday   INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  period_no INTEGER NOT NULL REFERENCES bell_schedule(period_no),
  room      TEXT,
  UNIQUE (course_id, weekday, period_no)
);

-- A concrete lesson/day a teacher adds to the journal.
CREATE TABLE IF NOT EXISTS lessons (
  id         SERIAL PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  period_no  INTEGER REFERENCES bell_schedule(period_no),
  topic      TEXT,
  type       TEXT NOT NULL DEFAULT 'lecture'
             CHECK (type IN ('lecture', 'lab', 'practice', 'control', 'test')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, date, period_no)
);

-- Grade + attendance per student per lesson.
CREATE TABLE IF NOT EXISTS grade_entries (
  id         SERIAL PRIMARY KEY,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade      INTEGER CHECK (grade BETWEEN 1 AND 100),
  attendance TEXT NOT NULL DEFAULT 'present' CHECK (attendance IN ('present', 'late', 'absent')),
  comment    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);

-- File metadata (binary stored on disk in UPLOAD_DIR).
CREATE TABLE IF NOT EXISTS files (
  id            SERIAL PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime          TEXT,
  size          INTEGER,
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Course program: template of assignments (labs / theory / practice / controls / tests).
CREATE TABLE IF NOT EXISTS assignments (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('lab', 'theory', 'practice', 'control', 'test')),
  title       TEXT NOT NULL,
  description TEXT,
  materials   TEXT,
  issued_date DATE,
  deadline    DATE,
  max_grade   INTEGER NOT NULL DEFAULT 100,
  is_team     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Files attached to an assignment (ТЗ / theory materials).
CREATE TABLE IF NOT EXISTS assignment_files (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  file_id       INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, file_id)
);

-- Teams for team assignments.
CREATE TABLE IF NOT EXISTS teams (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, student_id)
);

-- Student/team submissions for assignments.
CREATE TABLE IF NOT EXISTS submissions (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  team_id       INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  link          TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade         INTEGER CHECK (grade BETWEEN 1 AND 100),
  comment       TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
  graded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  graded_at     TIMESTAMPTZ,
  CHECK (student_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS submission_files (
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_id       INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  PRIMARY KEY (submission_id, file_id)
);

-- In-app notifications (grade given, work reviewed, deadline approaching).
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('grade', 'review', 'deadline', 'info')),
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  ref_id     INTEGER,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_group ON courses(group_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_grade_entries_lesson ON grade_entries(lesson_id);
CREATE INDEX IF NOT EXISTS idx_grade_entries_student ON grade_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_group ON student_profiles(group_id);
