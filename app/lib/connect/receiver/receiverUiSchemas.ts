import type { ReceiverRuntimeName, ReceiverLayoutScaleMode } from "./receiverRuntimeContract";

export type ReceiverUiSchemaId = "gxv3370_classic_1024x600_v1" | "default_receiver_v1";

export type ReceiverUiSchema = {
  designViewport: {
    height: number | null;
    orientation: "landscape" | "portrait" | "responsive";
    width: number | null;
  };
  home: {
    appointment: {
      format: "single_line" | "stacked";
      interactive: boolean;
      zone: string;
    };
    focus: {
      excludes: string[];
      maxItems: number;
      zone: string;
    };
    footer: {
      items: string[];
      layout: "single_row" | "responsive";
    };
    primaryActions: Array<{
      action: string;
      label: string;
      tone: "blue" | "green" | "black" | "neutral";
      zone: string;
    }>;
  };
  id: ReceiverUiSchemaId;
  layoutScaleModes: ReceiverLayoutScaleMode[];
  minTouchTargetPx: number;
  panelMode: "fullscreen_appliance" | "responsive_web";
  runtime: ReceiverRuntimeName;
  uiLayout: string;
  version: number;
};

export const receiverUiSchemas: Record<ReceiverUiSchemaId, ReceiverUiSchema> = {
  gxv3370_classic_1024x600_v1: {
    designViewport: {
      height: 600,
      orientation: "landscape",
      width: 1024,
    },
    home: {
      appointment: {
        format: "single_line",
        interactive: true,
        zone: "left_middle",
      },
      focus: {
        excludes: ["appointment_reminders"],
        maxItems: 3,
        zone: "top_left",
      },
      footer: {
        items: ["carepland_logo", "greeting", "active_person", "time", "date", "sounds", "clean"],
        layout: "single_row",
      },
      primaryActions: [
        { action: "messages", label: "Messages", tone: "blue", zone: "right_top" },
        { action: "appointments", label: "Appointment", tone: "blue", zone: "right_upper_middle" },
        { action: "ask", label: "Ask a Question", tone: "green", zone: "right_lower_middle" },
        { action: "call_primary", label: "Call Coordinator", tone: "green", zone: "right_bottom" },
        { action: "talk", label: "Talk", tone: "black", zone: "left_bottom" },
      ],
    },
    id: "gxv3370_classic_1024x600_v1",
    layoutScaleModes: ["native", "scale_to_fit"],
    minTouchTargetPx: 72,
    panelMode: "fullscreen_appliance",
    runtime: "classic_webview",
    uiLayout: "desk_phone_1024x600",
    version: 1,
  },
  default_receiver_v1: {
    designViewport: {
      height: null,
      orientation: "responsive",
      width: null,
    },
    home: {
      appointment: {
        format: "stacked",
        interactive: true,
        zone: "responsive",
      },
      focus: {
        excludes: ["appointment_reminders"],
        maxItems: 3,
        zone: "responsive",
      },
      footer: {
        items: ["greeting", "active_person", "time", "date"],
        layout: "responsive",
      },
      primaryActions: [
        { action: "ask", label: "Ask a Question", tone: "green", zone: "responsive" },
        { action: "messages", label: "Messages", tone: "blue", zone: "responsive" },
        { action: "appointments", label: "Appointment", tone: "blue", zone: "responsive" },
      ],
    },
    id: "default_receiver_v1",
    layoutScaleModes: ["responsive"],
    minTouchTargetPx: 56,
    panelMode: "responsive_web",
    runtime: "modern_web",
    uiLayout: "default_receiver",
    version: 1,
  },
};

export function resolveReceiverUiSchema(input: {
  hardwareProfile?: string;
  runtime?: ReceiverRuntimeName;
  uiLayout?: string;
}): ReceiverUiSchema {
  const hardwareProfile = normalizedToken(input.hardwareProfile);
  const uiLayout = normalizedToken(input.uiLayout);

  if (
    input.runtime === "classic_webview" &&
    (uiLayout === "desk_phone_1024x600" ||
      hardwareProfile.includes("gxv3370") ||
      hardwareProfile === "studio_gxv3370_1024x600" ||
      hardwareProfile === "generic_hd_landscape_android")
  ) {
    return receiverUiSchemas.gxv3370_classic_1024x600_v1;
  }

  return receiverUiSchemas.default_receiver_v1;
}

function normalizedToken(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");
}
