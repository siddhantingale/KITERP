import os from 'node:os';
import fs from 'node:fs/promises';
import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return Response.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Fetch session details
    const session = await client.asServiceRole.entities.Session.get(session_id);
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch batch details
    const batches = await client.asServiceRole.entities.Batch.filter({ batch_id: session.batch_id });
    const batch = batches.length > 0 ? batches[0] : null;

    // Fetch students in batch
    const students = await client.asServiceRole.entities.Student.filter({ batch_id: session.batch_id });
    
    // Fetch attendance records for this session
    const attendanceRecords = await client.asServiceRole.entities.AttendanceRecord.filter({ session_id });

    // Generate Excel report
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Title Section
    const title = `EDU TRACK - Attendance Report`;
    const subtitle = `${session.college_name} - ${session.year}`;
    const sessionInfo = `Session: ${session.session_name} | Date: ${new Date(session.session_date).toLocaleDateString()}`;

    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = title;
    worksheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }
    };
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = subtitle;
    worksheet.getCell('A2').font = { name: 'Calibri', size: 12, bold: true };
    worksheet.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' }
    };
    worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 25;

    worksheet.mergeCells('A3:F3');
    worksheet.getCell('A3').value = sessionInfo;
    worksheet.getCell('A3').font = { name: 'Calibri', size: 10, italic: true };
    worksheet.getCell('A3').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(3).height = 20;

    worksheet.addRow([]);

    // Header Row
    const headerRow = ['Roll No.', 'PRN', 'Student Name', 'Status', 'Marked At', 'Marked By'];
    const excelHeaderRow = worksheet.addRow(headerRow);
    excelHeaderRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    excelHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    };
    excelHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    excelHeaderRow.height = 25;

    worksheet.getColumn(1).width = 12;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 20;
    worksheet.getColumn(6).width = 30;

    // Data rows
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.student_id] = record;
    });

    const sortedStudents = students.sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0));
    
    sortedStudents.forEach((student, index) => {
      const attendance = attendanceMap[student.id];
      const isPresent = attendance?.is_present || false;

      const row = [
        student.roll_no || (index + 1).toString(),
        student.prn || '',
        student.name || '',
        isPresent ? 'Present' : 'Absent',
        attendance?.marked_at ? new Date(attendance.marked_at).toLocaleString() : '',
        attendance?.marked_by || ''
      ];

      const dataRow = worksheet.addRow(row);
      dataRow.font = { name: 'Calibri', size: 10 };
      dataRow.alignment = { vertical: 'middle', horizontal: 'left' };

      // Color coding for status
      const statusCell = dataRow.getCell(4);
      if (isPresent) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF10B981' } // Green
        };
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF4444' } // Red
        };
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add borders
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Summary
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow([
      'Summary:',
      `Total: ${students.length}`,
      `Present: ${session.present_count || 0}`,
      `Absent: ${students.length - (session.present_count || 0)}`,
      `Attendance: ${students.length > 0 ? Math.round((session.present_count || 0) / students.length * 100) : 0}%`
    ]);
    summaryRow.font = { name: 'Calibri', size: 11, bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' }
    };

    const footerRow = worksheet.addRow(['Generated by EDU TRACK Education Management System']);
    worksheet.mergeCells(footerRow.number, 1, footerRow.number, 6);
    footerRow.getCell(1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF6B7280' } };
    footerRow.getCell(1).alignment = { horizontal: 'center' };

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const tempFilePath = `${os.tmpdir()}/attendance_${session_id}_${Date.now()}.xlsx`;
    await fs.writeFile(tempFilePath, new Uint8Array(buffer));

    // Setup NodeMailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env['EMAIL_USER'],
        pass: process.env['EMAIL_PASS']
      }
    });

    // Prepare email recipients
    const recipients = [];
    if (session.tpo_email) recipients.push(session.tpo_email);
    if (session.faculty_email) recipients.push(session.faculty_email);
    const adminEmail = process.env['ADMIN_EMAIL'];
    if (adminEmail) recipients.push(adminEmail);

    if (recipients.length === 0) {
      return Response.json({ 
        error: 'No recipients configured. Please set TPO email or Admin email.' 
      }, { status: 400 });
    }

    // Professional Academic Email Content
    const attendanceRate = students.length > 0 ? Math.round((session.present_count || 0) / students.length * 100) : 0;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 0; }
          .email-wrapper { width: 100%; padding: 20px 0; }
          .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 35px 30px; text-align: center; }
          .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; }
          .header p { margin: 0; font-size: 14px; opacity: 0.95; }
          .content { padding: 35px 30px; }
          .section-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
          .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden; }
          .info-table td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
          .info-table td:first-child { font-weight: 600; color: #4b5563; width: 180px; }
          .info-table tr:last-child td { border-bottom: none; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0; }
          .stat-card { background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #d1d5db; }
          .stat-card.present { background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-color: #6ee7b7; }
          .stat-card.absent { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-color: #fca5a5; }
          .stat-card.rate { background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%); border-color: #a78bfa; }
          .stat-number { font-size: 32px; font-weight: 700; margin: 0 0 6px 0; color: #1f2937; }
          .stat-label { font-size: 13px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
          .notice-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 18px 20px; border-radius: 6px; margin: 25px 0; }
          .notice-box strong { color: #1e40af; display: block; margin-bottom: 6px; font-size: 15px; }
          .notice-box p { margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6; }
          .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 18px 20px; border-radius: 6px; margin: 25px 0; }
          .warning-box strong { color: #92400e; display: block; margin-bottom: 8px; font-size: 15px; }
          .warning-box p { margin: 0 0 8px 0; color: #92400e; font-size: 14px; }
          .warning-box ul { margin: 8px 0 0 20px; color: #92400e; font-size: 13px; }
          .footer { background: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb; text-align: center; }
          .footer p { margin: 5px 0; color: #6b7280; font-size: 13px; }
          .footer-logo { font-weight: 700; color: #1e40af; font-size: 15px; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>Attendance Report</h1>
              <p>Academic Session Documentation</p>
            </div>
            
            <div class="content">
              <p style="margin: 0 0 25px 0; font-size: 15px; color: #4b5563;">Dear Administrator,</p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.7; color: #4b5563;">
                This email contains the attendance report for the session conducted on 
                <strong>${new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>. 
                Please find the detailed attendance records attached to this email.
              </p>

              <h2 class="section-title">Session Information</h2>
              <table class="info-table">
                <tr>
                  <td>Session Name:</td>
                  <td>${session.session_name}</td>
                </tr>
                <tr>
                  <td>Date & Time:</td>
                  <td>${new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${session.session_time}</td>
                </tr>
                <tr>
                  <td>Topic Covered:</td>
                  <td>${session.topic_taught}</td>
                </tr>
                <tr>
                  <td>Faculty:</td>
                  <td>${session.faculty_name}</td>
                </tr>
                <tr>
                  <td>Institution:</td>
                  <td>${session.college_name}</td>
                </tr>
                <tr>
                  <td>Academic Year:</td>
                  <td>${session.year}</td>
                </tr>
              </table>

              <h2 class="section-title">Attendance Statistics</h2>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-number">${students.length}</div>
                  <div class="stat-label">Total Students</div>
                </div>
                <div class="stat-card present">
                  <div class="stat-number">${session.present_count || 0}</div>
                  <div class="stat-label">Present</div>
                </div>
                <div class="stat-card absent">
                  <div class="stat-number">${students.length - (session.present_count || 0)}</div>
                  <div class="stat-label">Absent</div>
                </div>
                <div class="stat-card rate">
                  <div class="stat-number">${attendanceRate}%</div>
                  <div class="stat-label">Attendance Rate</div>
                </div>
              </div>

              ${attendanceRate < 75 ? `
              <div class="warning-box">
                <strong>Attendance Alert</strong>
                <p>The attendance rate for this session is below the recommended threshold of 75%. Please consider the following actions:</p>
                <ul>
                  <li>Review the list of absent students</li>
                  <li>Contact students with repeated absences</li>
                  <li>Schedule remedial sessions if necessary</li>
                  <li>Update parents/guardians as per institutional policy</li>
                </ul>
              </div>
              ` : `
              <div class="notice-box">
                <strong>Attendance Status: Satisfactory</strong>
                <p>The attendance rate meets the institutional standards. The detailed attendance record is attached for your review and record-keeping purposes.</p>
              </div>
              `}

              <div class="notice-box">
                <strong>Attached Document</strong>
                <p>A comprehensive Excel report is attached to this email. The report includes student-wise attendance records with color-coded indicators (Green: Present, Red: Absent) for easy reference.</p>
              </div>

              <p style="margin: 25px 0 0 0; font-size: 14px; color: #4b5563;">
                Should you require any clarification or additional information, please do not hesitate to contact the faculty member or the academic administration office.
              </p>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #4b5563;">
                Best regards,<br>
                <strong>EDU TRACK Academic System</strong>
              </p>
            </div>
            
            <div class="footer">
              <div class="footer-logo">EDU TRACK</div>
              <p>Education Management System</p>
              <p>This is an automated notification. Please do not reply to this email.</p>
              <p style="margin-top: 12px; color: #9ca3af; font-size: 12px;">
                Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const mailOptions = {
      from: `"EDU TRACK Academic System" <${process.env['EMAIL_USER']}>`,
      to: recipients.join(', '),
      subject: `Attendance Report: ${session.session_name} - ${new Date(session.session_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      html: emailHtml,
      attachments: [
        {
          filename: `Attendance_Report_${session.college_name}_${session.year}_${new Date(session.session_date).toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'),
          path: tempFilePath
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);

    // Clean up temp file
    try {
      await fs.rm(tempFilePath);
    } catch (e) {
      console.warn('Failed to remove temp file:', e);
    }

    // Log email delivery
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      recipients: recipients,
      session: session.session_name,
      timestamp: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: 'Attendance report sent successfully',
      recipients: recipients,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending attendance report:', error);
    return Response.json({ 
      error: 'Failed to send attendance report', 
      details: error.message 
    }, { status: 500 });
  }
});

export default handlerFor(import.meta.url);
