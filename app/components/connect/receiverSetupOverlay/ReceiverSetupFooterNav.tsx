import type { ReceiverSetupSection } from "./types";

export function ReceiverSetupFooterNav({
  canGoNext = true,
  finishReceiverUrl = "",
  hidePrimaryActions = false,
  nextLabel = "Next",
  onBack,
  onNext,
  receiverIdentityText,
  section,
}: {
  canGoNext?: boolean;
  finishReceiverUrl?: string;
  hidePrimaryActions?: boolean;
  nextLabel?: string;
  onBack: () => void;
  onNext: () => void;
  receiverIdentityText: string;
  section: ReceiverSetupSection;
}) {
  const isAdvancedAndroid = section === "advancedAndroid";
  const isFinish = section === "finish";

  return (
    <div className="sticky bottom-0 mt-6 bg-white/95 px-8 backdrop-blur sm:px-12 lg:px-14">
      <p className="truncate pb-3 text-center text-sm font-bold leading-snug text-[#8a97a8] sm:text-base">
        {receiverIdentityText}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d6e3f2] py-4">
        <div className="flex flex-wrap gap-2">
          {section !== "home" ? (
            <button
              className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
              onClick={onBack}
              type="button"
            >
              Back
            </button>
          ) : null}
        </div>
        {section !== "home" && !isAdvancedAndroid && !hidePrimaryActions ? (
          <div className="flex flex-wrap gap-2">
            {isFinish && finishReceiverUrl ? (
              <a
                className="grid min-h-11 place-items-center rounded-lg border border-[#cbd9e7] bg-white px-5 text-sm font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                href={finishReceiverUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Receiver
              </a>
            ) : null}
            <button
              className="min-h-11 rounded-lg bg-[#2f6f9f] px-5 text-sm font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!canGoNext}
              onClick={onNext}
              type="button"
            >
              {nextLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
