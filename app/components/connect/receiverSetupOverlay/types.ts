import type { ConnectMainUserContext, ConnectPersPerson } from "@/app/lib/connect/context";
import type { ConnectReceiverDevice } from "@/app/lib/connect/provisioning";

export type ReceiverSetupSection =
  | "home"
  | "start"
  | "receiverUser"
  | "receiverContact"
  | "install"
  | "pair"
  | "finish"
  | "advancedAndroid"
  | "settings";

export type ReceiverSetupPairingStatus =
  | "idle"
  | "checking"
  | "pending"
  | "paired"
  | "error";

export type ReceiverSetupDraft = {
  installMode?: "android" | "web";
  installViewed?: boolean;
  lastCompletedSection?: ReceiverSetupSection;
  nativeClaim?: string;
  pairingCode: string;
  pairingError: string;
  pairingStatus: ReceiverSetupPairingStatus;
  receiverContactUserId: string;
  receiverUserPersonId: string;
  section: ReceiverSetupSection;
  selectedReceiverDeviceId?: string;
};

export type ReceiverSetupMetadata = {
  apkDownloadUrl: string;
  apkSha256Checksum: string;
  apkVersionName: string;
  setupBaseUrl: string;
};

export type ReceiverContactOption = {
  displayName: string;
  source: "existing_receiver" | "primary_coordinator";
  userId: string;
};

export type ReceiverSetupStepProps = {
  activeDevices: ConnectReceiverDevice[];
  contactOptions: ReceiverContactOption[];
  connectContext: ConnectMainUserContext | null;
  draft: ReceiverSetupDraft;
  eligiblePeople: ConnectPersPerson[];
  ensureCurrentAccountPerson: () => Promise<string>;
  ensuringCurrentAccountPerson: boolean;
  isSelfContact: boolean;
  isReturningReceiverSetup: boolean;
  currentReceiverUser: ConnectPersPerson | null;
  onCancelPairingChange: () => void;
  onCancelReceiverUserChange: () => void;
  onPairingComplete: () => Promise<void>;
  receiverUserPreparationStatus: string;
  selectedContact: ReceiverContactOption | null;
  selectedDevice: ConnectReceiverDevice | null;
  selectedUser: ConnectPersPerson | null;
  setDraft: (updater: (current: ReceiverSetupDraft) => ReceiverSetupDraft) => void;
};
