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
        if (!res.ok) {
          const text = await res.text();
          console.error("API error:", text);
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

  return (
    <div className="min-h-screen bg-[#cfe1ce] font-sans flex flex-col items-center py-6 sm:py-12">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col min-h-screen sm:min-h-0">
        <div className="p-6 flex items-center">
          <Link href="/" className="text-gray-900">
            ←
          </Link>
        </div>

        <div className="px-6 mb-6">
          <div className="bg-[#51a808] text-white p-5 rounded-xl shadow-md">
            <span className="font-semibold text-lg">Application Status</span>
          </div>
        </div>

        <form
          className="flex-1 flex flex-col px-6 pb-8"
          onSubmit={(e) => handleSubmit(e, setLoading, setErrors)}
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
                    className={`w-full border rounded-lg px-4 py-3 ${
                      errors.age ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                </FormField>

                <FormField error={errors.gender}>
                  <select
                    name="gender"
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

            <div className="space-y-4">
              <FormField error={errors.validId}>
                <input type="file" name="validId" accept="image/*" />
              </FormField>

              <FormField error={errors.proofOfFarm}>
                <input type="file" name="proofOfFarm" accept="image/*" />
              </FormField>
            </div>
          </div>

          <div className="mt-auto">
            <button
              type="submit"
              className="w-full bg-[#51a808] text-white py-4 rounded-xl font-bold text-lg shadow-md"
            >
              Submit Application
            </button>
          </div>
        </form>

        {/* logout */}
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
