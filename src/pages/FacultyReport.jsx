import React, { useState, useEffect, useMemo } from "react";
import { Session, Faculty, AttendanceRecord, FacultySession, FacultyExpense } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, DollarSign, TrendingUp } from "lucide-react";
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import FacultyReportCard from "../components/faculty/FacultyReportCard";

// Helper function to parse duration string to hours
const parseDurationToHours = (duration) => {
    if (typeof duration !== 'string') return 0;
    const parts = duration.split(' ');
    if (parts.length < 2) return 0;
    const value = parseFloat(parts[0]);
    const unit = parts[1].toLowerCase();
    if (isNaN(value)) return 0;
    if (unit.startsWith('hour')) return value;
    if (unit.startsWith('min')) return value / 60;
    return 0;
};

export default function FacultyReport() {
    const [sessions, setSessions] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [facultySessions, setFacultySessions] = useState([]);
    const [facultyExpenses, setFacultyExpenses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [sessionData, facultyData, facultySessionsData, facultyExpensesData] = await Promise.all([
                Session.list('-created_date', 500),
                Faculty.list(),
                FacultySession.list(),
                FacultyExpense.list()
            ]);
            setSessions(sessionData);
            setFaculty(facultyData);
            setFacultySessions(facultySessionsData);
            setFacultyExpenses(facultyExpensesData);
        } catch (error) {
            console.error("Error fetching report data:", error);
        }
        setIsLoading(false);
    };

    const facultyReportData = useMemo(() => {
        return faculty.map(f => {
            const fSessions = facultySessions.filter(s => s.faculty_id === f.id);
            const fExpenses = facultyExpenses.filter(e => e.faculty_id === f.id);
            const totalHours = fSessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);
            const totalExpenses = fExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            const totalEarnings = totalHours * (f.rate_per_hour || 0);
            const netPayable = totalEarnings + totalExpenses;

            return {
                ...f,
                totalSessions: fSessions.length,
                totalHours: totalHours.toFixed(1),
                totalExpenses: totalExpenses.toFixed(2),
                totalEarnings: totalEarnings.toFixed(2),
                netPayable: netPayable.toFixed(2)
            };
        });
    }, [faculty, facultySessions, facultyExpenses]);
    
    const exportToCSV = () => {
        const headers = ["Faculty Name", "Email", "Department", "Rate/Hour", "Total Sessions", "Total Hours", "Earnings", "Expenses", "Net Payable"];
        const rows = facultyReportData.map(row => 
            [
                row.name,
                row.email,
                row.department,
                row.rate_per_hour || 0,
                row.totalSessions,
                row.totalHours,
                row.totalEarnings,
                row.totalExpenses,
                row.netPayable
            ].join(',')
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `faculty_billing_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalHoursAll = facultyReportData.reduce((sum, f) => sum + parseFloat(f.totalHours), 0);
    const totalEarningsAll = facultyReportData.reduce((sum, f) => sum + parseFloat(f.totalEarnings), 0);
    const totalExpensesAll = facultyReportData.reduce((sum, f) => sum + parseFloat(f.totalExpenses), 0);
    const totalPayableAll = facultyReportData.reduce((sum, f) => sum + parseFloat(f.netPayable), 0);

    return (
        <div className="p-4 md:p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <DollarSign className="w-8 h-8 text-green-600" />
                            Faculty Billing & Payment Report
                        </h1>
                        <p className="text-gray-600 mt-1">Manage sessions, expenses, and generate invoices</p>
                    </div>
                    <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                        <CardContent className="p-6 text-center">
                            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-80" />
                            <p className="text-3xl font-bold">{totalHoursAll.toFixed(1)}</p>
                            <p className="text-sm opacity-90">Total Hours</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                        <CardContent className="p-6 text-center">
                            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-80" />
                            <p className="text-3xl font-bold">₹{totalEarningsAll.toFixed(0)}</p>
                            <p className="text-sm opacity-90">Total Earnings</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                        <CardContent className="p-6 text-center">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-80" />
                            <p className="text-3xl font-bold">₹{totalExpensesAll.toFixed(0)}</p>
                            <p className="text-sm opacity-90">Total Expenses</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                        <CardContent className="p-6 text-center">
                            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-80" />
                            <p className="text-3xl font-bold">₹{totalPayableAll.toFixed(0)}</p>
                            <p className="text-sm opacity-90">Total Payable</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    {isLoading ? (
                        Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
                    ) : (
                        facultyReportData.map((facultyMember) => (
                            <FacultyReportCard key={facultyMember.id} faculty={facultyMember} onUpdate={fetchData} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}