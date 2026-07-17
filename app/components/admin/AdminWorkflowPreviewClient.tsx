"use client";

import { FormEvent, useMemo, useState } from "react";

import { ReceiverSetupOverlay } from "../connect/receiverSetupOverlay/ReceiverSetupOverlay";
import { OnboardingGate } from "../personal/onboarding/OnboardingGate";
import type { ConnectMainUserContext } from "../../lib/connect/context";
import type { ConnectReceiverDevice } from "../../lib/connect/provisioning";
import {
  emptyProfileDraft,
  type ProfileDraft,
} from "../../lib/personal/profile/profileDraft";
import type { PlaceAddressResult } from "../../lib/platform/integrations/places";

type WorkflowPreview = "personal" | "receiver";

const previewUserId = "admin-workflow-preview-user";
const previewCareCircleId = "admin-workflow-preview-care-circle";
const previewReceiverUserId = "admin-workflow-preview-receiver-user";
const previewReceiverDeviceId = "admin-workflow-preview-receiver-device";

export function AdminWorkflowPreviewClient({
  workflow,
}: {
  workflow: WorkflowPreview;
}) {
  const [receiverSetupOpen, setReceiverSetupOpen] = useState(
    workflow === "receiver"
  );
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => ({
    ...emptyProfileDraft,
    country: "US",
    email: "preview@example.com",
    timezone: "America/Los_Angeles",
  }));
  const [acceptBetaTerms, setAcceptBetaTerms] = useState(false);
  const [acceptBetaPrivacy, setAcceptBetaPrivacy] = useState(false);
  const [acceptBetaDisclaimer, setAcceptBetaDisclaimer] = useState(false);
  const [message, setMessage] = useState("");

  const connectContext = useMemo<ConnectMainUserContext>(
    () => ({
      currentAccountPersonId: previewUserId,
      currentAccountPerson: {
        careCircleId: previewCareCircleId,
        displayName: "Preview Admin",
        id: previewUserId,
        isActive: true,
        isCurrentUser: true,
        subjectType: "self",
      },
      currentAccountProfile: {
        displayName: "Preview Admin",
      },
      mainConnectUserPerson: {
        careCircleId: previewCareCircleId,
        displayName: "Marlene Preview",
        id: previewReceiverUserId,
        isActive: true,
        subjectType: "other",
      },
      mainConnectUserPersonId: previewReceiverUserId,
      people: [
        {
          careCircleId: previewCareCircleId,
          displayName: "Preview Admin",
          id: previewUserId,
          isActive: true,
          isCurrentUser: true,
          subjectType: "self",
        },
        {
          careCircleId: previewCareCircleId,
          displayName: "Marlene Preview",
          id: previewReceiverUserId,
          isActive: true,
          subjectType: "other",
        },
      ],
      primaryCoordinator: {
        displayName: "Preview Admin",
        source: "care_circle_owner",
        userId: previewUserId,
      },
      source: "local_dev",
    }),
    []
  );

  const activeDevices = useMemo<ConnectReceiverDevice[]>(
    () => [
      {
        active: true,
        careCircleId: previewCareCircleId,
        id: previewReceiverDeviceId,
        locationLabel: "Kitchen Receiver",
        mainConnectUserDisplayName: "Marlene Preview",
        mainConnectUserPersonId: previewReceiverUserId,
        name: "Kitchen Receiver",
        pairedAt: new Date().toISOString(),
        presence: {
          label: "Preview",
          online: true,
          state: "online",
        },
        receiverContactDisplayName: "Preview Admin",
        receiverContactUserId: previewUserId,
        receiverId: "preview-receiver",
        receiverMode: "dedicated",
        status: "bound",
      },
    ],
    []
  );

  function handleNoopSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Workflow preview only. No account changes were saved.");
  }

  function updateProfileField(field: keyof ProfileDraft, value: string) {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  }

  function applyProfileAddress(address: PlaceAddressResult) {
    setProfileDraft((current) => ({
      ...current,
      addressLine1: address.addressLine1 || current.addressLine1,
      addressLine2: address.addressLine2 || current.addressLine2,
      city: address.city || current.city,
      country: address.country || current.country,
      postalCode: address.postalCode || current.postalCode,
      region: address.region || current.region,
    }));
  }

  if (workflow === "receiver") {
    return (
      <main className="min-h-screen bg-slate-100">
        <ReceiverSetupOverlay
          activeDevices={activeDevices}
          connectContext={connectContext}
          initialSection="start"
          onClose={() => setReceiverSetupOpen(false)}
          onRefresh={async () => undefined}
          open={receiverSetupOpen}
          selectedReceiverKey=""
          startCloseLabel="Close preview"
        />
        {!receiverSetupOpen ? (
          <div className="grid min-h-screen place-items-center p-6">
            <button
              className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white"
              onClick={() => setReceiverSetupOpen(true)}
              type="button"
            >
              Reopen Receiver Setup Preview
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f8fb]">
      <OnboardingGate
        acceptBetaDisclaimer={acceptBetaDisclaimer}
        acceptBetaPrivacy={acceptBetaPrivacy}
        acceptBetaTerms={acceptBetaTerms}
        appContentText={(key) => previewAgreementCopy[key] ?? key}
        getPlacesAuthHeaders={async () => ({})}
        loading={false}
        message={message}
        needsBetaAgreement
        needsOnboarding
        onAcceptBetaAgreement={handleNoopSubmit}
        onApplyProfileAddress={applyProfileAddress}
        onChangeProfileField={updateProfileField}
        onChangeProfilePhone={(value) => updateProfileField("phone", value)}
        onChangeProfileZip={(value) => updateProfileField("postalCode", value)}
        onImportAnything={() => setMessage("Import preview opened.")}
        onOpenCarePland={() => setMessage("CarePland preview opened.")}
        onOpenReceiver={() => setMessage("Receiver preview opened.")}
        onReviewStep={() => setMessage("")}
        onSaveProfile={handleNoopSubmit}
        onSetAcceptBetaDisclaimer={setAcceptBetaDisclaimer}
        onSetAcceptBetaPrivacy={setAcceptBetaPrivacy}
        onSetAcceptBetaTerms={setAcceptBetaTerms}
        onSignOut={() => setMessage("Sign out is disabled in Workflow View.")}
        profileDetailsRequired
        profileDraft={profileDraft}
        receiverConfigured
        requiresEmailUpdate={false}
        savingProfile={false}
        showReady={false}
        timeZoneOptions={[
          { label: "Pacific Time", value: "America/Los_Angeles" },
          { label: "Eastern Time", value: "America/New_York" },
        ]}
        verifiedAccountEmail="preview@example.com"
      />
    </main>
  );
}

const previewAgreementCopy: Record<string, string> = {
  beta_disclaimer_ack:
    "I understand CarePland is not a substitute for medical advice or emergency care.",
  beta_privacy_ack:
    "I understand CarePland stores the information I choose to add for care organization.",
  beta_terms_ack: "I agree to use CarePland Early Access for setup preview.",
};
