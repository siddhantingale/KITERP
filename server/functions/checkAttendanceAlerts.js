import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    const { student_id, batch_id } = await req.json();

    // Get student details
    const student = await client.entities.Student.get(student_id);
    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get all attendance records for this student
    const attendanceRecords = await client.entities.AttendanceRecord.filter({ 
      student_id: student_id 
    });

    // Get all sessions for this batch
    const allSessions = await client.entities.AttendanceSession.filter({ 
      batch_id: batch_id || student.batch_id 
    });

    const totalSessions = allSessions.length;
    const attendedSessions = attendanceRecords.filter(r => r.is_present).length;
    const attendancePercentage = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 100;

    // If attendance is below 75%, send alerts
    if (attendancePercentage < 75 && totalSessions >= 3) {
      const title = `⚠️ Low Attendance Alert`;
      const message = `Your attendance has dropped to ${attendancePercentage.toFixed(1)}%.\n\nAttended: ${attendedSessions}/${totalSessions} sessions\nRequired: 75%\n\nPlease improve your attendance to meet the minimum requirement.`;

      // 1. Send Email
      if (student.email) {
        await client.integrations.Core.SendEmail({
          to: student.email,
          subject: `Attendance Alert - ${attendancePercentage.toFixed(1)}%`,
          body: `Dear ${student.name},\n\n${message}\n\nBatch: ${student.batch_id}\nRoll No: ${student.roll_no}\n\nBest regards,\nEDU TRACK Team`,
          from_name: 'EDU TRACK Attendance System'
        });
      }

      // 2. Create in-app notification
      await client.entities.StudentNotification.create({
        student_id: student.id,
        student_email: student.email,
        batch_id: student.batch_id,
        title: title,
        message: message,
        category: 'Attendance',
        priority: attendancePercentage < 60 ? 'Urgent' : 'High',
        is_read: false
      });

      // 3. Create push notification
      const pushPayload = JSON.stringify({
        title: title,
        body: `${attendancePercentage.toFixed(1)}% - Attended ${attendedSessions}/${totalSessions} sessions`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `attendance-alert-${student.id}-${Date.now()}`,
        data: { 
          type: 'attendance_alert', 
          priority: attendancePercentage < 60 ? 'Urgent' : 'High',
          url: '/StudentPortal'
        }
      });

      // Get student's push subscriptions
      const subscriptions = await client.entities.PushSubscription.filter({ 
        user_email: student.email, 
        is_active: true 
      });

      // Queue push notifications
      for (const sub of subscriptions) {
        await client.entities.PendingPushNotification.create({
          subscription_id: sub.id,
          user_email: student.email,
          payload: pushPayload,
          sent: false
        });
      }

      return Response.json({ 
        success: true, 
        alert_sent: true,
        attendance: attendancePercentage.toFixed(1),
        student: student.name,
        email_sent: !!student.email
      });
    }

    return Response.json({ 
      success: true, 
      alert_sent: false,
      attendance: attendancePercentage.toFixed(1),
      message: 'Attendance is above 75%'
    });

  } catch (error) {
    console.error('Error checking attendance alerts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

export default handlerFor(import.meta.url);
