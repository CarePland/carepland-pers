import { NextResponse } from "next/server";

import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  readConnectPersonScopedAccess,
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import {
  createAdvisoryPlatformReviewAnalysis,
  listSupabasePlatformReviewsForAttempt,
  readLocalInteractionAttempts,
  recordLocalInteractionAttemptEvent,
  recordLocalInteractionAttemptObservation,
  recordLocalPlatformReview,
  recordLocalPlatformReviewAnalysis,
  recordSupabaseInteractionAttemptEvent,
  recordSupabaseInteractionAttemptObservation,
  recordSupabasePlatformReview,
  recordSupabasePlatformReviewAnalysis,
  startLocalInteractionAttempt,
  startSupabaseInteractionAttempt,
  type InteractionAttemptEventType,
  type InteractionAttemptRevisionReason,
  type PlatformReviewAnalysisRecord,
  type PlatformReviewRecord,
} from "@/app/lib/platform/ai/interactionAttempts";
import type { AiPlatformRecord, Observation } from "@/app/lib/platform/ai/contracts";
import { runOpenAiResponse } from "@/app/lib/platform/ai/responses";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = stringValue(body.action);
    const personId = stringValue(body.personId);

    if (!personId) {
      return NextResponse.json(
        { error: "Interaction Attempt requires a person.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectPersonScopedAccess(request, personId, { body });

    if (action === "start") {
      const input = {
        activeWorkflow: stringValue(body.activeWorkflow),
        careCircleId: access.careCircleId,
        careSubjectId: access.mainConnectUserPersonId,
        createdByUserId: access.createdByUserId,
        deviceId: stringValue(body.deviceId),
        metadata: platformRecord(body.metadata),
        receiverDeviceId:
          stringValue(body.receiverDeviceId) ||
          ("receiverDeviceId" in access ? access.receiverDeviceId : ""),
        surface: stringValue(body.surface),
      };
      const supabaseAttempt = await startSupabaseInteractionAttempt(
        input,
        access.supabase
      );
      const attempt = supabaseAttempt ?? (await startLocalInteractionAttempt(input));
      return NextResponse.json({ attemptId: attempt.id, ok: true, source: supabaseAttempt ? "supabase" : "local" });
    }

    const attemptId = stringValue(body.attemptId);
    if (!attemptId) {
      return NextResponse.json(
        { error: "Interaction Attempt id is required.", ok: false },
        { status: 400 }
      );
    }

    if (action === "record_observation") {
      const observation = body.observation as Observation | undefined;
      if (!observation?.observationId) {
        return NextResponse.json(
          { error: "Observation id is required.", ok: false },
          { status: 400 }
        );
      }

      const input = {
        attemptId,
        observation,
        parentObservationId: stringValue(body.parentObservationId),
        revisionIndex: numberValue(body.revisionIndex),
        revisionReason: revisionReasonValue(body.revisionReason),
      };
      const supabaseRecord = await recordSupabaseInteractionAttemptObservation(
        input,
        access.supabase
      );
      const record =
        supabaseRecord ?? (await recordLocalInteractionAttemptObservation(input));
      return NextResponse.json({ observationAttemptId: record.id, ok: true, source: supabaseRecord ? "supabase" : "local" });
    }

    if (action === "record_event") {
      const input = {
        actorRole: stringValue(body.actorRole) || "receiver_user",
        attemptId,
        eventType: eventTypeValue(body.eventType),
        observationId: stringValue(body.observationId),
        payload: platformRecord(body.payload),
      };
      const supabaseRecord = await recordSupabaseInteractionAttemptEvent(
        input,
        access.supabase
      );
      const record = supabaseRecord ?? (await recordLocalInteractionAttemptEvent(input));
      return NextResponse.json({ eventId: record.id, ok: true, source: supabaseRecord ? "supabase" : "local" });
    }

    if (action === "list_reviews") {
      await requireAdminReviewer(access);
      const supabaseRecords = await listSupabasePlatformReviewsForAttempt(
        attemptId,
        access.supabase
      );
      if (supabaseRecords) {
        return NextResponse.json({ ...supabaseRecords, ok: true, source: "supabase" });
      }
      const store = await readLocalInteractionAttempts();
      return NextResponse.json({
        analyses: store.reviewAnalyses.filter((analysis) => analysis.attemptId === attemptId),
        ok: true,
        reviews: store.reviews.filter((review) => review.attemptId === attemptId),
        source: "local",
      });
    }

    if (action === "record_review") {
      const reviewerUserId = await requireAdminReviewer(access);
      const input = {
        attemptId,
        comment: stringValue(body.comment),
        metadata: platformRecord(body.metadata),
        reviewerUserId,
      };
      const supabaseRecord = await recordSupabasePlatformReview(
        { ...input, careCircleId: access.careCircleId },
        access.supabase
      );
      const review =
        supabaseRecord ?? (await recordLocalPlatformReview(input));
      const records = await readReviewRecords(attemptId, access);
      return NextResponse.json({
        ...records,
        ok: true,
        review,
        source: supabaseRecord ? "supabase" : "local",
      });
    }

    if (action === "analyze_review") {
      await requireAdminReviewer(access);
      const reviewId = stringValue(body.reviewId);
      if (!reviewId) {
        return NextResponse.json(
          { error: "Platform Review id is required.", ok: false },
          { status: 400 }
        );
      }
      const records = await readReviewRecords(attemptId, access);
      const review = records.reviews.find((item) => item.id === reviewId);
      if (!review) {
        return NextResponse.json(
          { error: "Platform Review was not found.", ok: false },
          { status: 404 }
        );
      }
      const advisory = await createPlatformReviewAnalysis(review);
      const supabaseRecord = await recordSupabasePlatformReviewAnalysis(
        { ...advisory, careCircleId: access.careCircleId },
        access.supabase
      );
      const analysis =
        supabaseRecord ?? (await recordLocalPlatformReviewAnalysis(advisory));
      const updatedRecords = await readReviewRecords(attemptId, access);
      return NextResponse.json({
        ...updatedRecords,
        analysis,
        ok: true,
        source: supabaseRecord ? "supabase" : "local",
      });
    }

    return NextResponse.json(
      { error: "Unsupported Interaction Attempt action.", ok: false },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Main Connect User from your CarePland collection.",
          ok: false,
        },
        { status: 403 }
      );
    }
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(receiverDeviceSetupRequiredBody(error), {
        status: error.status,
      });
    }
    if (
      error instanceof Error &&
      (error.message.includes("Admin sign-in") ||
        error.message.includes("Admin access"))
    ) {
      return NextResponse.json({ error: error.message, ok: false }, { status: 403 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record Interaction Attempt.",
        ok: false,
      },
      { status: 500 }
    );
  }
}

async function readReviewRecords(
  attemptId: string,
  access: Awaited<ReturnType<typeof readConnectPersonScopedAccess>>
) {
  const supabaseRecords = await listSupabasePlatformReviewsForAttempt(
    attemptId,
    access.supabase
  );
  if (supabaseRecords) return supabaseRecords;
  const store = await readLocalInteractionAttempts();
  return {
    analyses: store.reviewAnalyses.filter((analysis) => analysis.attemptId === attemptId),
    reviews: store.reviews.filter((review) => review.attemptId === attemptId),
  };
}

async function createPlatformReviewAnalysis(
  review: PlatformReviewRecord
): Promise<Omit<PlatformReviewAnalysisRecord, "createdAt" | "id">> {
  const fallback = createAdvisoryPlatformReviewAnalysis(review);
  const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  if (!apiKey) return fallback;

  try {
    const response = await runOpenAiResponse({
      apiKey,
      input: [
        {
          role: "system",
          content:
            "You analyze administrator Platform Review comments for CarePland. The analysis is advisory only. It must never modify production behavior, prompts, interpreter memory, classification, workflow selection, or user interactions. Return concise JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            comment: review.comment,
            instructions: {
              affectedPlatformLayers: "Array of short platform layer names.",
              analysisText:
                "Short plain-text summary of the concern and suggested investigation.",
              identifiedConcerns: "Array of concise concern labels.",
              suggestedRefinementAreas: "Array of concise future investigation areas.",
            },
          }),
        },
      ],
      model: process.env.OPENAI_PLATFORM_REVIEW_ANALYSIS_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
    });
    if (!response.ok || !response.text.trim()) return fallback;
    const parsed = parseReviewAnalysisJson(response.text);
    return {
      affectedPlatformLayers: stringArray(parsed.affectedPlatformLayers),
      analysisText: stringValue(parsed.analysisText) || fallback.analysisText,
      attemptId: review.attemptId,
      identifiedConcerns: stringArray(parsed.identifiedConcerns),
      metadata: {
        advisoryOnly: true,
        openAiRequestId: response.requestId || "",
        productionBehaviorUnaffected: true,
      },
      model: process.env.OPENAI_PLATFORM_REVIEW_ANALYSIS_MODEL || "gpt-4.1-mini",
      modelVersion: "openai-responses",
      reviewId: review.id,
      suggestedRefinementAreas: stringArray(parsed.suggestedRefinementAreas),
    };
  } catch {
    return fallback;
  }
}

async function requireAdminReviewer(
  access: Awaited<ReturnType<typeof readConnectPersonScopedAccess>>
) {
  if (access.accessType !== "user" || !access.createdByUserId) {
    throw new Error("Admin sign-in is required for Platform Reviews.");
  }

  const { data, error } = await access.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", access.createdByUserId)
    .single();

  if (error) throw error;
  if ((data as { is_admin?: boolean } | null)?.is_admin !== true) {
    throw new Error("Admin access is required for Platform Reviews.");
  }
  return access.createdByUserId;
}

function eventTypeValue(value: unknown): InteractionAttemptEventType {
  const normalized = stringValue(value);
  const supported: InteractionAttemptEventType[] = [
    "abandoned",
    "attempt_started",
    "cancelled",
    "helpful_selected",
    "message_condensation_approved",
    "message_condensation_draft_edited",
    "message_condensation_triggered",
    "not_helpful_selected",
    "observation_submitted",
    "rephrase_selected",
    "response_presented",
    "revision_observation_submitted",
    "send_selected",
    "timed_out",
    "workflow_completed",
  ];
  if (supported.includes(normalized as InteractionAttemptEventType)) {
    return normalized as InteractionAttemptEventType;
  }
  throw new Error("Unsupported Interaction Attempt event type.");
}

function revisionReasonValue(value: unknown): InteractionAttemptRevisionReason {
  const normalized = stringValue(value);
  const supported: InteractionAttemptRevisionReason[] = [
    "clarification",
    "correction",
    "initial",
    "modality_switch",
    "rephrase",
    "retry",
  ];
  return supported.includes(normalized as InteractionAttemptRevisionReason)
    ? (normalized as InteractionAttemptRevisionReason)
    : "initial";
}

function platformRecord(value: unknown): AiPlatformRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entry]) =>
      isPlatformJson(entry)
    )
  ) as AiPlatformRecord;
}

function isPlatformJson(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlatformJson);
  if (value && typeof value === "object") {
    return Object.values(value).every(isPlatformJson);
  }
  return false;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function parseReviewAnalysisJson(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
