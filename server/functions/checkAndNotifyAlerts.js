import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';
import nodemailer from 'nodemailer';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const notifications = [];
    const emailsToSend = [];

    // 1. CHECK LOW ATTENDANCE STUDENTS
    const students = await client.asServiceRole.entities.Student.list();
    const sessions = await client.asServiceRole.entities.Session.list();
    const attendanceRecords = await client.asServiceRole.entities.AttendanceRecord.list();

    const studentAttendance = {};
    students.forEach(s => {
      const studentSessions = sessions.filter(sess => sess.batch_id === s.batch_id);
      const studentAttendance = attendanceRecords.filter(a => a.student_id === s.id && a.is_present);
      const totalSessions = studentSessions.length;
      const presentCount = studentAttendance.length;
      const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

      if (attendanceRate < 75 && totalSessions >= 5) {
        notifications.push({
          student_id: s.id,
          batch_id: s.batch_id,
          college_name: s.college_name,
          year: s.year,
          category: "Alert",
          title: "Low Attendance Alert",
          message: `Your attendance is currently ${Math.round(attendanceRate)}% which is below the required 75%. Please improve your attendance to avoid academic consequences.`,
          priority: "High"
        });

        if (s.email) {
          emailsToSend.push({
            to: s.email,
            subject: `Academic Alert: Low Attendance - ${Math.round(attendanceRate)}%`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0;">Academic Alert</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">EDU TRACK Academic System</p>
                </div>
                <div style="background: #fef2f2; padding: 30px; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 15px; color: #7f1d1d;">Dear <strong>${s.name}</strong>,</p>
                  <p style="color: #7f1d1d; line-height: 1.6;">This is to inform you that your current attendance rate is <strong>${Math.round(attendanceRate)}%</strong>, which falls below the institutional requirement of 75%.</p>
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <p style="margin: 0; color: #991b1b;"><strong>Attendance Summary:</strong></p>
                    <p style="margin: 10px 0 0 0; color: #7f1d1d;">Total Sessions: ${totalSessions} | Present: ${presentCount} | Absent: ${totalSessions - presentCount}</p>
                  </div>
                  <p style="color: #7f1d1d; line-height: 1.6;">Please ensure regular attendance to meet academic requirements. Contact your faculty advisor if you need assistance.</p>
                  <p style="margin-top: 25px; font-size: 14px; color: #7f1d1d;">Best regards,<br><strong>EDU TRACK Academic Office</strong></p>
                </div>
              </div>
            `
          });
        }
      }
    });

    // 2. CHECK UPCOMING ASSIGNMENT DEADLINES
    const assignments = await client.asServiceRole.entities.Assignment.filter({ status: 'active' });
    const submissions = await client.asServiceRole.entities.AssignmentSubmission.list();
    const now = new Date();
    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    assignments.forEach(assignment => {
      const deadline = new Date(assignment.deadline);
      if (deadline > now && deadline <= twoDaysLater) {
        const batchStudents = students.filter(s => s.batch_id === assignment.batch_id);
        
        batchStudents.forEach(student => {
          const hasSubmitted = submissions.some(sub => 
            sub.assignment_id === assignment.id && sub.student_id === student.id
          );

          if (!hasSubmitted) {
            notifications.push({
              student_id: student.id,
              batch_id: student.batch_id,
              college_name: student.college_name,
              year: student.year,
              category: "Assignment",
              title: "Assignment Deadline Approaching",
              message: `Assignment "${assignment.title}" for ${assignment.subject} is due on ${deadline.toLocaleDateString()}. Please submit before the deadline.`,
              priority: "Medium",
              link_url: "/StudentPortal"
            });

            if (student.email) {
              emailsToSend.push({
                to: student.email,
                subject: `Reminder: Assignment Due - ${assignment.title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                      <h1 style="margin: 0;">Assignment Reminder</h1>
                    </div>
                    <div style="background: #fffbeb; padding: 30px; border-radius: 0 0 10px 10px;">
                      <p style="font-size: 15px; color: #78350f;">Dear <strong>${student.name}</strong>,</p>
                      <p style="color: #78350f; line-height: 1.6;">This is a reminder that the following assignment is due soon:</p>
                      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;"><strong>Title:</strong> ${assignment.title}</p>
                        <p style="margin: 8px 0 0 0; color: #92400e;"><strong>Subject:</strong> ${assignment.subject}</p>
                        <p style="margin: 8px 0 0 0; color: #92400e;"><strong>Deadline:</strong> ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}</p>
                        <p style="margin: 8px 0 0 0; color: #92400e;"><strong>Max Marks:</strong> ${assignment.max_marks}</p>
                      </div>
                      <p style="color: #78350f;">Please submit your work through the student portal before the deadline.</p>
                      <p style="margin-top: 25px; font-size: 14px; color: #78350f;">Best regards,<br><strong>EDU TRACK Academic System</strong></p>
                    </div>
                  </div>
                `
              });
            }
          }
        });
      }
    });

    // 3. CHECK LOW PERFORMANCE STUDENTS
    const performances = await client.asServiceRole.entities.StudentPerformance.list();
    const studentPerformanceMap = {};

    performances.forEach(perf => {
      if (!studentPerformanceMap[perf.student_id]) {
        studentPerformanceMap[perf.student_id] = [];
      }
      studentPerformanceMap[perf.student_id].push(perf);
    });

    Object.entries(studentPerformanceMap).forEach(([studentId, perfs]) => {
      if (perfs.length >= 3) {
        const recentPerfs = perfs.slice(-3);
        const avgPercentage = recentPerfs.reduce((sum, p) => sum + p.percentage, 0) / recentPerfs.length;
        
        if (avgPercentage < 50) {
          const student = students.find(s => s.id === studentId);
          if (student) {
            notifications.push({
              student_id: student.id,
              batch_id: student.batch_id,
              college_name: student.college_name,
              year: student.year,
              category: "Academic",
              title: "Low Performance Alert",
              message: `Your recent average score is ${Math.round(avgPercentage)}%. Please meet with your faculty advisor for academic support.`,
              priority: "High"
            });

            if (student.email) {
              emailsToSend.push({
                to: student.email,
                subject: `Academic Support: Low Performance Alert`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                      <h1 style="margin: 0;">Academic Support Notice</h1>
                    </div>
                    <div style="background: #fef2f2; padding: 30px; border-radius: 0 0 10px 10px;">
                      <p style="font-size: 15px; color: #7f1d1d;">Dear <strong>${student.name}</strong>,</p>
                      <p style="color: #7f1d1d; line-height: 1.6;">Based on your recent assessment performance, we would like to offer academic support to help improve your results.</p>
                      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                        <p style="margin: 0; color: #991b1b;"><strong>Recent Average Score:</strong> ${Math.round(avgPercentage)}%</p>
                      </div>
                      <p style="color: #7f1d1d;">Please schedule a meeting with your faculty advisor to discuss study strategies and support options.</p>
                      <p style="margin-top: 25px; font-size: 14px; color: #7f1d1d;">Best regards,<br><strong>EDU TRACK Academic Office</strong></p>
                    </div>
                  </div>
                `
              });
            }
          }
        }
      }
    });

    // Save all notifications to database
    for (const notif of notifications) {
      await client.asServiceRole.entities.StudentNotification.create({
        ...notif,
        created_by: 'system'
      });
    }

    // Send emails if configured
    if (emailsToSend.length > 0 && process.env['EMAIL_USER'] && process.env['EMAIL_PASS']) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env['EMAIL_USER'],
          pass: process.env['EMAIL_PASS']
        }
      });

      for (const email of emailsToSend) {
        try {
          await transporter.sendMail({
            from: `"EDU TRACK Academic System" <${process.env['EMAIL_USER']}>`,
            ...email
          });
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }
      }
    }

    return Response.json({
      success: true,
      notificationsCreated: notifications.length,
      emailsSent: emailsToSend.length
    });

  } catch (error) {
    console.error('Error checking alerts:', error);
    return Response.json({ 
      error: 'Failed to process alerts', 
      details: error.message 
    }, { status: 500 });
  }
});

export default handlerFor(import.meta.url);
