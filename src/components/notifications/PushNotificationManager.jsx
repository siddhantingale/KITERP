import { useEffect, useState, useRef } from 'react';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PushNotificationManager({ userEmail, userType, userRole }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [swRegistration, setSwRegistration] = useState(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!userEmail) return;

    // Check current permission status
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Register service worker
    registerServiceWorker();

    // Check if already subscribed
    checkSubscription();

    // Start polling for notifications (works even in background via visibility API)
    startNotificationPolling();

    // Handle visibility change - check immediately when app becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPendingNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [userEmail]);

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw-push.js', {
          scope: '/'
        });
        console.log('✅ Push SW registered:', registration.scope);
        setSwRegistration(registration);

        // Request periodic sync if supported
        if ('periodicSync' in registration) {
          try {
            await registration.periodicSync.register('check-notifications', {
              minInterval: 60 * 1000 // 1 minute minimum
            });
          } catch (e) {
            console.log('Periodic sync not available');
          }
        }
      } catch (error) {
        console.error('❌ Push SW registration failed:', error);
      }
    }
  };

  const startNotificationPolling = () => {
    // Poll every 3 seconds for new notifications
    pollIntervalRef.current = setInterval(checkPendingNotifications, 3000);
    // Also check immediately
    checkPendingNotifications();
  };

  const checkSubscription = async () => {
    try {
      const subs = await api.entities.PushSubscription.filter({ 
        user_email: userEmail, 
        is_active: true 
      });
      setIsSubscribed(subs.length > 0);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const checkPendingNotifications = async () => {
    if (!userEmail) return;
    
    try {
      const pending = await api.entities.PendingPushNotification.filter({
        user_email: userEmail,
        sent: false
      });

      for (const notif of pending) {
        const payload = JSON.parse(notif.payload);
        
        // Always try to show browser notification (even when app is in background)
        if (Notification.permission === 'granted') {
          // Use service worker to show notification (works in background)
          if (swRegistration) {
            swRegistration.showNotification(payload.title, {
              body: payload.body,
              icon: payload.icon || '/logo.png',
              badge: '/logo.png',
              tag: payload.tag || `edutrack-${notif.id}`,
              data: payload.data || {},
              vibrate: [200, 100, 200],
              requireInteraction: payload.data?.priority === 'Urgent',
              actions: [
                { action: 'open', title: 'View' },
                { action: 'dismiss', title: 'Dismiss' }
              ]
            });
          } else {
            // Fallback to regular notification
            new Notification(payload.title, {
              body: payload.body,
              icon: payload.icon || '/logo.png',
              badge: '/logo.png',
              tag: payload.tag,
              requireInteraction: payload.data?.priority === 'Urgent'
            });
          }
        }

        // Show in-app toast only if app is visible
        if (document.visibilityState === 'visible') {
          const toastType = payload.data?.type === 'complaint' ? 'error' : 
                          payload.data?.priority === 'Urgent' ? 'warning' : 'info';
          
          toast[toastType](payload.title, {
            description: payload.body,
            icon: <BellRing className="w-5 h-5" />,
            duration: 8000,
          });
        }

        // Mark as sent
        await api.entities.PendingPushNotification.update(notif.id, { sent: true });
      }
    } catch (error) {
      // Silent fail - don't spam console
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications');
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      await subscribeUser();
      toast.success('🔔 Push Notifications Enabled!', {
        description: 'You will receive notifications even when the app is closed'
      });
    } else if (result === 'denied') {
      toast.error('Notifications blocked', {
        description: 'Please enable notifications in your browser settings'
      });
    }
  };

  const subscribeUser = async () => {
    try {
      const existing = await api.entities.PushSubscription.filter({ 
        user_email: userEmail 
      });

      if (existing.length === 0) {
        await api.entities.PushSubscription.create({
          user_email: userEmail,
          user_type: userType || 'student',
          user_role: userRole || 'user',
          is_active: true,
          device_info: navigator.userAgent,
          subscribed_at: new Date().toISOString()
        });
      } else {
        await api.entities.PushSubscription.update(existing[0].id, { is_active: true });
      }

      setIsSubscribed(true);
    } catch (error) {
      console.error('Error subscribing:', error);
    }
  };

  const unsubscribe = async () => {
    try {
      const subs = await api.entities.PushSubscription.filter({ user_email: userEmail });
      for (const sub of subs) {
        await api.entities.PushSubscription.update(sub.id, { is_active: false });
      }
      setIsSubscribed(false);
      toast.info('Push notifications disabled');
    } catch (error) {
      console.error('Error unsubscribing:', error);
    }
  };

  // Show enable button if not subscribed or permission not granted
  if (permission !== 'granted' || !isSubscribed) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={requestPermission}
        className="gap-2 bg-white/90 backdrop-blur-sm shadow-lg border-blue-200 hover:bg-blue-50"
      >
        <Bell className="w-4 h-4 text-blue-600" />
        <span className="hidden sm:inline">Enable Push</span>
      </Button>
    );
  }

  // Show subscribed indicator with option to disable
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={unsubscribe}
      className="gap-2 text-green-600 hover:text-red-600 hover:bg-red-50"
      title="Click to disable notifications"
    >
      <BellRing className="w-4 h-4" />
      <span className="hidden sm:inline text-xs">Push On</span>
    </Button>
  );
}

// Helper function to send push notifications from anywhere in the app
export async function sendPushNotification({ title, body, targetEmails, targetType, data }) {
  try {
    const apiClient = api;
    
    let subscriptions = [];
    
    if (targetEmails && targetEmails.length > 0) {
      for (const email of targetEmails) {
        const userSubs = await apiClient.entities.PushSubscription.filter({ 
          user_email: email, 
          is_active: true 
        });
        subscriptions.push(...userSubs);
      }
    } else if (targetType === 'admin') {
      subscriptions = await apiClient.entities.PushSubscription.filter({ 
        user_role: 'admin', 
        is_active: true 
      });
    } else if (targetType === 'faculty') {
      subscriptions = await apiClient.entities.PushSubscription.filter({ 
        user_type: 'faculty', 
        is_active: true 
      });
    } else if (targetType === 'students') {
      subscriptions = await apiClient.entities.PushSubscription.filter({ 
        user_type: 'student', 
        is_active: true 
      });
    } else if (targetType === 'all') {
      subscriptions = await apiClient.entities.PushSubscription.filter({ is_active: true });
    }

    const payload = JSON.stringify({
      title: title || 'EDU TRACK',
      body: body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: `edutrack-${Date.now()}`,
      data: data || {},
      timestamp: Date.now()
    });

    // Create pending notifications for each subscriber
    const createPromises = subscriptions.map(sub => 
      apiClient.entities.PendingPushNotification.create({
        subscription_id: sub.id,
        user_email: sub.user_email,
        payload: payload,
        sent: false
      })
    );

    await Promise.all(createPromises);

    console.log(`📤 Push notification queued for ${subscriptions.length} users`);
    return { success: true, count: subscriptions.length };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

// Helper to trigger notification via service worker (for when app is in foreground)
export function showLocalNotification(title, body, data = {}) {
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `edutrack-local-${Date.now()}`,
        data,
        vibrate: [200, 100, 200]
      });
    });
  }
}