import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useDeviceType } from "../utils/deviceDetection";
import { toast } from "sonner";

export default function StudentNotifications({ student, setUnreadCount }) {
  const deviceType = useDeviceType();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, [student]);

  const fetchNotifications = async () => {
    try {
      const list = await api.entities.StudentNotification.filter({
        student_id: student.id
      }, '-created_date');
      
      const batchNotifications = await api.entities.StudentNotification.filter({
        batch_id: student.batch_id,
        student_id: null
      }, '-created_date');

      const allNotifications = [...list, ...batchNotifications];
      
      // Use static notifications if no data
      if (allNotifications.length === 0) {
        const staticNotifications = [
          {
            id: '1',
            title: 'Mid-Semester Exam Schedule Released',
            message: 'Mid-semester examination schedule has been published. Please check the timetable section for detailed schedule. Exams begin from February 5th.',
            category: 'Exam',
            priority: 'Urgent',
            is_read: false,
            created_date: '2026-01-22T10:00:00'
          },
          {
            id: '2',
            title: 'Machine Learning Assignment Deadline Extended',
            message: 'Due to technical issues, the ML Neural Network assignment deadline has been extended to January 30th. Make use of extra time.',
            category: 'Assignment',
            priority: 'High',
            is_read: false,
            created_date: '2026-01-21T14:30:00'
          },
          {
            id: '3',
            title: 'Guest Lecture: AI in Healthcare',
            message: 'Special guest lecture on "AI Applications in Healthcare" by Dr. Sharma on January 27th at 2 PM in the auditorium. All students are encouraged to attend.',
            category: 'Event',
            priority: 'Medium',
            is_read: true,
            created_date: '2026-01-20T09:00:00'
          },
          {
            id: '4',
            title: 'Lab Booking Available',
            message: 'Computer Lab 301 is now available for student project work on weekends. Book slots through the portal.',
            category: 'General',
            priority: 'Low',
            is_read: true,
            created_date: '2026-01-19T11:00:00'
          },
          {
            id: '5',
            title: 'Attendance Alert',
            message: 'Your attendance in Database Management is below 75%. Please ensure regular attendance to meet the minimum requirement.',
            category: 'Alert',
            priority: 'High',
            is_read: false,
            created_date: '2026-01-18T16:00:00'
          }
        ];
        setNotifications(staticNotifications);
        setUnreadCount(staticNotifications.filter(n => !n.is_read).length);
      } else {
        setNotifications(allNotifications);
        const unread = allNotifications.filter(n => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.entities.StudentNotification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });
      await fetchNotifications();
      
      // Device-aware feedback
      if (deviceType === 'mobile') {
        toast.success('Marked as read', { duration: 2000 });
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifs.map(n => api.entities.StudentNotification.update(n.id, { is_read: true }))
      );
      await fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.category === filter);

  if (loading) {
    return <div className="h-64 bg-gray-200 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🔔 Notifications</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Stay updated with announcements</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <Button onClick={markAllAsRead} variant="outline" size={deviceType === 'mobile' ? 'sm' : 'default'}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {deviceType === 'mobile' ? 'All Read' : 'Mark All Read'}
          </Button>
        )}
      </div>

      {/* Filter - Mobile Optimized with Swipe */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory touch-pan-x">
          {['all', 'Academic', 'Assignment', 'Exam', 'General', 'Event', 'Alert'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex-shrink-0 snap-start px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                filter === cat
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50 hover:border-blue-300'
              } ${deviceType === 'mobile' ? 'min-h-[44px] px-5' : ''}`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
      </div>
      
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Notifications List - Fully Mobile Optimized */}
      <div className="space-y-2 sm:space-y-3">
        {filteredNotifications.map(notif => (
          <Card 
            key={notif.id} 
            className={`border-0 shadow-md hover:shadow-lg transition-all ${
              notif.is_read ? 'opacity-60 bg-gray-50' : 'border-l-4 border-blue-500 bg-white'
            } ${deviceType === 'mobile' ? 'active:scale-[0.98]' : ''}`}
          >
            <CardContent className={deviceType === 'mobile' ? 'p-3' : 'p-4 sm:p-6'}>
              <div className="space-y-3">
                {/* Header with Title and Badges */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    {!notif.is_read && (
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-blue-600 rounded-full animate-pulse mt-1.5 flex-shrink-0" />
                    )}
                    <h3 className={`font-bold text-gray-900 flex-1 ${deviceType === 'mobile' ? 'text-sm leading-tight' : 'text-base sm:text-lg'}`}>
                      {notif.title}
                    </h3>
                  </div>
                  
                  {/* Badges Row */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full font-semibold ${
                      notif.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                      notif.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                      notif.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {notif.priority}
                    </span>
                    <span className="px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-700 text-[10px] sm:text-xs rounded-full font-semibold">
                      {notif.category}
                    </span>
                  </div>
                </div>

                {/* Message */}
                <p className={`text-gray-700 ${deviceType === 'mobile' ? 'text-xs leading-relaxed' : 'text-sm'}`}>
                  {notif.message}
                </p>

                {/* Footer with Date and Action */}
                <div className={`flex ${deviceType === 'mobile' ? 'flex-col gap-2' : 'items-center justify-between gap-3'} pt-2 border-t border-gray-100`}>
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    {format(new Date(notif.created_date), deviceType === 'mobile' ? 'MMM d, h:mm a' : 'PPP p')}
                  </p>
                  {!notif.is_read && (
                    <Button 
                      onClick={() => markAsRead(notif.id)} 
                      size="sm"
                      variant="outline"
                      className={`${deviceType === 'mobile' ? 'w-full h-10 text-xs' : 'h-8'} border-blue-300 text-blue-600 hover:bg-blue-50`}
                    >
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      {deviceType === 'mobile' ? 'Mark as Read' : 'Read'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}