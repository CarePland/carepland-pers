export type ImportAnythingCarePrepReviewItem = {
  fields: Record<string, string | undefined>;
  kind: string;
  matchedAppointmentId: string;
  sourceExcerpt: string;
  status: string;
};

export type ImportAnythingCarePrepAppointment = {
  id: string;
  reason: string | null;
  title: string | null;
};

export const maxImportAnythingCarePrepSourceExcerptChars = 8_000;

type BuildImportAnythingCarePrepDraftsInput = {
  appointmentsById: Map<string, ImportAnythingCarePrepAppointment>;
  careCircleId: string;
  generatedAt: string;
  intakeItemId: string | null;
  items: ImportAnythingCarePrepReviewItem[];
  userId: string;
};

function uniqueNonEmptyStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = value?.trim();
    const comparisonKey = normalizedValue?.toLowerCase();

    if (!normalizedValue || !comparisonKey || seen.has(comparisonKey)) {
      continue;
    }

    seen.add(comparisonKey);
    result.push(normalizedValue);
  }

  return result;
}

function combinedSourceExcerpt(items: ImportAnythingCarePrepReviewItem[]) {
  const sourceExcerpt = items
    .map((item) => item.sourceExcerpt.trim())
    .filter(Boolean)
    .join("\n\n");

  if (sourceExcerpt.length <= maxImportAnythingCarePrepSourceExcerptChars) {
    return sourceExcerpt;
  }

  return `${sourceExcerpt.slice(
    0,
    maxImportAnythingCarePrepSourceExcerptChars
  )}\n\n[Source excerpt truncated for CarePrep draft context.]`;
}

export type ImportAnythingCarePrepDraft = {
  itemCount: number;
  payload: {
    appointment_id: string;
    bring_list: string[];
    care_circle_id: string;
    generated_at: string;
    input_context_snapshot: {
      import_anything_intake_item_id: string | null;
      source_excerpt: string;
      source_type: "import_anything";
    };
    is_current: false;
    key_questions: string[];
    med_review: string[];
    next_steps: string[];
    review_status: "draft";
    since_last_visit: string[];
    source: "import_anything";
    status: "succeeded";
    summary: string;
    user_id: string;
    version_number: 0;
    watchouts: string[];
  };
};

function carePrepSummary(
  items: ImportAnythingCarePrepReviewItem[],
  appointment: ImportAnythingCarePrepAppointment | undefined
): string {
  const itemSummaries = items
    .map((item) => {
      if (item.kind === "question") {
        return item.fields.question?.trim();
      }

      if (item.kind === "medication_change") {
        return [
          item.fields.medicationName?.trim(),
          item.fields.changeSummary?.trim(),
        ]
          .filter(Boolean)
          .join(": ");
      }

      if (item.kind === "task") {
        return [item.fields.title?.trim(), item.fields.dueAt?.trim()]
          .filter(Boolean)
          .join(" - ");
      }

      return item.fields.detail?.trim();
    })
    .filter(Boolean);
  const appointmentName =
    appointment?.title?.trim() || appointment?.reason?.trim() || "this visit";

  if (itemSummaries.length === 0) {
    return `Imported CarePrep draft for ${appointmentName}.`;
  }

  return `Imported CarePrep draft for ${appointmentName}: ${itemSummaries
    .slice(0, 3)
    .join("; ")}${itemSummaries.length > 3 ? "." : ""}`;
}

export function buildImportAnythingCarePrepDrafts({
  appointmentsById,
  careCircleId,
  generatedAt,
  intakeItemId,
  items,
  userId,
}: BuildImportAnythingCarePrepDraftsInput): ImportAnythingCarePrepDraft[] {
  const groupedItems = new Map<string, ImportAnythingCarePrepReviewItem[]>();

  for (const item of items) {
    if (
      item.status !== "approved" ||
      (item.kind !== "careprep" &&
        item.kind !== "medication_change" &&
        item.kind !== "question" &&
        item.kind !== "task") ||
      !item.matchedAppointmentId
    ) {
      continue;
    }

    groupedItems.set(item.matchedAppointmentId, [
      ...(groupedItems.get(item.matchedAppointmentId) ?? []),
      item,
    ]);
  }

  return Array.from(groupedItems.entries()).flatMap(
    ([appointmentId, carePrepItems]) => {
      const keyQuestions = carePrepItems
        .filter((item) => item.kind === "question")
        .map((item) => item.fields.question);
      const nextSteps = carePrepItems
        .filter((item) => item.kind === "careprep" || item.kind === "task")
        .map((item) => {
          if (item.kind === "task") {
            return [
              item.fields.title?.trim(),
              item.fields.dueAt?.trim(),
              item.fields.details?.trim(),
            ]
              .filter(Boolean)
              .join(" - ");
          }

          return item.fields.detail;
        });
      const medReview = carePrepItems
        .filter((item) => item.kind === "medication_change")
        .map((item) =>
          [
            item.fields.medicationName?.trim(),
            item.fields.changeSummary?.trim(),
            item.fields.instructions?.trim(),
          ]
            .filter(Boolean)
            .join(": ")
        );
      const uniqueKeyQuestions = uniqueNonEmptyStrings(keyQuestions);
      const uniqueNextSteps = uniqueNonEmptyStrings(nextSteps);
      const uniqueMedReview = uniqueNonEmptyStrings(medReview);

      if (
        uniqueKeyQuestions.length === 0 &&
        uniqueMedReview.length === 0 &&
        uniqueNextSteps.length === 0
      ) {
        return [];
      }

      const appointment = appointmentsById.get(appointmentId);

      return [
        {
          itemCount: carePrepItems.length,
          payload: {
            appointment_id: appointmentId,
            bring_list: [],
            care_circle_id: careCircleId,
            generated_at: generatedAt,
            input_context_snapshot: {
              import_anything_intake_item_id: intakeItemId,
              source_excerpt: combinedSourceExcerpt(carePrepItems),
              source_type: "import_anything",
            },
            is_current: false,
            key_questions: uniqueKeyQuestions,
            med_review: uniqueMedReview,
            next_steps: uniqueNextSteps,
            review_status: "draft",
            since_last_visit: [],
            source: "import_anything",
            status: "succeeded",
            summary: carePrepSummary(carePrepItems, appointment),
            user_id: userId,
            version_number: 0,
            watchouts: [],
          },
        },
      ];
    }
  );
}
