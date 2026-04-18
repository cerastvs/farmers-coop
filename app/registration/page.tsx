import Link from "next/link";

export default function Registration() {
  return (
    <div className="min-h-screen py-12 px-4 bg-[#f0f9f4] relative overflow-hidden font-sans">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-green-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-emerald-200/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto bg-white/70 backdrop-blur-xl p-8 sm:p-12 rounded-[2.5rem] shadow-2xl border border-white/30 relative z-10 transition-all duration-300">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-3xl mb-4 shadow-inner">
            <span className="text-4xl">🌱</span>
          </div>
          <h1 className="text-4xl font-extrabold text-green-900 tracking-tight">
            Farmer Application
          </h1>
          <p className="text-green-700/60 font-medium mt-3 text-lg italic">
            Empowering your agricultural journey
          </p>
        </div>

        <form
          className="space-y-10"
          action="/submit-application"
          method="POST"
          encType="multipart/form-data"
        >
          <input type="hidden" name="userId" value="" />

          {/* Section 1: Personal Information */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-2 border-b border-green-100">
              <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white text-xs font-bold rounded-lg uppercase tracking-tighter">
                01
              </span>
              <h2 className="text-xl font-bold text-green-800">
                Personal Information
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="Enter your legal full name"
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Age
                </label>
                <input
                  type="number"
                  name="age"
                  required
                  min="18"
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Gender
                </label>
                <select
                  name="gender"
                  required
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Residential Address
                </label>
                <input
                  type="text"
                  name="address"
                  required
                  placeholder="Complete home address"
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Contact Number
                </label>
                <input
                  type="text"
                  name="contact"
                  required
                  placeholder="e.g. +63 9xx xxx xxxx"
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Farming Information */}
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-3 pb-2 border-b border-green-100">
              <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white text-xs font-bold rounded-lg uppercase tracking-tighter">
                02
              </span>
              <h2 className="text-xl font-bold text-green-800">
                Farming Details
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Farm Size (Hectares)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="farmSize"
                  required
                  placeholder="0.00"
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Years of Farming
                </label>
                <input
                  type="number"
                  name="yearsFarming"
                  required
                  min="0"
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-green-800/70 ml-1 uppercase tracking-widest">
                  Principal Crop Types
                </label>
                <input
                  type="text"
                  name="cropType"
                  required
                  placeholder="e.g. Rice, Corn, Sugarcane"
                  className="w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Requirements */}
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-3 pb-2 border-b border-green-100">
              <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white text-xs font-bold rounded-lg uppercase tracking-tighter">
                03
              </span>
              <h2 className="text-xl font-bold text-green-800">
                Required Documents
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-green-50/50 rounded-3xl border border-green-100 hover:border-green-300 transition-colors group">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    🪪
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-green-900 uppercase tracking-tight">
                      Valid Identification
                    </h3>
                    <p className="text-[10px] text-green-700/60 mt-0.5">
                      National ID, Driver's License, etc.
                    </p>
                  </div>
                  <input
                    type="file"
                    name="validId"
                    accept="image/*"
                    required
                    className="mt-2 block w-full text-xs text-green-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-6 bg-green-50/50 rounded-3xl border border-green-100 hover:border-green-300 transition-colors group">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    📜
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-green-900 uppercase tracking-tight">
                      Proof of Farming
                    </h3>
                    <p className="text-[10px] text-green-700/60 mt-0.5">
                      Certificate, Land Title, or Barangay Permit
                    </p>
                  </div>
                  <input
                    type="file"
                    name="proofOfFarm"
                    accept="image/*"
                    required
                    className="mt-2 block w-full text-xs text-green-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-5 rounded-2xl hover:bg-green-700 active:scale-[0.99] transition-all font-bold text-lg shadow-xl shadow-green-200/50 flex items-center justify-center gap-2"
            >
              Submit Farmer Application
            </button>
            <p className="text-center text-gray-400 text-xs mt-4">
              By submitting, you agree to the FarmCoop Terms and Conditions.
            </p>
          </div>
        </form>

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="text-sm font-bold text-gray-400 hover:text-green-600 uppercase tracking-widest transition-colors inline-flex items-center gap-2"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
