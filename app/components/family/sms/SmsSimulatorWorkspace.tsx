"use client";

import { useMemo, useState } from "react";

import { createOutboundPrompt, processInboundSms } from "../../../lib/family/sms/SmsIntakeService";
import { createInitialSmsWorkflowState } from "../../../lib/family/sms/sampleState";
import type { SmsProcessingTrace, SmsPromptType, SmsWorkflowState } from "../../../lib/family/sms/types";
import {
  gentlePrimaryButtonClass,
  gentleSecondaryButtonClass,
  panelClass,
} from "../../shared/uiStyles";
import { ErrandStatusPill } from "../errands/ErrandStatusPill";

type SimulatorLogEntry = {
  id: string;
  replyBody: string;
  trace: SmsProcessingTrace;
};

const promptTypeLabels: Record<SmsPromptType, string> = {
  errand_offer: "Errand offer",
  errand_completion_check: "Completion check",
  errand_not_yet_followup: "Not-yet follow-up",
};

export function SmsSimulatorWorkspace() {
  const [workflowState, setWorkflowState] = useState<SmsWorkflowState>(() =>
    createInitialSmsWorkflowState(),
  );
  const [selectedMemberId, setSelectedMemberId] = useState("member-jamie");
  const [selectedErrandId, setSelectedErrandId] = useState("errand-2");
  const [promptType, setPromptType] = useState<SmsPromptType>("errand_offer");
  const [inboundBody, setInboundBody] = useState("1");
  const [simulatorLog, setSimulatorLog] = useState<SimulatorLogEntry[]>([]);

  const selectedMember = workflowState.members.find(
    (member) => member.id === selectedMemberId,
  );
  const selectedErrand = workflowState.errands.find(
    (errand) => errand.id === selectedErrandId,
  );
  const activePrompt = workflowState.promptContexts.find(
    (context) => context.memberId === selectedMemberId && !context.resolvedAt,
  );
  const relatedPromptErrand = workflowState.errands.find(
    (errand) => errand.id === activePrompt?.relatedObjectId,
  );
  const latestTrace = simulatorLog[0]?.trace;
  const latestReply = simulatorLog[0]?.replyBody;
  const latestOutboundMessage = workflowState.messages.find(
    (message) => message.direction === "outbound",
  );
  const visibleErrands = useMemo(
    () =>
      workflowState.errands.filter(
        (errand) =>
          errand.status !== "completed" ||
          errand.id === selectedErrandId ||
          errand.id === activePrompt?.relatedObjectId,
      ),
    [activePrompt?.relatedObjectId, selectedErrandId, workflowState.errands],
  );

  function sendVirtualPrompt() {
    if (!selectedMember || !selectedErrand) {
      return;
    }

    setWorkflowState((currentState) =>
      createOutboundPrompt(currentState, {
        promptType,
        errandId: selectedErrand.id,
        memberId: selectedMember.id,
        transport: "virtual",
        nowIso: new Date().toISOString(),
      }),
    );
  }

  function processVirtualReply() {
    if (!selectedMember?.phoneNumber || !inboundBody.trim()) {
      return;
    }

    const result = processInboundSms(workflowState, {
      fromPhone: selectedMember.phoneNumber,
      toPhone: workflowState.coordinatorPhone,
      body: inboundBody,
      transport: "virtual",
    });

    setWorkflowState(result.state);
    setSimulatorLog((currentLog) => [
      {
        id: `sim-log-${Date.now()}`,
        replyBody: result.replyBody,
        trace: result.trace,
      },
      ...currentLog,
    ]);
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className={panelClass}>
          <h2 className="text-xl font-semibold text-blue-950">
            Virtual SMS controls
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Care Family member
              <select
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
                onChange={(event) => setSelectedMemberId(event.target.value)}
                value={selectedMemberId}
              >
                {workflowState.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName} · {member.phoneNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Workflow prompt
              <select
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
                onChange={(event) =>
                  setPromptType(event.target.value as SmsPromptType)
                }
                value={promptType}
              >
                {Object.entries(promptTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Errand
            <select
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
              onChange={(event) => setSelectedErrandId(event.target.value)}
              value={selectedErrandId}
            >
              {workflowState.errands.map((errand) => (
                <option key={errand.id} value={errand.id}>
                  {errand.title} · {errand.status}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`mt-4 ${gentlePrimaryButtonClass}`}
            onClick={sendVirtualPrompt}
            type="button"
          >
            Send virtual SMS
          </button>

          <div className="mt-5 rounded-md border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-sm font-semibold text-blue-950">
              Latest outbound SMS
            </p>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {latestOutboundMessage?.body ?? "No virtual SMS sent yet."}
            </pre>
          </div>

          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Simulated inbound reply
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
              onChange={(event) => setInboundBody(event.target.value)}
              value={inboundBody}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {["1", "2", "3", "done", "help", "list"].map((example) => (
              <button
                className={gentleSecondaryButtonClass}
                key={example}
                onClick={() => setInboundBody(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
          <button
            className={`mt-4 ${gentlePrimaryButtonClass}`}
            onClick={processVirtualReply}
            type="button"
          >
            Process reply
          </button>
        </div>

        <div className={panelClass}>
          <h2 className="text-xl font-semibold text-blue-950">
            Decision chain
          </h2>
          {latestTrace ? (
            <div className="mt-4 grid gap-3">
              <DecisionRow
                label="Raw input"
                value={latestTrace.normalized.rawInput}
              />
              <DecisionRow
                label="Normalized"
                value={`${latestTrace.normalized.normalizedInput} · ${latestTrace.normalized.token}`}
              />
              <DecisionRow
                label="Deterministic"
                value={latestTrace.deterministicMatch ?? "No deterministic match"}
              />
              <DecisionRow
                label="AI invoked"
                value={latestTrace.aiInvoked ? "Yes" : "No"}
              />
              <DecisionRow
                label="Intent"
                value={`${latestTrace.finalIntent.intent} · confidence ${Math.round(
                  latestTrace.finalIntent.confidence * 100,
                )}%`}
              />
              <DecisionRow
                label="Rule"
                value={`${latestTrace.ruleDecision.action} · ${latestTrace.ruleDecision.reason}`}
              />
              <DecisionRow label="Reply" value={latestReply ?? ""} />
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Process a virtual reply to see the full chain of custody.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className={panelClass}>
          <h2 className="text-xl font-semibold text-blue-950">Errand state</h2>
          <div className="mt-4 grid gap-3">
            {visibleErrands.map((errand) => (
              <article
                className="rounded-md border border-blue-50 bg-white p-3"
                key={errand.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-700">
                      For {errand.careVipName}
                    </p>
                    <h3 className="mt-1 font-semibold text-blue-950">
                      {errand.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Owner: {errand.assignedMemberName ?? "Available"}
                    </p>
                  </div>
                  <ErrandStatusPill status={errand.status} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={panelClass}>
          <h2 className="text-xl font-semibold text-blue-950">
            Active prompt
          </h2>
          {activePrompt ? (
            <div className="mt-4 rounded-md border border-blue-50 bg-blue-50/60 p-3 text-sm leading-6 text-slate-700">
              <p>
                {promptTypeLabels[activePrompt.promptType]} for{" "}
                {relatedPromptErrand?.title ?? activePrompt.relatedObjectId}
              </p>
              <p>Member: {selectedMember?.displayName}</p>
              <p>Options: {activePrompt.expectedOptions.map((option) => option.label).join(", ")}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              No active prompt for this member.
            </p>
          )}

          <h2 className="mt-6 text-xl font-semibold text-blue-950">
            Concern review queue
          </h2>
          <div className="mt-3 grid gap-2">
            {workflowState.concerns.length > 0 ? (
              workflowState.concerns.map((concern) => (
                <article
                  className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-slate-700"
                  key={concern.id}
                >
                  <p className="font-semibold text-amber-900">
                    {concern.submittedByName}
                  </p>
                  <p>&quot;{concern.body}&quot;</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    {concern.status.replace(/_/g, " ")}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                No Concern candidates yet.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={panelClass}>
        <h2 className="text-xl font-semibold text-blue-950">
          SMS and audit log
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <LogList
            emptyLabel="No SMS messages yet."
            items={workflowState.messages.map((message) => ({
              id: message.id,
              title: `${message.direction} · ${message.provider}`,
              body: message.body,
              meta: `${message.fromPhone} → ${message.toPhone}`,
            }))}
          />
          <LogList
            emptyLabel="No audit events yet."
            items={workflowState.auditEvents.map((event) => ({
              id: event.id,
              title: event.type,
              body: event.detail,
              meta: event.actorName,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

function DecisionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-blue-50 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-blue-950">
        {value}
      </p>
    </div>
  );
}

function LogList({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: Array<{ id: string; title: string; body: string; meta: string }>;
}) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-slate-600">{emptyLabel}</p>;
  }

  return (
    <ol className="grid gap-2">
      {items.map((item) => (
        <li className="rounded-md border border-blue-50 bg-white p-3" key={item.id}>
          <p className="text-sm font-semibold text-blue-950">{item.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {item.body}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
        </li>
      ))}
    </ol>
  );
}
