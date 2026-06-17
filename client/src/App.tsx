import { Navigate, Route, Routes } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';
import { Role } from './types';

import Login from './pages/Login';
import Profile from './pages/Profile';
import StudentHome from './pages/student/StudentHome';
import StudentJournal from './pages/student/StudentJournal';
import StudentSubject from './pages/student/StudentSubject';
import LabPage from './pages/student/LabPage';
import TeacherHome from './pages/teacher/TeacherHome';
import TeacherCourses from './pages/teacher/TeacherCourses';
import TeacherJournal from './pages/teacher/TeacherJournal';
import CourseProgram from './pages/teacher/CourseProgram';
import LabReview from './pages/teacher/LabReview';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCourses from './pages/admin/AdminCourses';
import AdminSchedule from './pages/admin/AdminSchedule';
import { AdminGroups, AdminSubjects } from './pages/admin/AdminDictionaries';

function Protected({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* Home dispatches by role */}
      <Route
        path="/"
        element={
          user?.role === 'admin' ? (
            <Navigate to="/admin/users" replace />
          ) : (
            <Protected>{user?.role === 'teacher' ? <TeacherHome /> : <StudentHome />}</Protected>
          )
        }
      />

      {/* Student */}
      <Route path="/journal" element={<Protected role="student"><StudentJournal /></Protected>} />
      <Route path="/subject/:courseId" element={<Protected role="student"><StudentSubject /></Protected>} />
      <Route path="/lab/:assignmentId" element={<Protected role="student"><LabPage /></Protected>} />

      {/* Teacher */}
      <Route path="/courses" element={<Protected role="teacher"><TeacherCourses /></Protected>} />
      <Route path="/courses/:courseId/journal" element={<Protected role="teacher"><TeacherJournal /></Protected>} />
      <Route path="/courses/:courseId/program" element={<Protected role="teacher"><CourseProgram /></Protected>} />
      <Route path="/courses/:courseId/labs" element={<Protected role="teacher"><LabReview /></Protected>} />

      {/* Profile — any authenticated role */}
      <Route path="/profile" element={<Protected><Profile /></Protected>} />

      {/* Admin */}
      <Route path="/admin/users" element={<Protected role="admin"><AdminUsers /></Protected>} />
      <Route path="/admin/groups" element={<Protected role="admin"><AdminGroups /></Protected>} />
      <Route path="/admin/subjects" element={<Protected role="admin"><AdminSubjects /></Protected>} />
      <Route path="/admin/courses" element={<Protected role="admin"><AdminCourses /></Protected>} />
      <Route path="/admin/schedule" element={<Protected role="admin"><AdminSchedule /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
