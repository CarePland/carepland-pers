"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ConnectMainUserContext } from "@/app/lib/connect/context";
import { ensureConnectCurrentAccountPerson } from "@/app/lib/connect/context/client";
import { formatBrowserReceiverPairingCode } from "@/app/lib/connect/receiverShell/browserPairing";
import type { ConnectReceiverDevice } from "@/app/lib/connect/provisioning";

import { AdvancedAndroidSetupPanel } from "./AdvancedAndroidSetupPanel";
import { ReceiverFinishStep } from "./ReceiverFinishStep";
import { ReceiverInstallStep } from "./ReceiverInstallStep";
import { ReceiverPairStep } from "./ReceiverPairStep";
import { ReceiverSetupFooterNav } from "./ReceiverSetupFooterNav";
import { ReceiverSetupProgress } from "./ReceiverSetupProgress";
import { ReceiverSetupStatus } from "./ReceiverSetupStatus";
import { ReceiverStartStep } from "./ReceiverStartStep";
import { ReceiverUserStep } from "./ReceiverUserStep";
import type {
  ReceiverSetupDraft,
  ReceiverSetupMetadata,
  ReceiverSetupSection,
  ReceiverSetupStepProps,
} from "./types";
import {
  contactOptionsFromContext,
  currentAccountReceiverUserDraftId,
  defaultReceiverSetupDraft,
  readReceiverSetupDraft,
  receiverDeviceKey,
  receiverDisplayName,
  receiverEligiblePeople,
  receiverSetupSectionOrder,
  writeReceiverSetupDraft,
} from "./utils";

const receiverSetupCanvasWidth = 1024;
const receiverSetupCanvasHeight = 640;
const receiverSetupViewportMargin = 24;

export function ReceiverSetupOverlay({
  activeDevices,
  connectContext,
  initialPairingCode = "",
  initialReceiverUrl = "",
  initialSection = "start",
  installModeLock,
  onClose,
  onRefresh,
  open,
  selectedReceiverKey,
  startCloseLabel = "",
}: {
  activeDevices: ConnectReceiverDevice[];
  connectContext: ConnectMainUserContext | null;
  initialPairingCode?: string;
  initialReceiverUrl?: string;
  initialSection?: ReceiverSetupSection;
  installModeLock?: "android";
  onClose: () => void;
  onRefresh: () => Promise<void>;
  open: boolean;
  selectedReceiverKey: string;
  startCloseLabel?: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const initializedReturningReceiverKeyRef = useRef("");
  const [viewportSize, setViewportSize] = useState(() => ({
    height: typeof window === "undefined" ? receiverSetupCanvasHeight : window.innerHeight,
    width: typeof window === "undefined" ? receiverSetupCanvasWidth : window.innerWidth,
  }));
  const [browserOrigin, setBrowserOrigin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [copyStatus, setCopyStatus] = useState("");
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [receiverUserPreparationStatus, setReceiverUserPreparationStatus] = useState("");
  const [ensuringCurrentAccountPerson, setEnsuringCurrentAccountPerson] =
    useState(false);
  const [metadata, setMetadata] = useState<ReceiverSetupMetadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState("Loading Receiver setup details...");
  const storedDraft = readReceiverSetupDraft();
  const formattedInitialPairingCode = formatBrowserReceiverPairingCode(initialPairingCode);
  const [draft, setDraftState] = useState<ReceiverSetupDraft>(() => ({
    ...defaultReceiverSetupDraft,
    ...storedDraft,
    installMode:
      installModeLock ?? storedDraft?.installMode ?? defaultReceiverSetupDraft.installMode,
    installViewed: initialSection === "install" || Boolean(storedDraft?.installViewed),
    pairingCode: formattedInitialPairingCode || storedDraft?.pairingCode || "",
    section: initialSection,
  }));

  const setDraft = useCallback((updater: (current: ReceiverSetupDraft) => ReceiverSetupDraft) => {
    setDraftState((current) => {
      const next = updater(current);
      writeReceiverSetupDraft(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    function updateViewportSize() {
      setViewportSize({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    }

    const animationFrame = window.requestAnimationFrame(updateViewportSize);
    window.addEventListener("orientationchange", updateViewportSize);
    window.addEventListener("resize", updateViewportSize);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("orientationchange", updateViewportSize);
      window.removeEventListener("resize", updateViewportSize);
    };
  }, [open]);

  const eligiblePeople = useMemo(() => receiverEligiblePeople(connectContext), [connectContext]);
  const contactOptions = useMemo(
    () => contactOptionsFromContext(connectContext, activeDevices),
    [activeDevices, connectContext]
  );
  const selectedDevice = useMemo(() => {
    const keyedDevice = selectedReceiverKey
      ? activeDevices.find((device) => receiverDeviceKey(device) === selectedReceiverKey) ?? null
      : null;
    const draftDevice = draft.selectedReceiverDeviceId
      ? activeDevices.find(
          (device) =>
            device.id === draft.selectedReceiverDeviceId ||
            device.receiverId === draft.selectedReceiverDeviceId
        )
      : null;
    return keyedDevice ?? draftDevice ?? null;
  }, [activeDevices, draft.selectedReceiverDeviceId, selectedReceiverKey]);
  const savedReceiverUserPersonId = selectedDevice?.mainConnectUserPersonId?.trim() || "";
  const savedReceiverContactUserId = selectedDevice?.receiverContactUserId?.trim() || "";
  const savedReceiverDeviceKey = selectedDevice
    ? selectedDevice.id || selectedDevice.receiverId || receiverDeviceKey(selectedDevice)
    : "";
  const isReturningReceiverSetup = Boolean(
    selectedDevice &&
      (selectedDevice.pairedAt || savedReceiverUserPersonId || savedReceiverContactUserId)
  );
  const currentReceiverUser = useMemo(() => {
    if (!savedReceiverUserPersonId) return null;
    const eligiblePerson =
      eligiblePeople.find((person) => person.id === savedReceiverUserPersonId) ?? null;
    if (eligiblePerson) return eligiblePerson;
    return {
      avatarType: "initials" as const,
      careCircleId: selectedDevice?.careCircleId || "",
      displayName:
        selectedDevice?.mainConnectUserDisplayName?.trim() ||
        selectedDevice?.name?.trim() ||
        "Current Receiver User",
      id: savedReceiverUserPersonId,
      isActive: true,
      subjectType: "other",
    };
  }, [
    eligiblePeople,
    savedReceiverUserPersonId,
    selectedDevice?.careCircleId,
    selectedDevice?.mainConnectUserDisplayName,
    selectedDevice?.name,
  ]);
  const selectedUser = useMemo(() => {
    const eligiblePerson =
      eligiblePeople.find((person) => person.id === draft.receiverUserPersonId) ?? null;
    if (eligiblePerson) return eligiblePerson;
    if (
      draft.receiverUserPersonId === currentAccountReceiverUserDraftId &&
      connectContext?.currentAccountProfile?.displayName
    ) {
      return {
        avatarType: "initials" as const,
        careCircleId: connectContext.mainConnectUserPerson?.careCircleId || "",
        displayName: connectContext.currentAccountProfile.displayName,
        id: currentAccountReceiverUserDraftId,
        isActive: true,
        isCurrentUser: true,
        subjectType: "other",
      };
    }
    return null;
  }, [connectContext, draft.receiverUserPersonId, eligiblePeople]);
  const selectedContact = useMemo(
    () =>
      contactOptions.find((contact) => contact.userId === draft.receiverContactUserId) ??
      (contactOptions.length === 1 ? contactOptions[0] : null) ??
      null,
    [contactOptions, draft.receiverContactUserId]
  );
  const selectedUserIsCurrentAccountPerson = Boolean(
    draft.receiverUserPersonId === currentAccountReceiverUserDraftId ||
      (selectedUser &&
        connectContext?.currentAccountPersonId &&
        selectedUser.id === connectContext.currentAccountPersonId)
  );
  const selectedDeviceHasSelfContact = Boolean(
    selectedDevice?.receiverContactIsReceiverUser &&
      selectedDevice.mainConnectUserPersonId &&
      selectedUser?.id === selectedDevice.mainConnectUserPersonId
  );
  const isSelfContact = selectedUserIsCurrentAccountPerson || selectedDeviceHasSelfContact;
  const unsavedChangePages = useMemo(() => {
    const pages: string[] = [];
    const pairingChanged = Boolean(
      draft.pairingCode.trim() ||
        draft.nativeClaim ||
        (selectedDevice?.pairedAt
          ? draft.pairingStatus !== "paired"
          : draft.pairingStatus !== "idle")
    );

    if (!selectedReceiverKey) {
      if (draft.receiverUserPersonId || draft.receiverContactUserId) {
        pages.push("Receiver User");
      }
      if (pairingChanged) {
        pages.push("Pair");
      }
      return pages;
    }

    if (
      (savedReceiverUserPersonId && draft.receiverUserPersonId !== savedReceiverUserPersonId) ||
      (savedReceiverContactUserId && draft.receiverContactUserId !== savedReceiverContactUserId)
    ) {
      pages.push("Receiver User");
    }
    if (pairingChanged) {
      pages.push("Pair");
    }
    return pages;
  }, [
    draft.nativeClaim,
    draft.pairingCode,
    draft.pairingStatus,
    draft.receiverContactUserId,
    draft.receiverUserPersonId,
    savedReceiverContactUserId,
    savedReceiverUserPersonId,
    selectedDevice?.pairedAt,
    selectedReceiverKey,
  ]);
  const requestClose = useCallback(() => {
    if (unsavedChangePages.length) {
      setExitConfirmOpen(true);
      return;
    }
    onClose();
  }, [onClose, unsavedChangePages.length]);
  const receiverUrl = useMemo(() => {
    const receiverUrlFromSetupLink = safeReceiverUrl(initialReceiverUrl);
    if (receiverUrlFromSetupLink) return receiverUrlFromSetupLink;
    if (!browserOrigin) return "/connect/receiver";
    return new URL("/connect/receiver", browserOrigin).toString();
  }, [browserOrigin, initialReceiverUrl]);
  const provisioningUrl = useMemo(() => {
    const url = new URL("carepland://receiver/provision");
    url.searchParams.set("receiver_url", receiverUrl);
    if (draft.nativeClaim) {
      url.searchParams.set("claim", draft.nativeClaim);
      url.searchParams.set("mode", "claim_pending");
    } else {
      url.searchParams.set("code", draft.pairingCode.trim());
      url.searchParams.set("mode", "setup_pending");
    }
    url.searchParams.set("device", "android_receiver");
    url.searchParams.set("hardwareProfile", "generic_landscape_android");
    url.searchParams.set("uiLayout", "default_receiver");
    return url.toString();
  }, [draft.nativeClaim, draft.pairingCode, receiverUrl]);

  const ensureCurrentAccountPerson = useCallback(
    async (options?: { moveToReceiverUser?: boolean }) => {
      setEnsuringCurrentAccountPerson(true);
      try {
        const nextContext = await ensureConnectCurrentAccountPerson();
        const accountPersonId = nextContext.currentAccountPersonId || "";

        if (!accountPersonId) {
          throw new Error("Your Receiver User was not created yet.");
        }

        setDraft((current) => ({
          ...current,
          receiverContactUserId: "",
          receiverUserPersonId: accountPersonId,
          section:
            options?.moveToReceiverUser === false
              ? current.section
              : "receiverUser",
        }));
        await onRefresh();
        return accountPersonId;
      } catch (error) {
        console.warn("Receiver Setup could not prepare the account person.", error);
        return "";
      } finally {
        setEnsuringCurrentAccountPerson(false);
      }
    },
    [onRefresh, setDraft]
  );

  const cancelReceiverUserChange = useCallback(() => {
    if (!savedReceiverUserPersonId) return;
    setDraft((current) => ({
      ...current,
      receiverContactUserId: savedReceiverContactUserId || current.receiverContactUserId,
      receiverUserPersonId: savedReceiverUserPersonId,
      section: "receiverUser",
    }));
    setReceiverUserPreparationStatus("");
  }, [savedReceiverContactUserId, savedReceiverUserPersonId, setDraft]);

  const cancelPairingChange = useCallback(() => {
    setDraft((current) => ({
      ...current,
      nativeClaim: "",
      pairingCode: "",
      pairingStatus: selectedDevice?.pairedAt ? "paired" : "idle",
      selectedReceiverDeviceId: savedReceiverDeviceKey || current.selectedReceiverDeviceId,
      section: "pair",
    }));
  }, [savedReceiverDeviceKey, selectedDevice?.pairedAt, setDraft]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/connect/receiver-setup/metadata", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: ReceiverSetupMetadata & { ok?: boolean }) => {
        if (cancelled) return;
        setMetadata({
          apkDownloadUrl: payload.apkDownloadUrl || "",
          apkSha256Checksum: payload.apkSha256Checksum || "",
          apkVersionName: payload.apkVersionName || "",
          setupBaseUrl: payload.setupBaseUrl || "",
        });
        setBrowserOrigin(payload.setupBaseUrl || window.location.origin);
        setMetadataStatus("Ready.");
      })
      .catch(() => {
        if (cancelled) return;
        setMetadata(null);
        setMetadataStatus("Receiver setup details are unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      initializedReturningReceiverKeyRef.current = "";
      return;
    }
    if (!selectedReceiverKey) {
      if (initializedReturningReceiverKeyRef.current === "new") return;
      initializedReturningReceiverKeyRef.current = "new";
      setDraft(() => ({
        ...defaultReceiverSetupDraft,
        installMode: installModeLock,
        installViewed: initialSection === "install",
        pairingCode: formattedInitialPairingCode,
        section: initialSection,
      }));
      setReceiverUserPreparationStatus("");
      return;
    }
    if (!savedReceiverDeviceKey) return;
    if (initializedReturningReceiverKeyRef.current === savedReceiverDeviceKey) return;
    initializedReturningReceiverKeyRef.current = savedReceiverDeviceKey;
    const startingSection = initialSection === "home" ? "receiverUser" : initialSection;
    setDraft((current) => ({
      ...current,
      installMode: installModeLock ?? current.installMode,
      installViewed: true,
      lastCompletedSection: selectedDevice?.pairedAt ? "pair" : current.lastCompletedSection,
      pairingCode: formattedInitialPairingCode || current.pairingCode,
      pairingStatus: selectedDevice?.pairedAt ? "paired" : current.pairingStatus,
      receiverContactUserId: savedReceiverContactUserId || current.receiverContactUserId,
      receiverUserPersonId: savedReceiverUserPersonId || current.receiverUserPersonId,
      section: startingSection,
      selectedReceiverDeviceId: savedReceiverDeviceKey,
    }));
    setReceiverUserPreparationStatus("");
  }, [
    open,
    savedReceiverContactUserId,
    savedReceiverDeviceKey,
    savedReceiverUserPersonId,
    initialSection,
    formattedInitialPairingCode,
    installModeLock,
    selectedReceiverKey,
    selectedDevice?.pairedAt,
    setDraft,
  ]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, requestClose]);

  if (!open) return null;

  async function copyText(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(label);
    } catch {
      setCopyStatus("Copy failed. Select the text and copy it manually.");
    }
  }

  function goBack() {
    if (draft.section === "advancedAndroid") {
      setDraft((current) => ({ ...current, installViewed: true, section: "install" }));
      return;
    }
    if (draft.section === "install") {
      setDraft((current) => ({ ...current, section: "start" }));
      return;
    }
    const currentIndex = receiverSetupSectionOrder.indexOf(draft.section);
    if (currentIndex <= 0) {
      setDraft((current) => ({
        ...current,
        section: "start",
      }));
      return;
    }
    const previousSection = receiverSetupSectionOrder[currentIndex - 1];
    setDraft((current) => ({
      ...current,
      installViewed: current.installViewed || previousSection === "install",
      section: previousSection,
    }));
  }

  async function goNext() {
    setReceiverUserPreparationStatus("");
    if (draft.section === "finish") {
      onClose();
      void onRefresh();
      return;
    }
    if (
      draft.section === "receiverUser" &&
      connectContext?.currentAccountProfile?.displayName &&
      !connectContext.currentAccountPersonId
    ) {
      if (draft.receiverUserPersonId === currentAccountReceiverUserDraftId) {
        await ensureCurrentAccountPerson({
          moveToReceiverUser: false,
        });
      } else {
        void ensureCurrentAccountPerson({ moveToReceiverUser: false });
      }
    }
    const currentIndex = receiverSetupSectionOrder.indexOf(draft.section);
    if (currentIndex < 0) {
      setDraft((current) => ({ ...current, installViewed: true, section: "install" }));
      return;
    }
    const nextSection =
      receiverSetupSectionOrder[Math.min(currentIndex + 1, receiverSetupSectionOrder.length - 1)];
    setDraft((current) => ({
      ...current,
      installViewed: current.installViewed || nextSection === "install",
      lastCompletedSection: current.section,
      section: nextSection,
    }));
  }

  const sharedProps: ReceiverSetupStepProps = {
    activeDevices,
    contactOptions,
    connectContext,
    draft,
    eligiblePeople,
    ensureCurrentAccountPerson: () => ensureCurrentAccountPerson(),
    ensuringCurrentAccountPerson,
    currentReceiverUser,
    isReturningReceiverSetup,
    isSelfContact,
    onCancelPairingChange: cancelPairingChange,
    onCancelReceiverUserChange: cancelReceiverUserChange,
    onPairingComplete: onRefresh,
    receiverUserPreparationStatus,
    selectedContact,
    selectedDevice,
    selectedUser,
    setDraft,
  };
  const canGoNext = canMoveNext(draft, sharedProps);
  const lastCompletedIndex = receiverSetupSectionOrder.indexOf(
    draft.lastCompletedSection ?? "home"
  );
  const installIndex = receiverSetupSectionOrder.indexOf("install");
  const pairReady = draft.pairingStatus === "paired" || Boolean(selectedDevice?.pairedAt);
  const finishReady = Boolean(selectedUser && selectedContact && pairReady);
  const receiverIdentityText = selectedDevice
    ? `Receiver Name: ${receiverDisplayName(selectedDevice)} · Receiver ID: ${
        selectedDevice.receiverId || selectedDevice.id || selectedReceiverKey || "Not assigned yet"
      }`
    : "New Receiver Setup";
  const completedProgressSections: Partial<Record<ReceiverSetupSection, boolean>> = {
    receiverUser: canMoveNext({ ...draft, section: "receiverUser" }, sharedProps),
    install: isReturningReceiverSetup || draft.installViewed || lastCompletedIndex >= installIndex,
    pair: pairReady,
    finish: finishReady && draft.section === "finish",
  };
  const showProgress = receiverSetupSectionOrder.includes(draft.section);
  const showCopyStatus = Boolean(
    copyStatus && (draft.section === "install" || draft.section === "advancedAndroid")
  );
  const isStartScreen = draft.section === "start";
  const availableViewportWidth = Math.max(
    1,
    viewportSize.width - receiverSetupViewportMargin * 2
  );
  const availableViewportHeight = Math.max(
    1,
    viewportSize.height - receiverSetupViewportMargin * 2
  );
  const canvasScale = Math.min(
    availableViewportWidth / receiverSetupCanvasWidth,
    availableViewportHeight / receiverSetupCanvasHeight,
    1
  );
  const scaledCanvasWidth = receiverSetupCanvasWidth * canvasScale;
  const scaledCanvasHeight = receiverSetupCanvasHeight * canvasScale;

  return (
    <div
      aria-labelledby="receiver-setup-overlay-title"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-[#020817]/80"
      role="dialog"
    >
      <div
        style={{
          height: `${scaledCanvasHeight}px`,
          width: `${scaledCanvasWidth}px`,
        }}
      >
        <div
          className="relative flex overflow-hidden rounded-2xl bg-white shadow-2xl"
          ref={panelRef}
          style={{
            height: `${receiverSetupCanvasHeight}px`,
            transform: `scale(${canvasScale})`,
            transformOrigin: "top left",
            width: `${receiverSetupCanvasWidth}px`,
          }}
        >
        <div className="flex h-full w-full flex-col">
          <span className="sr-only" id="receiver-setup-overlay-title">
            CarePland Receiver Setup
          </span>
          {isStartScreen ? (
            <button
              aria-label={startCloseLabel || "Close Receiver Setup"}
              className={`absolute right-8 top-7 z-10 shrink-0 rounded-lg font-black text-[#173150] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] ${
                startCloseLabel
                  ? "px-2 py-1 text-sm hover:text-[#2f6f9f] hover:underline"
                  : "grid h-11 w-11 place-items-center border border-[#cbd9e7] bg-white text-xl hover:bg-[#edf5fc]"
              }`}
              onClick={requestClose}
              ref={closeButtonRef}
              type="button"
            >
              {startCloseLabel || "×"}
            </button>
          ) : (
          <header className="bg-[#f8fbff] px-8 pb-0 pt-5 sm:px-12 sm:pt-6 lg:px-14">
            <div className="flex items-start justify-between gap-4">
              <div className="pt-4">
                <p className="text-xs font-black uppercase tracking-normal text-[#5f6e84]">
                  CarePland Receiver Setup
                </p>
              </div>
              <button
                aria-label="Close Receiver Setup"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#cbd9e7] bg-white text-xl font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                onClick={requestClose}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </div>
            {showProgress ? (
              <div className="mt-2 border-b border-[#d6e3f2] pb-4">
                <ReceiverSetupProgress
                  canNavigate
                  completedSections={completedProgressSections}
                  labelOverrides={{
                    finish: finishReady ? "Setup Complete" : "Complete Setup",
                  }}
                  onNavigate={(section) =>
                    setDraft((current) => ({
                      ...current,
                      installViewed: current.installViewed || section === "install",
                      section,
                    }))
                  }
                  section={draft.section}
                />
              </div>
            ) : (
              <div className="mt-3 border-b border-[#d6e3f2]" />
            )}
          </header>
          )}

          <div
            className={`flex-1 overflow-y-auto px-8 sm:px-12 lg:px-14 ${
              isStartScreen ? "py-8" : "py-5"
            }`}
          >
            {metadataStatus !== "Ready." && draft.section !== "home" ? (
              <div className="mb-4">
                <ReceiverSetupStatus tone={metadata ? "info" : "warn"}>
                  {metadataStatus}
                </ReceiverSetupStatus>
              </div>
            ) : null}
            {showCopyStatus ? (
              <div className="mb-4" aria-live="polite">
                <ReceiverSetupStatus tone="good">{copyStatus}</ReceiverSetupStatus>
              </div>
            ) : null}
            {renderSection(draft.section, {
              advancedAndroid: (
                <AdvancedAndroidSetupPanel
                  browserOrigin={browserOrigin}
                  copyText={copyText}
                  metadata={metadata}
                  provisioningUrl={provisioningUrl}
                  receiverUrl={receiverUrl}
                />
              ),
              finish: (
                <ReceiverFinishStep {...sharedProps} />
              ),
              home: (
                <ReceiverStartStep
                  installModeLock={installModeLock}
                  setDraft={setDraft}
                />
              ),
              install: (
                <ReceiverInstallStep
                  browserOrigin={browserOrigin}
                  copyText={copyText}
                  draft={draft}
                  installModeLock={installModeLock}
                  metadata={metadata}
                  receiverUrl={receiverUrl}
                  setDraft={setDraft}
                />
              ),
              pair: (
                <ReceiverPairStep
                  {...sharedProps}
                  receiverUrl={receiverUrl}
                />
              ),
              receiverContact: <ReceiverUserStep {...sharedProps} />,
              receiverUser: <ReceiverUserStep {...sharedProps} />,
              settings: (
                <ReceiverSetupStatus>
                  Receiver Settings will open in the existing settings surface.
                </ReceiverSetupStatus>
              ),
              start: (
                <ReceiverStartStep
                  installModeLock={installModeLock}
                  setDraft={setDraft}
                />
              ),
            })}
          </div>

          {!isStartScreen ? (
            <ReceiverSetupFooterNav
              canGoNext={
                draft.section === "finish"
                  ? finishReady
                  : canGoNext && !ensuringCurrentAccountPerson
              }
              finishReceiverUrl={
                draft.section === "finish" && finishReady ? receiverUrl : ""
              }
              hidePrimaryActions={draft.section === "finish" && !finishReady}
              nextLabel={
                ensuringCurrentAccountPerson && draft.section === "receiverUser"
                  ? "Preparing..."
                  : draft.section === "finish"
                    ? "Done"
                    : "Next"
              }
              onBack={goBack}
              onNext={goNext}
              receiverIdentityText={receiverIdentityText}
              section={draft.section}
            />
          ) : null}
        </div>
        {exitConfirmOpen ? (
          <div
            aria-labelledby="receiver-setup-exit-title"
            aria-modal="true"
            className="absolute inset-0 z-10 grid place-items-center bg-[#0f172a]/35 p-5"
            role="dialog"
          >
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
              <h2
                className="text-2xl font-black text-[#172f49]"
                id="receiver-setup-exit-title"
              >
                You have unsaved changes
              </h2>
              <p className="mt-3 text-base font-semibold leading-relaxed text-[#5f6e84]">
                Leaving now will discard changes on:
              </p>
              <ul className="mt-3 grid gap-2 text-base font-black text-[#172f49]">
                {unsavedChangePages.map((page) => (
                  <li key={page}>• {page}</li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                  onClick={() => setExitConfirmOpen(false)}
                  type="button"
                >
                  Stay in Setup
                </button>
                <button
                  className="min-h-11 rounded-lg bg-[#2f6f9f] px-4 text-sm font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                  onClick={() => {
                    setExitConfirmOpen(false);
                    onClose();
                  }}
                  type="button"
                >
                  Leave Setup
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

function renderSection(
  section: ReceiverSetupSection,
  sections: Record<ReceiverSetupSection, ReactNode>
) {
  return sections[section] ?? sections.home;
}

function canMoveNext(draft: ReceiverSetupDraft, props: ReceiverSetupStepProps) {
  if (draft.section === "receiverUser") {
    return (
      Boolean(props.selectedUser) ||
      draft.receiverUserPersonId === currentAccountReceiverUserDraftId
    ) && (props.isSelfContact || Boolean(props.selectedContact));
  }
  if (draft.section === "receiverContact") return Boolean(props.selectedContact);
  if (draft.section === "start") return false;
  if (draft.section === "install") return Boolean(draft.installMode ?? "web");
  if (draft.section === "pair") return draft.pairingStatus === "paired";
  return true;
}

function safeReceiverUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.pathname = "/connect/receiver";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}
