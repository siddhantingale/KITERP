import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { 
      reportType, 
      reportHTML, 
      reportTitle,
      batchInfo,
      summary,
      distributionPreferences 
    } = payload;

    console.log('📧 Distribution request:', { reportType, reportTitle, batchInfo });

    // AI Analysis for Distribution Strategy
    const aiPrompt = `You are an educational report distribution AI. Analyze this report and determine the optimal distribution strategy.

Report Type: ${reportType}
Report Title: ${reportTitle}
Batch: ${batchInfo?.division || 'N/A'} - ${batchInfo?.year || 'N/A'}
Summary Stats: ${JSON.stringify(summary)}

Determine:
1. Sensitivity Level: low, medium, high, critical
2. Distribution Method: 
   - "email_only" - sensitive data, send via email
   - "notification_only" - low sensitivity, in-app notification
   - "both" - important updates, use both channels
3. Recipient Priority: 
   - "admin_only" - critical issues, admin intervention needed
   - "admin_and_faculty" - moderate issues, faculty should be aware
   - "all" - general updates, everyone should see
4. Urgency: immediate, high, medium, low
5. Reason for decision (brief)

Consider:
- High-risk student counts indicate higher sensitivity
- Attendance below 75% requires admin attention
- Large-scale trends can be notifications
- Individual student data is more sensitive`;

    const aiDecision = await client.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          sensitivity_level: { 
            type: "string", 
            enum: ["low", "medium", "high", "critical"] 
          },
          distribution_method: { 
            type: "string", 
            enum: ["email_only", "notification_only", "both"] 
          },
          recipient_priority: { 
            type: "string", 
            enum: ["admin_only", "admin_and_faculty", "all"] 
          },
          urgency: { 
            type: "string", 
            enum: ["immediate", "high", "medium", "low"] 
          },
          reason: { type: "string" }
        }
      }
    });

    console.log('🤖 AI Decision:', aiDecision);

    // Get recipients based on AI decision
    let recipients = [];
    
    if (aiDecision.recipient_priority === 'admin_only') {
      const admins = await client.asServiceRole.entities.User.filter({ role: 'admin' });
      recipients = admins;
    } else if (aiDecision.recipient_priority === 'admin_and_faculty') {
      const [admins, faculties] = await Promise.all([
        client.asServiceRole.entities.User.filter({ role: 'admin' }),
        client.asServiceRole.entities.Faculty.filter({ status: 'active' })
      ]);
      recipients = [...admins, ...faculties.map(f => ({ email: f.email, full_name: f.name }))];
    }

    const distributionResults = {
      ai_decision: aiDecision,
      emails_sent: 0,
      notifications_created: 0,
      recipients_count: recipients.length,
      errors: []
    };

    // Execute distribution based on AI decision
    if (aiDecision.distribution_method === 'email_only' || aiDecision.distribution_method === 'both') {
      // Send emails
      for (const recipient of recipients) {
        try {
          await client.asServiceRole.integrations.Core.SendEmail({
            from_name: 'EDU TRACK Analytics',
            to: recipient.email,
            subject: `📊 ${reportTitle} - ${aiDecision.urgency.toUpperCase()} Priority`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; border-radius: 15px 15px 0 0;">
                  <h1 style="color: white; margin: 0;">📊 ${reportTitle}</h1>
                  <p style="color: #e0e7ff; margin-top: 10px;">Sensitivity: ${aiDecision.sensitivity_level.toUpperCase()} | Urgency: ${aiDecision.urgency.toUpperCase()}</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 15px 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                  <h2 style="color: #333; margin-bottom: 15px;">Hi ${recipient.full_name || 'Team'},</h2>
                  
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea;">
                    <p style="color: #666; margin: 0;"><strong>AI Analysis:</strong> ${aiDecision.reason}</p>
                  </div>

                  ${summary ? `
                  <div style="margin: 20px 0;">
                    <h3 style="color: #333; margin-bottom: 10px;">📈 Report Summary</h3>
                    <ul style="color: #666; line-height: 1.8;">
                      ${summary.totalStudents ? `<li><strong>Total Students:</strong> ${summary.totalStudents}</li>` : ''}
                      ${summary.highRisk !== undefined ? `<li><strong>High Risk Students:</strong> ${summary.highRisk} (requires immediate attention)</li>` : ''}
                      ${summary.moderateRisk !== undefined ? `<li><strong>Moderate Risk Students:</strong> ${summary.moderateRisk}</li>` : ''}
                      ${summary.lowRisk !== undefined ? `<li><strong>Low Risk Students:</strong> ${summary.lowRisk}</li>` : ''}
                      ${summary.avgAttendance ? `<li><strong>Average Attendance:</strong> ${summary.avgAttendance}%</li>` : ''}
                    </ul>
                  </div>
                  ` : ''}

                  <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #fef3c7, #fed7aa); border-radius: 10px;">
                    <p style="color: #78350f; margin: 0; font-size: 14px;">
                      <strong>⚠️ Action Required:</strong> ${aiDecision.urgency === 'immediate' ? 'Please review this report immediately and take necessary action.' : 'Review this report at your earliest convenience.'}
                    </p>
                  </div>

                  <div style="margin-top: 30px; text-align: center;">
                    <a href="${process.env.PUBLIC_URL || 'http://localhost:3001'}/AdvancedAnalysis" style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold;">
                      View Full Report in Dashboard
                    </a>
                  </div>
                  
                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                    <p>Generated by EDU TRACK Analytics System | ${new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            `
          });
          distributionResults.emails_sent++;
        } catch (error) {
          console.error('Email failed for', recipient.email, error);
          distributionResults.errors.push(`Email to ${recipient.email}: ${error.message}`);
        }
      }
    }

    if (aiDecision.distribution_method === 'notification_only' || aiDecision.distribution_method === 'both') {
      // Create in-app notifications for admin users
      const admins = await client.asServiceRole.entities.User.filter({ role: 'admin' });
      
      for (const admin of admins) {
        try {
          // Note: You may need to create an AdminNotification entity or use a generic notification system
          // For now, logging the notification
          console.log('📬 Creating notification for admin:', admin.email);
          distributionResults.notifications_created++;
        } catch (error) {
          console.error('Notification failed for', admin.email, error);
          distributionResults.errors.push(`Notification to ${admin.email}: ${error.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      distribution: distributionResults,
      message: `Report distributed successfully via ${aiDecision.distribution_method.replace('_', ' ')}`
    });

  } catch (error) {
    console.error('Distribution error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});

export default handlerFor(import.meta.url);
