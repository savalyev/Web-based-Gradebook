export type Role = 'student' | 'teacher';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export type Attendance = 'present' | 'late' | 'absent';
export type StudentStatus = 'active' | 'expelled' | 'new';
export type AssignmentType = 'lab' | 'theory' | 'practice' | 'control' | 'test';
export type LessonType = 'lecture' | 'lab' | 'practice' | 'control' | 'test';

export interface ScheduleSlot {
  id: number;
  weekday: number;
  period_no: number;
  room: string | null;
  starts_at: string;
  ends_at: string;
  subject: string;
  group_name: string;
  teacher_name: string;
  course_id: number;
}

export interface Course {
  id: number;
  subject: string;
  group_name: string;
  group_id: number;
  student_count?: number;
}

export interface JournalStudent {
  id: number;
  full_name: string;
  status: StudentStatus;
  enrolled_at: string;
}

export interface JournalLesson {
  id: number;
  date: string;
  period_no: number | null;
  topic: string | null;
  type: LessonType;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface GradeEntry {
  lesson_id: number;
  student_id: number;
  grade: number | null;
  attendance: Attendance;
  comment: string | null;
}

export interface Assignment {
  id: number;
  course_id?: number;
  type: AssignmentType;
  title: string;
  description?: string | null;
  materials?: string | null;
  issued_date?: string | null;
  deadline?: string | null;
  max_grade: number;
  is_team: boolean;
}

export interface FileMeta {
  id: number;
  original_name: string;
  size?: number;
  mime?: string;
}

export interface TeamInfo {
  id: number;
  name: string;
  members: { id: number; full_name: string }[];
}

export interface Submission {
  id: number;
  assignment_id: number;
  link: string | null;
  submitted_at: string;
  grade: number | null;
  comment: string | null;
  status: 'submitted' | 'reviewed';
  files?: FileMeta[];
  student_name?: string;
  team_name?: string | null;
  assignment_title?: string;
  type?: AssignmentType;
  deadline?: string | null;
  max_grade?: number;
  is_team?: boolean;
  is_late?: boolean;
  graded_at?: string | null;
}
