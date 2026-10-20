import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { User, Faculty, Student } from "@/entities/all";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { refreshBatches } from "@/components/utils/useBatches";
import { Toaster } from "@/components/ui/sonner";
import AdminNotificationListener from "@/components/notifications/AdminNotificationListener";
import PushNotificationManager from "@/components/notifications/PushNotificationManager";
import {
  LayoutDashboard,
  PlusCircle,
  Upload,
  CalendarCheck,
  Users,
  Building,
  UserCog,
  KeyRound,
  FileText,
  Book,
  LogOut,
  Menu,
  GraduationCap,
  AlertCircle,
  TrendingUp,
  Calendar,
  MessageSquare,
  Megaphone,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
  User as UserIcon
} from "lucide-react";

// Faculty Nav Items (visible to both admin and faculty)
const facultyNavItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "CreateSession", label: "Create Session", icon: PlusCircle, facultyOnly: true },
  { name: "Attendance", label: "Take Attendance", icon: CalendarCheck, facultyOnly: true },
  { name: "AssignmentManagement", label: "Assignments", icon: FileText, facultyOnly: true },
  { name: "TeachingNotes", label: "Teaching Notes", icon: FileText, facultyOnly: true },
  { name: "Batches", label: "Manage Classes", icon: Users, adminOnly: true },
  { name: "TimeTable", label: "Timetable", icon: Calendar },
  { name: "Performance", label: "Performance", icon: TrendingUp },
  { name: "Announcements", label: "Announcements", icon: Megaphone },
  { name: "ProxyDetection", label: "Proxy Detection", icon: AlertCircle },
  { name: "GeoFenceManagement", label: "Geo-Fencing", icon: MapPin, facultyOnly: true },
];

const adminNavItems = [
  { name: "ManageFaculty", label: "Manage Faculty", icon: UserCog },
  { name: "UserAccounts", label: "User Accounts", icon: KeyRound },
  { name: "FeedbackComplaintsAdmin", label: "Feedback & Complaints", icon: MessageSquare },
  { name: "AdvancedAnalysis", label: "Advanced Analysis", icon: TrendingUp },
  { name: "PredictiveAnalysis", label: "Predictive Attendance Insights", icon: Sparkles },
];

const commonNavItems = [];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  
  const [user, setUser] = useState(null);
  const [isStudent, setIsStudent] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  // Initialize global batch refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.refreshBatches = refreshBatches;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.refreshBatches;
      }
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('✅ Service Worker registered:', registration);
          })
          .catch(error => {
            console.log('❌ Service Worker registration failed:', error);
          });
      });
    }

    // Check if PWA is installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPWAInstalled(true);
    }

    // Request notification permission proactively for PWA
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission();
      }, 3000);
    }
    }, []);

  useEffect(() => {
    const fetchUser = async () => {
      // Public pages - no auth needed
      if (currentPageName === "QRAttendanceStudent" || currentPageName === "Home") {
        setUserLoading(false);
        return;
      }

      // Student portal - separate auth flow
      if (currentPageName === "StudentPortal") {
        setUserLoading(false);
        return;
      }

      setUserLoading(true);
      setAuthError(null);
      
      try {
        const currentUser = await User.me();
        
        console.log("✅ User logged in:", currentUser.email, "Role:", currentUser.role);
        
        // Check if user is a student first
        if (currentUser.role !== 'admin') {
          try {
            const studentRecords = await Student.filter({ email: currentUser.email });
            
            if (studentRecords.length > 0) {
              // User is a student - they should ONLY access StudentPortal
              console.log("👨‍🎓 Student detected:", currentUser.email);
              setIsStudent(true);
              setUser(currentUser);
              setUserLoading(false);
              
              // If not already on StudentPortal, redirect
              if (currentPageName !== "StudentPortal") {
                console.log("🔄 Redirecting to Student Portal...");
                window.location.href = createPageUrl("StudentPortal");
              }
              return;
            }
            
            // Not a student, check if they're in Faculty table
            const facultyRecords = await Faculty.filter({ email: currentUser.email });
            
            if (facultyRecords.length === 0) {
              // User is not in Faculty table - add them automatically with INACTIVE status
              console.log("🔧 Adding user to Faculty table automatically (inactive by default)...");
              
              await Faculty.create({
                name: currentUser.full_name || currentUser.email.split('@')[0],
                email: currentUser.email,
                department: "General",
                status: "inactive" // Default to INACTIVE - admin must activate
              });
              
              console.log("⚠️ User added to Faculty table as INACTIVE - Admin must activate");
              
              // Block access for inactive faculty
              setAuthError("Your faculty account is pending admin activation. Please contact your administrator.");
              setUser(null);
              setUserLoading(false);
              return;
            } else {
              console.log("✅ User already exists in Faculty table");
              
              // CHECK IF FACULTY IS ACTIVE
              const facultyMember = facultyRecords[0];
              if (facultyMember.status === "inactive") {
                console.log("⚠️ Faculty account is INACTIVE");
                setAuthError("Your faculty account is inactive. Please contact your administrator to activate your account.");
                setUser(null);
                setUserLoading(false);
                return;
              }
              
              console.log("✅ Faculty is ACTIVE - Access granted");
            }
          } catch (checkError) {
            console.error("❌ Error checking student/faculty records:", checkError);
            // Don't block access even if this fails
          }
        }
        
        setUser(currentUser);
        
      } catch (error) {
        console.error("❌ User not logged in:", error);
        setUser(null);
      }
      
      setUserLoading(false);
    };
    
    fetchUser();
  }, [currentPageName]);

  // Public pages - render without layout
  if (currentPageName === "QRAttendanceStudent" || currentPageName === "StudentPortal" || currentPageName === "Home" || currentPageName === "TeachingNoteEditor") {
    return <>{children}</>;
  }

  // Loading state
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is a student, block faculty dashboard access
  if (isStudent && currentPageName !== "StudentPortal") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <div className="bg-blue-600 p-3 rounded-lg inline-block mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">EDU TRACK</h1>
            <p className="text-gray-600">Student Portal Access Only</p>
          </div>
          <p className="text-gray-700 mb-6">You are logged in as a student. Redirecting to Student Portal...</p>
          <button 
            onClick={() => window.location.href = createPageUrl("StudentPortal")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Go to Student Portal
          </button>
        </div>
      </div>
    );
  }

  // Not logged in or auth error - show login prompt or error
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-center border border-white/20">
          <div className="mb-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl inline-block mb-4 shadow-lg">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">EDU TRACK</h1>
            <p className="text-gray-600">Education Management Platform</p>
          </div>
          
          {authError ? (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <div className="text-red-600 text-4xl mb-2">⚠️</div>
              <p className="text-red-800 font-semibold mb-2">Account Inactive</p>
              <p className="text-sm text-red-700">{authError}</p>
            </div>
          ) : (
            <p className="text-gray-700 mb-6">Please log in to access the dashboard.</p>
          )}
          
          <button 
            onClick={() => (authError ? User.logout(window.location.href) : User.login())}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            {authError ? 'Login with Different Account' : 'Log In'}
          </button>
          
          {authError && (
            <p className="mt-4 text-xs text-gray-500">
              If you believe this is an error, please contact your administrator.
            </p>
          )}
        </div>
      </div>
    );
  }

  // User is logged in - show full app (authorization happens automatically)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex">
      {/* Real-time notification listener */}
      <AdminNotificationListener userEmail={user?.email} isAdmin={user?.role === 'admin'} />
      <Toaster position="top-right" richColors />

      {/* Push notification enable button - floating */}
      <div className="fixed bottom-20 right-4 z-50 lg:bottom-4">
        <PushNotificationManager 
          userEmail={user?.email} 
          userType={user?.role === 'admin' ? 'admin' : 'faculty'} 
          userRole={user?.role} 
        />
      </div>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72`}>
        {/* Glassmorphism Sidebar */}
        <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl border-r border-white/20 shadow-2xl">
          {/* Logo Section with Gradient - Clickable */}
          <div className="p-6 relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">
            <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-white/30 hover:scale-105 transition-transform duration-300">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-white tracking-tight">EDU TRACK</span>
                  <span className="text-xs text-blue-100 font-medium">Smart Education Platform</span>
                </div>
              )}
            </Link>
            {/* Collapse Button - Desktop Only */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2 rounded-full shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300 border-2 border-white"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto custom-scrollbar">
            {/* All menu items in a single flat list */}
            {facultyNavItems.map((item) => {
              // Hide faculty-only items for admin, hide admin-only items for faculty
              if (user?.role === 'admin' && item.facultyOnly) return null;
              if (user?.role !== 'admin' && item.adminOnly) return null;
              
              const isActive = location.pathname.startsWith(createPageUrl(item.name));
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  onClick={() => setIsSidebarOpen(false)}
                  title={isSidebarCollapsed ? (item.label || item.name) : ''}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110'} transition-transform`} />
                  {!isSidebarCollapsed && <span>{item.label || item.name}</span>}
                  {!isSidebarCollapsed && isActive && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  )}
                </Link>
              );
            })}
            
            {/* Admin items - shown only to admins, no section header */}
            {user && user.role === 'admin' && adminNavItems.map((item) => {
              const isActive = location.pathname.startsWith(createPageUrl(item.name));
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  onClick={() => setIsSidebarOpen(false)}
                  title={isSidebarCollapsed ? (item.label || item.name) : ''}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110'} transition-transform`} />
                  {!isSidebarCollapsed && <span>{item.label || item.name}</span>}
                  {!isSidebarCollapsed && isActive && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  )}
                </Link>
              );
            })}

          </div>

          {/* User Section with Glassmorphism */}
          <div className="p-4 border-t border-gray-200/50 bg-gradient-to-r from-slate-50 to-blue-50">
            {user && !isSidebarCollapsed && (
              <button 
                onClick={() => window.location.href = createPageUrl("Profile")}
                className="relative mb-3 w-full hover:scale-102 transition-transform duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40"></div>
                <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/90 backdrop-blur-md border border-white/50 shadow-lg hover:shadow-xl transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white">
                    {user.full_name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-sm text-gray-800 truncate leading-snug">{user.full_name.trim()}</p>
                    <p className="text-xs text-indigo-600 capitalize font-semibold flex items-center gap-1 leading-snug">
                      {user.role === 'admin' ? 'Admin' : 'Faculty'}
                      {user.role === 'admin' && (
                        <span className="px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">✨</span>
                      )}
                    </p>
                  </div>
                </div>
              </button>
            )}
            {user && isSidebarCollapsed && (
              <button
                onClick={() => window.location.href = createPageUrl("Profile")}
                className="flex justify-center mb-3 w-full"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-30 hover:opacity-60 transition-opacity"></div>
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white hover:scale-110 transition-transform cursor-pointer" title={user.full_name.trim()}>
                    {user.full_name.trim().charAt(0).toUpperCase()}
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Mobile Header with Gradient */}
        <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-xl p-4 flex items-center justify-between lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg text-white hover:bg-white/20 backdrop-blur-md transition-all duration-300"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="font-bold text-lg text-white tracking-tight">EDU TRACK</div>
          <div className="w-10"></div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Overlay with Blur */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-all duration-300" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Custom Scrollbar Styles & Safe Area */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #6366f1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #2563eb, #4f46e5);
        }
        .safe-area-inset {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }
        .touch-manipulation {
          touch-action: manipulation;
        }
      `}</style>

    </div>
  );
}