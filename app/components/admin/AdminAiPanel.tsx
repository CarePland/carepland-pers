"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AgentKnowledgeAutomationSettings,
  AgentKnowledgeCheckRun,
  AgentKnowledgeProposal,
  AgentKnowledgeProposalItem,
  AgentKnowledgeProposalItemReviewStatus,
  AgentKnowledgeProposalsPanel,
} from "./AgentKnowledgeProposalsPanel";
import { AdminNavButton } from "./AdminAttention";
import { AdminAgentKnowledgePanel } from "./AdminAgentKnowledgePanel";
import { AdminAiHistoryPanel, type AdminAiHistoryAppointment, type CarePrepHistoryRow, type IntakeHistoryRow } from "./AdminAiHistoryPanel";
import { AdminAiInstructionPanel, type AiInstructionVersion } from "./AdminAiInstructionPanel";
import { AdminPromptTextInventoryPanel } from "./AdminPromptTextInventoryPanel";
import type { AppContentVersion } from "./AdminContentPanel";
import {
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../../lib/connect/prototypeClient";

export type AiAdminTab =
  | "audioProfile"
  | "agentKnowledge"
  | "appearance"
  | "history"
  | "instructions"
  | "inventory"
  | "proposals";

type AdminAiArea = "ai" | "connect";

type AdminAttentionCounts = {
  followup_count: number;
  new_count: number;
};

type AiWorkflowConfig = {
  historyLabel: string;
  label: string;
};

type ConnectAudioProfileEvent = {
  audioEnhancementProfile?: {
    adjustments?: {
      bassReduction?: string;
      compression?: string;
      speed?: string;
      timbre?: string;
    } | null;
    compressor?: { ratio?: number; thresholdDb?: number } | null;
    gainMultiplier?: number | null;
    highPassHz?: number | null;
    lowMidGainDb?: number | null;
    metrics?: {
      clippingRatio?: number | null;
      dynamicRange?: number | null;
      noiseRatio?: number | null;
      peak?: number | null;
      rms?: number | null;
    };
    playbackGain?: number | null;
    playbackRate?: number | null;
    presenceGainDb?: number | null;
    profileId?: string;
    reasons?: string[];
  } | null;
  audioUrl?: string;
  createdAt?: string;
  enhancement?: { playbackGain?: number | null };
  improved?: boolean;
  messageFrom?: string;
  messageId?: string;
  messageSource?: string;
};

type ConnectAudioProfile = {
  careVipName?: string;
  events?: ConnectAudioProfileEvent[];
  receiverId?: string;
  summary?: {
    averageProfile?: {
      clippingRatio?: number | null;
      compressorRatio?: number | null;
      compressorThresholdDb?: number | null;
      dynamicRange?: number | null;
      gainMultiplier?: number | null;
      highPassHz?: number | null;
      lowMidGainDb?: number | null;
      noiseRatio?: number | null;
      peak?: number | null;
      playbackGain?: number | null;
      presenceGainDb?: number | null;
      rms?: number | null;
    };
    commonReasons?: { count: number; reason: string }[];
    didNotHelp?: number;
    helped?: number;
    helpedRate?: number | null;
    lastUpdatedAt?: string;
    learningSummary?: {
      adjustments?: Record<string, Record<string, number>>;
      preferenceCounts?: {
        original?: number;
        same?: number;
        version1?: number;
        version2?: number;
      };
      preferredChoice?: string;
      total?: number;
    };
    total?: number;
  };
};

type ConnectTheme = {
  borderColor: string;
  informationActionColor: string;
  name: string;
  outerFrameColor: string;
  panelBackgroundColor: string;
  primaryActionColor: string;
  recordActionColor: string;
  secondaryActionColor: string;
  secondaryUtilityColor: string;
  textColor: string;
};

const connectAudioProfileEndpoint = connectPrototypeEndpoints.audioProfile;
const connectThemeEndpoint = connectPrototypeEndpoints.themeBase;
const connectReceiverId = connectPrototypeReceiverId;
const connectThemeStorageKey = "carepland.connect.receiver.theme.v2";

const defaultConnectTheme: ConnectTheme = {
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
};

const connectThemePresets: ConnectTheme[] = [
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
];

const connectThemeFields: Array<keyof ConnectTheme> = [
  "primaryActionColor",
  "secondaryActionColor",
  "informationActionColor",
  "recordActionColor",
  "secondaryUtilityColor",
  "panelBackgroundColor",
  "outerFrameColor",
  "textColor",
  "borderColor",
];

const connectThemeFieldLabels: Record<keyof ConnectTheme, string> = {
  name: "Name",
  primaryActionColor: "Primary action",
  secondaryActionColor: "Secondary action",
  informationActionColor: "Information action",
  recordActionColor: "Record action",
  secondaryUtilityColor: "Secondary utility",
  panelBackgroundColor: "Panel background",
  outerFrameColor: "Outer frame",
  textColor: "Text",
  borderColor: "Border",
};

function normalizeConnectTheme(theme?: Partial<ConnectTheme> | null): ConnectTheme {
  const normalized = { ...defaultConnectTheme };
  connectThemeFields.forEach((field) => {
    const value = String(theme?.[field] ?? "");
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      normalized[field] = value;
    }
  });
  normalized.name = String(theme?.name || normalized.name || "Custom").trim() || "Custom";
  return normalized;
}

type AdminAiPanelProps = {
  adminArea: AdminAiArea;
  agentEscalationGuidance: string;
  agentKnowledgeAutomationSettings: AgentKnowledgeAutomationSettings;
  agentKnowledgeChangeNote: string;
  agentKnowledgeCheckRuns: AgentKnowledgeCheckRun[];
  agentKnowledgeProposalDrafts: Record<string, string>;
  agentKnowledgeProposalNotes: Record<string, string>;
  agentKnowledgeProposalPublishNote: string;
  agentKnowledgeProposals: AgentKnowledgeProposal[];
  agentKnowledgeVersions: AppContentVersion[];
  agentKnownLimitations: string;
  agentProductFacts: string;
  agentVoiceGuidance: string;
  aiAdminTab: AiAdminTab;
  aiInstructionVersion: AiInstructionVersion | null;
  aiInstructionVersions: AiInstructionVersion[];
  aiWorkflows: Record<string, AiWorkflowConfig>;
  appointments: AdminAiHistoryAppointment[];
  carePrepHistory: CarePrepHistoryRow[];
  draftSourceVersion: AiInstructionVersion | null;
  formatDate: (value: string | null) => string;
  historyAppointmentId: string;
  instructionChangeNote: string;
  instructionModel: string;
  instructionOutputSchema: string;
  instructionSystemPrompt: string;
  instructionUserPrompt: string;
  intakeHistory: IntakeHistoryRow[];
  loadingAgentKnowledgeProposals: boolean;
  loadingCarePrepHistory: boolean;
  loadingInstructions: boolean;
  publishingAgentKnowledgeProposalId: string | null;
  queueingAgentKnowledgeRun: boolean;
  revertingInstructionForId: string | null;
  savingAgentKnowledge: boolean;
  savingAgentKnowledgeAutomationSettings: boolean;
  savingAgentKnowledgeProposalItemId: string | null;
  savingInstructions: boolean;
  selectedAgentKnowledgeProposal: AgentKnowledgeProposal | null;
  selectedAgentKnowledgeProposalItems: AgentKnowledgeProposalItem[];
  selectedAgentKnowledgeProposalPublishableCount: number;
  selectedAiWorkflow: string;
  selectedAiWorkflowConfig: AiWorkflowConfig;
  adminAttentionFor: (
    scopeType: "ai_admin_tab",
    scopeKey: string
  ) => AdminAttentionCounts | null | undefined;
  handleChangeAiAdminTab: (tab: AiAdminTab) => void;
  handleChangeAiWorkflow: (workflowKey: string) => void;
  handleQueueAgentKnowledgeManualCheck: () => void;
  handlePublishAgentKnowledgeProposal: (event: FormEvent<HTMLFormElement>) => void;
  handleReviewAgentKnowledgeProposalItem: (
    item: AgentKnowledgeProposalItem,
    reviewStatus: AgentKnowledgeProposalItemReviewStatus
  ) => void;
  handleRevertInstructionVersion: (version: AiInstructionVersion) => void;
  handleSaveAgentKnowledge: (event: FormEvent<HTMLFormElement>) => void;
  handleSaveAgentKnowledgeAutomationSettings: (
    event: FormEvent<HTMLFormElement>
  ) => void;
  handleSaveAiInstructions: (event: FormEvent<HTMLFormElement>) => void;
  loadAgentKnowledgeProposals: () => void;
  loadAiInstructions: () => void;
  loadCarePrepHistory: () => void;
  loadInstructionVersionIntoEditor: (version: AiInstructionVersion) => void;
  loadIntakeHistory: () => void;
  onChangeAgentKnowledgeAutomationSettings: (
    patch: Partial<AgentKnowledgeAutomationSettings>
  ) => void;
  onChangeAgentKnowledgeProposalDraft: (itemId: string, value: string) => void;
  onChangeAgentKnowledgeProposalNote: (itemId: string, value: string) => void;
  onChangeHistoryAppointment: (appointmentId: string) => void;
  onLoadAgentKnowledgeContent: () => void;
  setAgentEscalationGuidance: (value: string) => void;
  setAgentKnowledgeChangeNote: (value: string) => void;
  setAgentKnowledgeProposalPublishNote: (value: string) => void;
  setAgentKnownLimitations: (value: string) => void;
  setAgentProductFacts: (value: string) => void;
  setAgentVoiceGuidance: (value: string) => void;
  setInstructionChangeNote: (value: string) => void;
  setInstructionModel: (value: string) => void;
  setInstructionOutputSchema: (value: string) => void;
  setInstructionSystemPrompt: (value: string) => void;
  setInstructionUserPrompt: (value: string) => void;
  setSelectedAgentKnowledgeProposalId: (proposalId: string) => void;
};

export function AdminAiPanel({
  adminArea,
  agentEscalationGuidance,
  agentKnowledgeAutomationSettings,
  agentKnowledgeChangeNote,
  agentKnowledgeCheckRuns,
  agentKnowledgeProposalDrafts,
  agentKnowledgeProposalNotes,
  agentKnowledgeProposalPublishNote,
  agentKnowledgeProposals,
  agentKnowledgeVersions,
  agentKnownLimitations,
  agentProductFacts,
  agentVoiceGuidance,
  aiAdminTab,
  aiInstructionVersion,
  aiInstructionVersions,
  aiWorkflows,
  appointments,
  carePrepHistory,
  draftSourceVersion,
  formatDate,
  handleChangeAiAdminTab,
  handleChangeAiWorkflow,
  handlePublishAgentKnowledgeProposal,
  handleQueueAgentKnowledgeManualCheck,
  handleReviewAgentKnowledgeProposalItem,
  handleRevertInstructionVersion,
  handleSaveAgentKnowledge,
  handleSaveAgentKnowledgeAutomationSettings,
  handleSaveAiInstructions,
  historyAppointmentId,
  instructionChangeNote,
  instructionModel,
  instructionOutputSchema,
  instructionSystemPrompt,
  instructionUserPrompt,
  intakeHistory,
  loadAgentKnowledgeProposals,
  loadAiInstructions,
  loadCarePrepHistory,
  loadInstructionVersionIntoEditor,
  loadIntakeHistory,
  loadingAgentKnowledgeProposals,
  loadingCarePrepHistory,
  loadingInstructions,
  onChangeAgentKnowledgeAutomationSettings,
  onChangeAgentKnowledgeProposalDraft,
  onChangeAgentKnowledgeProposalNote,
  onChangeHistoryAppointment,
  onLoadAgentKnowledgeContent,
  publishingAgentKnowledgeProposalId,
  queueingAgentKnowledgeRun,
  revertingInstructionForId,
  savingAgentKnowledge,
  savingAgentKnowledgeAutomationSettings,
  savingAgentKnowledgeProposalItemId,
  savingInstructions,
  selectedAgentKnowledgeProposal,
  selectedAgentKnowledgeProposalItems,
  selectedAgentKnowledgeProposalPublishableCount,
  selectedAiWorkflow,
  selectedAiWorkflowConfig,
  adminAttentionFor,
  setAgentEscalationGuidance,
  setAgentKnowledgeChangeNote,
  setAgentKnowledgeProposalPublishNote,
  setAgentKnownLimitations,
  setAgentProductFacts,
  setAgentVoiceGuidance,
  setInstructionChangeNote,
  setInstructionModel,
  setInstructionOutputSchema,
  setInstructionSystemPrompt,
  setInstructionUserPrompt,
  setSelectedAgentKnowledgeProposalId,
}: AdminAiPanelProps) {
  const isConnectAdmin = adminArea === "connect";
  const isLoading =
    loadingInstructions || loadingCarePrepHistory || loadingAgentKnowledgeProposals;
  const [connectAudioProfile, setConnectAudioProfile] =
    useState<ConnectAudioProfile | null>(null);
  const [loadingConnectAudioProfile, setLoadingConnectAudioProfile] =
    useState(false);
  const [connectAudioProfileStatus, setConnectAudioProfileStatus] =
    useState("");
  const [connectTheme, setConnectTheme] = useState<ConnectTheme>(() => {
    if (typeof window === "undefined") return defaultConnectTheme;
    try {
      const storedTheme = window.localStorage.getItem(connectThemeStorageKey);
      return storedTheme ? normalizeConnectTheme(JSON.parse(storedTheme)) : defaultConnectTheme;
    } catch {
      return defaultConnectTheme;
    }
  });
  const [connectThemeStatus, setConnectThemeStatus] = useState(
    "Receiver appearance defaults to Classic Green."
  );
  const selectedThemePreset = useMemo(
    () =>
      connectThemePresets.find((preset) =>
        connectThemeFields.every(
          (field) =>
            preset[field].toLowerCase() === connectTheme[field].toLowerCase()
        )
      )?.name ?? "",
    [connectTheme]
  );

  useEffect(() => {
    if (isConnectAdmin && aiAdminTab === "audioProfile") {
      void loadConnectAudioProfile();
    }
  }, [aiAdminTab, isConnectAdmin]);

  useEffect(() => {
    if (isConnectAdmin && aiAdminTab === "appearance") {
      void loadConnectTheme();
    }
  }, [aiAdminTab, isConnectAdmin]);

  async function loadConnectAudioProfile() {
    setLoadingConnectAudioProfile(true);
    setConnectAudioProfileStatus("Loading Connect audio profile...");
    try {
      const response = await fetch(connectAudioProfileEndpoint);
      if (!response.ok) {
        throw new Error(`Local Connect server returned ${response.status}`);
      }
      const payload = (await response.json()) as {
        ok?: boolean;
        profile?: ConnectAudioProfile;
      };
      setConnectAudioProfile(payload.profile ?? null);
      setConnectAudioProfileStatus(
        payload.profile?.summary?.total
          ? "Loaded from local Connect receiver feedback."
          : "No receiver hearing feedback yet."
      );
    } catch (error) {
      setConnectAudioProfile(null);
      setConnectAudioProfileStatus(
        error instanceof Error
          ? error.message
          : "Connect audio profile is unavailable."
      );
    } finally {
      setLoadingConnectAudioProfile(false);
    }
  }

  async function loadConnectTheme() {
    setConnectThemeStatus("Loading receiver appearance...");
    try {
      const response = await fetch(
        connectPrototypeEndpoints.theme
      );
      if (!response.ok) {
        throw new Error(`Local Connect server returned ${response.status}`);
      }
      const payload = (await response.json()) as {
        ok?: boolean;
        source?: string;
        theme?: ConnectTheme;
      };
      const nextTheme = normalizeConnectTheme(payload.theme);
      setConnectTheme(nextTheme);
      window.localStorage.setItem(connectThemeStorageKey, JSON.stringify(nextTheme));
      setConnectThemeStatus(
        payload.source === "default"
          ? "Receiver is using the default Classic Green appearance."
          : `${nextTheme.name || "Custom"} loaded from local Connect server.`
      );
    } catch (error) {
      setConnectThemeStatus(
        error instanceof Error
          ? `${error.message}. Showing this Admin browser's saved appearance.`
          : "Showing this Admin browser's saved appearance."
      );
    }
  }

  async function saveConnectTheme(nextTheme: ConnectTheme) {
    const normalizedTheme = normalizeConnectTheme(nextTheme);
    setConnectTheme(normalizedTheme);
    try {
      window.localStorage.setItem(
        connectThemeStorageKey,
        JSON.stringify(normalizedTheme)
      );
      const response = await fetch(connectThemeEndpoint, {
        body: JSON.stringify({
          receiverId: connectReceiverId,
          theme: normalizedTheme,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error(`Local Connect server returned ${response.status}`);
      }
      setConnectThemeStatus(
        `${normalizedTheme.name || "Custom"} saved for the web receiver.`
      );
    } catch (error) {
      setConnectThemeStatus(
        error instanceof Error
          ? `${error.message}. Saved in this Admin browser only.`
          : "Saved in this Admin browser only."
      );
    }
  }

  function previewConnectTheme(nextTheme: ConnectTheme) {
    setConnectTheme(normalizeConnectTheme(nextTheme));
    setConnectThemeStatus("Previewing changes in Admin. Save to apply on the web receiver.");
  }

  async function resetConnectTheme() {
    setConnectTheme(defaultConnectTheme);
    try {
      window.localStorage.removeItem(connectThemeStorageKey);
      const response = await fetch(
        connectPrototypeEndpoints.theme,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(`Local Connect server returned ${response.status}`);
      }
      setConnectThemeStatus("Receiver appearance reset to Classic Green.");
    } catch (error) {
      setConnectThemeStatus(
        error instanceof Error
          ? `${error.message}. This Admin browser was reset to Classic Green.`
          : "This Admin browser was reset to Classic Green."
      );
    }
  }
  const connectAdminSubtitle =
    aiAdminTab === "audioProfile"
      ? "User Audio Profile"
      : aiAdminTab === "appearance"
        ? "Appearance"
        : `AI Prompts · ${selectedAiWorkflowConfig.label}${
            aiAdminTab === "instructions" && aiInstructionVersion
              ? ` · current v${aiInstructionVersion.version_number}`
              : ""
          }${
            aiAdminTab === "instructions" && !aiInstructionVersion
              ? " · no current version"
              : ""
          }`;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">
            {isConnectAdmin ? "Connect admin" : "AI admin"}
          </h2>
          <p className="mt-1 text-slate-600">
            {isConnectAdmin
              ? connectAdminSubtitle
              : `${selectedAiWorkflowConfig.label}${
                  aiAdminTab === "history" ? " audit trail" : ""
                }${
                  aiAdminTab === "instructions" && aiInstructionVersion
                    ? ` · current v${aiInstructionVersion.version_number}`
                    : ""
                }${
                  aiAdminTab === "instructions" && !aiInstructionVersion
                    ? " · no current version"
                    : ""
                }`}
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={
            aiAdminTab === "inventory" ||
            aiAdminTab === "audioProfile" ||
            aiAdminTab === "appearance" ||
            isLoading
          }
          onClick={() =>
            aiAdminTab === "instructions"
              ? loadAiInstructions()
              : aiAdminTab === "agentKnowledge"
                ? onLoadAgentKnowledgeContent()
                : aiAdminTab === "proposals"
                  ? loadAgentKnowledgeProposals()
                  : aiAdminTab === "inventory"
                    ? undefined
                    : selectedAiWorkflow === "careprep_generation"
                      ? loadCarePrepHistory()
                      : loadIntakeHistory()
          }
          type="button"
        >
          {isLoading
            ? "Loading..."
            : aiAdminTab === "inventory" ||
                aiAdminTab === "audioProfile" ||
                aiAdminTab === "appearance"
              ? "Read-only"
              : "Reload"}
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            {isConnectAdmin ? "Connect area" : "AI area"}
          </p>
          {(isConnectAdmin
            ? [
                ["instructions", "AI Prompts", "Prompt versions"],
              ]
            : [
                ["instructions", "Instructions", "Prompt versions"],
                ["inventory", "Inventory", "Prompt/text map"],
                ["agentKnowledge", "Agent Knowledge", "Product truth"],
                ["proposals", "Proposals", "Review updates"],
                ["history", selectedAiWorkflowConfig.historyLabel, "Audit trail"],
              ]
          ).map(([tabKey, label, description]) => {
            const isSelected = aiAdminTab === tabKey;
            const attention = adminAttentionFor("ai_admin_tab", tabKey);

            return (
              <AdminNavButton
                className="w-full px-3 py-3 text-left"
                disabled={isLoading}
                followupCount={attention?.followup_count ?? 0}
                isSelected={isSelected}
                key={tabKey}
                newCount={attention?.new_count ?? 0}
                onClick={() => handleChangeAiAdminTab(tabKey as AiAdminTab)}
              >
                <span className="block font-semibold">{label}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {description}
                </span>
              </AdminNavButton>
            );
          })}
        </aside>

        <div>
          {aiAdminTab !== "agentKnowledge" &&
          aiAdminTab !== "inventory" &&
          aiAdminTab !== "proposals" &&
          aiAdminTab !== "audioProfile" &&
          aiAdminTab !== "appearance" ? (
            <label className="block max-w-xl text-sm font-medium text-slate-700">
              AI workflow
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                disabled={loadingInstructions || loadingCarePrepHistory}
                onChange={(event) => handleChangeAiWorkflow(event.target.value)}
                value={selectedAiWorkflow}
              >
                {Object.entries(aiWorkflows)
                  .filter(([workflowKey]) =>
                    isConnectAdmin
                      ? workflowKey.startsWith("connect_")
                      : !workflowKey.startsWith("connect_")
                  )
                  .map(([workflowKey, workflow]) => (
                    <option key={workflowKey} value={workflowKey}>
                      {workflow.label}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          {isConnectAdmin && aiAdminTab === "instructions" ? (
            <div className="mt-5 rounded-md border border-blue-100 bg-[#f4faff] p-4 text-sm text-blue-950">
              <p className="font-semibold">Connect AI Prompts</p>
              <p className="mt-1">
                These prompts affect receiver communication, messages, routing,
                and future voice or intent interpretation. Personal prompts for
                appointments, CarePrep, and visit notes remain in the System AI
                area.
              </p>
            </div>
          ) : null}

          {aiAdminTab === "inventory" ? <AdminPromptTextInventoryPanel /> : null}

          {isConnectAdmin && aiAdminTab === "audioProfile" ? (
            <ConnectAudioProfilePanel
              formatDate={formatDate}
              loading={loadingConnectAudioProfile}
              onReload={loadConnectAudioProfile}
              profile={connectAudioProfile}
              status={connectAudioProfileStatus}
            />
          ) : null}

          {isConnectAdmin && aiAdminTab === "appearance" ? (
            <ConnectAppearancePanel
              onChange={previewConnectTheme}
              onReset={resetConnectTheme}
              onSave={saveConnectTheme}
              selectedPreset={selectedThemePreset}
              status={connectThemeStatus}
              theme={connectTheme}
            />
          ) : null}

          {aiAdminTab === "instructions" ? (
            <AdminAiInstructionPanel
              draftSourceVersion={draftSourceVersion}
              formatDate={formatDate}
              instructionChangeNote={instructionChangeNote}
              instructionModel={instructionModel}
              instructionOutputSchema={instructionOutputSchema}
              instructionSystemPrompt={instructionSystemPrompt}
              instructionUserPrompt={instructionUserPrompt}
              instructionVersions={aiInstructionVersions}
              onLoadVersion={loadInstructionVersionIntoEditor}
              onRevertVersion={handleRevertInstructionVersion}
              onSave={handleSaveAiInstructions}
              revertingInstructionForId={revertingInstructionForId}
              saving={savingInstructions}
              setInstructionChangeNote={setInstructionChangeNote}
              setInstructionModel={setInstructionModel}
              setInstructionOutputSchema={setInstructionOutputSchema}
              setInstructionSystemPrompt={setInstructionSystemPrompt}
              setInstructionUserPrompt={setInstructionUserPrompt}
              workflowLabel={selectedAiWorkflowConfig.label}
            />
          ) : aiAdminTab === "agentKnowledge" ? (
            <AdminAgentKnowledgePanel
              agentEscalationGuidance={agentEscalationGuidance}
              agentKnowledgeChangeNote={agentKnowledgeChangeNote}
              agentKnowledgeVersions={agentKnowledgeVersions}
              agentKnownLimitations={agentKnownLimitations}
              agentProductFacts={agentProductFacts}
              agentVoiceGuidance={agentVoiceGuidance}
              formatDate={formatDate}
              onSave={handleSaveAgentKnowledge}
              saving={savingAgentKnowledge}
              setAgentEscalationGuidance={setAgentEscalationGuidance}
              setAgentKnowledgeChangeNote={setAgentKnowledgeChangeNote}
              setAgentKnownLimitations={setAgentKnownLimitations}
              setAgentProductFacts={setAgentProductFacts}
              setAgentVoiceGuidance={setAgentVoiceGuidance}
            />
          ) : aiAdminTab === "proposals" ? (
            <AgentKnowledgeProposalsPanel
              automationSettings={agentKnowledgeAutomationSettings}
              checkRuns={agentKnowledgeCheckRuns}
              drafts={agentKnowledgeProposalDrafts}
              formatDate={formatDate}
              loading={loadingAgentKnowledgeProposals}
              notes={agentKnowledgeProposalNotes}
              onDraftChange={onChangeAgentKnowledgeProposalDraft}
              onNoteChange={onChangeAgentKnowledgeProposalNote}
              onPublish={handlePublishAgentKnowledgeProposal}
              onPublishNoteChange={setAgentKnowledgeProposalPublishNote}
              onQueueManualCheck={handleQueueAgentKnowledgeManualCheck}
              onReviewItem={handleReviewAgentKnowledgeProposalItem}
              onSaveAutomationSettings={handleSaveAgentKnowledgeAutomationSettings}
              onSelectProposal={setSelectedAgentKnowledgeProposalId}
              onSettingsChange={onChangeAgentKnowledgeAutomationSettings}
              proposals={agentKnowledgeProposals}
              publishableCount={selectedAgentKnowledgeProposalPublishableCount}
              publishingProposalId={publishingAgentKnowledgeProposalId}
              publishNote={agentKnowledgeProposalPublishNote}
              queueingRun={queueingAgentKnowledgeRun}
              savingAutomationSettings={savingAgentKnowledgeAutomationSettings}
              savingItemId={savingAgentKnowledgeProposalItemId}
              selectedItems={selectedAgentKnowledgeProposalItems}
              selectedProposal={selectedAgentKnowledgeProposal}
            />
          ) : aiAdminTab === "history" ? (
            <AdminAiHistoryPanel
              appointments={appointments}
              carePrepHistory={carePrepHistory}
              formatDate={formatDate}
              historyAppointmentId={historyAppointmentId}
              intakeHistory={intakeHistory}
              loading={loadingCarePrepHistory}
              mode={
                selectedAiWorkflow === "careprep_generation"
                  ? "careprep"
                  : "intake"
              }
              onChangeHistoryAppointment={onChangeHistoryAppointment}
              onLoadCarePrepHistory={loadCarePrepHistory}
              onLoadIntakeHistory={loadIntakeHistory}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ConnectAudioProfilePanel({
  formatDate,
  loading,
  onReload,
  profile,
  status,
}: {
  formatDate: (value: string | null) => string;
  loading: boolean;
  onReload: () => void;
  profile: ConnectAudioProfile | null;
  status: string;
}) {
  const summary = profile?.summary;
  const average = summary?.averageProfile ?? {};
  const events = profile?.events ?? [];

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            User Audio Profile
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Read-only Connect audio clarity summary from receiver hearing
            feedback.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={loading}
          onClick={onReload}
          type="button"
        >
          {loading ? "Loading..." : "Refresh profile"}
        </button>
      </div>

      <p className="rounded-md border border-blue-100 bg-[#f4faff] p-3 text-sm text-blue-950">
        {status || "Connect audio profile reads from the local Connect receiver feedback service."}
      </p>

      {!summary?.total ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No hearing feedback yet. Feedback appears after the receiver user
          compares message playback versions.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <AudioProfileMetric
              detail={`${Math.round((summary.helpedRate ?? 0) * 100)}% helpful`}
              label="Feedback"
              value={`${summary.helped ?? 0}/${summary.total ?? 0} helped`}
            />
            <AudioProfileMetric
              detail="average requested gain"
              label="Playback"
              value={formatAudioValue(average.playbackGain, "x")}
            />
            <AudioProfileMetric
              detail={`${formatAudioDb(average.lowMidGainDb)} low-mid · ${formatAudioDb(
                average.presenceGainDb
              )} presence`}
              label="EQ"
              value={`${formatAudioValue(average.highPassHz, " Hz")} high-pass`}
            />
            <AudioProfileMetric
              detail={
                average.compressorThresholdDb
                  ? `${average.compressorThresholdDb} dB threshold`
                  : "conservative"
              }
              label="Dynamics"
              value={
                average.compressorRatio
                  ? `${average.compressorRatio}:1 compression`
                  : "limiter only"
              }
            />
          </div>

          <p className="text-sm text-slate-600">
            Common signals:{" "}
            {(summary.commonReasons ?? [])
              .slice(0, 4)
              .map((item) => formatAudioReason(item.reason))
              .join(", ") || "None yet"}
            {summary.lastUpdatedAt
              ? ` · Updated ${formatDate(summary.lastUpdatedAt)}`
              : ""}
          </p>

          <ConnectAudioLearningSummary summary={summary.learningSummary} />

          <details className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer font-semibold text-slate-900">
              Detail view
            </summary>
            <div className="mt-3 space-y-3">
              {events.map((event, index) => {
                const eventProfile = event.audioEnhancementProfile ?? {};
                const metrics = eventProfile.metrics ?? {};
                return (
                  <article
                    className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                    key={`${event.messageId || "event"}-${index}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-slate-900">
                        {event.improved ? "Helped" : "Did not help"} ·{" "}
                        {event.messageFrom || "Unknown speaker"}
                      </strong>
                      <span className="text-slate-500">
                        {event.createdAt ? formatDate(event.createdAt) : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-600">
                      Gain {formatAudioValue(event.enhancement?.playbackGain, "x")};
                      high-pass {formatAudioValue(eventProfile.highPassHz, " Hz")};
                      low-mid {formatAudioDb(eventProfile.lowMidGainDb)};
                      presence {formatAudioDb(eventProfile.presenceGainDb)};
                      compression{" "}
                      {eventProfile.compressor?.ratio
                        ? `${eventProfile.compressor.ratio}:1`
                        : "none"}.
                    </p>
                    <p className="mt-1 text-slate-600">
                      Input rms {formatAudioValue(metrics.rms)}; peak{" "}
                      {formatAudioValue(metrics.peak)}; noise{" "}
                      {formatAudioValue(metrics.noiseRatio)}; clipping{" "}
                      {formatAudioValue(metrics.clippingRatio)}; reasons{" "}
                      {(eventProfile.reasons ?? [])
                        .map(formatAudioReason)
                        .join(", ") || "none"}.
                    </p>
                    <p className="mt-1 text-slate-600">
                      {formatAudioProfileName(eventProfile.profileId)} · speed{" "}
                      {formatAudioValue(eventProfile.playbackRate, "x")} ·{" "}
                      {formatAudioAdjustmentSummary(eventProfile.adjustments)}
                    </p>
                  </article>
                );
              })}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function ConnectAppearancePanel({
  onChange,
  onReset,
  onSave,
  selectedPreset,
  status,
  theme,
}: {
  onChange: (theme: ConnectTheme) => void;
  onReset: () => void;
  onSave: (theme: ConnectTheme) => void;
  selectedPreset: string;
  status: string;
  theme: ConnectTheme;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Connect Appearance
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Prototype receiver color presets and advanced color fields. Saving
          applies to the local web receiver through the Connect test server.
        </p>
      </div>

      <div
        className="rounded-md border p-3"
        style={{ background: theme.outerFrameColor, borderColor: theme.borderColor }}
      >
        <div
          className="grid gap-2 rounded-md border p-3"
          style={{
            background: theme.panelBackgroundColor,
            borderColor: theme.borderColor,
            color: theme.textColor,
          }}
        >
          <span className="text-xs font-bold uppercase opacity-75">Receiver</span>
          <strong>Call Andrew</strong>
          <button
            className="rounded-md border px-3 py-2 text-sm font-bold text-white"
            style={{
              background: theme.primaryActionColor,
              borderColor: theme.primaryActionColor,
            }}
            type="button"
          >
            Ask a question
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm font-bold text-white"
              style={{
                background: theme.informationActionColor,
                borderColor: theme.informationActionColor,
              }}
              type="button"
            >
              Message
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm font-bold"
              style={{
                background: theme.secondaryActionColor,
                borderColor: theme.borderColor,
                color: theme.textColor,
              }}
              type="button"
            >
              Back
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm font-bold text-white"
              style={{
                background: theme.recordActionColor,
                borderColor: theme.recordActionColor,
              }}
              type="button"
            >
              Mic
            </button>
          </div>
        </div>
      </div>

      <label className="block max-w-xl text-sm font-medium text-slate-700">
        Preset theme
        <select
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
          onChange={(event) => {
            const preset =
              connectThemePresets.find(
                (item) => item.name === event.target.value
              ) ?? defaultConnectTheme;
            onChange({ ...preset });
          }}
          value={selectedPreset}
        >
          <option value="">Custom</option>
          {connectThemePresets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>

      <details className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">
          Advanced colors
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {connectThemeFields.map((field) => (
            <label className="text-sm font-medium text-slate-700" key={field}>
              {connectThemeFieldLabels[field]}
              <input
                className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white p-1"
                onChange={(event) =>
                  onChange({ ...theme, [field]: event.target.value, name: "Custom" })
                }
                type="color"
                value={theme[field]}
              />
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => onSave(theme)}
          type="button"
        >
          Save appearance
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={onReset}
          type="button"
        >
          Reset to Classic Green
        </button>
      </div>
      <p className="text-sm text-slate-600">{status}</p>
    </div>
  );
}

function AudioProfileMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3">
      <span className="block text-xs font-semibold uppercase text-slate-500">
        {label}
      </span>
      <strong className="mt-1 block text-slate-900">{value}</strong>
      <small className="mt-1 block text-slate-500">{detail}</small>
    </section>
  );
}

function ConnectAudioLearningSummary({
  summary,
}: {
  summary: NonNullable<ConnectAudioProfile["summary"]>["learningSummary"];
}) {
  if (!summary?.total) return null;

  const counts = summary.preferenceCounts ?? {};
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Receiver learning</h4>
          <p className="mt-1 text-sm text-slate-600">
            Blind audio comparison choices from the receiver.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Default: {formatAudioLearningChoice(summary.preferredChoice)}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <AudioProfileMetric detail="unmodified" label="Original" value={String(counts.original ?? 0)} />
        <AudioProfileMetric detail="bright clarity" label="Option 1" value={String(counts.version1 ?? 0)} />
        <AudioProfileMetric detail="slower steady" label="Option 2" value={String(counts.version2 ?? 0)} />
        <AudioProfileMetric detail="no winner" label="Same" value={String(counts.same ?? 0)} />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Top traits: speed {topAudioAdjustment(summary.adjustments?.speed)} · timbre{" "}
        {topAudioAdjustment(summary.adjustments?.timbre)} · bass{" "}
        {topAudioAdjustment(summary.adjustments?.bassReduction)} · compression{" "}
        {topAudioAdjustment(summary.adjustments?.compression)}
      </p>
    </section>
  );
}

function formatAudioValue(value: number | null | undefined, suffix = "") {
  return value === null || value === undefined ? "n/a" : `${value}${suffix}`;
}

function formatAudioDb(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  if (value === 0) return "0 dB";
  return `${value > 0 ? "+" : ""}${value} dB`;
}

function formatAudioReason(reason: string) {
  return reason
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function topAudioAdjustment(values?: Record<string, number>) {
  const entries = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "not enough data";
  return `${formatAudioReason(entries[0][0])} (${entries[0][1]})`;
}

function formatAudioLearningChoice(choice?: string) {
  switch (choice) {
    case "original":
      return "Original";
    case "version_1":
      return "Option 1";
    case "version_2":
      return "Option 2";
    case "same":
      return "No clear winner";
    default:
      return "Learning";
  }
}

function formatAudioProfileName(profileId?: string) {
  switch (profileId) {
    case "bright_speech_clarity":
      return "Bright clarity";
    case "steady_slow_speech":
      return "Slower steady";
    case "standard":
      return "Original";
    default:
      return "Profile pending";
  }
}

function formatAudioAdjustmentSummary(
  adjustments?: NonNullable<ConnectAudioProfileEvent["audioEnhancementProfile"]>["adjustments"]
) {
  if (!adjustments) return "no adjustment detail";
  return [
    adjustments.speed ? `speed ${formatAudioReason(adjustments.speed)}` : "",
    adjustments.timbre ? `timbre ${formatAudioReason(adjustments.timbre)}` : "",
    adjustments.bassReduction ? `bass ${formatAudioReason(adjustments.bassReduction)}` : "",
    adjustments.compression ? `compression ${formatAudioReason(adjustments.compression)}` : "",
  ]
    .filter(Boolean)
    .join(" · ") || "no adjustment detail";
}
