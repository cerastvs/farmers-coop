import Link from "next/link";
import { logout } from "../login/actions";

export default function Registration() {
  return (
    <div className="min-h-screen bg-[#cfe1ce] font-sans flex flex-col items-center py-6 sm:py-12">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col min-h-screen sm:min-h-0">

        {/* Header with Back Button */}
        <div className="p-6 flex items-center">
          <Link href="/" className="text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>

        {/* Summary Card */}
        <div className="px-6 mb-6">
          <div className="bg-[#51a808] text-white p-5 rounded-xl flex justify-between items-center shadow-md">
            <span className="font-semibold text-lg">Application Status</span>
            <span className="font-bold text-xl uppercase tracking-tighter">Farmer ID</span>
          </div>
        </div>

        <form
          className="flex-1 flex flex-col px-6 pb-8"
          action="/submit-application"
          method="POST"
          encType="multipart/form-data"
        >
          <input type="hidden" name="userId" value="" />

          {/* Section: Personal Information */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">Personal Information</h2>
            <div className="space-y-3">
              <input
                type="text"
                name="fullName"
                required
                placeholder="Your Name *"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
              />
              <input
                type="text"
                name="contact"
                required
                placeholder="Your Phone Number *"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
              />
              <input
                type="text"
                name="address"
                required
                placeholder="Current Address *"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  name="age"
                  required
                  placeholder="Age *"
                  className="border border-gray-200 rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
                />
                <select
                  name="gender"
                  required
                  className="border border-gray-200 rounded-lg px-4 py-3 bg-white text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">Gender *</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Farming Details */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">Farming Details</h2>
            <div className="space-y-3">
              <input
                type="number"
                step="0.01"
                name="farmSize"
                required
                placeholder="Farm Size (in hectares) *"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
              />
              <input
                type="text"
                name="cropType"
                required
                placeholder="Principal Crop Types *"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
              />
              <input
                type="number"
                name="yearsFarming"
                required
                placeholder="Years of Farming *"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
              />
            </div>
          </div>

          {/* Section: Requirements */}
          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 opacity-70">Requirements</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase px-1">Valid Identification</label>
                <input
                  type="file"
                  name="validId"
                  accept="image/*"
                  required
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase px-1">Proof of Farming</label>
                <input
                  type="file"
                  name="proofOfFarm"
                  accept="image/*"
                  required
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
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
              Have any questions? Reach directly to our <Link href="#" className="text-black font-semibold hover:underline">Customer Support</Link>
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
