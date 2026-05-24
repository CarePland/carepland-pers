export type PricingTier = {
  id: string;
  aliases?: string[];
  name: string;
  label: string;
  profileSummary: string;
  purpose: string;
  bestFor: string;
  careVips: string;
  carePrep: string;
  imports: string;
  support: string;
  automation: string;
  highlights: string[];
};

export type PricingTierFeatureKey =
  | "automation"
  | "care_prep"
  | "care_vips"
  | "imports"
  | "support";

export const pricingTiers: PricingTier[] = [
  {
    id: "personal",
    aliases: ["free"],
    name: "Free",
    label: "Tier 1",
    profileSummary: "Light appointment tracking with manual preparation.",
    purpose: "A gentle way to try appointment memory and CarePrep.",
    bestFor: "Light or occasional appointment tracking",
    careVips: "1 Care VIP",
    carePrep: "Limited manual CarePrep",
    imports: "Limited imports",
    support: "Self-service help",
    automation: "Manual preparation only",
    highlights: [
      "Basic appointment tracking",
      "Manual CarePrep generation",
      "Limited import allowances",
    ],
  },
  {
    id: "active_use",
    name: "Active Use",
    label: "Tier 2",
    profileSummary: "More room for active healthcare management.",
    purpose: "More room for active healthcare management.",
    bestFor: "Chronic care, frequent specialists, or fuller history",
    careVips: "1 Care VIP",
    carePrep: "More manual CarePrep",
    imports: "Expanded imports",
    support: "Assistant/chat support",
    automation: "Manual preparation",
    highlights: [
      "Larger CarePrep generation bag",
      "Deeper saved appointment context",
      "More import capacity",
    ],
  },
  {
    id: "premium_individual",
    name: "Premium Individual",
    label: "Tier 3",
    profileSummary: "Automatic preparation for one Care VIP.",
    purpose: "Proactive continuity support for one person.",
    bestFor: "People who want CarePland to quietly do more work",
    careVips: "1 Care VIP",
    carePrep: "Automatic CarePrep",
    imports: "Generous imports",
    support: "Enhanced support",
    automation: "Automatic preparation",
    highlights: [
      "Automatic appointment preparation",
      "Smart reminders and preparation workflows",
      "Reduced manual effort",
    ],
  },
  {
    id: "personal_plus",
    aliases: ["group", "caregiver"],
    name: "Group",
    label: "Tier 4",
    profileSummary: "Multi-person continuity and coordination.",
    purpose: "Coordination across multiple Care VIPs.",
    bestFor: "Families, caregivers, or groups managing care for others",
    careVips: "Multiple Care VIPs",
    carePrep: "Automatic CarePrep",
    imports: "Highest import allowances",
    support: "Most support access",
    automation: "Multi-person automation",
    highlights: [
      "Multiple Care VIP profiles",
      "Shared continuity workflows",
      "Group-oriented coordination support",
    ],
  },
  {
    id: "early_access",
    aliases: ["early_adopter"],
    name: "Early Access",
    label: "Early Access",
    profileSummary: "Broad early-adopter access while CarePland develops.",
    purpose: "Full-access continuity support for early adopters.",
    bestFor: "Early adopters who should retain broad Personal access",
    careVips: "Multiple Care VIPs",
    carePrep: "Automatic CarePrep",
    imports: "Highest import allowances",
    support: "Most support access",
    automation: "Multi-person automation",
    highlights: [
      "Group-level functionality",
      "Early adopter differentiation",
      "Ready for later subscription transition",
    ],
  },
];

export const pricingTierFeatureOptions: Array<{
  description: string;
  key: PricingTierFeatureKey;
  label: string;
  pricingTierProperty: keyof Pick<
    PricingTier,
    "automation" | "carePrep" | "careVips" | "imports" | "support"
  >;
}> = [
  {
    description: "Care VIP access shown in the Profile plan helper.",
    key: "care_vips",
    label: "Care VIPs",
    pricingTierProperty: "careVips",
  },
  {
    description: "CarePrep access shown in the Profile plan helper.",
    key: "care_prep",
    label: "CarePrep",
    pricingTierProperty: "carePrep",
  },
  {
    description: "Automation access shown in the Profile plan helper.",
    key: "automation",
    label: "Automation",
    pricingTierProperty: "automation",
  },
  {
    description: "Import allowance wording shown in the Profile plan helper.",
    key: "imports",
    label: "Imports",
    pricingTierProperty: "imports",
  },
  {
    description: "Support access wording shown in the Profile plan helper.",
    key: "support",
    label: "Support",
    pricingTierProperty: "support",
  },
];

export function pricingTierForEntitlement(
  entitlement: Pick<{ plan_id: string; plan_name: string }, "plan_id" | "plan_name">
) {
  return (
    pricingTiers.find(
      (tier) =>
        tier.id === entitlement.plan_id ||
        tier.aliases?.includes(entitlement.plan_id)
    ) ??
    pricingTiers.find((tier) => tier.name === entitlement.plan_name) ??
    pricingTiers[0]
  );
}

export function planFeatureContentKey(
  tierId: string,
  featureKey: PricingTierFeatureKey
) {
  return `plan_${tierId}_${featureKey}`;
}

export function planSummaryContentKey(tierId: string) {
  return `plan_${tierId}_summary`;
}

export function planProfilePanelContentKey(tierId: string) {
  return `plan_${tierId}_profile_panel`;
}

function planProfilePanelBody(tier: PricingTier) {
  return [
    tier.profileSummary,
    ...pricingTierFeatureOptions.map(
      (feature) => `${feature.label}: ${tier[feature.pricingTierProperty]}`
    ),
  ].join("\n");
}

export const planFeatureContentDefaults = Object.fromEntries(
  pricingTiers.flatMap((tier) => [
    [planSummaryContentKey(tier.id), tier.profileSummary],
    [planProfilePanelContentKey(tier.id), planProfilePanelBody(tier)],
    ...pricingTierFeatureOptions.map((feature) => [
      planFeatureContentKey(tier.id, feature.key),
      tier[feature.pricingTierProperty],
    ]),
  ])
) as Record<string, string>;
