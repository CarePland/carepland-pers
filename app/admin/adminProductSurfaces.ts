export type AdministeredProductKey = "connect" | "family" | "personal";

export type PersonalAdminAreaKey = "ai" | "product" | "support" | "users";
export type FamilyAdminAreaKey = "households" | "shared_care";
export type ConnectAdminAreaKey =
  | "audio"
  | "devices"
  | "households"
  | "interaction_traces"
  | "provisioning"
  | "request_interpretation"
  | "users";

export type AdminProductAreaKey =
  | ConnectAdminAreaKey
  | FamilyAdminAreaKey
  | PersonalAdminAreaKey;

export type AdminSurfaceStatus = "active" | "planned";

export type AdminProductArea = {
  description: string;
  key: AdminProductAreaKey;
  label: string;
  status: AdminSurfaceStatus;
};

export type AdminProductSurface = {
  areas: readonly AdminProductArea[];
  description: string;
  key: AdministeredProductKey;
  label: string;
  status: AdminSurfaceStatus;
};

export type AdminPanelRegistration = {
  areaKey: AdminProductAreaKey;
  description: string;
  key: string;
  label: string;
  owner: string;
  productKey: AdministeredProductKey;
  status: AdminSurfaceStatus;
};

export const adminProductSurfaces = [
  {
    areas: [
      {
        description: "User support tickets, Ask review, and follow-up queues.",
        key: "support",
        label: "Support",
        status: "active",
      },
      {
        description: "AI prompt versions, history, evaluations, and review tools.",
        key: "ai",
        label: "AI Ops",
        status: "active",
      },
      {
        description: "Read-only user views, audit trail, and account operations.",
        key: "users",
        label: "Users",
        status: "active",
      },
      {
        description: "Dynamic text, readiness, release notes, and product issues.",
        key: "product",
        label: "Product",
        status: "active",
      },
    ],
    description:
      "Appointment memory, CarePrep, Health Focus, support, and user operations.",
    key: "personal",
    label: "Personal",
    status: "active",
  },
  {
    areas: [
      {
        description:
          "Household/care-circle administration once Family paths are consolidated.",
        key: "households",
        label: "Households",
        status: "planned",
      },
      {
        description:
          "Shared appointments, errands, and consent-aware family participation.",
        key: "shared_care",
        label: "Shared Care",
        status: "planned",
      },
    ],
    description:
      "Household and shared-care workflows that will be administered through the same control plane.",
    key: "family",
    label: "Family",
    status: "planned",
  },
  {
    areas: [
      {
        description:
          "Setup workflows, activation, consent, and identity-link review.",
        key: "provisioning",
        label: "Provisioning",
        status: "planned",
      },
      {
        description:
          "Connect receiver users, lifecycle status, identity links, and product eligibility.",
        key: "users",
        label: "Users",
        status: "planned",
      },
      {
        description:
          "Receiver households, active/inactive state, membership, and Early Access product context.",
        key: "households",
        label: "Households",
        status: "planned",
      },
      {
        description:
          "Receiver devices, assignment, setup status, activity, and provisioning health.",
        key: "devices",
        label: "Devices",
        status: "planned",
      },
      {
        description:
          "Audio user profiles, receiver clarity, device sound checks, and feedback summaries.",
        key: "audio",
        label: "Audio",
        status: "planned",
      },
      {
        description:
          "Receiver Ask interpretation prompts, confidence, routing, and outcomes.",
        key: "request_interpretation",
        label: "Request Interpretation",
        status: "planned",
      },
      {
        description:
          "Durable ConnectAskInteraction trails and related recovery/escalation events.",
        key: "interaction_traces",
        label: "Interaction Traces",
        status: "planned",
      },
    ],
    description:
      "Receiver, provisioning, consent, audio, and interaction-trace operations. Early Access currently grants both Personal and Connect access.",
    key: "connect",
    label: "Connect",
    status: "planned",
  },
] as const satisfies readonly AdminProductSurface[];

export const adminPanelRegistrations = [
  {
    areaKey: "audio",
    description:
      "User audio profiles, receiver clarity summaries, sound-check results, and device-specific sound help.",
    key: "connect.audio.profile",
    label: "User Audio Profiles",
    owner: "connect-audio",
    productKey: "connect",
    status: "planned",
  },
  {
    areaKey: "users",
    description:
      "Connect receiver users by lifecycle state, identity links, and product eligibility.",
    key: "connect.users.registry",
    label: "Receiver Users",
    owner: "connect-provisioning",
    productKey: "connect",
    status: "planned",
  },
  {
    areaKey: "households",
    description:
      "Receiver households, membership, active/inactive status, and Early Access product context.",
    key: "connect.provisioning.households",
    label: "Households",
    owner: "connect-provisioning",
    productKey: "connect",
    status: "planned",
  },
  {
    areaKey: "devices",
    description:
      "Receiver devices, household assignment, setup links, activation, and presence signals.",
    key: "connect.devices.registry",
    label: "Devices",
    owner: "connect-provisioning",
    productKey: "connect",
    status: "planned",
  },
  {
    areaKey: "provisioning",
    description:
      "Setup links, activation, identity links, consent status, and provisioning event review.",
    key: "connect.provisioning.overview",
    label: "Provisioning Overview",
    owner: "connect-provisioning",
    productKey: "connect",
    status: "planned",
  },
  {
    areaKey: "request_interpretation",
    description:
      "Prompt versions and review queues for receiver request interpretation.",
    key: "connect.ask.interpreter",
    label: "Receiver Interpreter",
    owner: "connect",
    productKey: "connect",
    status: "planned",
  },
  {
    areaKey: "interaction_traces",
    description:
      "Durable ConnectAskInteraction trails with related recovery, escalation, and outcome events.",
    key: "connect.ask.interactions",
    label: "Interaction Traces",
    owner: "connect",
    productKey: "connect",
    status: "planned",
  },
] as const satisfies readonly AdminPanelRegistration[];

export function adminProductSurfaceFor(productKey: AdministeredProductKey) {
  return (
    adminProductSurfaces.find((surface) => surface.key === productKey) ?? null
  );
}

export function adminProductAreaFor(
  productKey: AdministeredProductKey,
  areaKey: AdminProductAreaKey
) {
  return (
    adminProductSurfaceFor(productKey)?.areas.find(
      (area) => area.key === areaKey
    ) ?? null
  );
}

export function adminPanelsForProduct(productKey: AdministeredProductKey) {
  return adminPanelRegistrations.filter(
    (registration) => registration.productKey === productKey
  );
}

export function adminPanelsForArea(
  productKey: AdministeredProductKey,
  areaKey: AdminProductAreaKey
) {
  return adminPanelRegistrations.filter(
    (registration) =>
      registration.productKey === productKey &&
      registration.areaKey === areaKey
  );
}
