"use client";

import { useState } from "react";

import {
  receiverLayoutOptions,
  receiverLayoutOptionUrl,
  type ReceiverLayoutOptionId,
  type ReceiverLayoutStage,
} from "../../lib/connect/receiver/receiverLayoutCatalog";

function receiverLayoutStageClass(stage: ReceiverLayoutStage, selected = false) {
  if (stage === "active") {
    return selected
      ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (stage === "proposed") {
    return selected
      ? "border-yellow-500 bg-yellow-400 text-yellow-950 shadow-sm"
      : "border-yellow-200 bg-yellow-50 text-yellow-800";
  }

  if (stage === "experiment") {
    return selected
      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
      : "border-blue-200 bg-blue-50 text-blue-800";
  }

  return selected
    ? "border-slate-500 bg-slate-600 text-white shadow-sm"
    : "border-slate-200 bg-slate-100 text-slate-400";
}

export function AdminReceiverLayoutPanel() {
  const [selectedLayoutId, setSelectedLayoutId] =
    useState<ReceiverLayoutOptionId>("appliance");
  const [focusMode, setFocusMode] = useState(false);
  const selectedLayout =
    receiverLayoutOptions.find((option) => option.id === selectedLayoutId) ??
    receiverLayoutOptions[0];
  const selectedLayoutUrl = receiverLayoutOptionUrl(selectedLayout);
  const selectedHomeLayout =
    "homeLayout" in selectedLayout ? selectedLayout.homeLayout : undefined;
  const selectedReceiverLayout =
    "receiverLayout" in selectedLayout ? selectedLayout.receiverLayout : undefined;
  const layoutStageLabels = {
    active: "Active",
    archive: "Archive",
    experiment: "Experiment",
    proposed: "Proposed",
  };
  const selectedLayoutStatusPill = (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-bold uppercase ${
        focusMode ? "text-[9px]" : "text-[10px]"
      } ${receiverLayoutStageClass(selectedLayout.stage)}`}
    >
      {selectedLayout.productionReady
        ? "Production"
        : layoutStageLabels[selectedLayout.stage]}
    </span>
  );
  const selectedLayoutDetails = (
    <div
      className={
        focusMode
          ? "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 text-[10px] leading-tight text-slate-600"
          : "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600"
      }
    >
      {selectedLayoutStatusPill}
      {focusMode ? (
        <span className="min-w-0">
          <span className="block truncate">{selectedLayout.description}</span>
          <span className="block truncate">
            {selectedLayout.assignable ? "Assignable" : "Not assignable"} ·{" "}
            {selectedLayout.customerVisible ? "Visible to customers" : "Admin-only"} ·{" "}
            <span className="font-mono text-[10px] text-slate-500">
              {selectedLayout.route}
              {selectedHomeLayout ? `?homeLayout=${selectedHomeLayout}` : ""}
              {selectedReceiverLayout ? `?receiverLayout=${selectedReceiverLayout}` : ""}
            </span>
          </span>
        </span>
      ) : (
        <>
          <span>{selectedLayout.description}</span>
          <span className="shrink-0">
            {selectedLayout.assignable ? "Assignable" : "Not assignable"} ·{" "}
            {selectedLayout.customerVisible ? "Visible to customers" : "Admin-only"}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-slate-500">
            {selectedLayout.route}
            {selectedHomeLayout ? `?homeLayout=${selectedHomeLayout}` : ""}
            {selectedReceiverLayout ? `?receiverLayout=${selectedReceiverLayout}` : ""}
          </span>
        </>
      )}
    </div>
  );

  return (
    <section
      className={
        focusMode
          ? "fixed inset-0 z-[1000] overflow-auto bg-slate-50 p-4"
          : "space-y-3"
      }
    >
      <div className="grid gap-3">
        <section className="flex items-start gap-2">
          <div
            className={`flex min-w-0 gap-2 ${
              focusMode
                ? "flex-1 flex-wrap pb-0"
                : "flex-1 overflow-x-auto pb-1"
            }`}
          >
            {receiverLayoutOptions.map((option) => {
              const selected = option.id === selectedLayout.id;
              return (
                <button
                  className={`shrink-0 rounded-full border font-semibold ${
                    focusMode ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
                  } ${receiverLayoutStageClass(
                    option.stage,
                    selected
                  )}`}
                  key={option.id}
                  onClick={() => setSelectedLayoutId(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {focusMode ? (
            <div className="w-[520px] shrink-0 pt-0.5">
              {selectedLayoutDetails}
            </div>
          ) : null}
          <button
            aria-label={
              focusMode ? "Exit Layout focus mode" : "Enter Layout focus mode"
            }
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setFocusMode((current) => !current)}
            title={
              focusMode ? "Exit Layout focus mode" : "Enter Layout focus mode"
            }
            type="button"
          >
            {focusMode ? "MIN" : "MAX"}
          </button>
        </section>

        {!focusMode ? selectedLayoutDetails : null}

        <section className="rounded-md border border-slate-200 bg-slate-950 p-3">
          <div className="mb-3 flex justify-end">
            <a
              className="rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              href={selectedLayoutUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open full Receiver
            </a>
          </div>
          <iframe
            className={`w-full rounded bg-white ${
              focusMode ? "h-[calc(100dvh-118px)]" : "h-[600px]"
            }`}
            key={selectedLayout.id}
            src={selectedLayoutUrl}
            title={`Receiver layout preview: ${selectedLayout.label}`}
          />
        </section>
      </div>
    </section>
  );
}
