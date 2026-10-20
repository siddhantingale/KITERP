import React, { useState, useEffect } from "react";
import { FacultyInvoice, FacultySession, FacultyExpense } from "@/entities/all";
import { generateFacultyInvoice } from "@/functions/generateFacultyInvoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function FacultyInvoicesTab({ faculty }) {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    billing_period_start: "",
    billing_period_end: "",
    remarks: ""
  });

  useEffect(() => {
    loadInvoices();
  }, [faculty.id]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const data = await FacultyInvoice.filter({ faculty_id: faculty.id }, "-created_date");
      setInvoices(data);
    } catch (error) {
      console.error("Error loading invoices:", error);
    }
    setIsLoading(false);
  };

  const handleGenerateInvoice = async () => {
    if (!formData.billing_period_start || !formData.billing_period_end) {
      alert("Please select billing period");
      return;
    }

    setGenerating(true);
    try {
      // Fetch sessions and expenses for the period
      const allSessions = await FacultySession.filter({ faculty_id: faculty.id });
      const allExpenses = await FacultyExpense.filter({ faculty_id: faculty.id });

      const periodSessions = allSessions.filter(s => 
        s.session_date >= formData.billing_period_start && 
        s.session_date <= formData.billing_period_end
      );

      const periodExpenses = allExpenses.filter(e => 
        e.expense_date >= formData.billing_period_start && 
        e.expense_date <= formData.billing_period_end
      );

      const totalHours = periodSessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);
      const totalExpenses = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const ratePerHour = faculty.rate_per_hour || 0;
      const subtotal = totalHours * ratePerHour;
      const grandTotal = subtotal + totalExpenses;

      // Generate invoice number
      const invoiceNumber = `INV-${faculty.email.split('@')[0].toUpperCase()}-${Date.now()}`;

      // Create invoice record
      const invoiceData = {
        faculty_id: faculty.id,
        faculty_email: faculty.email,
        invoice_number: invoiceNumber,
        billing_period_start: formData.billing_period_start,
        billing_period_end: formData.billing_period_end,
        total_hours: totalHours,
        rate_per_hour: ratePerHour,
        subtotal: subtotal,
        total_expenses: totalExpenses,
        grand_total: grandTotal,
        status: "Generated",
        remarks: formData.remarks
      };

      await FacultyInvoice.create(invoiceData);
      
      loadInvoices();
      handleCloseModal();
      alert("Invoice generated successfully!");
    } catch (error) {
      console.error("Error generating invoice:", error);
      alert("Failed to generate invoice");
    }
    setGenerating(false);
  };

  const handleDownloadPDF = async (invoice) => {
    try {
      // Fetch detailed data for PDF
      const allSessions = await FacultySession.filter({ faculty_id: faculty.id });
      const allExpenses = await FacultyExpense.filter({ faculty_id: faculty.id });

      const periodSessions = allSessions.filter(s => 
        s.session_date >= invoice.billing_period_start && 
        s.session_date <= invoice.billing_period_end
      );

      const periodExpenses = allExpenses.filter(e => 
        e.expense_date >= invoice.billing_period_start && 
        e.expense_date <= invoice.billing_period_end
      );

      const response = await generateFacultyInvoice({
        faculty,
        invoice,
        sessions: periodSessions,
        expenses: periodExpenses
      });

      // Convert base64 to blob and download
      const byteCharacters = atob(response.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Failed to download PDF");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      billing_period_start: "",
      billing_period_end: "",
      remarks: ""
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Invoices</h3>
        <Button onClick={() => setIsModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          Generate Invoice
        </Button>
      </div>

      <div className="grid gap-4">
        {invoices.map((invoice) => (
          <Card key={invoice.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    {invoice.invoice_number}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Period: {format(new Date(invoice.billing_period_start), "dd MMM")} - {format(new Date(invoice.billing_period_end), "dd MMM yyyy")}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                  invoice.status === 'Generated' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {invoice.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Hours</p>
                  <p className="text-lg font-bold">{invoice.total_hours}h</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rate/Hour</p>
                  <p className="text-lg font-bold">₹{invoice.rate_per_hour}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Expenses</p>
                  <p className="text-lg font-bold text-orange-600">₹{invoice.total_expenses}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-bold text-green-600">₹{invoice.grand_total}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleDownloadPDF(invoice)} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {invoices.length === 0 && !isLoading && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No invoices generated yet</p>
              <Button onClick={() => setIsModalOpen(true)} className="mt-4">Generate First Invoice</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Billing Period Start *</Label>
              <Input
                type="date"
                value={formData.billing_period_start}
                onChange={(e) => setFormData({...formData, billing_period_start: e.target.value})}
              />
            </div>
            <div>
              <Label>Billing Period End *</Label>
              <Input
                type="date"
                value={formData.billing_period_end}
                onChange={(e) => setFormData({...formData, billing_period_end: e.target.value})}
              />
            </div>
            <div>
              <Label>Remarks / Notes</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                placeholder="Any additional notes for this invoice..."
                rows={3}
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Current Rate:</strong> ₹{faculty.rate_per_hour || 0}/hour
              </p>
              <p className="text-xs text-blue-700 mt-1">Invoice will include all sessions and expenses within the selected period</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleGenerateInvoice} disabled={generating}>
              {generating ? "Generating..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}