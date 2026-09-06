import { CheckCircle2 } from "lucide-react";

const STEPS = [
  "Application Submitted",
  "Application Fee Paid",
  "Payment Verified",
  "President Review",
  "Membership Approved",
];

export function MembershipProgressSteps({
  currentIndex,
}: {
  currentIndex: number;
}) {
  return (
    <div className="mb-8 rounded-2xl border border-[#dce5d9] bg-white px-5 py-4">
      <ol className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                    done
                      ? "bg-[#4f7e38] text-white"
                      : active
                        ? "bg-[#26633f] text-white ring-4 ring-[#d6ed9f]"
                        : "bg-[#edf2ea] text-[#8fa594]"
                  }`}
                >
                  {done ? <CheckCircle2 size={14} /> : index + 1}
                </span>
                <span
                  className={`hidden whitespace-nowrap text-[10px] font-bold sm:block ${
                    active || done ? "text-[#26633f]" : "text-[#8fa594]"
                  }`}
                >
                  {step}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded ${index < currentIndex ? "bg-[#4f7e38]" : "bg-[#e3eae0]"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}