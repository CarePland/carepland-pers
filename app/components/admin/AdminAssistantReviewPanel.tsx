"use client";

import { ComponentProps } from "react";

import { AdminAskIntakePanel } from "./AdminAskIntakePanel";
import { AdminSupportAssistantReviewPanel } from "./AdminSupportAssistantReviewPanel";

type AdminAskIntakePanelProps = ComponentProps<typeof AdminAskIntakePanel>;
type AdminSupportAssistantReviewPanelProps = ComponentProps<
  typeof AdminSupportAssistantReviewPanel
>;

type AdminAssistantReviewPanelProps = {
  ask: AdminAskIntakePanelProps;
  support: AdminSupportAssistantReviewPanelProps;
};

export function AdminAssistantReviewPanel({
  ask,
  support,
}: AdminAssistantReviewPanelProps) {
  return (
    <div className="space-y-4">
      <AdminAskIntakePanel {...ask} />
      <AdminSupportAssistantReviewPanel {...support} />
    </div>
  );
}
