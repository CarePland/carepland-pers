import {
  homeContextClassifierDefaultSchema,
  homeContextClassifierDefaultSystemPrompt,
  homeContextClassifierDefaultUserPrompt,
  homeContextDefaultSchema,
  homeContextDefaultSystemPrompt,
  homeContextDefaultUserPrompt,
} from "../../lib/personal/homeContext/prompts";

export type AiWorkflowKey =
  | "admin_hq_prioritization"
  | "ask_onboarding_helper"
  | "ask_user_response_rubric"
  | "bulk_appointment_intake"
  | "careprep_generation"
  | "connect_receiver_request_interpreter"
  | "connect_receiver_sound_help"
  | "health_focus_card_summary"
  | "health_report_generation"
  | "health_story_feedback_acknowledgement"
  | "health_story_narrative_summary"
  | "health_story_source_snippet_selection"
  | "health_story_timeline_summary"
  | "health_topic_correction_structuring"
  | "health_topic_extraction"
  | "health_topic_feedback_interpretation"
  | "health_topic_normalization"
  | "health_topic_relationship_detection"
  | "home_context_answer"
  | "home_context_intent_classifier"
  | "note_intake_interpretation"
  | "support_assistant";

export const defaultCarePrepOutputSchema = {
  additionalProperties: false,
  properties: {
    bring_list: { items: { type: "string" }, type: "array" },
    key_questions: { items: { type: "string" }, type: "array" },
    med_review: { items: { type: "string" }, type: "array" },
    next_steps: { items: { type: "string" }, type: "array" },
    since_last_visit: { items: { type: "string" }, type: "array" },
    summary: { type: "string" },
    watchouts: { items: { type: "string" }, type: "array" },
  },
  required: ["summary", "key_questions", "bring_list"],
  type: "object",
};

const defaultTextIntakeOutputSchema = {
  additionalProperties: false,
  properties: {
    appointment_reason: { type: "string" },
    appointment_title: { type: "string" },
    confidence: { type: "number" },
    followups: { items: { type: "string" }, type: "array" },
    location_address: { type: "string" },
    location_name: { type: "string" },
    location_phone: { type: "string" },
    notes_summary: { type: "string" },
    provider_name: { type: "string" },
    provider_organization: { type: "string" },
    starts_at_local: { type: "string" },
    suggested_action: { type: "string" },
    takeaways: { items: { type: "string" }, type: "array" },
  },
  required: [
    "appointment_title",
    "appointment_reason",
    "starts_at_local",
    "provider_name",
    "provider_organization",
    "location_name",
    "location_address",
    "location_phone",
    "notes_summary",
    "takeaways",
    "followups",
    "confidence",
    "suggested_action",
  ],
  type: "object",
};

const defaultBulkAppointmentOutputSchema = {
  additionalProperties: false,
  properties: {
    appointments: {
      items: {
        additionalProperties: false,
        properties: {
          appointment_reason: { type: "string" },
          appointment_title: { type: "string" },
          confidence: { type: "number" },
          location_address: { type: "string" },
          location_name: { type: "string" },
          location_phone: { type: "string" },
          provider_name: { type: "string" },
          provider_organization: { type: "string" },
          starts_at_local: { type: "string" },
          suggested_action: { type: "string" },
        },
        required: [
          "appointment_title",
          "appointment_reason",
          "starts_at_local",
          "provider_name",
          "provider_organization",
          "location_name",
          "location_address",
          "location_phone",
          "confidence",
          "suggested_action",
        ],
        type: "object",
      },
      maxItems: 10,
      type: "array",
    },
    import_summary: { type: "string" },
  },
  required: ["appointments", "import_summary"],
  type: "object",
};

const defaultSupportAssistantOutputSchema = {
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    category: { type: "string" },
    confidence: { type: "number" },
    escalation_recommended: { type: "boolean" },
    escalation_reason: { type: "string" },
    priority: { enum: ["low", "medium", "high", "urgent"], type: "string" },
    suggested_next_step: { type: "string" },
  },
  required: [
    "answer",
    "suggested_next_step",
    "confidence",
    "escalation_recommended",
    "escalation_reason",
    "category",
    "priority",
  ],
  type: "object",
};

const defaultAdminHqPrioritizationOutputSchema = {
  additionalProperties: false,
  properties: {
    engagementWatchlist: {
      items: {
        additionalProperties: false,
        properties: {
          sourceCount: { type: "number" },
          suggestedAction: { type: "string" },
          title: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: ["title", "whyItMatters", "suggestedAction", "sourceCount"],
        type: "object",
      },
      type: "array",
    },
    highestPriority: {
      items: {
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          rank: { type: "number" },
          severity: { enum: ["critical", "high", "medium", "low"], type: "string" },
          sourceCount: { type: "number" },
          sourceRefs: { items: { type: "string" }, type: "array" },
          suggestedAction: { type: "string" },
          title: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: [
          "rank",
          "category",
          "title",
          "whyItMatters",
          "suggestedAction",
          "severity",
          "sourceCount",
          "sourceRefs",
        ],
        type: "object",
      },
      type: "array",
    },
    lowerPrioritySignals: {
      items: {
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          sourceCount: { type: "number" },
          summary: { type: "string" },
          title: { type: "string" },
        },
        required: ["category", "title", "summary", "sourceCount"],
        type: "object",
      },
      type: "array",
    },
    openQuestions: { items: { type: "string" }, type: "array" },
    overallSummary: { type: "string" },
  },
  required: [
    "overallSummary",
    "highestPriority",
    "engagementWatchlist",
    "lowerPrioritySignals",
    "openQuestions",
  ],
  type: "object",
};

const defaultAdminHqPrioritizationSystemPrompt = `You are the CarePland Personal Admin HQ prioritization assistant.

Your job is to help the admin understand what deserves attention first across the Admin area. You are not a product strategist, medical advisor, support agent, or autonomous operator. You do not change data, close tickets, publish content, alter priorities, or make decisions on behalf of the admin.

Core philosophy:
CarePland Personal is a calm appointment memory and preparation system. Admin should help a solo operator see what matters without creating more noise. Your output should reduce cognitive load, not add another dashboard maze. Be concrete, concise, and operational.

Prioritization order:
1. Operational failure: system errors, integration failures, broken imports, failed CarePrep/OCR/AI workflows, email notification failures, or anything that may block normal app use.
2. User-reported problems: support tickets, reported bugs, user confusion that prevents task completion, urgent or repeated user complaints.
3. Early Access readiness blockers: open regressions, onboarding blockers, high-priority bugs, unresolved issues that reduce confidence in inviting or supporting Early Access users.
4. AI / quality review: assistant answers needing review, not-helpful feedback, Agent Knowledge proposals, OCR/import/CarePrep quality concerns, stale prompt or product-knowledge risks.
5. Stale follow-ups: old open product items, unresolved tickets, long-running review items, forgotten admin tasks.
6. User engagement / continuity health: users who have not logged in, have not completed onboarding, have appointments without Notes or CarePrep, imported but did not review/save, or are not using the system in a way that gives them continuity value.
7. Product direction / wishlist: feature ideas, UX improvements, wishlist clusters, non-urgent polish.

Rules:
- Prioritize user harm, app failure, and Early Access confidence over general product ideas.
- Prefer clear explanations over dramatic language.
- Do not overstate certainty. If a pattern is only suggested by the data, say so.
- Group related items when useful, but preserve the source categories.
- Always explain why an item is ranked high.
- Always include counts or source references when available.
- Do not invent records, user behavior, or error causes.
- Do not expose sensitive user details unless they are included in the provided Admin-safe input.
- Keep recommendations practical and short.

Output style:
Use calm, direct Admin language. The admin should be able to scan the result in under a minute.`;

const defaultAdminHqPrioritizationUserPrompt = `Review the following Admin-safe CarePland data and produce an Admin HQ prioritization brief.

Use the priority hierarchy from the system instructions. Focus on what deserves attention first.

Admin data:
{{admin_attention_payload}}

Current date:
{{current_date}}

Return concise JSON matching the schema.`;

const defaultConnectReceiverInterpreterOutputSchema = {
  additionalProperties: false,
  properties: {
    clarifyingQuestion: { type: ["string", "null"] },
    confidence: { type: "number" },
    futureCandidates: { items: { type: "string" }, type: "array" },
    intent: { type: "string" },
    normalizedText: { type: "string" },
    rawText: { type: "string" },
    requiresClarification: { type: "boolean" },
    safetyConcern: { type: "boolean" },
    selectedContact: { type: "string" },
    suggestedRoute: { type: "string" },
    summaryForCaregiver: { type: "string" },
  },
  required: [
    "rawText",
    "normalizedText",
    "intent",
    "confidence",
    "suggestedRoute",
    "selectedContact",
    "futureCandidates",
    "requiresClarification",
    "clarifyingQuestion",
    "safetyConcern",
    "summaryForCaregiver",
  ],
  type: "object",
};

const defaultConnectReceiverInterpreterSystemPrompt = `You are the CarePland Connect Receiver Request Interpreter.

CarePland Connect helps trusted people communicate. The receiver user may type or speak an open-ended request such as "I need to go to the store" or "Ask my caregiver about my appointment." Interpret the request for future routing, but do not overstate certainty.

Important product boundaries:
- This is not AI companionship.
- This is not surveillance.
- This is not always-on monitoring.
- The AI is a relay that helps humans communicate with each other.

Classify the request into one of these intents:
- general_message
- appointment_question
- errand_or_shopping
- transportation
- medication_question
- help_or_concern
- callback_request
- settings_or_device_help
- unclear

Current MVP behavior always sends the request as a message to the selected contact. Therefore suggestedRoute should usually be "message_selected_contact" even when a richer future workflow may apply.

Return strict JSON only. Do not include Markdown, commentary, or extra keys.`;

const defaultConnectReceiverInterpreterUserPrompt = `Interpret this CarePland Connect receiver request.

Request text:
{{requestText}}

Selected contact:
{{selectedContact}}

Receiver name:
{{receiverName}}

Receiver location:
{{receiverLocation}}

Care VIP name:
{{careVipName}}

Next appointment summary:
{{nextAppointmentSummary}}

Timestamp:
{{timestamp}}

Available contacts:
{{availableContacts}}

Return JSON with this shape:
{
  "rawText": "",
  "normalizedText": "",
  "intent": "",
  "confidence": 0.0,
  "suggestedRoute": "message_selected_contact",
  "selectedContact": "",
  "futureCandidates": [],
  "requiresClarification": false,
  "clarifyingQuestion": null,
  "safetyConcern": false,
  "summaryForCaregiver": ""
}`;

const defaultConnectReceiverSoundHelpOutputSchema = {
  additionalProperties: false,
  properties: {
    appMode: { type: "string" },
    actions: {
      items: {
        additionalProperties: false,
        properties: {
          action: { type: "string" },
          label: { type: "string" },
        },
        required: ["action", "label"],
        type: "object",
      },
      type: "array",
    },
    browser: { type: "string" },
    device: { type: "string" },
    explanation: { type: "string" },
    notes: { items: { type: "string" }, type: "array" },
    permissionStatus: { type: "string" },
    problem: { type: "string" },
    steps: { items: { type: "string" }, type: "array" },
    summary: { type: "string" },
    testAgainRecommended: { type: "boolean" },
    title: { type: "string" },
    warnings: { items: { type: "string" }, type: "array" },
  },
  required: [
    "title",
    "summary",
    "problem",
    "device",
    "browser",
    "appMode",
    "permissionStatus",
    "explanation",
    "steps",
    "actions",
    "warnings",
    "notes",
    "testAgainRecommended",
  ],
  type: "object",
};

const defaultConnectReceiverSoundHelpSystemPrompt = `You are the CarePland Connect Receiver Sound Help assistant.

CarePland Connect Receiver may run on native Android, iPad/iPhone browsers, Android browsers, desktop browsers, or future web/PWA surfaces. Your job is to generate practical, device-specific sound troubleshooting instructions for a caregiver or receiver user.

Use the supplied device/browser/app-mode context and the last audio test result. Keep instructions calm, readable, and support-friendly.

This prompt is used only when no reviewed/static Support Recipe matches the device/browser issue. Generate missing support knowledge once so it can be saved, reviewed, and reused as a static recipe later.

Important constraints:
- Be non-destructive.
- Do not suggest deleting accounts, wiping devices, resetting all settings, clearing all browser data, factory resets, or reinstalling the operating system.
- Do not claim that browsers expose a native "allow sounds" permission unless the supplied context says so.
- Do not overstate certainty. Browser audio behavior varies by iOS/iPadOS version and app mode.
- Prefer simple checks: physical volume buttons, mute/silent mode, Focus mode, audio output route, browser/site audio settings when available, opening from the Home Screen icon when relevant, and tapping Test Sound again.
- Include a Test Sound step before or after changes.
- Put destructive or risky actions in warnings as "Do not..." statements, not as steps.
- If the receiver can safely perform a local comfort-setting step, return it as an action instead of telling the user to navigate away. Allowed actions are: set_volume_high, enable_retro_button_sounds. Do not invent operational/admin actions.
- Keep steps practical and caregiver-readable.

Return strict JSON only. Do not include Markdown, commentary, or extra keys.`;

const defaultConnectReceiverSoundHelpUserPrompt = `Generate CarePland Connect Receiver sound help instructions.

Problem:
{{problem}}

Device detected:
{{device}}

Browser detected:
{{browser}}

App mode detected:
{{appMode}}

Last audio test result:
{{lastAudioTestResult}}

Audio context state:
{{audioContextState}}

Permission/autoplay status:
{{permissionStatus}}

Recipe lookup key:
{{recipeLookupKey}}

Recipe fallback keys tried:
{{recipeFallbackKeys}}

Return JSON with this shape:
{
  "title": "",
  "summary": "",
  "problem": "",
  "device": "",
  "browser": "",
  "appMode": "",
  "permissionStatus": "",
  "explanation": "",
  "steps": [],
  "actions": [],
  "warnings": [],
  "notes": [],
  "testAgainRecommended": true
}`;

export const aiWorkflows: Record<
  AiWorkflowKey,
  {
    defaultChangeNote: string;
    defaultSchema: unknown;
    defaultSystemPrompt?: string;
    defaultUserPrompt?: string;
    description: string;
    historyLabel: string;
    label: string;
  }
> = {
  admin_hq_prioritization: {
    defaultChangeNote: "Initial Admin HQ prioritization instruction set",
    defaultSchema: defaultAdminHqPrioritizationOutputSchema,
    defaultSystemPrompt: defaultAdminHqPrioritizationSystemPrompt,
    defaultUserPrompt: defaultAdminHqPrioritizationUserPrompt,
    description:
      "Instructions used to summarize and prioritize Admin operational signals.",
    historyLabel: "Admin HQ History",
    label: "Admin HQ prioritization",
  },
  ask_user_response_rubric: {
    defaultChangeNote: "Initial Ask user-facing response rubric",
    defaultSchema: {},
    defaultSystemPrompt:
      "Ask should sound like a CarePland routing surface, not a human agent. Avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical. Prefer neutral constructions such as \"This will be raised for review,\" \"This may need a closer look,\" \"A little more detail would help route this correctly,\" or \"Thanks for adding this.\" Do not deny that Ask is AI or pretend to be human. If AI identity is directly relevant, explain it plainly without overemphasizing it. Keep responses brief, calm, respectful, and non-corporate.",
    defaultUserPrompt:
      "Apply this rubric to user-facing Ask module responses unless a more specific approved instruction overrides it.",
    description:
      "Global response philosophy used by Ask modules when writing user-facing text.",
    historyLabel: "Ask Rubric History",
    label: "Ask user response rubric",
  },
  ask_onboarding_helper: {
    defaultChangeNote: "Initial Ask onboarding helper instruction set",
    defaultSchema: {
      additionalProperties: false,
      properties: {
        answer: { type: "string" },
        confidence: { type: "number" },
        escalation_reason: { type: "string" },
        escalation_recommended: { type: "boolean" },
        recommended_actions: {
          items: {
            additionalProperties: true,
            properties: {
              action: { type: "string" },
              confidence: { type: "number" },
              priority: { type: "string" },
              rationale: { type: "string" },
              title: { type: "string" },
            },
            required: ["action", "confidence", "rationale", "title"],
            type: "object",
          },
          type: "array",
        },
        summary: { type: "string" },
      },
      required: [
        "answer",
        "confidence",
        "escalation_reason",
        "escalation_recommended",
        "recommended_actions",
        "summary",
      ],
      type: "object",
    },
    defaultSystemPrompt:
      "You are the CarePland Personal Ask onboarding helper. Answer low-risk getting-started questions about profile setup, Early Access acknowledgements, Care Circle setup, the first-run Home welcome guide, adding a first appointment, importing appointment details, and demo examples. For profile setup, explain that CarePland keeps profile details lighter when a user authenticates with Google or Apple: email comes from auth, and extra contact details are optional unless the UI marks them otherwise. For email/password or email-update setup, the UI may require basic account/contact fields such as first and last name, phone, time zone, and ZIP so dates, account recovery, and support follow-up work correctly. Keep this from sounding like a medical intake form. If the user says they are confused, lost, unsure what the welcome screen means, or asks what to do next, respond with gentle orientation: reassure them briefly, explain that CarePland helps carry important appointment context forward from one visit to the next, name a few examples such as what changed, what mattered, and what to ask next, then suggest the easiest next step: adding or importing a first appointment. Keep answers brief, calm, and practical. Avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical. Do not give medical, legal, privacy, account-security, billing, or emergency advice. Do not claim to change data. Escalate if the user appears blocked by account state, email update, authentication, profile saving, missing Care Circle setup, data loss, or frustration. Return valid JSON exactly matching the schema.",
    defaultUserPrompt:
      "Use the supplied Ask thread, current page, app context, and onboarding facts. Either answer the onboarding question or recommend review when account-specific help is needed.",
    description:
      "Instructions used by Ask to answer low-risk onboarding and getting-started questions.",
    historyLabel: "Ask Onboarding History",
    label: "Ask onboarding helper",
  },
  careprep_generation: {
    defaultChangeNote: "Initial CarePrep instruction set",
    defaultSchema: defaultCarePrepOutputSchema,
    description: "Instructions used to generate appointment preparation guidance.",
    historyLabel: "CarePrep History",
    label: "CarePrep generation",
  },
  connect_receiver_request_interpreter: {
    defaultChangeNote: "Initial Connect receiver request interpreter prompt",
    defaultSchema: defaultConnectReceiverInterpreterOutputSchema,
    defaultSystemPrompt: defaultConnectReceiverInterpreterSystemPrompt,
    defaultUserPrompt: defaultConnectReceiverInterpreterUserPrompt,
    description:
      "Interprets open-ended receiver requests from the Something Else flow and returns structured intent data for future Connect routing.",
    historyLabel: "Connect Receiver Interpreter History",
    label: "Connect receiver request interpreter",
  },
  connect_receiver_sound_help: {
    defaultChangeNote: "Initial Connect receiver sound help prompt",
    defaultSchema: defaultConnectReceiverSoundHelpOutputSchema,
    defaultSystemPrompt: defaultConnectReceiverSoundHelpSystemPrompt,
    defaultUserPrompt: defaultConnectReceiverSoundHelpUserPrompt,
    description:
      "Generates non-destructive, device-specific sound setup instructions for Connect Receiver web/native surfaces.",
    historyLabel: "Connect Receiver Sound Help History",
    label: "Connect receiver sound help",
  },
  health_topic_extraction: {
    defaultChangeNote: "Initial Health Focus topic extraction prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You extract Health Focus topics from CarePland source text. Use only supplied data. Prefer user-friendly topics over diagnosis coding. Return structured JSON only.",
    defaultUserPrompt:
      "Use the supplied source text, appointment metadata, topic catalog, and prior user corrections. Return candidate topic mentions with confidence, status suggestion, source anchor, and related topic slugs.",
    description: "Extracts candidate Health Focus topics from saved source text.",
    historyLabel: "Health Focus History",
    label: "Health topic extraction",
  },
  health_topic_normalization: {
    defaultChangeNote: "Initial Health Focus topic normalization prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You map health-related language to CarePland standard topic slugs. Preserve user language, avoid over-medicalizing, and return structured JSON only.",
    defaultUserPrompt:
      "Use the supplied candidate topic language and topic catalog. Return normalized topic slugs and any uncertain mappings.",
    description: "Maps topic language to the standard Health Focus catalog.",
    historyLabel: "Health Focus History",
    label: "Health topic normalization",
  },
  health_topic_relationship_detection: {
    defaultChangeNote: "Initial Health Focus relationship detection prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You decide whether co-mentioned topics appear related, separate, or unclear based only on supplied CarePland source data. Avoid medical conclusions. Return structured JSON only.",
    defaultUserPrompt:
      "Use the supplied topic mentions, source snippets, appointment metadata, and user corrections. Return relationship assessments and rationale.",
    description: "Detects whether Health Focus topics appear related, separate, or unclear.",
    historyLabel: "Health Focus History",
    label: "Health topic relationship detection",
  },
  health_focus_card_summary: {
    defaultChangeNote: "Initial Health Focus card summary prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You write condensed Health Focus card summaries. The three context pills already explain recency, frequency, and span, so do not repeat those details. Target 120-160 characters, hard max 200. Choose the most important insight and stop.",
    defaultUserPrompt:
      "Use the supplied source mentions, related topics, provider context, and user corrections. Return both full_summary and condensed_summary. condensed_summary must be human, specific, and under 200 characters.",
    description: "Writes compact human-facing Health Focus card summaries.",
    historyLabel: "Health Focus History",
    label: "Health Focus card summary",
  },
  health_story_narrative_summary: {
    defaultChangeNote: "Initial Health Story narrative prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You write concise Health Story summaries from saved CarePland data. Explain the care story in human language, not a topic relationship graph. Use varied, conversational phrase patterns. Avoid repeating phrases like appears in, was discussed in, or was mentioned in. Only include statuses or relationships that are supported by the supplied data. Do not provide medical advice or diagnosis. Return structured JSON only.",
    defaultUserPrompt:
      "Use the supplied source appointments, topic mentions, context signature, related topics, timeline, and user corrections. Return a concise Health Story summary. Prefer observations over explanations, avoid exact counts or percentages unless requested, and choose the most natural relevant phrasing from care journey, context, time, and connection language.",
    description: "Writes concise plain-language Health Story summaries.",
    historyLabel: "Health Focus History",
    label: "Health Story narrative summary",
  },
  health_story_timeline_summary: {
    defaultChangeNote: "Initial Health Story timeline prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You write approximate Health Story timeline notes. Use broad timing labels and source-backed events. Avoid timestamps unless explicitly requested. Return structured JSON only.",
    defaultUserPrompt:
      "Use the supplied dated source mentions and corrections. Return timeline items using approximate date labels and source-backed event summaries.",
    description: "Summarizes Health Story timeline events.",
    historyLabel: "Health Focus History",
    label: "Health Story timeline summary",
  },
  health_story_source_snippet_selection: {
    defaultChangeNote: "Initial Health Story source snippet prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You select short source snippets that help users trust a Health Story. Prefer meaningful source text over matched-term fallbacks. Return structured JSON only.",
    defaultUserPrompt:
      "Use the supplied source text and topic focus. Return the most helpful short snippets and source anchors.",
    description: "Chooses supporting snippets for Health Story source trust.",
    historyLabel: "Health Focus History",
    label: "Health Story source snippet selection",
  },
  health_story_feedback_acknowledgement: {
    defaultChangeNote: "Initial Health Story feedback acknowledgement prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You define how CarePland acknowledges saved Health Story feedback. Reinforce that the user is improving their own story and context. Avoid promises about model learning, permanent changes, guaranteed future behavior, or retraining. Keep the tone calm, clear, brief, and human.",
    defaultUserPrompt:
      "After Health Story feedback is saved, select one approved acknowledgement phrase, summarize what the user indicated, show Undo for a limited period, and then remove the acknowledgement. Approved phrases: Thank you — your context will improve future stories. Thank you — your context improves future stories. Thank you — your context helps build better stories. Thank you — your feedback helps improve your stories. Thank you — your care history improves with this feedback. Thank you — your context helps connect future visits.",
    description:
      "Acknowledges saved Health Story feedback without implying retraining or guaranteed outcomes.",
    historyLabel: "Health Focus History",
    label: "Health Story feedback acknowledgement",
  },
  health_topic_feedback_interpretation: {
    defaultChangeNote: "Initial Health Focus feedback interpretation prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You interpret user feedback on Health Focus or Health Story output. Decide whether the user confirmed, corrected, clarified, or rejected the interpretation. Return structured JSON only.",
    defaultUserPrompt:
      "Use the system output shown to the user and the user feedback. Return feedback mode, value, relationship feedback if any, and whether it should influence future generation.",
    description: "Interprets user feedback on Health Focus and Health Stories.",
    historyLabel: "Health Focus History",
    label: "Health topic feedback interpretation",
  },
  health_topic_correction_structuring: {
    defaultChangeNote: "Initial Health Focus correction structuring prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You convert user clarification into structured care-context corrections that can influence future Health Focus, CarePrep, and reports. Use only the user correction and supplied CarePland context. Return structured JSON only.",
    defaultUserPrompt:
      "Use the user clarification and target topic/story context. Return durable structured context for future Health Focus, CarePrep, and report generation.",
    description: "Turns user clarifications into reusable care context.",
    historyLabel: "Health Focus History",
    label: "Health topic correction structuring",
  },
  health_report_generation: {
    defaultChangeNote: "Initial Health Focus report generation prompt",
    defaultSchema: {},
    defaultSystemPrompt:
      "You generate saved CarePland Health Focus reports from source-backed topic context and user corrections. Do not provide medical advice or diagnosis. Return structured JSON only.",
    defaultUserPrompt:
      "Use the supplied topic summaries, source appointments, topic mentions, user corrections, and requested report type. Return a saved-report draft with source references.",
    description: "Generates saved Health Focus reports and Health Narratives.",
    historyLabel: "Health Focus History",
    label: "Health report generation",
  },
  home_context_answer: {
    defaultChangeNote: "Initial Home context answer prompt",
    defaultSchema: homeContextDefaultSchema,
    defaultSystemPrompt: homeContextDefaultSystemPrompt,
    defaultUserPrompt: homeContextDefaultUserPrompt,
    description:
      "Answers short context questions using saved appointments, notes, CarePrep, providers, Health Focus, and the active Ask context.",
    historyLabel: "Home Context History",
    label: "Home context answer",
  },
  home_context_intent_classifier: {
    defaultChangeNote: "Initial Home context intent classifier prompt",
    defaultSchema: homeContextClassifierDefaultSchema,
    defaultSystemPrompt: homeContextClassifierDefaultSystemPrompt,
    defaultUserPrompt: homeContextClassifierDefaultUserPrompt,
    description:
      "Classifies context questions before answer generation, using the active Ask context and redirecting out-of-scope requests.",
    historyLabel: "Home Context History",
    label: "Home context intent classifier",
  },
  bulk_appointment_intake: {
    defaultChangeNote: "Initial bulk appointment intake instruction set",
    defaultSchema: defaultBulkAppointmentOutputSchema,
    description:
      "Instructions used to extract multiple appointment drafts from pasted text.",
    historyLabel: "Intake History",
    label: "Bulk appointment intake",
  },
  note_intake_interpretation: {
    defaultChangeNote: "Initial note intake instruction set",
    defaultSchema: defaultTextIntakeOutputSchema,
    description:
      "Instructions used to interpret pasted appointment notes and appointment details.",
    historyLabel: "Intake History",
    label: "Note intake interpretation",
  },
  support_assistant: {
    defaultChangeNote: "Initial support assistant instruction set",
    defaultSchema: defaultSupportAssistantOutputSchema,
    description:
      "Instructions used to answer low-risk support questions before ticket escalation.",
    historyLabel: "Support Assistant History",
    label: "Support assistant",
  },
};
