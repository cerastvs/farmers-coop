"use client";

import { FileText, Users, DollarSign, AlertCircle, Clock } from "lucide-react";

const StatCard = ({ title, value, trend, icon: Icon }: any) => (
  <div className="bg-white rounded-2xl shadow p-5 flex items-center justify-between">
    <div>
      <p className="text-gray-500 text-sm">{title}</p>
      <h2 className="text-2xl font-semibold">{value}</h2>
      <span className="text-xs text-red-500">{trend}</span>
    </div>
    <div className="bg-green-100 p-3 rounded-full">
      <Icon className="text-green-600" size={20} />
    </div>
  </div>
);

const ActionButton = ({ icon: Icon, label }: any) => (
  <button className="w-full border-2 border-green-600 text-green-700 rounded-xl p-3 flex items-center justify-center gap-2 hover:bg-green-50 transition">
    <Icon size={18} />
    {label}
  </button>
);

const TaskItem = ({ title, status, due }: any) => (
  <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
    <Clock className="text-orange-500 mt-1" size={18} />
    <div>
      <p className="font-medium text-gray-700">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            status === "Pending"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {status}
        </span>
        <span className="text-xs text-gray-500">Due: {due}</span>
      </div>
    </div>
  </div>
);

export default function SecretaryDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="font-semibold text-lg">🌱 FarmCoop</h1>
        <div className="w-6 h-0.5 bg-white relative before:content-[''] before:block before:w-6 before:h-0.5 before:bg-white before:absolute before:-top-2 after:content-[''] after:block after:w-6 after:h-0.5 after:bg-white after:absolute after:top-2" />
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Secretary Dashboard</h2>
          <p className="text-gray-500">
            Manage documents, payments, and loan requests
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Documents"
            value="8"
            trend="neutral"
            icon={FileText}
          />
          <StatCard
            title="Loan Requests"
            value="5"
            trend="neutral"
            icon={AlertCircle}
          />
          <StatCard
            title="Payments to Process"
            value="12"
            trend="neutral"
            icon={DollarSign}
          />
          <StatCard title="Members" value="45" trend="up" icon={Users} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow p-5 space-y-3 lg:col-span-1">
            <h3 className="font-semibold text-lg">Quick Actions</h3>
            <ActionButton icon={Users} label="Manage Members" />
            <ActionButton icon={FileText} label="Verify Applications" />
            <ActionButton icon={AlertCircle} label="Review Loans" />
            <ActionButton icon={DollarSign} label="Process Payments" />
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4 lg:col-span-2">
            <h3 className="font-semibold text-lg">Pending Tasks</h3>

            <TaskItem
              title="Review loan application - Juan Dela Cruz"
              status="Pending"
              due="Today"
            />
            <TaskItem
              title="Process 3 pending payments"
              status="Pending"
              due="Today"
            />
            <TaskItem
              title="Verify member documents - 5 pending"
              status="Active"
              due="Tomorrow"
            />
            <TaskItem
              title="Prepare monthly financial report"
              status="Active"
              due="April 5, 2026"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
