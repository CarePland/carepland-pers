import {
  planFeatureContentDefaults,
  planProfilePanelContentKey,
  pricingTiers,
} from "../entitlements/pricingTiers";

export const appContentDefaults = {
  beta_disclaimer_ack:
    "I understand this Early Access version is not for emergencies or critical medical decisions.",
  beta_notice_intro:
    "CarePland Personal is currently available through Early Access. Formal Terms of Service and Privacy Policy pages are not enabled yet.",
  beta_privacy_ack:
    "I understand formal Privacy Policy review is not currently enabled for this Early Access version.",
  beta_terms_ack:
    "I understand formal Terms of Service are not currently enabled for this Early Access version.",
  demo_profile_add_body:
    "Add a few fictional appointments, notes, and CarePrep examples if you want a guided workspace to explore.",
  demo_profile_remove_body:
    "Demo appointments are not real appointments. Removing demo data deletes only items marked as demo data and keeps your real information.",
  demo_prompt_body:
    "CarePland can add a few fictional appointments, notes, and CarePrep examples so you can explore before entering your own information.",
  demo_prompt_title: "Want examples to explore?",
  ...planFeatureContentDefaults,
  careprep_manual_limit_message:
    "You have used this month's manual CarePrep generations. Plan changes are not wired up yet, but support can help while account changes are still handled manually.",
  careprep_refresh_not_ready_message:
    "CarePrep is already up to date for this appointment. Add or save new Visit Notes, then try again.",
  careprep_auto_success_message:
    "CarePrep generated for {appointmentTitle}.",
  connect_receiver_undo_seconds: "5",
  health_focus_context_frequency_labels:
    "Once = Once\nA Few Times = A Few Times;Few\nOccasionally = Occasionally\nFairly Often = Fairly Often;Often\nFrequent = Frequent\nMost Visits = Most Visits;Most",
  health_focus_context_recency_labels:
    "No Date = No Date;None\nToday = Today\nYesterday = Yesterday\nPast Few Days = Past Few Days;Few Days\nThis Week = This Week\nThis Month = This Month\nLast Month = Last Month\nEarlier This Year = Earlier This Year;This Year\nLast Year = Last Year\nBefore Last Year = Before Last Year;Older",
  health_focus_context_span_labels:
    "One Visit = One Visit\nSeveral Weeks = Several Weeks;Weeks\nSeveral Months = Several Months;Months\nAbout a Year = About a Year;Year\nMultiple Years = Multiple Years;Years",
  ask_guidance_message:
    "Questions, ideas, help, feedback, or general appointment info -- ask away.",
  ask_input_placeholder: "What's on your mind?",
  ask_acknowledgement_message:
    "Thank you for taking the time to ask us. We do review every request!",
  ask_duplicate_message:
    "Thanks — we got your question!",
  support_contact_note:
    "Need help or want to report an issue? Contact support from the app and include what you were trying to do.",
  support_reply_email_body:
    "You've got a response to your CarePland question. Please log in to review it.\n\n{appUrl}",
  support_reply_email_subject:
    "You have a response to your CarePland question",
  support_missing_feedback_prompt: "What was missing?",
  support_agent_escalation_guidance:
    "Escalate bugs, account access issues, data loss, billing/privacy/security concerns, emergency or medical advice requests, data-changing requests, unclear issues, and frustrated users.",
  support_agent_known_limitations:
    "Calendar sync is not live yet. SMS/text notifications are not live yet. Favorite location management is basic. Google Places autocomplete can be temporarily unavailable if quota or key restrictions block requests. Self-service billing and plan changes are not wired up yet; plan questions or account-specific tier issues should be escalated to support.",
  support_agent_product_facts:
    "CarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. Users can add appointments manually, import appointments from pasted text, images, and .ics calendar files, search Google Places for clinics/businesses/addresses, save favorite locations with nicknames, generate CarePrep for upcoming appointments, add notes to logged appointments, and ask questions in the app. New users complete profile basics, Early Access acknowledgements, Care Circle setup, and a Home welcome guide before regular app use. Early Access currently gives early adopters full access, including multiple Care VIPs and automatic appointment preparation where available. Manual CarePrep generation can be metered by plan; automatic appointment preparation is intended for Premium Individual, Group, and Early Access tiers. After Visit Notes are saved, CarePland can automatically prepare the next upcoming appointment for the same Care VIP when the plan includes automatic CarePrep. CarePrep refresh is only available when there are additional appointments to consider.",
  support_agent_voice_guidance:
    "Use a warm, steady, and practical tone. Be empathetic without pretending intimacy, supportive without being syrupy, and clear about limits without sounding cold. Be confident on app guidance, humble on care-related questions, and never corporate-deflective or fake-cheerful when a user is frustrated.",
  welcome_guide_body:
    "Help is always available in the upper right [?].",
  welcome_guide_title: "Welcome to CarePland",
};

export const appContentOptions = [
  {
    category: "beta",
    contentKey: "beta_notice_intro",
    description: "Introductory text shown before Early Access acknowledgement checkboxes.",
    label: "Early Access notice intro",
  },
  {
    category: "beta",
    contentKey: "beta_terms_ack",
    description: "Checkbox text confirming Terms of Service status during Early Access.",
    label: "Early Access terms acknowledgement",
  },
  {
    category: "beta",
    contentKey: "beta_privacy_ack",
    description: "Checkbox text confirming Privacy Policy status during Early Access.",
    label: "Early Access privacy acknowledgement",
  },
  {
    category: "beta",
    contentKey: "beta_disclaimer_ack",
    description: "Checkbox text confirming Early Access safety limitations.",
    label: "Early Access safety acknowledgement",
  },
  {
    category: "support",
    contentKey: "support_contact_note",
    description: "General support context for Early Access users.",
    label: "Support contact note",
  },
  {
    category: "support",
    contentKey: "support_missing_feedback_prompt",
    description:
      "Optional prompt shown after a support assistant answer is marked not helpful.",
    label: "Support assistant missing-feedback prompt",
  },
  {
    category: "ai",
    contentKey: "support_agent_product_facts",
    description:
      "Current product facts injected into the support assistant knowledge context.",
    label: "Agent product facts",
  },
  {
    category: "ai",
    contentKey: "support_agent_known_limitations",
    description:
      "Known limitations injected into the support assistant knowledge context.",
    label: "Agent known limitations",
  },
  {
    category: "ai",
    contentKey: "support_agent_escalation_guidance",
    description:
      "Escalation rules injected into the support assistant knowledge context.",
    label: "Agent escalation guidance",
  },
  {
    category: "ai",
    contentKey: "support_agent_voice_guidance",
    description:
      "Tone guidance injected into the support assistant knowledge context.",
    label: "Agent voice guidance",
  },
  {
    category: "communications",
    contentKey: "support_reply_email_subject",
    description:
      "Subject line for the generic email sent after an admin replies to a support question.",
    label: "Support reply email subject",
  },
  {
    category: "communications",
    contentKey: "support_reply_email_body",
    description:
      "Body text for the generic support reply notification. Supported placeholders: {appUrl}, {recipientName}.",
    label: "Support reply email body",
  },
  {
    category: "onboarding",
    contentKey: "welcome_guide_title",
    description: "Headline for the first-run welcome card on the appointments screen.",
    label: "Welcome guide title",
  },
  {
    category: "onboarding",
    contentKey: "welcome_guide_body",
    description: "Introductory guidance shown in the first-run welcome card.",
    label: "Welcome guide body",
  },
  {
    category: "onboarding",
    contentKey: "demo_prompt_title",
    description: "Headline for the first-run demo data offer.",
    label: "Demo data prompt title",
  },
  {
    category: "onboarding",
    contentKey: "demo_prompt_body",
    description: "Body text explaining the first-run demo data offer.",
    label: "Demo data prompt body",
  },
  {
    category: "onboarding",
    contentKey: "demo_profile_remove_body",
    description: "Profile page explanation shown before removing demo data.",
    label: "Demo data removal note",
  },
  {
    category: "onboarding",
    contentKey: "demo_profile_add_body",
    description: "Profile page explanation shown before adding demo data.",
    label: "Demo data add note",
  },
  ...pricingTiers.map((tier) => ({
    category: "plans",
    contentKey: planProfilePanelContentKey(tier.id),
    description:
      "Whole editable block shown in the Profile plan helper. First line is the brief summary; following lines may use Label: value.",
    label: `${tier.name}: Profile plan panel`,
  })),
  {
    category: "messages",
    contentKey: "ask_guidance_message",
    description:
      "Guidance text shown at the top of the Ask panel before a user sends a message.",
    label: "Ask guidance message",
  },
  {
    category: "messages",
    contentKey: "ask_input_placeholder",
    description: "Placeholder text shown in the Ask panel message field.",
    label: "Ask input placeholder",
  },
  {
    category: "messages",
    contentKey: "ask_acknowledgement_message",
    description:
      "Message shown after an Ask conversation has been accepted for review.",
    label: "Ask acknowledgement message",
  },
  {
    category: "messages",
    contentKey: "ask_duplicate_message",
    description:
      "Message shown when a user tries to submit the same Ask message more than once.",
    label: "Ask duplicate message",
  },
  {
    category: "messages",
    contentKey: "careprep_manual_limit_message",
    description:
      "Message shown when a user has used the current plan allowance for manual CarePrep generations.",
    label: "Manual CarePrep limit message",
  },
  {
    category: "messages",
    contentKey: "careprep_refresh_not_ready_message",
    description:
      "Message shown when a user tries to refresh CarePrep before new appointment history is available.",
    label: "CarePrep refresh not-ready message",
  },
  {
    category: "messages",
    contentKey: "careprep_auto_success_message",
    description:
      "Expiring blue status shown after automatic CarePrep prepares an appointment. Supported placeholder: {appointmentTitle}.",
    label: "Automatic CarePrep success message",
  },
  {
    category: "connect",
    contentKey: "connect_receiver_undo_seconds",
    description:
      "Number of seconds the Receiver shows Undo after a reversible action. Enter a number, such as 10.",
    label: "Receiver undo seconds",
  },
  {
    category: "health_focus",
    contentKey: "health_focus_context_recency_labels",
    description:
      "Display labels for Health Focus recency pills. Format each line as: canonical = label_full;label_short.",
    label: "Context pill labels: Recency",
  },
  {
    category: "health_focus",
    contentKey: "health_focus_context_frequency_labels",
    description:
      "Display labels for Health Focus frequency pills. Format each line as: canonical = label_full;label_short.",
    label: "Context pill labels: Frequency",
  },
  {
    category: "health_focus",
    contentKey: "health_focus_context_span_labels",
    description:
      "Display labels for Health Focus span pills. Format each line as: canonical = label_full;label_short.",
    label: "Context pill labels: Span",
  },
];

export const appContentCategories = [
  {
    description: "Testing notices, temporary legal acknowledgements, and safety language.",
    key: "beta",
    label: "Early Access and legal",
  },
  {
    description: "Support guidance and help text shown to users.",
    key: "support",
    label: "Support",
  },
  {
    description: "Product facts and guardrails injected into AI assistant context.",
    key: "ai",
    label: "AI Agent",
  },
  {
    description:
      "Email and notification wording that invites users back into the app.",
    key: "communications",
    label: "Communications",
  },
  {
    description: "First-run guidance, demo data prompts, and welcome copy.",
    key: "onboarding",
    label: "Onboarding",
  },
  {
    description: "Plan feature wording shown in Profile and future billing surfaces.",
    key: "plans",
    label: "Plans",
  },
  {
    description: "Short status, success, warning, and validation messages.",
    key: "messages",
    label: "Messages",
  },
  {
    description:
      "Editable labels and user-facing text for Health Focus and Health Story.",
    key: "health_focus",
    label: "Health Focus",
  },
  {
    description: "Connect Receiver behavior and user-facing timing controls.",
    key: "connect",
    label: "Connect / Receiver",
  },
] as const;
