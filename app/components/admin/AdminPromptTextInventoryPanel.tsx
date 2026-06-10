"use client";

type PromptInventoryItem = {
  affects: string[];
  key: string;
  label: string;
  refineWhen: string[];
  usedWhen: string[];
};

type TextInventoryItem = {
  copy: string[];
  label: string;
  refineWhen: string[];
  surface: string;
};

const healthFocusPromptInventory: PromptInventoryItem[] = [
  {
    affects: [
      "Home context answer",
      "uncertainty phrasing",
      "plain-language care understanding",
    ],
    key: "home_context_answer",
    label: "Home context answer",
    refineWhen: [
      "answers are too long",
      "answers sound like reports",
      "answers give advice instead of context",
      "topic-level answers sound global",
    ],
    usedWhen: ["Get more context question is submitted"],
  },
  {
    affects: [
      "intent routing",
      "out-of-scope redirects",
      "source bucket selection",
      "visible context weighting",
    ],
    key: "home_context_intent_classifier",
    label: "Home context intent classifier",
    refineWhen: [
      "unrelated questions get answered",
      "care-history questions are rejected",
      "visible appointment questions are rejected",
      "wrong sources are selected",
    ],
    usedWhen: ["before context answers are generated"],
  },
  {
    affects: ["Which topics appear", "source-backed Health Focus context"],
    key: "health_topic_extraction",
    label: "Health topic extraction",
    refineWhen: ["important topics are missing", "irrelevant topics appear"],
    usedWhen: ["Visit Notes save", "backfill", "future AI extraction"],
  },
  {
    affects: ["topic grouping", "topic names", "taxonomy mapping"],
    key: "health_topic_normalization",
    label: "Health topic normalization",
    refineWhen: ["topics are too broad", "user wording maps to the wrong topic"],
    usedWhen: ["mapping extracted language to standard topics"],
  },
  {
    affects: ["separate vs related care threads", "related-topic meaning"],
    key: "health_topic_relationship_detection",
    label: "Health topic relationship detection",
    refineWhen: ["unrelated concerns are linked", "connected issues are split"],
    usedWhen: ["building Health Story relationship context"],
  },
  {
    affects: ["Health Focus card summary"],
    key: "health_focus_card_summary",
    label: "Health Focus card summary",
    refineWhen: ["card copy sounds robotic", "summary is too vague"],
    usedWhen: ["rendering or saving Health Focus card summaries"],
  },
  {
    affects: ["top Health Story paragraph"],
    key: "health_story_narrative_summary",
    label: "Health Story narrative summary",
    refineWhen: ["story sounds like a database", "story ignores user correction"],
    usedWhen: ["View Story", "future saved Health Narrative generation"],
  },
  {
    affects: ["timeline event text", "approximate date wording"],
    key: "health_story_timeline_summary",
    label: "Health Story timeline summary",
    refineWhen: ["timeline implies unsupported progression", "date language confuses"],
    usedWhen: ["Health Story has multiple dated source visits"],
  },
  {
    affects: ["source snippets", "source trust and auditability"],
    key: "health_story_source_snippet_selection",
    label: "Health Story source snippet selection",
    refineWhen: ["source proof feels weak", "snippets look like matched terms"],
    usedWhen: ["choosing source snippets for a Health Story"],
  },
  {
    affects: ["feedback acknowledgement", "undo wording", "user ownership tone"],
    key: "health_story_feedback_acknowledgement",
    label: "Health Story feedback acknowledgement",
    refineWhen: [
      "acknowledgement feels too technical",
      "copy implies guaranteed AI learning",
    ],
    usedWhen: ["Health Story feedback is saved"],
  },
  {
    affects: ["feedback mode", "future-generation influence flag"],
    key: "health_topic_feedback_interpretation",
    label: "Health topic feedback interpretation",
    refineWhen: ["feedback is misunderstood", "the same correction repeats"],
    usedWhen: ["user submits Health Story feedback"],
  },
  {
    affects: ["durable user correction context"],
    key: "health_topic_correction_structuring",
    label: "Health topic correction structuring",
    refineWhen: ["correction applies too broadly", "wrong Care VIP/topic is affected"],
    usedWhen: ["turning clarification into future care context"],
  },
  {
    affects: ["saved reports", "saved Health Narratives"],
    key: "health_report_generation",
    label: "Health report generation",
    refineWhen: ["reports are generic", "reports ignore corrections"],
    usedWhen: ["future saved report generation"],
  },
];

const healthFocusTextInventory: TextInventoryItem[] = [
  {
    copy: [
      "Get more context",
      "What would you like to understand better?",
      "Anything to understand better",
      "Get context on this story",
    ],
    label: "Home context panel",
    refineWhen: ["users confuse this with Ask", "the panel purpose is unclear"],
    surface: "Home",
  },
  {
    copy: ["Past visit context", "Your Health Focus", "Story Open"],
    label: "Health Focus card surface",
    refineWhen: ["section name is unclear", "card actions feel technical"],
    surface: "Home",
  },
  {
    copy: ["This Month", "A Few Times", "Several Months"],
    label: "Context signature pills",
    refineWhen: ["labels feel too vague", "frequency expectation feels off"],
    surface: "Health Focus cards and Health Story header",
  },
  {
    copy: [
      "Health Story",
      "Close",
      "Related topics",
      "How's this look?",
    ],
    label: "Health Story sections",
    refineWhen: ["sections sound too technical", "source area feels unclear"],
    surface: "View Story",
  },
  {
    copy: ["Relevant saved note text was not available."],
    label: "Source fallback copy",
    refineWhen: ["fallback sounds unhelpful", "source trust is weak"],
    surface: "Health Story sources and timeline",
  },
  {
    copy: [
      "Looks right",
      "Not quite",
      "Related",
      "Separate",
      "Share anything you'd like different",
      "Add your detail",
      "Undo",
    ],
    label: "Health Story feedback controls",
    refineWhen: ["feedback feels like support", "users do not know what to click"],
    surface: "Health Story feedback UI",
  },
  {
    copy: [
      "Thank you — your context will improve future stories.",
      "Thank you — your context improves future stories.",
      "Thank you — your context helps build better stories.",
      "Thank you — your feedback helps improve your stories.",
      "Thank you — your care history improves with this feedback.",
      "Thank you — your context helps connect future visits.",
    ],
    label: "Health Story feedback acknowledgement",
    refineWhen: [
      "thank-you copy promises too much",
      "acknowledgement feels generic",
    ],
    surface: "Health Story feedback UI",
  },
];

export function AdminPromptTextInventoryPanel() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">
          Prompt and text inventory
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Read-only map of Health Focus prompt paths and user-facing text. Use
          this to find what to refine when feedback says something was confusing.
        </p>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-slate-900">
          Health Focus prompts
        </h3>
        <div className="mt-3 grid gap-3">
          {healthFocusPromptInventory.map((item) => (
            <article
              className="rounded-md border border-slate-200 bg-white p-4"
              key={item.key}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {item.label}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {item.key}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900 ring-1 ring-blue-100">
                  Admin AI Prompt
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
                <InventoryList label="Used when" values={item.usedWhen} />
                <InventoryList label="Affects" values={item.affects} />
                <InventoryList label="Refine when" values={item.refineWhen} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-900">
          User-facing text paths
        </h3>
        <div className="mt-3 grid gap-3">
          {healthFocusTextInventory.map((item) => (
            <article
              className="rounded-md border border-slate-200 bg-white p-4"
              key={item.label}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {item.surface}
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  Read-only copy
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
                <InventoryList label="Current / candidate copy" values={item.copy} />
                <InventoryList label="Refine when" values={item.refineWhen} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function InventoryList({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <ul className="mt-1 space-y-1">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
