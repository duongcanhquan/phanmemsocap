import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { AuthProvider } from './context/AuthContext'
import { DashboardPage } from './pages/DashboardPage'
import { Login } from './pages/Login'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { Unauthorized } from './pages/Unauthorized'

const LessonEditorPage = lazy(() =>
  import('./pages/LessonEditorPage').then((module) => ({ default: module.LessonEditorPage })),
)
const ProgramManager = lazy(() =>
  import('./pages/admin/ProgramManager').then((module) => ({ default: module.ProgramManager })),
)
const ProgramDetail = lazy(() =>
  import('./pages/admin/ProgramDetail').then((module) => ({ default: module.ProgramDetail })),
)
const ClassManager = lazy(() =>
  import('./pages/admin/ClassManager').then((module) => ({ default: module.ClassManager })),
)
const TeacherDashboard = lazy(() =>
  import('./pages/teacher/Dashboard').then((module) => ({ default: module.TeacherDashboard })),
)
const Grading = lazy(() => import('./pages/teacher/Grading').then((module) => ({ default: module.Grading })))
const StudentLog = lazy(() =>
  import('./pages/teacher/StudentLog').then((module) => ({ default: module.StudentLog })),
)
const LearningSpace = lazy(() =>
  import('./pages/student/LearningSpace').then((module) => ({ default: module.LearningSpace })),
)

const staffRoles = ['admin', 'teacher'] as const
const allRoles = ['admin', 'teacher', 'student'] as const
const adminRoles = ['admin'] as const
const teacherRoles = ['teacher'] as const
const studentRoles = ['student'] as const

function PageFallback() {
  return <p className="px-1 text-muted">…</p>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route element={<ProtectedRoute allowedRoles={[...allRoles]} />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route element={<ProtectedRoute allowedRoles={[...staffRoles]} />}>
                <Route
                  path="learners"
                  element={
                    <PlaceholderPage
                      titleKey="pages.learners.title"
                      descriptionKey="pages.learners.description"
                    />
                  }
                />
                <Route
                  path="lessons"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LessonEditorPage />
                    </Suspense>
                  }
                />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={[...teacherRoles]} />}>
                <Route
                  path="teacher"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <TeacherDashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="teacher/grading"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <Grading />
                    </Suspense>
                  }
                />
                <Route
                  path="teacher/students/:studentId/:programId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <StudentLog />
                    </Suspense>
                  }
                />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={[...studentRoles]} />}>
                <Route
                  path="student"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LearningSpace />
                    </Suspense>
                  }
                />
                <Route
                  path="student/:programId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LearningSpace />
                    </Suspense>
                  }
                />
                <Route
                  path="student/:programId/:lessonId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LearningSpace />
                    </Suspense>
                  }
                />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={[...adminRoles]} />}>
                <Route
                  path="programs"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ProgramManager />
                    </Suspense>
                  }
                />
                <Route
                  path="programs/:programId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ProgramDetail />
                    </Suspense>
                  }
                />
                <Route
                  path="classes"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ClassManager />
                    </Suspense>
                  }
                />
              </Route>
              <Route
                path="courses"
                element={
                  <PlaceholderPage titleKey="pages.courses.title" descriptionKey="pages.courses.description" />
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
