import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    
    const { event, data, old_data } = await req.json();
    
    console.log('🤖 AI Notification triggered:', event);

    // Determine notification context
    const context = {
      event_type: event.type,
      entity_name: event.entity_name,
      entity_id: event.entity_id,
      data: data,
      old_data: old_data
    };

    // Use AI to analyze the event and decide notification strategy
    const aiPrompt = `You are an AI notification system for EDU TRACK education platform.

Event Details:
- Entity: ${event.entity_name}
- Action: ${event.type}
- Data: ${JSON.stringify(data, null, 2)}
${old_data ? `- Previous Data: ${JSON.stringify(old_data, null, 2)}` : ''}

Analyze this event and determine:
1. Should a notification be sent? (yes/no)
2. Who should receive it? (students/faculty/admin/specific_user)
3. Notification priority (low/medium/high/urgent)
4. Notification title (concise, under 50 chars)
5. Notification message (clear, actionable, under 150 chars)
6. Should email be sent? (yes/no)
7. Email subject (if applicable)
8. Email body (if applicable, professional and informative)

Consider these scenarios:
- New Assignment created → Notify students in that batch
- Assignment submitted → Notify faculty
- Proxy detected → Urgent notification to admin and student
- Low attendance detected → Warning to student
- Performance record added → Info to student
- Session created → Reminder to students`;

    const aiResponse = await client.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          should_notify: { type: "boolean" },
          recipients: { 
            type: "string",
            description: "students, faculty, admin, or specific email"
          },
          priority: { 
            type: "string",
            enum: ["low", "medium", "high", "urgent"]
          },
          notification_title: { type: "string" },
          notification_message: { type: "string" },
          should_email: { type: "boolean" },
          email_subject: { type: "string" },
          email_body: { type: "string" },
          recipient_emails: {
            type: "array",
            items: { type: "string" },
            description: "List of specific email addresses if known from data"
          }
        }
      }
    });

    console.log('🤖 AI Decision:', aiResponse);

    if (!aiResponse.should_notify) {
      return Response.json({ 
        success: true, 
        message: 'AI determined no notification needed',
        ai_decision: aiResponse
      });
    }

    const notifications = [];
    const emails = [];

    // Determine recipients based on AI analysis
    let recipientEmails = aiResponse.recipient_emails || [];
    
    if (aiResponse.recipients === 'students' && data.batch_id) {
      const students = await client.asServiceRole.entities.Student.filter({ batch_id: data.batch_id });
      recipientEmails = students.map(s => s.email).filter(Boolean);
    } else if (aiResponse.recipients === 'faculty' && data.faculty_email) {
      recipientEmails = [data.faculty_email];
    } else if (aiResponse.recipients === 'admin') {
      const adminEmail = process.env['ADMIN_EMAIL'];
      if (adminEmail) recipientEmails = [adminEmail];
    }

    // Create in-app notifications
    for (const email of recipientEmails) {
      try {
        await client.asServiceRole.entities.StudentNotification.create({
          student_email: email,
          title: aiResponse.notification_title,
          message: aiResponse.notification_message,
          priority: aiResponse.priority,
          type: event.entity_name,
          related_id: event.entity_id,
          is_read: false
        });
        notifications.push(email);
      } catch (err) {
        console.error('Failed to create notification for', email, err);
      }
    }

    // Send emails if AI recommends
    if (aiResponse.should_email && recipientEmails.length > 0) {
      const emailUser = process.env['EMAIL_USER'];
      const emailPass = process.env['EMAIL_PASS'];
      
      if (emailUser && emailPass) {
        for (const email of recipientEmails.slice(0, 50)) { // Limit to 50 emails
          try {
            await client.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject: aiResponse.email_subject || aiResponse.notification_title,
              body: aiResponse.email_body || aiResponse.notification_message,
              from_name: 'EDU TRACK'
            });
            emails.push(email);
          } catch (err) {
            console.error('Failed to send email to', email, err);
          }
        }
      }
    }

    return Response.json({
      success: true,
      notifications_sent: notifications.length,
      emails_sent: emails.length,
      ai_decision: aiResponse,
      recipients: recipientEmails.slice(0, 10) // Sample
    });

  } catch (error) {
    console.error('❌ Notification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

export default handlerFor(import.meta.url);
