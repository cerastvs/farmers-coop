"use client";

import Link from "next/link";
import { logout } from "../login/actions";
import { useEffect, useState } from "react";
import { Application } from "../generated/prisma/client";
import { handleSubmit } from "./actions";

function FormField({
  error,
  children,
}: {
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[72px] flex flex-col justify-start">
      <p className="text-red-500 text-sm h-4">{error || ""}</p>
      {children}
    </div>
  );
}

export default function Registration() {
  const [loading, setLoading] = useState(false);
  const [application, setApplicaton] = useState<Application | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/registration")
      .then(async (res) => {
        if (res.status === 401) {
          console.error("Not logged in");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setApplicaton(data);
        }
      })
      .catch((err) => {
        console.error("Fetch failed:", err);
      });
  }, []);
  if (!mounted) return null;

  const isUpdate = !!application;

  return (
    <div className="min-h-screen bg-[#cfe1ce] font-sans flex flex-col items-center py-6 sm:py-12">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col min-h-screen sm:min-h-0">
        <div className="p-6 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="text-[#51a808] font-bold flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </Link>
          <h1 className="text-xl font-black text-[#2d6a2d]">
            {isUpdate ? "Edit Profile" : "Application"}
          </h1>
          <div className="w-10"></div>
        </div>

        <form
          key={application?.id || "new"}
          className="flex-1 flex flex-col px-6 pb-8"
          onSubmit={(e) => handleSubmit(e, setLoading, setErrors, isUpdate)}
        >
          <input type="hidden" name="userId" value="" />

          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">
              Personal Information
            </h2>

            <div className="space-y-4">
              <FormField error={errors.fullName}>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Your Name *"
                  defaultValue={application?.fullName || ""}
                  className={`w-full border rounded-lg px-4 py-3 ${
                    errors.fullName ? "border-red-500" : "border-gray-200"
                  }`}
                />
              </FormField>

              <FormField error={errors.contact}>
                <input
                  type="text"
                  name="contact"
                  placeholder="Your Phone Number *"
                  defaultValue={application?.contact || ""}
                  className={`w-full border rounded-lg px-4 py-3 ${
                    errors.contact ? "border-red-500" : "border-gray-200"
                  }`}
                />
              </FormField>

              <FormField error={errors.address}>
                <input
                  type="text"
                  name="address"
                  placeholder="Current Address *"
                  defaultValue={application?.address || ""}
                  className={`w-full border rounded-lg px-4 py-3 ${
                    errors.address ? "border-red-500" : "border-gray-200"
                  }`}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField error={errors.age}>
                  <input
                    type="number"
                    name="age"
                    placeholder="Age *"
                    defaultValue={application?.age || ""}
                    className={`w-full border rounded-lg px-4 py-3 ${
                      errors.age ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                </FormField>

                <FormField error={errors.gender}>
                  <select
                    name="gender"
                    defaultValue={application?.gender || ""}
                    className={`w-full border rounded-lg px-4 py-3 bg-white ${
                      errors.gender ? "border-red-500" : "border-gray-200"
                    }`}
                  >
                    <option value="">Gender *</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </FormField>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">
              Farming Details
            </h2>

            <div className="space-y-4">
              <FormField error={errors.farmSize}>
                <input
                  type="number"
                  step="0.01"
                  name="farmSize"
                  placeholder="Farm Size (in hectares) *"
                  defaultValue={application?.farmSize || ""}
                  className={`w-full border rounded-lg px-4 py-3 ${
                    errors.farmSize ? "border-red-500" : "border-gray-200"
                  }`}
                />
              </FormField>

              <FormField error={errors.cropType}>
                <input
                  type="text"
                  name="cropType"
                  placeholder="Principal Crop Types *"
                  defaultValue={application?.cropType || ""}
                  className={`w-full border rounded-lg px-4 py-3 ${
                    errors.cropType ? "border-red-500" : "border-gray-200"
                  }`}
                />
              </FormField>

              <FormField error={errors.yearsFarming}>
                <input
                  type="number"
                  name="yearsFarming"
                  placeholder="Years of Farming *"
                  defaultValue={application?.yearsFarming || ""}
                  className={`w-full border rounded-lg px-4 py-3 ${
                    errors.yearsFarming ? "border-red-500" : "border-gray-200"
                  }`}
                />
              </FormField>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">
              Requirements
            </h2>

            <div className="space-y-5">
              <FormField error={errors.validId}>
                <label className="text-xs font-semibold text-gray-500 uppercase px-1">
                  Valid Identification {isUpdate && "(Leave blank to keep current)"}
                </label>

                <div
                  className={`flex items-center justify-between border rounded-lg px-4 py-3 ${
                    errors.validId ? "border-red-500" : "border-gray-200"
                  }`}
                >
                  <input
                    type="file"
                    name="validId"
                    accept="image/*"
                    className="hidden"
                    id="validId"
                  />

                  <label
                    htmlFor="validId"
                    className="cursor-pointer text-sm text-gray-600"
                  >
                    {isUpdate ? "Change file" : "Choose file"}
                  </label>

                  <span className="text-xs text-gray-400">Image only</span>
                </div>
                {application?.validIdUrl && (
                  <p className="text-[10px] text-gray-400 mt-1 truncate">
                    Current: {application.validIdUrl}
                  </p>
                )}
              </FormField>

              <FormField error={errors.proofOfFarm}>
                <label className="text-xs font-semibold text-gray-500 uppercase px-1">
                  Proof of Farming {isUpdate && "(Leave blank to keep current)"}
                </label>

                <div
                  className={`flex items-center justify-between border rounded-lg px-4 py-3 ${
                    errors.proofOfFarm ? "border-red-500" : "border-gray-200"
                  }`}
                >
                  <input
                    type="file"
                    name="proofOfFarm"
                    accept="image/*"
                    className="hidden"
                    id="proofOfFarm"
                  />

                  <label
                    htmlFor="proofOfFarm"
                    className="cursor-pointer text-sm text-gray-600"
                  >
                    {isUpdate ? "Change file" : "Choose file"}
                  </label>

                  <span className="text-xs text-gray-400">Image only</span>
                </div>
                {application?.proofOfFarmUrl && (
                  <p className="text-[10px] text-gray-400 mt-1 truncate">
                    Current: {application.proofOfFarmUrl}
                  </p>
                )}
              </FormField>
            </div>
          </div>

          <div className="mt-auto">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#51a808] text-white py-4 rounded-xl font-bold text-lg shadow-md disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : isUpdate
                ? "Update Profile"
                : "Submit Application"}
            </button>
          </div>
        </form>

        <div className="p-4 border-t text-center">
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-400">
              logout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
