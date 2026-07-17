"use client";

import { useState } from "react";

type WorkflowPreview = "personal" | "receiver";
type WorkflowViewport = "fit" | "desktop" | "tablet" | "phone";

const workflowPreviews: Record<
  WorkflowPreview,
  { label: string; src: string; title: string }
> = {
  personal: {
    label: "Personal Setup",
    src: "/admin/workflows/preview/personal",
    title: "Personal Setup workflow preview",
  },
  receiver: {
    label: "Receiver Setup",
    src: "/admin/workflows/preview/receiver",
    title: "Receiver Setup workflow preview",
  },
};

const viewportPresets: Record<
  WorkflowViewport,
  { height: number; label: string; width: number | "100%" }
> = {
  fit: { height: 820, label: "Fit", width: "100%" },
  desktop: { height: 900, label: "Desktop", width: 1440 },
  tablet: { height: 768, label: "Tablet", width: 1024 },
  phone: { height: 844, label: "Phone", width: 390 },
};

export function AdminWorkflowViewPanel() {
  const [preview, setPreview] = useState<WorkflowPreview>("personal");
  const [viewport, setViewport] = useState<WorkflowViewport>("fit");
  const activePreview = workflowPreviews[preview];
  const activeViewport = viewportPresets[viewport];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Workflow View</h2>
            <p className="mt-1 text-slate-600">
              View setup workflows as isolated browser previews with safe data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(workflowPreviews).map(([key, option]) => (
              <button
                className={`rounded-md px-4 py-2 font-semibold ${
                  preview === key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
                key={key}
                onClick={() => setPreview(key as WorkflowPreview)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="mr-1 text-sm font-semibold text-slate-700">Viewport</p>
          {Object.entries(viewportPresets).map(([key, option]) => (
            <button
              aria-pressed={viewport === key}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                viewport === key
                  ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
                  : "border border-slate-300 text-slate-700"
              }`}
              key={key}
              onClick={() => setViewport(key as WorkflowViewport)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-100 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">
            Rendering{" "}
            <span className="text-slate-950">{activePreview.label}</span> at{" "}
            {activeViewport.width === "100%"
              ? "available width"
              : `${activeViewport.width}px`}{" "}
            × {activeViewport.height}px
          </p>
          <a
            className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            href={activePreview.src}
            rel="noreferrer"
            target="_blank"
          >
            Open preview page
          </a>
        </div>
        <div className="overflow-auto rounded-lg border border-slate-300 bg-slate-200 p-3">
          <div
            className="overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200"
            style={{
              height: `${activeViewport.height}px`,
              width:
                activeViewport.width === "100%"
                  ? activeViewport.width
                  : `${activeViewport.width}px`,
            }}
          >
            <iframe
              className="h-full w-full border-0 bg-white"
              key={`${preview}-${activePreview.src}`}
              src={activePreview.src}
              title={activePreview.title}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
