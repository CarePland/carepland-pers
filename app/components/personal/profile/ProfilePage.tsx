"use client";

import { ComponentProps, useState } from "react";

import { ConnectProfileSettingsPanel } from "../../connect/dashboard/ConnectDashboard";
import { OfflineAccessPanel } from "./OfflineAccessPanel";
import { ProfileAccountSummary } from "./ProfileAccountSummary";
import { ProfileContactDetailsForm } from "./ProfileContactDetailsForm";

type ProfilePageProps = {
  accountSummaryProps: ComponentProps<typeof ProfileAccountSummary>;
  canShowAdminItems: boolean;
  contactDetailsProps: ComponentProps<typeof ProfileContactDetailsForm>;
  offlineAccessProps: ComponentProps<typeof OfflineAccessPanel>;
  message?: string;
};

type ProfileSettingsTab = "account" | "offlineAccess" | "receiverSettings";

const profileSettingsTabs: Array<{ id: ProfileSettingsTab; label: string }> = [
  { id: "account", label: "Your CarePland Account" },
  { id: "offlineAccess", label: "Offline Access" },
  { id: "receiverSettings", label: "Receiver Settings" },
];

export function ProfilePage({
  accountSummaryProps,
  canShowAdminItems,
  contactDetailsProps,
  offlineAccessProps,
  message,
}: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileSettingsTab>("account");

  return (
    <div className="mt-6 space-y-5">
      <nav
        aria-label="Profile settings sections"
        className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-blue-100 bg-white/70 p-1 shadow-sm"
      >
        {profileSettingsTabs.map((tab) => (
          <button
            aria-pressed={activeTab === tab.id}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                : "text-slate-500 hover:bg-blue-50/70 hover:text-blue-800"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "account" ? (
        <>
          <ProfileAccountSummary {...accountSummaryProps} showHeading={false} />
          <ProfileContactDetailsForm {...contactDetailsProps} />
          {message ? (
            <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </>
      ) : activeTab === "offlineAccess" ? (
        <OfflineAccessPanel {...offlineAccessProps} />
      ) : (
        <ConnectProfileSettingsPanel
          canShowAdminItems={canShowAdminItems}
          setupView="receivers"
        />
      )}
    </div>
  );
}
