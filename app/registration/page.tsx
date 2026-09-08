"use client";

import Link from "next/link";
import { logout } from "../login/actions";
import { useEffect, useState } from "react";
import { Application } from "../generated/prisma/client";
import { handleSubmit } from "./actions";
import { MembershipProgressSteps } from "@/components/MembershipProgressSteps";
import { ArrowLeft, FileImage, Sprout } from "lucide-react";

type ApplicationWithLists = Application & {
  crops: { name: string }[];
  machines: { name: string }[];
};

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-red-500 text-xs mt-1.5">{error}</p>;
}

function InputLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-[#3d5c47] mb-1.5">
      {children}
      {optional && <span className="font-normal text-[#8fa594] ml-1">optional</span>}
    </label>
  );
}

function DynamicListField({
  name,
  label,
  placeholder,
  items,
  max = 10,
  note,
  className,
}: {
  name: string;
  label: string;
  placeholder: string;
  items: string[];
  max?: number;
  note?: string;
  className?: string;
}) {
  const [count, setCount] = useState(Math.max(items.length, 1));
  const [prevItems, setPrevItems] = useState(items);

  if (items !== prevItems) {
    setPrevItems(items);
    setCount((c) => Math.max(c, items.length, 1));
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-[#3d5c47]">{label}</label>
        {note && <span className="text-[11px] text-[#8fa594] italic">{note}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-xl border border-[#dbe5d7] bg-[#fafcf8]">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="px-3 py-2.5 text-[#4f7e38] hover:text-[#2d6a2d]"
            aria-label={`Decrease ${label}`}
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold text-[#173a2b]">
            {count}
          </span>
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(max, c + 1))}
            className="px-3 py-2.5 text-[#4f7e38] hover:text-[#2d6a2d]"
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
        <span className="text-xs text-[#718176]">How many?</span>
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <input
            key={i}
            type="text"
            name={name}
            placeholder={i === 0 ? placeholder : `${placeholder} (${i + 1})`}
            defaultValue={items[i] ?? ""}
            className="w-full rounded-xl border border-[#dbe5d7] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35"
          />
        ))}
      </div>
    </div>
  );
}

export default function Registration() {
  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState<ApplicationWithLists | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isApplicant, setIsApplicant] = useState(false);
  const [farmOwnership, setFarmOwnership] = useState("");

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
          setApplication(data);
          setFarmOwnership(data.farmOwnership || "");
        }
      })
      .catch((err) => {
        console.error("Fetch failed:", err);
      });
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setIsApplicant(data?.role === "APPLICANT");
      })
      .catch(() => {});
  }, []);

  const isUpdate = !!application;

  return (
    <div className="relative min-h-screen bg-[#edf5df] flex flex-col items-center px-4 py-10 md:px-8 md:py-12">
      <div className="absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-[#badb94]/50 blur-3xl" />
      <div className="absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-[#86b87b]/35 blur-3xl" />

      <div className="relative flex w-full max-w-6xl flex-col">
        {/* Header */}
        <div className="mx-auto w-full max-w-lg md:max-w-none">
          <div className="flex items-center justify-between mb-6 md:mb-8 md:pb-6 md:border-b md:border-[#d8e5d1]">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4f7e38] transition hover:text-[#2d6a2d] md:text-base"
            >
              <ArrowLeft size={16} />
              Back
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#174b36] text-[#d6ed9f] md:h-10 md:w-10 md:rounded-xl">
                <Sprout size={16} className="md:h-5 md:w-5" />
              </span>
              <span className="text-sm font-bold text-[#174b36] tracking-tight md:text-lg">FarmCoop</span>
            </div>
          </div>
        </div>

        {isApplicant && (
          <MembershipProgressSteps
            currentIndex={
              !application
                ? 0
                : application.status === "APPROVED"
                  ? 4
                  : application.status === "REJECTED" ||
                      application.status === "PENDING_APPLICATION_REVIEW"
                    ? 3
                    : 1
            }
          />
        )}

        {/* Card */}
        <div className="mx-auto w-full max-w-lg md:max-w-none">
        <div className="bg-white rounded-3xl border border-white/80 shadow-2xl shadow-[#173a2b]/15 backdrop-blur-md overflow-hidden">
          <div className="px-7 pt-7 pb-1 md:px-10">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#173a2b]">
              {isUpdate ? "Edit profile" : "Membership application"}
            </h1>
            <p className="mt-1 text-sm text-[#718176]">
              {isUpdate ? "Update your information below." : "Fill in your details to apply for membership."}
            </p>
          </div>

          <form
            key={application?.id || "new"}
            className="flex flex-col px-7 pb-7 pt-5 md:px-10"
            onSubmit={(e) => handleSubmit(e, setLoading, setErrors, isUpdate)}
          >
            <input type="hidden" name="userId" value="" />

            {/* Personal Information */}
            <SectionHeader label="Personal information" />

            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              {/* Name row 1: First name + Middle name */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <InputLabel>First name</InputLabel>
                  <TextInput
                    name="firstName"
                    placeholder="Juan"
                    defaultValue={application?.firstName || ""}
                    error={errors.firstName}
                  />
                  <FieldError error={errors.firstName} />
                </div>
                <div className="col-span-2">
                  <InputLabel optional>Middle name</InputLabel>
                  <TextInput
                    name="middleName"
                    placeholder="Santos"
                    defaultValue={application?.middleName || ""}
                    error={errors.middleName}
                  />
                  <FieldError error={errors.middleName} />
                </div>
              </div>

              {/* Name row 2: Last name + Extension */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <InputLabel>Last name</InputLabel>
                  <TextInput
                    name="lastName"
                    placeholder="Dela Cruz"
                    defaultValue={application?.lastName || ""}
                    error={errors.lastName}
                  />
                  <FieldError error={errors.lastName} />
                </div>
                <div className="col-span-2">
                  <InputLabel optional>Extension</InputLabel>
                  <select
                    name="extensionName"
                    defaultValue={application?.extensionName || ""}
                    className={`w-full rounded-xl border bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35 ${
                      errors.extensionName ? "border-red-400" : "border-[#dbe5d7]"
                    }`}
                  >
                    <option value="">None</option>
                    <option value="Jr.">Jr.</option>
                    <option value="Sr.">Sr.</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                  </select>
                  <FieldError error={errors.extensionName} />
                </div>
              </div>

              {/* Phone */}
              <div>
                <InputLabel>Phone number</InputLabel>
                <TextInput
                  name="contact"
                  type="tel"
                  placeholder="09171234567"
                  defaultValue={application?.contact || ""}
                  error={errors.contact}
                />
                <FieldError error={errors.contact} />
              </div>

              {/* Address */}
              <div>
                <InputLabel>Current address</InputLabel>
                <TextInput
                  name="address"
                  placeholder="123 Rizal St, Brgy. San Isidro, Quezon City"
                  defaultValue={application?.address || ""}
                  error={errors.address}
                />
                <FieldError error={errors.address} />
              </div>

              {/* Birthdate + Gender */}
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div>
                  <InputLabel>Birth Date</InputLabel>
                  <TextInput
                    name="birthDate"
                    type="date"
                    defaultValue={
                      application?.birthDate
                        ? new Date(application.birthDate).toISOString().split("T")[0]
                        : ""
                    }
                    error={errors.birthDate}
                  />
                  <FieldError error={errors.birthDate} />
                </div>
                <div>
                  <InputLabel>Gender</InputLabel>
                  <select
                    name="gender"
                    defaultValue={application?.gender || ""}
                    className={`w-full rounded-xl border bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35 ${
                      errors.gender ? "border-red-400" : "border-[#dbe5d7]"
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <FieldError error={errors.gender} />
                </div>
              </div>
            </div>

            {/* Farming Details */}
            <SectionHeader label="Farming details" />

            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div>
                  <InputLabel>Farm size</InputLabel>
                  <div className="relative">
                    <TextInput
                      name="farmSize"
                      type="number"
                      step="0.01"
                      placeholder="2.5"
                      defaultValue={application?.farmSize ?? ""}
                      error={errors.farmSize}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9aa89e] pointer-events-none">hectares</span>
                  </div>
                  <FieldError error={errors.farmSize} />
                </div>
                <div>
                  <InputLabel>Years farming</InputLabel>
                  <TextInput
                    name="yearsFarming"
                    type="number"
                    placeholder="5"
                    defaultValue={application?.yearsFarming ?? ""}
                    error={errors.yearsFarming}
                  />
                  <FieldError error={errors.yearsFarming} />
                </div>
              </div>

              <DynamicListField
                name="cropType"
                label="Principal crop types"
                placeholder="e.g. Rice"
                items={(application?.crops ?? []).map((c) => c.name)}
                note="Leave blank if not applicable"
                className="md:col-span-1"
              />

              <div className="md:col-span-1">
                <InputLabel>Farm ownership status</InputLabel>
                <select
                  name="farmOwnership"
                  value={farmOwnership}
                  onChange={(e) => setFarmOwnership(e.target.value)}
                  className={`w-full rounded-xl border bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35 ${
                    errors.farmOwnership ? "border-red-400" : "border-[#dbe5d7]"
                  }`}
                >
                  <option value="">Select</option>
                  <option value="FARM_OWNER">Farm owner</option>
                  <option value="FARM_WORKER">Farm worker / tenant</option>
                  <option value="OTHERS">Others</option>
                </select>
                {farmOwnership === "OTHERS" && (
                  <div className="mt-2">
                    <InputLabel>Please specify your role</InputLabel>
                    <input
                      type="text"
                      name="farmOwnershipDetails"
                      placeholder="e.g. Farm caretaker"
                      defaultValue={application?.farmOwnershipDetails || ""}
                      className="w-full rounded-xl border border-[#dbe5d7] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35"
                    />
                  </div>
                )}
                <FieldError error={errors.farmOwnership} />
              </div>

              <DynamicListField
                name="farmMachinery"
                label="Farm machinery owned/accessible"
                placeholder="e.g. Hand tractor"
                items={(application?.machines ?? []).map((m) => m.name)}
                note="Leave blank if not applicable"
                className="md:col-span-2"
              />
            </div>

            {/* Guarantor */}
            <SectionHeader label="Guarantor" />

            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <p className="text-xs text-[#718176] md:col-span-2">
                Provide a guarantor who can vouch for you and be contacted by
                the cooperative if needed.
              </p>
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <InputLabel>First name</InputLabel>
                  <TextInput
                    name="guarantorFirstName"
                    placeholder="Maria"
                    defaultValue={
                      typeof application?.guarantor === "object" &&
                      application?.guarantor !== null
                        ? String(
                            (
                              application.guarantor as {
                                firstName?: string;
                              }
                            ).firstName || "",
                          )
                        : ""
                    }
                    error={errors.guarantor}
                  />
                </div>
                <div className="col-span-2">
                  <InputLabel optional>Middle name</InputLabel>
                  <TextInput
                    name="guarantorMiddleName"
                    placeholder="Santos"
                    defaultValue={
                      typeof application?.guarantor === "object" &&
                      application?.guarantor !== null
                        ? String(
                            (
                              application.guarantor as {
                                middleName?: string;
                              }
                            ).middleName || "",
                          )
                        : ""
                    }
                    error={errors.guarantor}
                  />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <InputLabel>Last name</InputLabel>
                  <TextInput
                    name="guarantorLastName"
                    placeholder="Santos"
                    defaultValue={
                      typeof application?.guarantor === "object" &&
                      application?.guarantor !== null
                        ? String(
                            (
                              application.guarantor as {
                                lastName?: string;
                              }
                            ).lastName || "",
                          )
                        : ""
                    }
                    error={errors.guarantor}
                  />
                </div>
                <div className="col-span-2">
                  <InputLabel optional>Extension</InputLabel>
                  <select
                    name="guarantorExtensionName"
                    defaultValue={
                      typeof application?.guarantor === "object" &&
                      application?.guarantor !== null
                        ? String(
                            (
                              application.guarantor as {
                                extensionName?: string;
                              }
                            ).extensionName || "",
                          )
                        : ""
                    }
                    className={`w-full rounded-xl border bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35 ${
                      errors.guarantor ? "border-red-400" : "border-[#dbe5d7]"
                    }`}
                  >
                    <option value="">None</option>
                    <option value="Jr.">Jr.</option>
                    <option value="Sr.">Sr.</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div>
                  <InputLabel>Contact number</InputLabel>
                  <TextInput
                    name="guarantorContact"
                    type="tel"
                    placeholder="09171234567"
                    defaultValue={
                      typeof application?.guarantor === "object" &&
                      application?.guarantor !== null
                        ? String(
                            (
                              application.guarantor as {
                                contact?: string;
                              }
                            ).contact || "",
                          )
                        : ""
                    }
                    error={errors.guarantor}
                  />
                </div>
                <div>
                  <InputLabel>Relationship</InputLabel>
                  <TextInput
                    name="guarantorRelationship"
                    placeholder="Relative"
                    defaultValue={
                      typeof application?.guarantor === "object" &&
                      application?.guarantor !== null
                        ? String(
                            (
                              application.guarantor as {
                                relationship?: string;
                              }
                            ).relationship || "",
                          )
                        : ""
                    }
                    error={errors.guarantor}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <FieldError error={errors.guarantor} />
              </div>
            </div>

            {/* Requirements */}
            <SectionHeader label="Requirements" />

            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <FileUpload
                name="validId"
                label="Valid ID"
                isUpdate={isUpdate}
                currentUrl={application?.validIdUrl}
                error={errors.validId}
              />
              <FileUpload
                name="proofOfFarm"
                label="Proof of farming"
                isUpdate={isUpdate}
                currentUrl={application?.proofOfFarmUrl}
                error={errors.proofOfFarm}
              />
            </div>

            {/* Submit */}
            <div className="mt-7">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#174b36] py-3.5 font-bold text-white shadow-lg shadow-[#174b36]/15 transition hover:bg-[#0e3b2a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Processing..."
                  : isUpdate
                    ? "Save changes"
                    : "Submit application"}
              </button>
            </div>
          </form>

          {/* Logout */}
          <div className="border-t border-[#eef3ec] px-7 py-3 text-center">
            <form action={logout}>
              <button type="submit" className="text-xs font-medium text-[#9aa89e] transition hover:text-[#5b6e62]">
                Log out
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-8 first:mt-0">
      <span className="h-2 w-2 rounded-sm bg-[#4f7e38]" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#4f7e38]">
        {label}
      </h2>
    </div>
  );
}

function TextInput({
  name,
  type = "text",
  step,
  placeholder,
  defaultValue,
  error,
}: {
  name: string;
  type?: string;
  step?: string;
  placeholder?: string;
  defaultValue: string | number;
  error?: string;
}) {
  return (
    <input
      type={type}
      name={name}
      step={step}
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={`w-full rounded-xl border bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35 ${
        error ? "border-red-400" : "border-[#dbe5d7]"
      }`}
    />
  );
}

function FileUpload({
  name,
  label,
  isUpdate,
  currentUrl,
  error,
}: {
  name: string;
  label: string;
  isUpdate: boolean;
  currentUrl?: string;
  error?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  return (
    <div>
      <InputLabel>
        {label}
        {isUpdate && <span className="font-normal text-[#8fa594] ml-1">(leave blank to keep current)</span>}
      </InputLabel>
      <div
        className={`flex items-center gap-3 rounded-xl border bg-[#fafcf8] px-4 py-3 transition focus-within:border-[#4f7e38] focus-within:ring-4 focus-within:ring-[#b9db9e]/35 ${
          error ? "border-red-400" : "border-[#dbe5d7]"
        }`}
      >
        <input
          type="file"
          name={name}
          accept="image/*"
          className="hidden"
          id={name}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setFileName(file.name);
              setPreview(URL.createObjectURL(file));
            }
          }}
        />
        <label
          htmlFor={name}
          className="flex items-center gap-2 cursor-pointer text-sm text-[#5b6e62] hover:text-[#174b36] transition"
        >
          <FileImage size={18} className="text-[#8fa594]" />
          <span>{isUpdate ? "Change file" : "Choose file"}</span>
        </label>
        <span className="ml-auto text-xs text-[#b5c4b9]">Image</span>
      </div>
      <FieldError error={error} />
      {(preview || currentUrl) && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#dbe5d7] bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview ?? currentUrl}
            alt={`${label} preview`}
            className="max-h-40 w-full rounded-lg object-contain"
          />
          <p className="mt-1 truncate text-[11px] text-[#5b6e62]">
            {preview ? fileName : "Uploaded — click «Change file» to replace"}
          </p>
        </div>
      )}
    </div>
  );
}
