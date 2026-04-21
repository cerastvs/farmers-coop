"use client";

import { useEffect, useState } from "react";
import { FileText, Users, DollarSign, AlertCircle, Clock, X } from "lucide-react";
import { DashboardHeader } from "../components/DashboardHeader";

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

const TaskItem = ({ title, status, due, onClick, isClickable }: any) => (
  <div 
    onClick={onClick}
    className={`bg-gray-50 rounded-xl p-4 flex items-start gap-3 transition ${isClickable ? "cursor-pointer hover:bg-gray-100 border border-transparent hover:border-green-200" : ""}`}
  >
    <Clock className="text-orange-500 mt-1" size={18} />
    <div className="flex-1">
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

interface Application {
  id: string;
  fullName: string;
  age: number;
  gender: string;
  address: string;
  contact: string;
  farmSize: number;
  cropType: string;
  yearsFarming: number;
  validIdUrl: string;
  proofOfFarmUrl: string;
  status: string;
  createdAt: string;
}

interface SecretaryStats {
  pendingApplicationsCount: number;
  pendingLoansCount: number;
  pendingPaymentsCount: number;
  membersCount: number;
  pendingApplications: Application[];
  pendingTasks: Array<{
    title: string;
    status: string;
    due: string;
    type: string;
  }>;
}

export default function SecretaryDashboard() {
  const [stats, setStats] = useState<SecretaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/secretary/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch secretary stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const closeApplicationModal = () => setSelectedApplication(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      <DashboardHeader />

      <div className="p-6 max-w-7xl mx-auto space-y-6 w-full">
        <div>
          <h2 className="text-2xl font-bold">Secretary Dashboard</h2>
          <p className="text-gray-500">
            Manage documents, payments, and loan requests
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Documents"
            value={stats?.pendingApplicationsCount.toString() || "0"}
            trend="neutral"
            icon={FileText}
          />
          <StatCard
            title="Loan Requests"
            value={stats?.pendingLoansCount.toString() || "0"}
            trend="neutral"
            icon={AlertCircle}
          />
          <StatCard
            title="Payments to Process"
            value={stats?.pendingPaymentsCount.toString() || "0"}
            trend="neutral"
            icon={DollarSign}
          />
          <StatCard
            title="Members"
            value={stats?.membersCount.toString() || "0"}
            trend="up"
            icon={Users}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow p-5 space-y-3 lg:col-span-1 h-fit">
            <h3 className="font-semibold text-lg">Quick Actions</h3>
            <ActionButton icon={Users} label="Manage Members" />
            <ActionButton icon={FileText} label="Verify Applications" />
            <ActionButton icon={AlertCircle} label="Review Loans" />
            <ActionButton icon={DollarSign} label="Process Payments" />
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4 lg:col-span-2">
            <h3 className="font-semibold text-lg">Pending Tasks</h3>

            {/* Pending Applications Section */}
            {stats?.pendingApplications && stats.pendingApplications.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Membership Applications</p>
                {stats.pendingApplications.map((app) => (
                  <TaskItem
                    key={app.id}
                    title={`New Application: ${app.fullName}`}
                    status="Pending"
                    due="ASAP"
                    isClickable={true}
                    onClick={() => setSelectedApplication(app)}
                  />
                ))}
              </div>
            )}

            {/* Other Pending Tasks */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Tasks</p>
              {stats?.pendingTasks && stats.pendingTasks.length > 0 ? (
                stats.pendingTasks.map((task, index) => (
                  <TaskItem
                    key={index}
                    title={task.title}
                    status={task.status}
                    due={task.due}
                  />
                ))
              ) : null}
              
              <TaskItem
                title="Prepare monthly financial report"
                status="Active"
                due="April 5, 2026"
              />
            </div>

            {(!stats?.pendingApplications || stats.pendingApplications.length === 0) && 
             (!stats?.pendingTasks || stats.pendingTasks.length === 0) && (
              <div className="text-center py-8 text-gray-500 italic">
                No pending tasks at the moment
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Application Details Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-green-50/50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Application Details</h3>
                <p className="text-xs text-green-700 font-medium uppercase tracking-wider">Membership Application Review</p>
              </div>
              <button 
                onClick={closeApplicationModal}
                className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Personal Information */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[#2d6a2d]">
                  <Users size={20} />
                  <h4 className="font-bold">Personal Information</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Full Name</p>
                    <p className="font-bold text-gray-800">{selectedApplication.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Age / Gender</p>
                    <p className="font-bold text-gray-800">{selectedApplication.age} years old / {selectedApplication.gender}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 font-medium">Contact Number</p>
                    <p className="font-bold text-gray-800">{selectedApplication.contact}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 font-medium">Residential Address</p>
                    <p className="font-bold text-gray-800 leading-relaxed">{selectedApplication.address}</p>
                  </div>
                </div>
              </section>

              {/* Farm Information */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[#2d6a2d]">
                  <FileText size={20} />
                  <h4 className="font-bold">Farm Details</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Farm Size (Hectares)</p>
                    <p className="font-bold text-gray-800">{selectedApplication.farmSize} ha</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Primary Crop Type</p>
                    <p className="font-bold text-gray-800">{selectedApplication.cropType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Experience</p>
                    <p className="font-bold text-gray-800">{selectedApplication.yearsFarming} Years Farming</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Application Date</p>
                    <p className="font-bold text-gray-800">{new Date(selectedApplication.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </section>

              {/* Verification Documents */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[#2d6a2d]">
                  <AlertCircle size={20} />
                  <h4 className="font-bold">Submitted Documents</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="group relative aspect-[4/3] rounded-2xl bg-gray-100 overflow-hidden border border-gray-200">
                    <div className="absolute inset-0 flex items-center justify-center">
                       <p className="text-xs font-bold text-gray-400">Valid ID Document</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedApplication.validIdUrl} alt="Valid ID" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <a href={selectedApplication.validIdUrl} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-[#2d6a2d] opacity-0 group-hover:opacity-100 transition-opacity">View Full Size</a>
                  </div>
                  <div className="group relative aspect-[4/3] rounded-2xl bg-gray-100 overflow-hidden border border-gray-200">
                    <div className="absolute inset-0 flex items-center justify-center">
                       <p className="text-xs font-bold text-gray-400">Proof of Farming Document</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedApplication.proofOfFarmUrl} alt="Proof of Farming" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <a href={selectedApplication.proofOfFarmUrl} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-[#2d6a2d] opacity-0 group-hover:opacity-100 transition-opacity">View Full Size</a>
                  </div>
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-green-200">
                Approve Member
              </button>
              <button className="flex-1 py-4 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 rounded-2xl font-bold transition-all">
                Reject Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
