import { lazy } from 'react';
const AITimetableGenerator = lazy(() => import('./pages/AITimetableGenerator'));
const AdvancedAnalysis = lazy(() => import('./pages/AdvancedAnalysis'));
const Announcements = lazy(() => import('./pages/Announcements'));
const AssignmentManagement = lazy(() => import('./pages/AssignmentManagement'));
const Attendance = lazy(() => import('./pages/Attendance'));
const BatchAnalytics = lazy(() => import('./pages/BatchAnalytics'));
const BatchDetails = lazy(() => import('./pages/BatchDetails'));
const BatchDetailsPage = lazy(() => import('./pages/BatchDetailsPage'));
const Batches = lazy(() => import('./pages/Batches'));
const ConsolidatedReport = lazy(() => import('./pages/ConsolidatedReport'));
const CreateSession = lazy(() => import('./pages/CreateSession'));
import Dashboard from './pages/Dashboard';
const ExcalidrawNotesList = lazy(() => import('./pages/ExcalidrawNotesList'));
const ExcalidrawTeacher = lazy(() => import('./pages/ExcalidrawTeacher'));
const ExcalidrawViewer = lazy(() => import('./pages/ExcalidrawViewer'));
const FacultyReport = lazy(() => import('./pages/FacultyReport'));
const FeedbackComplaintsAdmin = lazy(() => import('./pages/FeedbackComplaintsAdmin'));
const GeoFenceManagement = lazy(() => import('./pages/GeoFenceManagement'));
const Home = lazy(() => import('./pages/Home'));
const ManageColleges = lazy(() => import('./pages/ManageColleges'));
const ManageFaculty = lazy(() => import('./pages/ManageFaculty'));
const ManageTimeTable = lazy(() => import('./pages/ManageTimeTable'));
const Messages = lazy(() => import('./pages/Messages'));
const Performance = lazy(() => import('./pages/Performance'));
const PredictiveAnalysis = lazy(() => import('./pages/PredictiveAnalysis'));
const Profile = lazy(() => import('./pages/Profile'));
const ProxyDetection = lazy(() => import('./pages/ProxyDetection'));
const QRAttendance = lazy(() => import('./pages/QRAttendance'));
const QRAttendanceStudent = lazy(() => import('./pages/QRAttendanceStudent'));
const StudentPerformance = lazy(() => import('./pages/StudentPerformance'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const StudentRecordsPage = lazy(() => import('./pages/StudentRecordsPage'));
const TeachingNoteEditor = lazy(() => import('./pages/TeachingNoteEditor'));
const TeachingNotes = lazy(() => import('./pages/TeachingNotes'));
const TimeTable = lazy(() => import('./pages/TimeTable'));
const Upload = lazy(() => import('./pages/Upload'));
const UserAccounts = lazy(() => import('./pages/UserAccounts'));
import __Layout from './Layout.jsx';


export const PAGES = {
    "AITimetableGenerator": AITimetableGenerator,
    "AdvancedAnalysis": AdvancedAnalysis,
    "Announcements": Announcements,
    "AssignmentManagement": AssignmentManagement,
    "Attendance": Attendance,
    "BatchAnalytics": BatchAnalytics,
    "BatchDetails": BatchDetails,
    "BatchDetailsPage": BatchDetailsPage,
    "Batches": Batches,
    "ConsolidatedReport": ConsolidatedReport,
    "CreateSession": CreateSession,
    "Dashboard": Dashboard,
    "ExcalidrawNotesList": ExcalidrawNotesList,
    "ExcalidrawTeacher": ExcalidrawTeacher,
    "ExcalidrawViewer": ExcalidrawViewer,
    "FacultyReport": FacultyReport,
    "FeedbackComplaintsAdmin": FeedbackComplaintsAdmin,
    "GeoFenceManagement": GeoFenceManagement,
    "Home": Home,
    "ManageColleges": ManageColleges,
    "ManageFaculty": ManageFaculty,
    "ManageTimeTable": ManageTimeTable,
    "Messages": Messages,
    "Performance": Performance,
    "PredictiveAnalysis": PredictiveAnalysis,
    "Profile": Profile,
    "ProxyDetection": ProxyDetection,
    "QRAttendance": QRAttendance,
    "QRAttendanceStudent": QRAttendanceStudent,
    "StudentPerformance": StudentPerformance,
    "StudentPortal": StudentPortal,
    "StudentRecordsPage": StudentRecordsPage,
    "TeachingNoteEditor": TeachingNoteEditor,
    "TeachingNotes": TeachingNotes,
    "TimeTable": TimeTable,
    "Upload": Upload,
    "UserAccounts": UserAccounts,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};