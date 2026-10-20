import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';
import { jsPDF } from 'jspdf';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const { faculty, invoice, sessions, expenses } = await req.json();

    // Create PDF
    const doc = new jsPDF();
    let yPos = 20;

    // Header with Logo placeholder
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('APT-TECH CRT Solutions', 105, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Campus Recruitment Training', 105, yPos, { align: 'center' });
    
    // Invoice Header
    yPos += 15;
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('FACULTY INVOICE', 105, yPos, { align: 'center' });

    // Invoice Details
    yPos += 15;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Invoice Number: ${invoice.invoice_number}`, 20, yPos);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 150, yPos);
    
    yPos += 7;
    doc.text(`Faculty: ${faculty.name}`, 20, yPos);
    doc.text(`Email: ${faculty.email}`, 20, yPos + 7);
    doc.text(`Department: ${faculty.department || 'N/A'}`, 20, yPos + 14);
    
    yPos += 21;
    doc.text(`Billing Period: ${new Date(invoice.billing_period_start).toLocaleDateString('en-IN')} to ${new Date(invoice.billing_period_end).toLocaleDateString('en-IN')}`, 20, yPos);

    // Sessions Table
    yPos += 15;
    doc.setFont(undefined, 'bold');
    doc.text('TEACHING SESSIONS', 20, yPos);
    
    yPos += 7;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 5, 170, 8, 'F');
    doc.text('Date', 25, yPos);
    doc.text('Session Title', 50, yPos);
    doc.text('Hours', 140, yPos);
    doc.text('Amount (₹)', 160, yPos);

    yPos += 7;
    doc.setFont(undefined, 'normal');

    sessions.forEach(session => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(new Date(session.session_date).toLocaleDateString('en-IN'), 25, yPos);
      doc.text(session.session_title.substring(0, 30), 50, yPos);
      doc.text(session.total_hours.toString(), 140, yPos);
      doc.text((session.total_hours * invoice.rate_per_hour).toFixed(2), 160, yPos);
      yPos += 7;
    });

    // Subtotal
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text(`Subtotal (Hours × ₹${invoice.rate_per_hour}/hr):`, 110, yPos);
    doc.text(`₹${invoice.subtotal.toFixed(2)}`, 160, yPos);

    // Expenses Table
    if (expenses.length > 0) {
      yPos += 15;
      doc.text('EXPENSES', 20, yPos);
      
      yPos += 7;
      doc.setFillColor(240, 240, 240);
      doc.rect(20, yPos - 5, 170, 8, 'F');
      doc.text('Date', 25, yPos);
      doc.text('Type', 50, yPos);
      doc.text('Description', 90, yPos);
      doc.text('Amount (₹)', 160, yPos);

      yPos += 7;
      doc.setFont(undefined, 'normal');

      expenses.forEach(expense => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(new Date(expense.expense_date).toLocaleDateString('en-IN'), 25, yPos);
        doc.text(expense.expense_type, 50, yPos);
        doc.text(expense.description ? expense.description.substring(0, 20) : '-', 90, yPos);
        doc.text(expense.amount.toFixed(2), 160, yPos);
        yPos += 7;
      });

      yPos += 5;
      doc.setFont(undefined, 'bold');
      doc.text('Total Expenses:', 110, yPos);
      doc.text(`₹${invoice.total_expenses.toFixed(2)}`, 160, yPos);
    }

    // Grand Total
    yPos += 15;
    doc.setFillColor(0, 120, 200);
    doc.rect(20, yPos - 7, 170, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('GRAND TOTAL PAYABLE:', 25, yPos);
    doc.text(`₹${invoice.grand_total.toFixed(2)}`, 160, yPos);

    // Footer
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    yPos += 20;
    if (invoice.remarks) {
      doc.setFont(undefined, 'normal');
      doc.text('Remarks:', 20, yPos);
      doc.text(invoice.remarks, 20, yPos + 7, { maxWidth: 170 });
      yPos += 20;
    }

    doc.setFont(undefined, 'italic');
    doc.setFontSize(8);
    doc.text('This is a computer-generated invoice and does not require a signature.', 105, 280, { align: 'center' });
    doc.text('For queries, contact: admin@apttech.com', 105, 285, { align: 'center' });

    // Convert to base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    return Response.json({ 
      success: true, 
      pdf_base64: pdfBase64,
      invoice_number: invoice.invoice_number 
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

export default handlerFor(import.meta.url);
