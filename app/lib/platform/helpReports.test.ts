import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHelpReportTimeline,
  deriveHelpReportSummary,
  extractProblemReportSummary,
  generateHelpReportReference,
  groupedHelpReportLogs,
  isHelpReportResolutionCategory,
  isHelpReportStatus,
  sanitizeDiagnosticPacket,
  validateAndPrepareHelpReportSubmission,
} from "./helpReports";

const basePacket = {
  apiCalls: [
    {
      at: "2026-07-17T18:00:03.000Z",
      durationMs: 120,
      method: "GET",
      status: 200,
      url: "/api/personal/messages?token=super-secret",
    },
    {
      at: "2026-07-17T18:00:05.000Z",
      durationMs: 6400,
      method: "POST",
      status: 500,
      url: "/api/careprep",
    },
  ],
  app: {
    buildNumber: "abc123",
  },
  breadcrumbs: [
    {
      at: "2026-07-17T18:00:01.000Z",
      detail: {
        control: {
          ariaLabel: "Save appointment",
        },
        path: "/?personal=1&appointments=1",
      },
      kind: "ui",
      label: "click",
    },
  ],
  device: {
    platform: "MacIntel",
    userAgent: "Test Browser",
  },
  logs: [
    {
      at: "2026-07-17T18:00:04.000Z",
      level: "warn",
      message: "Slow save warning",
    },
    {
      at: "2026-07-17T18:00:06.000Z",
      level: "error",
      message: "TypeError: Cannot read properties of undefined token=abc123",
    },
    {
      at: "2026-07-17T18:00:07.000Z",
      level: "error",
      message: "TypeError: Cannot read properties of undefined token=abc123",
    },
  ],
  navigation: [
    {
      at: "2026-07-17T18:00:00.000Z",
      from: "",
      to: "/?personal=1&appointments=1",
      type: "initial",
    },
  ],
  screen: {
    html: '<input value="private"><main>Appointment screen token=abc123</main>',
    path: "/?personal=1&appointments=1",
    visibleText: "Appointment screen password=hunter2",
  },
  session: {
    authorization: "Bearer abc123",
  },
  version: 1,
};

test("generates readable help report references", () => {
  assert.equal(
    generateHelpReportReference(new Date("2026-07-17T12:00:00Z"), 0),
    "HELP-20260717-0000"
  );
  assert.match(
    generateHelpReportReference(new Date("2026-07-17T12:00:00Z"), 0.5),
    /^HELP-20260717-[0-9A-Z]{4}$/
  );
});

test("validates packet version and derives route and feature area", () => {
  const prepared = validateAndPrepareHelpReportSubmission({
    packet: basePacket,
    userInput: {
      happenedInstead: "It showed an error",
      tryingToDo: "Save appointment",
    },
  });

  assert.equal(prepared.packetSchemaVersion, 1);
  assert.equal(prepared.route, "/?personal=1&appointments=1");
  assert.equal(prepared.featureArea, "Appointments");
  assert.equal(prepared.userTryingToDo, "Save appointment");
});

test("rejects unsupported packet versions", () => {
  assert.throws(
    () =>
      validateAndPrepareHelpReportSubmission({
        packet: { ...basePacket, version: 999 },
      }),
    /Unsupported/
  );
});

test("redacts server-side secrets from packet fields", () => {
  const sanitized = sanitizeDiagnosticPacket(basePacket);

  assert.equal(
    (sanitized.session as Record<string, unknown>).authorization,
    "[redacted]"
  );
  assert.doesNotMatch(
    String((sanitized.screen as Record<string, unknown>).visibleText),
    /hunter2|abc123/
  );
  assert.doesNotMatch(JSON.stringify(sanitized), /super-secret|Bearer abc123/);
});

test("derives deterministic triage summary", () => {
  const summary = deriveHelpReportSummary(sanitizeDiagnosticPacket(basePacket));

  assert.equal(summary.errorCount, 2);
  assert.equal(summary.warningCount, 1);
  assert.equal(summary.failedRequestCount, 1);
  assert.equal(summary.slowRequestCount, 1);
  assert.equal(summary.lastFailedEndpoint, "/api/careprep");
  assert.equal(summary.lastMeaningfulUserAction, "Pressed Save appointment");
  assert.equal(summary.likelyCategory, "timeout or slow response");
});

test("builds human-readable chronological timeline", () => {
  const timeline = buildHelpReportTimeline(sanitizeDiagnosticPacket(basePacket));

  assert.ok(timeline.some((item) => item.title === "Navigated"));
  assert.ok(timeline.some((item) => item.title === "Pressed Save appointment"));
  assert.ok(timeline.some((item) => item.title === "API request failed"));
  assert.ok(timeline.some((item) => item.title.startsWith("Frontend error")));
});

test("groups repeated console messages", () => {
  const grouped = groupedHelpReportLogs(sanitizeDiagnosticPacket(basePacket));
  const error = grouped.find((entry) => entry.level === "error");

  assert.equal(error?.count, 2);
  assert.match(error?.message ?? "", /TypeError/);
});

test("guards status and resolution categories", () => {
  assert.equal(isHelpReportStatus("reviewing"), true);
  assert.equal(isHelpReportStatus("closed"), false);
  assert.equal(isHelpReportResolutionCategory("code_defect"), true);
  assert.equal(isHelpReportResolutionCategory("surprise"), false);
});

test("extracts Something Went Wrong decision trace from diagnostics", () => {
  const packet = sanitizeDiagnosticPacket({
    ...basePacket,
    breadcrumbs: [
      ...basePacket.breadcrumbs,
      {
        at: "2026-07-17T18:00:08.000Z",
        detail: {
          entryPoint: "something_went_wrong",
          reportCorrelationId: "SWW-123",
        },
        kind: "diagnostic",
        label: "something_went_wrong_opened",
      },
      {
        at: "2026-07-17T18:00:09.000Z",
        detail: {
          decisionTrace: {
            confidence: 0.86,
            entryPoint: "something_went_wrong",
            interpretedQuestion: "send stayed spinning",
            relevantContextUsed: ["route:/connect/dashboard", "recent_failed_api"],
            selectedInteractionFamily: "unexpected_behavior",
            selectedWorkflow: "failed_message_delivery",
          },
          reportCorrelationId: "SWW-123",
        },
        kind: "diagnostic",
        label: "something_went_wrong_interpreted",
      },
    ],
  });

  assert.deepEqual(extractProblemReportSummary(packet), {
    confidence: 0.86,
    entryPoint: "something_went_wrong",
    interpretedQuestion: "send stayed spinning",
    interactionFamily: "unexpected_behavior",
    relevantContextUsed: ["route:/connect/dashboard", "recent_failed_api"],
    reportCorrelationId: "SWW-123",
    selectedWorkflow: "failed_message_delivery",
  });
});
