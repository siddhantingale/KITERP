import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Student } from "@/entities/all";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Toaster } from "@/components/ui/sonner";
import StudentNotificationListener from "@/components/notifications/StudentNotificationListener";
import PushNotificationManager from "@/components/notifications/PushNotificationManager";
import { 
  LayoutDashboard, 
  Calendar, 
  ClipboardList, 
  FileText, 
  BookOpen, 
  TrendingUp, 
  MessageSquare, 
  AlertCircle, 
  Bell,
  Menu,
  X,
  LogOut,
  GraduationCap,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Student Pages
import StudentDashboard from "../components/student/StudentDashboard";
import StudentAttendanceEnhanced from "../components/student/StudentAttendanceEnhanced";
import StudentTimetableGrid from "../components/student/StudentTimetableGrid";
import StudentCoursesAndFaculty from "../components/student/StudentCoursesAndFaculty";
import StudentAssignments from "../components/student/StudentAssignments";
import StudentNotes from "../components/student/StudentNotes";
import StudentTeachingNotes from "../components/student/StudentTeachingNotes";
import StudentAnalysis from "../components/student/StudentAnalysis";
import StudentFeedback from "../components/student/StudentFeedback";
import StudentComplaints from "../components/student/StudentComplaints";
import StudentNotifications from "../components/student/StudentNotifications";
import StudentProfile from "../components/student/StudentProfile";

const studentMenuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'timetable', label: 'Timetable', icon: ClipboardList },
  { id: 'courses', label: 'Courses & Faculty', icon: BookOpen },
  { id: 'assignments', label: 'Assignments', icon: FileText },
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'teachingnotes', label: 'Teaching Notes', icon: FileText },
  { id: 'analysis', label: 'Analysis & Performance', icon: TrendingUp },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'complaints', label: 'Complaints', icon: AlertCircle },
  { id: 'notifications', label: 'Notifications', icon: Bell }
];

export default function StudentPortal() {
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);

        const studentRecords = await Student.filter({ email: currentUser.email });
        if (studentRecords.length > 0) {
          setStudent(studentRecords[0]);
        } else {
          console.error("No student record found for user");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const renderPage = () => {
    if (!student) return null;

    const pageProps = { student, user };

    switch(activePage) {
      case 'dashboard':
        return <StudentDashboard {...pageProps} onNavigate={setActivePage} />;
      case 'attendance':
        return <StudentAttendanceEnhanced {...pageProps} />;
      case 'timetable':
        return <StudentTimetableGrid {...pageProps} />;
      case 'courses':
        return <StudentCoursesAndFaculty {...pageProps} />;
      case 'assignments':
        return <StudentAssignments {...pageProps} />;
      case 'notes':
        return <StudentNotes {...pageProps} />;
      case 'teachingnotes':
        return <StudentTeachingNotes {...pageProps} />;
      case 'analysis':
        return <StudentAnalysis {...pageProps} />;
      case 'feedback':
        return <StudentFeedback {...pageProps} />;
      case 'complaints':
        return <StudentComplaints {...pageProps} />;
      case 'notifications':
        return <StudentNotifications {...pageProps} setUnreadCount={setUnreadCount} />;
      case 'profile':
        return <StudentProfile {...pageProps} onLogout={handleLogout} />;
      default:
        return <StudentDashboard {...pageProps} onNavigate={setActivePage} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Student Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl inline-block mb-4">
            <GraduationCap className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">EDU TRACK</h1>
          <p className="text-gray-600 mb-6">Student Portal</p>
          <Button 
            onClick={() => api.auth.login()}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg"
          >
            Log In
          </Button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Student Record Found</h2>
          <p className="text-gray-600 mb-6">Your account is not registered as a student. Please contact administration.</p>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
      {/* Real-time notification listener */}
      <StudentNotificationListener studentEmail={user?.email} />
      <Toaster position="top-right" richColors />
      
      {/* Push notification enable button - shown in mobile header */}
      <div className="fixed bottom-4 right-4 z-50 lg:hidden">
        <PushNotificationManager 
          userEmail={user?.email} 
          userType="student" 
          userRole="user" 
        />
      </div>
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72 bg-white shadow-2xl`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
                <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                {!isSidebarCollapsed && (
                  <div>
                    <h2 className="text-white font-bold text-lg">EDU TRACK</h2>
                    <p className="text-blue-100 text-xs">Student Portal</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Collapse button - desktop only */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 bg-white text-blue-600 p-1.5 rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {studentMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              const showBadge = item.id === 'notifications' && unreadCount > 0;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105' 
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                  } ${isSidebarCollapsed ? 'lg:justify-center' : ''}`}
                  title={isSidebarCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
                  {showBadge && !isSidebarCollapsed && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Student Profile Info - Bottom */}
          <div className="p-4 border-t bg-gradient-to-r from-slate-50 to-blue-50">
            {student && !isSidebarCollapsed && (
              <button 
                onClick={() => setActivePage('profile')}
                className="w-full hover:scale-102 transition-transform duration-300"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/90 backdrop-blur-md border border-white/50 shadow-lg hover:shadow-xl transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white">
                    {student.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{student.name.trim() || (user.email ? user.email.split('@')[0] : 'Student')}</p>
                    <p className="text-xs text-indigo-600 capitalize font-semibold">Student</p>
                  </div>
                </div>
              </button>
            )}
            {student && isSidebarCollapsed && (
              <button
                onClick={() => setActivePage('profile')}
                className="flex justify-center w-full"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white hover:scale-110 transition-transform cursor-pointer" title={student.name.trim() || (user.email ? user.email.split('@')[0] : 'Student')}>
                    {(student.name.trim() || (user.email ? user.email.split('@')[0] : 'S')).charAt(0).toUpperCase()}
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen" style={{ marginLeft: isSidebarCollapsed ? '5rem' : '' }}>
        {/* Mobile Header */}
        <header className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">EDU TRACK</h1>
          <div className="w-6"></div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {renderPage()}
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}