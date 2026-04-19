"use client";

import Link from "next/link";
import { logout } from "../login/actions";
import { useEffect, useState } from "react";
import { Application } from "../generated/prisma/client";
import { handleSubmit } from "./actions";

export default function Registration() {
  const [loading, setLoading] = useState(false);
  const [application, setApplicaton] = useState<Application | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
          console.log(data);
        }
      })
      .catch((err) => {
        console.error("Fetch failed:", err);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#cfe1ce] font-sans flex flex-col items-center py-6 sm:py-12">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col min-h-screen sm:min-h-0">
        <div className="p-6 flex items-center">
          <Link href="/" className="text-gray-900">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
        </div>

        <div className="px-6 mb-6">
          <div className="bg-[#51a808] text-white p-5 rounded-xl flex justify-between items-center shadow-md">
            <span className="font-semibold text-lg">Application Status</span>
          </div>
        </div>

        <form
          className="flex-1 flex flex-col px-6 pb-8"
          action="/submit-application"
          method="POST"
          encType="multipart/form-data"
          onSubmit={(e) => handleSubmit(e, setLoading, setErrors)}
        >
          <input type="hidden" name="userId" value="" />

          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">
              Personal Information
            </h2>

            {errors.fullName && (
              <p className="text-red-500 text-sm mb-1">{errors.fullName}</p>
            )}
            <input
              type="text"
              name="fullName"
              placeholder="Your Name *"
              className={`w-full border rounded-lg px-4 py-3 ${errors.fullName ? "border-red-500" : "border-gray-200"
                }`}
            />

            {errors.contact && (
              <p className="text-red-500 text-sm mb-1">{errors.contact}</p>
            )}
            <input
              type="text"
              name="contact"
              placeholder="Your Phone Number *"
              className={`w-full border rounded-lg px-4 py-3 ${errors.contact ? "border-red-500" : "border-gray-200"
                }`}
            />

            {errors.address && (
              <p className="text-red-500 text-sm mb-1">{errors.address}</p>
            )}
            <input
              type="text"
              name="address"
              placeholder="Current Address *"
              className={`w-full border rounded-lg px-4 py-3 ${errors.address ? "border-red-500" : "border-gray-200"
                }`}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                {errors.age && (
                  <p className="text-red-500 text-sm mb-1">{errors.age}</p>
                )}
                <input
                  type="number"
                  name="age"
                  placeholder="Age *"
                  className={`w-full border rounded-lg px-4 py-3 ${errors.age ? "border-red-500" : "border-gray-200"
                    }`}
                />
              </div>

              <div>
                {errors.gender && (
                  <p className="text-red-500 text-sm mb-1">{errors.gender}</p>
                )}
                <select
                  name="gender"
                  className={`w-full border rounded-lg px-4 py-3 bg-white ${errors.gender ? "border-red-500" : "border-gray-200"
                    }`}
                >
                  <option value="">Gender *</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">
              Farming Details
            </h2>
            <div className="space-y-3">
              <div>
                {errors.farmSize && (
                  <p className="text-red-500 text-sm mb-1">{errors.farmSize}</p>
                )}
                <input
                  type="number"
                  step="0.01"
                  name="farmSize"
                  placeholder="Farm Size (in hectares) *"
                  className={`w-full border rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700 ${errors.farmSize ? "border-red-500" : "border-gray-200"
                    }`}
                />
              </div>
              <div>
                {errors.cropType && (
                  <p className="text-red-500 text-sm mb-1">{errors.cropType}</p>
                )}
                <input
                  type="text"
                  name="cropType"
                  placeholder="Principal Crop Types *"
                  className={`w-full border rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700 ${errors.cropType ? "border-red-500" : "border-gray-200"
                    }`}
                />
              </div>
              <div>
                {errors.yearsFarming && (
                  <p className="text-red-500 text-sm mb-1">{errors.yearsFarming}</p>
                )}
                <input
                  type="number"
                  name="yearsFarming"
                  placeholder="Years of Farming *"
                  className={`w-full border rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700 ${errors.yearsFarming ? "border-red-500" : "border-gray-200"
                    }`}
                />
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">
              Requirements
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase px-1">
                  Valid Identification
                </label>
                {errors.validId && (
                  <p className="text-red-500 text-sm">{errors.validId}</p>
                )}
                <input
                  type="file"
                  name="validId"
                  accept="image/*"
                  className={`text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer ${errors.validId ? "outline outline-red-400 rounded" : ""
                    }`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase px-1">
                  Proof of Farming
                </label>
                {errors.proofOfFarm && (
                  <p className="text-red-500 text-sm">{errors.proofOfFarm}</p>
                )}
                <input
                  type="file"
                  name="proofOfFarm"
                  accept="image/*"
                  className={`text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer ${errors.proofOfFarm ? "outline outline-red-400 rounded" : ""
                    }`}
                />
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <button
              type="submit"
              className="w-full bg-[#51a808] text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-[#458e07] transition-colors active:scale-95"
            >
              Submit Application
            </button>
            <p className="text-center text-xs text-gray-400 mt-4 px-2">
              Have any questions? Reach directly to our{" "}
              <Link
                href="#"
                className="text-black font-semibold hover:underline"
              >
                Customer Support
              </Link>
            </p>
          </div>
        </form>

        <div className="p-4 border-t border-gray-100 text-center">
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-bold text-gray-300 hover:text-green-600 uppercase tracking-widest transition-colors"
            >
              logout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
