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
