export const connectThemeStorageKey = "carepland.connect.receiver.theme.v2";

export const defaultConnectTheme = Object.freeze({
  name: "Classic Green",
  primaryActionColor: "#26661A",
  secondaryActionColor: "#fffdf7",
  informationActionColor: "#2d5c87",
  recordActionColor: "#111111",
  secondaryUtilityColor: "#5f665f",
  panelBackgroundColor: "#f4f5f3",
  outerFrameColor: "#202423",
  textColor: "#17231d",
  borderColor: "#b9beb8",
});

export const connectThemePresets = Object.freeze([
  defaultConnectTheme,
  {
    name: "Vintage Radio",
    primaryActionColor: "#7a4b20",
    secondaryActionColor: "#fff5dd",
    informationActionColor: "#b88422",
    recordActionColor: "#23170f",
    secondaryUtilityColor: "#6d5945",
    panelBackgroundColor: "#fff0d1",
    outerFrameColor: "#4c2d18",
    textColor: "#211711",
    borderColor: "#b08b5e",
  },
  {
    name: "Mid-Century",
    primaryActionColor: "#667447",
    secondaryActionColor: "#fff4dd",
    informationActionColor: "#315f77",
    recordActionColor: "#202322",
    secondaryUtilityColor: "#6b6a5e",
    panelBackgroundColor: "#f5ead1",
    outerFrameColor: "#202423",
    textColor: "#18201a",
    borderColor: "#b9aa84",
  },
  {
    name: "Art Deco",
    primaryActionColor: "#b99338",
    secondaryActionColor: "#fff9e8",
    informationActionColor: "#2f5b7c",
    recordActionColor: "#050505",
    secondaryUtilityColor: "#5b5548",
    panelBackgroundColor: "#fff8e7",
    outerFrameColor: "#050505",
    textColor: "#111111",
    borderColor: "#b99338",
  },
  {
    name: "Mission Control",
    primaryActionColor: "#4f7155",
    secondaryActionColor: "#f5f7f4",
    informationActionColor: "#3d657c",
    recordActionColor: "#111615",
    secondaryUtilityColor: "#5b6562",
    panelBackgroundColor: "#f2f4f1",
    outerFrameColor: "#222827",
    textColor: "#121918",
    borderColor: "#a7b0aa",
  },
  {
    name: "Library",
    primaryActionColor: "#17452d",
    secondaryActionColor: "#fff4dc",
    informationActionColor: "#284f75",
    recordActionColor: "#1c120b",
    secondaryUtilityColor: "#5e4a35",
    panelBackgroundColor: "#fff1d4",
    outerFrameColor: "#3b2517",
    textColor: "#151c16",
    borderColor: "#9d7f55",
  },
  {
    name: "High Contrast",
    primaryActionColor: "#0b6f24",
    secondaryActionColor: "#ffffff",
    informationActionColor: "#005fcc",
    recordActionColor: "#000000",
    secondaryUtilityColor: "#333333",
    panelBackgroundColor: "#ffffff",
    outerFrameColor: "#000000",
    textColor: "#000000",
    borderColor: "#111111",
  },
  {
    name: "Soft Cream",
    primaryActionColor: "#6c7d57",
    secondaryActionColor: "#fffaf0",
    informationActionColor: "#6f879b",
    recordActionColor: "#4d4a43",
    secondaryUtilityColor: "#7a7468",
    panelBackgroundColor: "#fff8e9",
    outerFrameColor: "#d8c8ad",
    textColor: "#283027",
    borderColor: "#d5c8ae",
  },
]);

export const connectThemeFields = Object.freeze([
  "primaryActionColor",
  "secondaryActionColor",
  "informationActionColor",
  "recordActionColor",
  "secondaryUtilityColor",
  "panelBackgroundColor",
  "outerFrameColor",
  "textColor",
  "borderColor",
]);

export function loadConnectTheme(storage = window.localStorage) {
  try {
    const stored = JSON.parse(storage.getItem(connectThemeStorageKey) || "null");
    return normalizeConnectTheme(stored || defaultConnectTheme);
  } catch {
    return { ...defaultConnectTheme };
  }
}

export function saveConnectTheme(theme, storage = window.localStorage) {
  const normalized = normalizeConnectTheme(theme);
  storage.setItem(connectThemeStorageKey, JSON.stringify(normalized));
  return normalized;
}

export function resetConnectTheme(storage = window.localStorage) {
  storage.removeItem(connectThemeStorageKey);
  return { ...defaultConnectTheme };
}

export function normalizeConnectTheme(theme = {}) {
  const normalized = { ...defaultConnectTheme };
  connectThemeFields.forEach((field) => {
    if (isHexColor(theme[field])) {
      normalized[field] = theme[field];
    }
  });
  normalized.name = String(theme.name || normalized.name || "Custom").trim() || "Custom";
  return normalized;
}

export function applyConnectTheme(theme, root = document.documentElement) {
  const normalized = normalizeConnectTheme(theme);
  const primaryDark = darkenHex(normalized.primaryActionColor, 0.33);
  const infoDark = darkenHex(normalized.informationActionColor, 0.28);
  const utilityDark = darkenHex(normalized.secondaryUtilityColor, 0.28);
  root.style.setProperty("--green", normalized.primaryActionColor);
  root.style.setProperty("--green-dark", primaryDark);
  root.style.setProperty("--green-soft", lightenHex(normalized.primaryActionColor, 0.82));
  root.style.setProperty("--blue", normalized.informationActionColor);
  root.style.setProperty("--blue-dark", infoDark);
  root.style.setProperty("--gray", normalized.secondaryUtilityColor);
  root.style.setProperty("--gray-dark", utilityDark);
  root.style.setProperty("--panel", normalized.panelBackgroundColor);
  root.style.setProperty("--bg", lightenHex(normalized.panelBackgroundColor, 0.32));
  root.style.setProperty("--outer-frame", normalized.outerFrameColor);
  root.style.setProperty("--ink", normalized.textColor);
  root.style.setProperty("--line", normalized.borderColor);
  root.style.setProperty("--secondary-action-bg", normalized.secondaryActionColor);
  root.style.setProperty("--record-action-bg", normalized.recordActionColor);
  root.style.setProperty("--record-action-border", darkenHex(normalized.recordActionColor, 0.35));
  root.style.setProperty("--button-shadow", hexToRgba(primaryDark, 0.34));
  root.style.setProperty("--selected-action-shadow", hexToRgba(normalized.primaryActionColor, 0.28));
  return normalized;
}

export function presetByName(name) {
  return connectThemePresets.find((preset) => preset.name === name) || defaultConnectTheme;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(hex, target, amount) {
  const color = hexToRgb(hex);
  const next = {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
  return rgbToHex(next);
}

function lightenHex(hex, amount) {
  return mixHex(hex, { r: 255, g: 255, b: 255 }, amount);
}

function darkenHex(hex, amount) {
  return mixHex(hex, { r: 0, g: 0, b: 0 }, amount);
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
