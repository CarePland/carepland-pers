export type ReceiverLayoutStage = "active" | "proposed" | "experiment" | "archive";

export type ReceiverLayoutOption = {
  assignable: boolean;
  customerVisible: boolean;
  description: string;
  fakeProvisioning: ReceiverLayoutFakeProvisioning;
  hardwareProfile: string;
  homeLayout?: string;
  id: string;
  label: string;
  productionReady: boolean;
  receiverLayout?: "classic" | "modern";
  route: "/connect/receiver" | "/connect/receiver/legacy";
  runtime: "modern_web" | "classic_webview";
  stage: ReceiverLayoutStage;
  uiLayout: string;
};

export type ReceiverLayoutFakeProvisioning = {
  locationLabel: string;
  mainConnectUserDisplayName: string;
  mainConnectUserPersonId: string;
  primaryCoordinatorDisplayName: string;
  receiverContactDisplayName: string;
  receiverContactIsReceiverUser: boolean;
  receiverContactUserId: string;
  sampleDataLayer: string;
};

const defaultReceiverLayoutFakeProvisioning = {
  locationLabel: "Layout Preview Receiver",
  mainConnectUserDisplayName: "Andrew",
  mainConnectUserPersonId: "sample-receiver-user-andrew",
  primaryCoordinatorDisplayName: "CarePland Preview",
  receiverContactDisplayName: "CarePland Preview",
  receiverContactIsReceiverUser: false,
  receiverContactUserId: "sample-carepland-preview-contact",
  sampleDataLayer: "sample_seed_receiver_messages_v1",
} as const satisfies ReceiverLayoutFakeProvisioning;

const receiverLayoutSortOrder: Record<ReceiverLayoutStage, number> = {
  active: 0,
  proposed: 1,
  experiment: 2,
  archive: 3,
};

const unsortedReceiverLayoutOptions = [
  {
    description: "Default dedicated Receiver appliance surface.",
    assignable: true,
    customerVisible: true,
    fakeProvisioning: defaultReceiverLayoutFakeProvisioning,
    hardwareProfile: "grandstream_gxv3370",
    homeLayout: "ask_tell_2",
    id: "appliance",
    label: "Appliance",
    productionReady: true,
    route: "/connect/receiver",
    runtime: "modern_web",
    stage: "active",
    uiLayout: "desk_phone_1024x600",
  },
  {
    description: "Approved responsive web Receiver surface.",
    assignable: true,
    customerVisible: true,
    fakeProvisioning: defaultReceiverLayoutFakeProvisioning,
    hardwareProfile: "web",
    id: "modern",
    label: "Modern",
    productionReady: true,
    receiverLayout: "modern",
    route: "/connect/receiver",
    runtime: "modern_web",
    stage: "active",
    uiLayout: "default_receiver",
  },
  {
    description: "Older desk-phone action grid retained for comparison.",
    assignable: false,
    customerVisible: false,
    fakeProvisioning: defaultReceiverLayoutFakeProvisioning,
    hardwareProfile: "grandstream_gxv3370",
    id: "classic",
    label: "Classic",
    productionReady: false,
    route: "/connect/receiver",
    runtime: "modern_web",
    stage: "archive",
    uiLayout: "desk_phone_1024x600",
  },
  {
    description: "Focus-first desk-phone experiment.",
    assignable: false,
    customerVisible: false,
    fakeProvisioning: defaultReceiverLayoutFakeProvisioning,
    hardwareProfile: "grandstream_gxv3370",
    homeLayout: "focus_v1",
    id: "focus_v1",
    label: "Focus",
    productionReady: false,
    route: "/connect/receiver",
    runtime: "modern_web",
    stage: "experiment",
    uiLayout: "desk_phone_1024x600",
  },
  {
    description: "Original Ask/Tell desk-phone experiment.",
    assignable: false,
    customerVisible: false,
    fakeProvisioning: defaultReceiverLayoutFakeProvisioning,
    hardwareProfile: "grandstream_gxv3370",
    homeLayout: "ask_tell",
    id: "ask_tell",
    label: "Ask/Tell",
    productionReady: false,
    route: "/connect/receiver",
    runtime: "modern_web",
    stage: "experiment",
    uiLayout: "desk_phone_1024x600",
  },
  {
    description: "Android 7-compatible server-rendered Receiver.",
    assignable: false,
    customerVisible: false,
    fakeProvisioning: defaultReceiverLayoutFakeProvisioning,
    hardwareProfile: "grandstream_gxv3370",
    id: "old_web",
    label: "Old Web",
    productionReady: false,
    route: "/connect/receiver/legacy",
    runtime: "classic_webview",
    stage: "proposed",
    uiLayout: "desk_phone_1024x600",
  },
  {
    description: "Responsive browser Receiver fallback.",
    assignable: false,
    customerVisible: false,
    fakeProvisioning: defaultReceiverLayoutFakeProvisioning,
    hardwareProfile: "web",
    id: "default_web",
    label: "Default Web",
    productionReady: false,
    route: "/connect/receiver",
    runtime: "modern_web",
    stage: "proposed",
    uiLayout: "default_receiver",
  },
] as const satisfies readonly ReceiverLayoutOption[];

export const receiverLayoutOptions = [...unsortedReceiverLayoutOptions].sort(
  (first, second) =>
    receiverLayoutSortOrder[first.stage] - receiverLayoutSortOrder[second.stage] ||
    first.label.localeCompare(second.label)
);

export type ReceiverLayoutOptionId = (typeof receiverLayoutOptions)[number]["id"];

export function receiverLayoutOptionUrl(option: ReceiverLayoutOption) {
  const params = new URLSearchParams({
    device: option.hardwareProfile.includes("gxv3370") ? "gxv3370" : "web",
    hardwareProfile: option.hardwareProfile,
    layoutPreview: "1",
    locationLabel: option.fakeProvisioning.locationLabel,
    mainConnectUserDisplayName: option.fakeProvisioning.mainConnectUserDisplayName,
    mainConnectUserPersonId: option.fakeProvisioning.mainConnectUserPersonId,
    primaryCoordinatorDisplayName: option.fakeProvisioning.primaryCoordinatorDisplayName,
    receiverContactDisplayName: option.fakeProvisioning.receiverContactDisplayName,
    receiverContactIsReceiverUser: option.fakeProvisioning.receiverContactIsReceiverUser
      ? "1"
      : "0",
    receiverContactUserId: option.fakeProvisioning.receiverContactUserId,
    receiverBindingStatus: "local_test",
    receiverDeviceId: `layout-preview-${option.id}`,
    receiverInstallId: `layout-preview-${option.id}-browser`,
    receiver_runtime: option.runtime,
    sampleDataLayer: option.fakeProvisioning.sampleDataLayer,
    setupCode: "12345",
    uiLayout: option.uiLayout,
  });

  if (option.homeLayout) {
    params.set("homeLayout", option.homeLayout);
  }

  if (option.receiverLayout) {
    params.set("receiverLayout", option.receiverLayout);
  }

  return `${option.route}?${params.toString()}`;
}
