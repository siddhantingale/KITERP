import { useEffect, useCallback, useRef } from 'react';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { AlertCircle, MessageSquare, Mail, BellRing, Users, Calendar, FileText, TrendingUp } from 'lucide-react';

export default function AdminNotificationListener({ userEmail, isAdmin }) {
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
        tag: `edutrack-admin-${Date.now()}`,
        vibrate: [200, 100, 200],
        requireInteraction: options.urgent || false,
        data: { url: options.url, ...options.data },
        actions: options.urgent ? [
          { action: 'open', title: 'View Now' },
          { action: 'dismiss', title: 'Later' }
        ] : undefined
      });
    } else if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `edutrack-admin-${Date.now()}`,
        requireInteraction: options.urgent
      });
      
      notification.onclick = () => {
        window.focus();
        if (options.url) window.location.href = options.url;
        notification.close();
      };
    }

    // Also show in-app toast if visible
    if (document.visibilityState === 'visible') {
      const toastFn = options.type === 'error' ? toast.error : 
                     options.urgent ? toast.warning : toast.info;
      toastFn(title, {
        description: body,
        icon: <BellRing className="w-5 h-5" />,
        duration: options.urgent ? 10000 : 6000,
        action: options.url ? {
          label: 'View',
          onClick: () => window.location.href = options.url
        } : undefined
      });
    }
  }, []);

  // Auto-register for push on component mount
  useEffect(() => {
    if (!userEmail) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Register push subscription
    registerPushSubscription();

    async function registerPushSubscription() {
      try {
        const existing = await api.entities.PushSubscription.filter({ 
          user_email: userEmail 
        });
        
        if (existing.length === 0 && Notification.permission === 'granted') {
          await api.entities.PushSubscription.create({
            user_email: userEmail,
            user_type: isAdmin ? 'admin' : 'faculty',
            user_role: isAdmin ? 'admin' : 'user',
            is_active: true,
            device_info: navigator.userAgent,
            subscribed_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error registering push:', error);
      }
    }
  }, [userEmail, isAdmin]);

  // Real-time entity subscriptions
  useEffect(() => {
    if (!userEmail) return;

    // Subscribe to Complaints - for admin (HIGH PRIORITY)
    const unsubscribeComplaints = api.entities.Complaint.subscribe((event) => {
      if (event.type === 'create' && isAdmin) {
        const complaint = event.data;
        showNotification(
          `🚨 NEW COMPLAINT: ${complaint.category}`,
          `From: ${complaint.student_name}\n${complaint.issue?.substring(0, 100) || complaint.title}`,
          { 
            urgent: true, 
            type: 'error',
            url: '/FeedbackComplaintsAdmin',
            data: { type: 'complaint', priority: complaint.priority }
          }
        );
      }
    });

    // Subscribe to Feedback - for admin
    const unsubscribeFeedback = api.entities.Feedback.subscribe((event) => {
      if (event.type === 'create' && isAdmin) {
        const feedback = event.data;
        showNotification(
          `💬 New Feedback from ${feedback.student_name}`,
          `Rating: ${'⭐'.repeat(feedback.rating || 0)} | ${feedback.feedback_text?.substring(0, 80)}`,
          { url: '/FeedbackComplaintsAdmin', data: { type: 'feedback' } }
        );
      }
    });

    // Subscribe to Messages
    const unsubscribeMessages = api.entities.Message.subscribe((event) => {
      if (event.type === 'create' && event.data.receiver_email === userEmail) {
        showNotification(
          `✉️ Message from ${event.data.sender_name}`,
          event.data.subject,
          { url: '/Messages', data: { type: 'message' } }
        );
      }
    });

    // Subscribe to new student registrations (for admin)
    const unsubscribeStudents = api.entities.Student.subscribe((event) => {
      if (event.type === 'create' && isAdmin) {
        showNotification(
          `👨‍🎓 New Student Registered`,
          `${event.data.name} joined batch: ${event.data.batch_id}`,
          { data: { type: 'student' } }
        );
      }
    });

    // Subscribe to new sessions
    const unsubscribeSessions = api.entities.Session.subscribe((event) => {
      if (event.type === 'create') {
        showNotification(
          `📅 Session Created`,
          `${event.data.session_name} by ${event.data.faculty_name}`,
          { data: { type: 'session' } }
        );
      }
    });

    // Subscribe to Assignment submissions (for faculty)
    const unsubscribeSubmissions = api.entities.AssignmentSubmission.subscribe((event) => {
      if (event.type === 'create') {
        showNotification(
          `📄 New Assignment Submission`,
          `${event.data.student_name} submitted an assignment`,
          { url: '/AssignmentManagement', data: { type: 'submission' } }
        );
      }
    });

    // Subscribe to Proxy Detection alerts (for admin)
    const unsubscribeProxy = api.entities.ProxyDetectionLog.subscribe((event) => {
      if (event.type === 'create' && isAdmin && event.data.risk_score >= 70) {
        showNotification(
          `⚠️ Proxy Alert Detected!`,
          `${event.data.violation_type} - Risk Score: ${event.data.risk_score}`,
          { urgent: true, type: 'error', url: '/ProxyDetection', data: { type: 'proxy' } }
        );
      }
    });

    return () => {
      unsubscribeComplaints();
      unsubscribeFeedback();
      unsubscribeMessages();
      unsubscribeStudents();
      unsubscribeSessions();
      unsubscribeSubmissions();
      unsubscribeProxy();
    };
  }, [userEmail, isAdmin, showNotification]);

  return null;
}