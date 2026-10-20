import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const StatCard = ({ title, value, icon: Icon, bgColor, textColor, trend }) => (
  <Card className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
    <div className={`absolute top-0 right-0 w-24 h-24 transform translate-x-6 -translate-y-6 ${bgColor} rounded-full opacity-10`} />
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      <div className={`p-2 rounded-lg ${bgColor} bg-opacity-20`}>
        <Icon className={`w-5 h-5 ${textColor}`} />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {trend && (
        <p className="text-xs text-slate-500 mt-1">{trend}</p>
      )}
    </CardContent>
  </Card>
);

export default function StatsGrid({ totalSessions, todaySessionsCount, totalStudents, attendanceRate, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Sessions"
        value={totalSessions}
        icon={Calendar}
        bgColor="bg-blue-500"
        textColor="text-blue-600"
        trend="All time"
      />
      <StatCard
        title="Today's Sessions"
        value={todaySessionsCount}
        icon={Clock}
        bgColor="bg-green-500"
        textColor="text-green-600"
        trend="Active today"
      />
      <StatCard
        title="Total Students"
        value={totalStudents}
        icon={Users}
        bgColor="bg-purple-500"
        textColor="text-purple-600"
        trend="Across all batches"
      />
      <StatCard
        title="Attendance Rate"
        value={`${attendanceRate.toFixed(1)}%`}
        icon={TrendingUp}
        bgColor="bg-orange-500"
        textColor="text-orange-600"
        trend="Average rate"
      />
    </div>
  );
}