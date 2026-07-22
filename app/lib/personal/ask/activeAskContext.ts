import type { HomeContextAskContext } from "@/app/components/personal/home/HomeContextPanel";

type HomeAppointmentContext = {
  id: string;
  location_name: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string;
  title: string | null;
};

type HealthFocusTopicContext = {
  careSubjectId: string;
  displayName: string;
  topicSlug: string;
};

type HealthFocusTopicDetailContext = {
  mentions: Array<{
    appointmentId: string | null;
  }>;
};

type BuildHomeAskContextInput = {
  formatDate: (value: string | null) => string;
  homeNextAppointment: HomeAppointmentContext | null;
};

type BuildHealthFocusAskContextInput = {
  allSubjectsValue: string;
  selectedTopic: HealthFocusTopicContext | null;
  topicDetail: HealthFocusTopicDetailContext | null;
};

type BuildActiveAskContextInput = BuildHomeAskContextInput & {
  allSubjectsValue: string;
  mainTab: string;
  selectedSubjectId: string;
};

export function buildHomeAskContext({
  formatDate,
  homeNextAppointment,
}: BuildHomeAskContextInput): HomeContextAskContext {
  return {
    level: "home",
    visibleItems: homeNextAppointment
      ? [
          {
            date: homeNextAppointment.starts_at,
            id: homeNextAppointment.id,
            label:
              homeNextAppointment.title ||
              homeNextAppointment.reason ||
              "Next appointment",
            metadata: {
              date: formatDate(homeNextAppointment.starts_at),
              location: homeNextAppointment.location_name,
              provider:
                homeNextAppointment.provider_organization ||
                homeNextAppointment.provider_name,
              status: homeNextAppointment.status,
            },
            type: "appointment",
          },
        ]
      : [],
  };
}

export function buildHealthFocusAskContext({
  allSubjectsValue,
  selectedTopic,
  topicDetail,
}: BuildHealthFocusAskContextInput): HomeContextAskContext | null {
  if (!selectedTopic) {
    return null;
  }

  return {
    careSubjectId:
      selectedTopic.careSubjectId === allSubjectsValue
        ? null
        : selectedTopic.careSubjectId,
    level: "health_focus",
    sourceIds:
      topicDetail?.mentions
        .map((mention) => mention.appointmentId)
        .filter((id): id is string => Boolean(id)) ?? [],
    topicId: selectedTopic.topicSlug,
    topicName: selectedTopic.displayName,
  };
}

export function buildActiveAskContext({
  allSubjectsValue,
  formatDate,
  homeNextAppointment,
  mainTab,
  selectedSubjectId,
}: BuildActiveAskContextInput): HomeContextAskContext {
  if (mainTab === "home") {
    return buildHomeAskContext({ formatDate, homeNextAppointment });
  }

  if (selectedSubjectId && selectedSubjectId !== allSubjectsValue) {
    return {
      careSubjectId: selectedSubjectId,
      level: "global",
    };
  }

  return { level: "global" };
}

// The functions above build the *situational* context (what screen/record
// the caregiver is looking at right now) shared with /api/home-context. The
// two functions below build the outer envelope sent specifically to
// /api/ask -- account/onboarding facts the router needs that home-context
// has no reason to know about. Together they are the one place caregiver
// Ask requests get assembled on the client; a future admin, receiver, or
// support context should add a sibling builder here (e.g.
// buildAdminAskRequestContext) rather than a new inline object at a new
// call site.
type BuildAskProfileSetupContext = {
  optional_fields: string[];
  required_fields: string[];
  requires_email_update: boolean;
} | null;

type BuildAskRequestContextInput = {
  activeAskContext: HomeContextAskContext;
  hasOpenSupportTicket: boolean;
  isProfileSetup: boolean;
  profileLabel: string;
  profileSetup: BuildAskProfileSetupContext;
  signedInEmail: string | null;
};

export function buildAskRequestContext({
  activeAskContext,
  hasOpenSupportTicket,
  isProfileSetup,
  profileLabel,
  profileSetup,
  signedInEmail,
}: BuildAskRequestContextInput) {
  return {
    active_ask_context: activeAskContext,
    email: signedInEmail,
    has_open_support_ticket: hasOpenSupportTicket,
    is_profile_setup: isProfileSetup,
    profile_label: profileLabel,
    profile_setup: profileSetup,
  };
}

export function buildAskCurrentPage({
  mainTab,
  needsOnboarding,
  showWelcomeGuide,
}: {
  mainTab: string;
  needsOnboarding: boolean;
  showWelcomeGuide: boolean;
}): string {
  if (needsOnboarding) {
    return "profile_setup";
  }

  if (showWelcomeGuide) {
    return "welcome_guide";
  }

  return mainTab;
}

export function buildAskProfileSetupContext({
  requiresEmailUpdate,
}: {
  requiresEmailUpdate: boolean;
}): BuildAskProfileSetupContext {
  return {
    optional_fields: ["display name", "address line 2", "country"],
    required_fields: [
      "email",
      "first name",
      "last name",
      "phone",
      "time zone",
      "address line 1",
      "city",
      "state / region",
      "ZIP code",
    ],
    requires_email_update: requiresEmailUpdate,
  };
}
