export const staticSupportRecipes = [
  {
    id: "sound-no-audio-ios-ipad-safari-browser",
    key: "sound.no_audio.ios.ipad.safari.browser",
    issue: "no_audio",
    category: "sound",
    deviceFamily: "iPad",
    deviceModel: "",
    osName: "iOS",
    osVersion: "",
    browserName: "Safari",
    browserVersion: "",
    mode: "browser",
    title: "Fix sound on iPad using Safari",
    steps: [
      "Keep this receiver page open.",
      "Press the physical volume up button several times.",
      "Open Control Center and confirm audio is playing through this iPad, not headphones or another output.",
      "Check Silent Mode or Focus if this iPad shows those controls.",
      "Tap once anywhere on the receiver screen.",
      "Tap Test Sound Again.",
    ],
    warnings: ["Do not reset the device.", "Do not erase content or settings."],
    notes: ["iPadOS sound behavior varies by version. Some versions reduce browser audio while allowing speech."],
    lastReviewedAt: null,
    source: "static",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
  {
    id: "sound-no-beeps-ios-ipad-safari-browser",
    key: "sound.no_beeps.ios.ipad.safari.browser",
    issue: "no_beeps",
    category: "sound",
    deviceFamily: "iPad",
    deviceModel: "",
    osName: "iOS",
    osVersion: "",
    browserName: "Safari",
    browserVersion: "",
    mode: "browser",
    title: "Fix missing button beeps on iPad Safari",
    steps: [
      "Leave spoken reminders on; speech may work even when button beeps are muted.",
      "Press the physical volume up button while this receiver page is visible.",
      "Tap once anywhere on the receiver screen.",
      "Tap Test Sound Again.",
      "If beeps stay quiet, treat button beeps as optional on this iPad and rely on spoken prompts.",
    ],
    actions: [{ action: "set_volume_high", label: "Set Receiver Volume to High" }],
    warnings: ["Do not reset the device.", "Do not erase content or settings."],
    notes: ["Some iPad browsers reduce generated browser sounds while allowing speech synthesis."],
    lastReviewedAt: null,
    source: "static",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
  {
    id: "sound-faint-beeps-ios-ipad-safari-browser",
    key: "sound.faint_beeps.ios.ipad.safari.browser",
    issue: "faint_beeps",
    category: "sound",
    deviceFamily: "iPad",
    deviceModel: "",
    osName: "iOS",
    osVersion: "",
    browserName: "Safari",
    browserVersion: "",
    mode: "browser",
    title: "Make iPad Safari button beeps easier to hear",
    steps: [
      "Press the physical volume up button while this receiver page is visible.",
      "Check Control Center for the current audio output.",
      "Tap Test Sound Again.",
      "If the beep remains faint but speech is clear, use spoken reminders as the reliable sound path.",
    ],
    actions: [{ action: "set_volume_high", label: "Set Receiver Volume to High" }],
    warnings: ["Do not reset the device.", "Do not erase content or settings."],
    notes: ["Button beeps are comfort feedback. They should never block receiver use."],
    lastReviewedAt: null,
    source: "static",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
  {
    id: "sound-no-audio-generic",
    key: "sound.no_audio.generic",
    issue: "no_audio",
    category: "sound",
    deviceFamily: "",
    deviceModel: "",
    osName: "",
    osVersion: "",
    browserName: "",
    browserVersion: "",
    mode: "",
    title: "Fix receiver sound",
    steps: [
      "Keep this receiver page open.",
      "Turn up the physical device volume.",
      "Confirm audio is playing through this device, not headphones or another output.",
      "Tap once anywhere on the receiver screen.",
      "Tap Test Sound Again.",
    ],
    warnings: ["Do not reset the device.", "Do not erase content or settings."],
    notes: [],
    lastReviewedAt: null,
    source: "static",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
  {
    id: "sound-no-beeps-generic",
    key: "sound.no_beeps.generic",
    issue: "no_beeps",
    category: "sound",
    deviceFamily: "",
    deviceModel: "",
    osName: "",
    osVersion: "",
    browserName: "",
    browserVersion: "",
    mode: "",
    title: "Fix receiver button beeps",
    steps: [
      "Make sure Retro Sounds and Button Beeps are on.",
      "Turn up the physical device volume while this receiver page is visible.",
      "Tap Test Sound Again.",
      "If spoken reminders work but button beeps do not, continue using the receiver; beeps are optional feedback.",
    ],
    actions: [
      { action: "enable_retro_button_sounds", label: "Turn On Receiver Sounds" },
      { action: "set_volume_high", label: "Set Receiver Volume to High" },
    ],
    warnings: ["Do not reset the device.", "Do not erase content or settings."],
    notes: [],
    lastReviewedAt: null,
    source: "static",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
];

export function normalizeRecipePart(value) {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return clean || "unknown";
}

export function issueFromSoundResult(result) {
  if (result === "speech_only") return "no_beeps";
  if (result === "faint_beep") return "faint_beeps";
  if (result === "no_ringers") return "no_ringers";
  if (result === "no_spoken_reminders") return "no_spoken_reminders";
  if (result === "all") return "tested_ok";
  return "no_audio";
}

export function buildSupportRecipeKey(context, issue) {
  return [
    "sound",
    issue,
    normalizeRecipePart(context.osName),
    normalizeRecipePart(context.deviceModel || context.deviceFamily),
    normalizeRecipePart(context.browserName),
    normalizeRecipePart(context.mode),
  ].join(".");
}

export function supportRecipeLookupKeys(context, issue) {
  const category = "sound";
  const os = normalizeRecipePart(context.osName);
  const family = normalizeRecipePart(context.deviceFamily);
  const model = normalizeRecipePart(context.deviceModel);
  const browser = normalizeRecipePart(context.browserName);
  const mode = normalizeRecipePart(context.mode);
  const keys = [
    [category, issue, os, model, browser, mode].join("."),
    [category, issue, os, family, browser, mode].join("."),
    [category, issue, os, browser, mode].join("."),
    [category, issue, "generic"].join("."),
  ];
  return [...new Set(keys.filter((key) => !key.includes(".unknown.")))];
}

export function findSupportRecipe(context, issue, generatedRecipes = []) {
  const recipes = [...generatedRecipes, ...staticSupportRecipes].filter(
    (recipe) => recipe.status === "active" && recipe.issue === issue
  );
  const keys = supportRecipeLookupKeys(context, issue);
  for (const key of keys) {
    const match = recipes.find((recipe) => recipe.key === key);
    if (match) {
      return { recipe: match, matchedKey: key, lookupKeys: keys };
    }
  }
  return { recipe: null, matchedKey: "", lookupKeys: keys };
}

export function createGeneratedSupportRecipe(context, issue, help) {
  const now = new Date().toISOString();
  const key = buildSupportRecipeKey(context, issue);
  return {
    id: `local-${key}-${Date.now()}`,
    key,
    issue,
    category: "sound",
    deviceFamily: context.deviceFamily || "",
    deviceModel: context.deviceModel || "",
    osName: context.osName || "",
    osVersion: context.osVersion || "",
    browserName: context.browserName || "",
    browserVersion: context.browserVersion || "",
    mode: context.mode || "",
    title: help.title,
    steps: help.steps,
    actions: help.actions || [],
    warnings: help.warnings || ["Do not reset the device.", "Do not erase content or settings."],
    notes: help.notes || [],
    lastReviewedAt: null,
    source: "ai_generated",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}
