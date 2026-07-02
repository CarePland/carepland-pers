export type ReceiverContextualPromptOption = {
  label: string;
  value: string;
};

export const receiverContextualPromptCandidateAreas = [
  "timing",
  "visibility",
  "wording",
  "interaction_friction",
  "notification_frequency",
  "dismissal_behavior",
] as const;

export type ReceiverContextualPromptCandidateArea =
  (typeof receiverContextualPromptCandidateAreas)[number];

export type ReceiverContextualPrompt = {
  candidateArea: ReceiverContextualPromptCandidateArea;
  constraints: {
    askOnlyOneQuestion: true;
    directlyRelatedToRecentExperience: true;
    easyToDismiss: true;
    infrequent: true;
    neverInterruptUrgentWorkflows: true;
  };
  futureTrigger: string;
  id: string;
  intendedUse: string;
  options: ReceiverContextualPromptOption[];
  question: string;
  status: "cataloged_future_trigger" | "active";
  surface: "connect_receiver";
  topic: string;
};

export const receiverContextualPromptCatalog = {
  todays_focus_undo_duration: {
    candidateArea: "timing",
    constraints: {
      askOnlyOneQuestion: true,
      directlyRelatedToRecentExperience: true,
      easyToDismiss: true,
      infrequent: true,
      neverInterruptUrgentWorkflows: true,
    },
    futureTrigger:
      "After a Receiver user completes Today's Focus items several times, occasionally ask after a related Focus interaction. Do not show immediately after every completion.",
    id: "todays_focus_undo_duration",
    intendedUse:
      "Tune the shared Receiver undo duration, currently controlled by Dynamic Text key connect_receiver_undo_seconds.",
    options: [
      { label: "Not enough time", value: "not_enough_time" },
      { label: "About right", value: "about_right" },
      { label: "Too much time", value: "too_much_time" },
    ],
    question:
      "When you want to undo completing a Today's Focus item, do you feel CarePland gives you enough time?",
    status: "cataloged_future_trigger",
    surface: "connect_receiver",
    topic: "todays_focus_undo",
  },
} as const satisfies Record<string, ReceiverContextualPrompt>;

export type ReceiverContextualPromptId =
  keyof typeof receiverContextualPromptCatalog;

export function receiverContextualPromptById(
  id: string
): ReceiverContextualPrompt | null {
  return id in receiverContextualPromptCatalog
    ? receiverContextualPromptCatalog[id as ReceiverContextualPromptId]
    : null;
}

export function listReceiverContextualPrompts() {
  return Object.values(receiverContextualPromptCatalog);
}
