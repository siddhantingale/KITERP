import { useEffect, useCallback, useRef } from 'react';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { Bell, Megaphone, MessageSquare, FileText, BellRing, Calendar, TrendingUp } from 'lucide-react';
import { sendPushNotification, showLocalNotification } from './PushNotificationManager';

export default function StudentNotificationListener({ studentEmail }) {
  const swRegistrationRef = useRef(null);

  // Register service worker on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        swRegistrationRef.current = registration;
      });
    }
  }, []);

  // Show notification via service worker (works in background)
  const showNotification = useCallback((title, body, options = {}) => {
    // Always try service worker first (works when app is closed)
    if (swRegistrationRef.current && Notification.permission === 'granted') {
      swRegistrationRef.current.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `edutrack-${Date.now()}`,
        vibrate: [200, 100, 200],
        requireInteraction: options.urgent || false,
        data: options.data || {},
        actions: options.urgent ? [
          { action: 'open', title: 'View Now' },
          { action: 'dismiss', title: 'Later' }
        ] : undefined
      });
    } else if (Notification.permission === 'granted') {
      // Fallback to regular notification
      new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `edutrack-${Date.now()}`,
        requireInteraction: options.urgent
      });
    }

    // Also show in-app toast if visible
    if (document.visibilityState === 'visible') {
      const toastFn = options.urgent ? toast.warning : toast.info;
      toastFn(title, {
        description: body,
        icon: <BellRing className="w-5 h-5" />,
        duration: options.urgent ? 10000 : 6000,
      });
    }
  }, []);

  // Auto-register for push on component mount
  useEffect(() => {
    if (!studentEmail) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Register push subscription
    registerPushSubscription();

    async function registerPushSubscription() {
      try {
        const existing = await api.entities.PushSubscription.filter({ 
          user_email: studentEmail 
        });
        
        if (existing.length === 0 && Notification.permission === 'granted') {
          await api.entities.PushSubscription.create({
            user_email: studentEmail,
            user_type: 'student',
            user_role: 'user',
            is_active: true,
            device_info: navigator.userAgent,
            subscribed_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error registering push:', error);
      }
    }
  }, [studentEmail]);

  // Real-time entity subscriptions
  useEffect(() => {
    if (!studentEmail) return;

    // Subscribe to StudentNotification entity
    const unsubscribeNotifications = api.entities.StudentNotification.subscribe((event) => {
      if (event.type === 'create' && event.data.student_email === studentEmail) {
        const isUrgent = event.data.priority === 'Urgent' || event.data.priority === 'High';
        showNotification(
          `🔔 ${event.data.title || 'New Notification'}`,
          event.data.message,
          { urgent: isUrgent, data: { type: 'notification', priority: event.data.priority } }
        );
      }
    });

    // Subscribe to Announcements
    const unsubscribeAnnouncements = api.entities.Announcement.subscribe((event) => {
      if (event.type === 'create') {
        const announcement = event.data;
        const isForStudent = announcement.recipient_type === 'All' || 
                            announcement.recipient_type === 'Students';
        
        if (isForStudent) {
          const emoji = announcement.priority === 'Urgent' ? '🚨' : 
                       announcement.priority === 'High' ? '⚠️' : '📢';
          const isUrgent = announcement.priority === 'Urgent';
          
          showNotification(
            `${emoji} ${announcement.title}`,
            announcement.message,
            { urgent: isUrgent, data: { type: 'announcement', priority: announcement.priority } }
          );
        }
      }
    });

    // Subscribe to Messages
    const unsubscribeMessages = api.entities.Message.subscribe((event) => {
      if (event.type === 'create' && event.data.receiver_email === studentEmail) {
        showNotification(
          `✉️ Message from ${event.data.sender_name}`,
          event.data.subject,
          { data: { type: 'message', url: '/messages' } }
        );
      }
    });

    // Subscribe to Assignment creation
    const unsubscribeAssignments = api.entities.Assignment.subscribe((event) => {
      if (event.type === 'create') {
        showNotification(
          `📝 New Assignment: ${event.data.title}`,
          `Subject: ${event.data.subject} | Due: ${new Date(event.data.deadline).toLocaleDateString()}`,
          { data: { type: 'assignment' } }
        );
      }
    });

    // Subscribe to Attendance Sessions (for real-time alerts)
    const unsubscribeSessions = api.entities.Session.subscribe((event) => {
      if (event.type === 'create' && event.data.status === 'active') {
        showNotification(
          `📅 Attendance Session Started`,
          `${event.data.session_name} - Mark your attendance now!`,
          { urgent: true, data: { type: 'attendance', url: '/attendance' } }
        );
      }
    });

    // Subscribe to Performance updates
    const unsubscribePerformance = api.entities.StudentPerformance.subscribe((event) => {
      if (event.type === 'create' && event.data.student_email === studentEmail) {
        showNotification(
          `📊 New Score Posted`,
          `${event.data.subject}: ${event.data.marks_obtained}/${event.data.total_marks} (${event.data.assessment_type})`,
          { data: { type: 'performance' } }
        );
      }
    });

    // Subscribe to StudentNotification for low attendance alerts
    const unsubscribeStudentNotif = api.entities.StudentNotification.subscribe((event) => {
      if (event.type === 'create' && event.data.student_email === studentEmail) {
        const isUrgent = event.data.category === 'Attendance' && 
                        (event.data.priority === 'Urgent' || event.data.priority === 'High');
        showNotification(
          event.data.title,
          event.data.message,
          { urgent: isUrgent, data: { type: event.data.category.toLowerCase(), priority: event.data.priority } }
        );
      }
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeAnnouncements();
      unsubscribeMessages();
      unsubscribeAssignments();
      unsubscribeSessions();
      unsubscribePerformance();
      unsubscribeStudentNotif();
    };
  }, [studentEmail, showNotification]);

  return null;
}