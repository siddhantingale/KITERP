import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AttendanceTrends({ sessions, isLoading }) {
  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Attendance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const branchData = sessions.reduce((acc, session) => {
    if (!acc[session.branch]) {
      acc[session.branch] = { total: 0, present: 0, sessions: 0 };
    }
    acc[session.branch].total += session.total_students || 0;
    acc[session.branch].present += session.present_count || 0;
    acc[session.branch].sessions += 1;
    return acc;
  }, {});

  const branchStats = Object.entries(branchData).map(([branch, data]) => ({
    branch,
    rate: data.total > 0 ? (data.present / data.total * 100) : 0,
    sessions: data.sessions
  }));

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Attendance by Branch</CardTitle>
      </CardHeader>
      <CardContent>
        {branchStats.length === 0 ? (
          <div className="text-center py-6">
            <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {branchStats.map((stat) => (
              <div key={stat.branch} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{stat.branch}</p>
                  <p className="text-xs text-slate-500">{stat.sessions} sessions</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{stat.rate.toFixed(1)}%</span>
                  {stat.rate >= 75 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : stat.rate >= 50 ? (
                    <Minus className="w-4 h-4 text-yellow-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}