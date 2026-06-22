export type ErrandStatus =
  | "available"
  | "assigned"
  | "completed"
  | "unable_to_complete";

export type ErrandDueDateOption =
  | {
      kind: "date";
      sourceText: string;
      dateIso: string;
      displayLabel: string;
      confidence: "high" | "medium";
    }
  | {
      kind: "date_time";
      sourceText: string;
      dateIso: string;
      timeLabel: string;
      displayLabel: string;
      confidence: "high" | "medium";
    };

export type ErrandAppointmentRelation =
  | "before"
  | "during"
  | "after"
  | "on_day"
  | "linked";

export type Errand = {
  id: string;
  careVipName: string;
  title: string;
  description: string;
  status: ErrandStatus;
  assignedMemberName?: string;
  dueLabel?: string;
  dueIntent?: ErrandDueIntent;
};

export type ErrandDueIntent =
  | {
      kind: "none";
      sourceText: "";
      displayLabel: "Open";
    }
  | ErrandDueDateOption
  | {
      kind: "contextual";
      sourceText: string;
      relation: ErrandAppointmentRelation;
      anchorId?: string;
      anchorLabel: string;
      anchorSearchText?: string;
      anchorStartsAt?: string | null;
      displayLabel: string;
      confidence: "medium";
    }
  | {
      kind: "appointment_candidate";
      sourceText: string;
      anchorId?: string;
      anchorLabel?: string;
      anchorSearchText: string;
      anchorStartsAt?: string | null;
      displayLabel: string;
      confidence: "medium";
    }
  | {
      kind: "unparsed";
      sourceText: string;
      displayLabel: string;
      confidence: "low";
    }
  | {
      kind: "ambiguous_date";
      sourceText: string;
      displayLabel: string;
      options: ErrandDueDateOption[];
      confidence: "medium";
    };

export type FamilyTaskStatus = ErrandStatus;
export type FamilyTask = Errand;

export type ErrandEventType =
  | "created"
  | "assigned"
  | "completed"
  | "released"
  | "unable_to_complete";

export type ErrandEvent = {
  id: string;
  errandId: string;
  type: ErrandEventType;
  actorName: string;
  detail: string;
  createdLabel: string;
};

export type FamilyMember = {
  id: string;
  displayName: string;
  relationshipLabel: string;
  phoneNumber?: string;
  lastActiveLabel?: string;
};

export type FamilyAppointmentOption = {
  id: string;
  title: string;
  startsAt: string | null;
  label: string;
  careSubjectName?: string | null;
  providerName?: string | null;
  providerOrganization?: string | null;
};

export type CareReport = {
  id: string;
  category: "condition" | "household" | "safety" | "supply" | "operational";
  summary: string;
  submittedByName: string;
  createdLabel: string;
};
