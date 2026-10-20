import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);

    // RULE 1: LOW ATTENDANCE ALERT (<75%)
    await checkLowAttendance(client);

    // RULE 2: CONTINUOUS ABSENTEEISM (≥3 consecutive days)
    await checkContinuousAbsenteeism(client);

    // RULE 3: LATE ASSIGNMENT SUBMISSIONS
    await checkLateSubmissions(client);

    return Response.json({
      success: true,
      message: 'Alert evaluation completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Alert evaluation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// RULE 1: LOW ATTENDANCE ALERT
async function checkLowAttendance(client) {
  const students = await client.entities.Student.list();
  const sessions = await client.entities.Session.list();
  const attendanceRecords = await client.entities.AttendanceRecord.list();

  for (const student of students) {
    const studentSessions = sessions.filter(s => s.batch_id === student.batch_id);
    const totalSessions = studentSessions.length;

    if (totalSessions === 0) continue;

    const presentCount = attendanceRecords.filter(
      a => a.student_id === student.id && a.is_present
    ).length;

    const attendancePercentage = (presentCount / totalSessions) * 100;

    if (attendancePercentage < 75) {
      // Check cooldown - don't spam alerts
      const existingAlerts = await client.entities.StudentNotification.filter({
        student_id: student.id,
        category: 'Alert',
        title: 'Low Attendance Warning'
      });

      const lastAlert = existingAlerts.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      )[0];

      const cooldownPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (lastAlert && (Date.now() - new Date(lastAlert.created_date).getTime()) < cooldownPeriod) {
        continue;
      }

      // Create alert
      await client.entities.StudentNotification.create({
        student_id: student.id,
        batch_id: student.batch_id,
        college_name: student.college_name,
        year: student.year,
        category: 'Alert',
        title: 'Low Attendance Warning',
        message: `⚠️ Your attendance is ${attendancePercentage.toFixed(1)}%, which is below the minimum required threshold of 75%. Present: ${presentCount}/${totalSessions} sessions. Please improve your attendance to meet academic requirements.`,
        priority: 'High',
        is_read: false,
        created_by: 'System'
      });
    }
  }
}

// RULE 2: CONTINUOUS ABSENTEEISM
async function checkContinuousAbsenteeism(client) {
  const students = await client.entities.Student.list();
  const sessions = await client.entities.Session.filter({}, '-session_date', 30);
  const attendanceRecords = await client.entities.AttendanceRecord.list();

  for (const student of students) {
    const studentSessions = sessions
      .filter(s => s.batch_id === student.batch_id)
      .sort((a, b) => new Date(b.session_date) - new Date(a.session_date));

    let consecutiveAbsences = 0;
    const absentDates = [];

    for (const session of studentSessions) {
      const attended = attendanceRecords.find(
        a => a.student_id === student.id && a.session_id === session.id && a.is_present
      );

      if (!attended) {
        consecutiveAbsences++;
        absentDates.push(session.session_date);
      } else {
        break; // Reset on attendance
      }
    }

    if (consecutiveAbsences >= 3) {
      // Check cooldown
      const existingAlerts = await client.entities.StudentNotification.filter({
        student_id: student.id,
        category: 'Alert',
        title: 'Critical: Continuous Absenteeism'
      });

      const lastAlert = existingAlerts.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      )[0];

      const cooldownPeriod = 3 * 24 * 60 * 60 * 1000; // 3 days
      if (lastAlert && (Date.now() - new Date(lastAlert.created_date).getTime()) < cooldownPeriod) {
        continue;
      }

      // Create critical alert
      await client.entities.StudentNotification.create({
        student_id: student.id,
        batch_id: student.batch_id,
        college_name: student.college_name,
        year: student.year,
        category: 'Alert',
        title: 'Critical: Continuous Absenteeism',
        message: `🚨 URGENT: You have been absent for ${consecutiveAbsences} consecutive sessions. This requires immediate attention. Last ${absentDates.length} absences recorded. Please contact your faculty or admin immediately.`,
        priority: 'Urgent',
        is_read: false,
        created_by: 'System'
      });
    }
  }
}

// RULE 3: LATE ASSIGNMENT SUBMISSIONS
async function checkLateSubmissions(client) {
  const submissions = await client.entities.AssignmentSubmission.filter({
    is_late: true,
    status: { $in: ['Submitted', 'Late'] }
  });

  for (const submission of submissions) {
    // Check if alert already sent
    const existingAlert = await client.entities.StudentNotification.filter({
      student_id: submission.student_id,
      category: 'Alert',
      message: { $regex: submission.assignment_id }
    });

    if (existingAlert.length > 0) continue;

    const assignment = await client.entities.Assignment.get(submission.assignment_id);

    // Create policy violation alert
    await client.entities.StudentNotification.create({
      student_id: submission.student_id,
      batch_id: assignment.batch_id,
      college_name: assignment.college_name,
      year: assignment.year,
      category: 'Alert',
      title: 'Policy Violation: Late Submission',
      message: `⚠️ POLICY VIOLATION: Assignment "${assignment.title}" was submitted late. Due: ${new Date(assignment.deadline).toLocaleString()}, Submitted: ${new Date(submission.submitted_at).toLocaleString()}. Late submissions may result in mark deductions as per academic policy.`,
      priority: 'Medium',
      link_url: `/assignments?id=${assignment.id}`,
      is_read: false,
      created_by: 'System'
    });
  }
}

export default handlerFor(import.meta.url);
