import React, { useState, useEffect } from "react";
import { Session } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, BookOpen, GraduationCap, QrCode } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SessionSelector({ onSessionSelect, onQRSessionSelect, isLoading }) {
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const availableSessions = await Session.filter({ status: 'scheduled' }, '-session_date', 200);
      setSessions(availableSessions);
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
    setLoadingSessions(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loadingSessions) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-blue-600 text-white px-4 py-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2 sm:gap-3">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            <span>Select a Scheduled Session</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {Array(4).fill(0).map((_, i) => (
              <Card key={i} className="p-3 sm:p-4 border">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-3" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-10 w-full mt-3" />
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-blue-600 text-white px-4 py-4 sm:px-6 sticky top-0 z-10">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2 sm:gap-3">
          <Calendar className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
          <span>Select a Scheduled Session</span>
        </CardTitle>
        <p className="text-blue-100 mt-1 text-sm sm:text-base">Choose any scheduled session and select your attendance method</p>
      </CardHeader>
      
      <CardContent className="p-3 sm:p-4 md:p-6">
        {sessions.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">📭 No Scheduled Sessions Found</h3>
            <p className="text-gray-600 text-sm sm:text-base">Create a session first to take attendance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {sessions.map((session) => (
              <Card 
                key={session.id} 
                className="border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 flex flex-col"
              >
                <CardContent className="p-3 flex flex-col h-full">
                  {/* Header with title and badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">
                        {session.session_name}
                      </h3>
                    </div>
                    <Badge className={`text-xs flex-shrink-0 px-1.5 py-0.5 ${getStatusColor(session.status)}`}>
                      {session.status}
                    </Badge>
                  </div>
                  
                  {/* Session details - more compact */}
                  <div className="text-xs text-gray-600 space-y-1 flex-1 mb-2">
                    <p className="flex items-start gap-1.5">
                      <GraduationCap className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{session.topic_taught}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{format(new Date(session.session_date), "dd MMM yyyy")}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{session.session_time} ({session.duration})</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{session.faculty_name}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="flex-shrink-0">🏛️</span>
                      <span className="truncate text-xs">{session.college_name}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="flex-shrink-0">📚</span>
                      <span className="truncate text-xs">{session.year} - {session.branch || session.batch_description}</span>
                    </p>
                  </div>
                  
                  {/* Compact action buttons - always in one row */}
                  <div className="flex gap-1.5 mt-auto">
                    <Button
                      onClick={() => onSessionSelect(session)}
                      disabled={isLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 h-9 touch-manipulation px-2"
                    >
                      <span className="truncate">📝 Manual</span>
                    </Button>
                    
                    {/* QR Button - Icon only, compact */}
                    <Button
                      onClick={() => onQRSessionSelect(session)}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700 text-white h-9 w-9 p-0 touch-manipulation flex items-center justify-center flex-shrink-0"
                      title="QR Attendance"
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}