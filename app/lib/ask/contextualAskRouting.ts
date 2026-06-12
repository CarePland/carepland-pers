import type { HomeContextAskContext } from "@/app/components/HomeContextPanel";

const careContextTerms =
  /\b(appointment|appointments|appt|appts|visit|visits|doctor|provider|clinic|careprep|notes?|follow-?up|prepare|bring|health focus|story|topic|timeline|source|sources|related|separate|changed|recent|recently|coming up|next|past|history|blood pressure|bp|physical therapy|pt|therapy|pain|dental|dentist|vision|eye|vet|veterinary|lab|labs|imaging|medication|medicine)\b/i;

const supportTerms =
  /\b(bug|broken|problem with the app|feature request|wishlist|feedback about the app|support|help using|how do i use|sign in|login|password|account|billing|privacy|terms|delete my account|contact support)\b/i;

const contextualReferenceTerms =
  /\b(this|that|these|it|here|showing up|why|what changed|related|separate|summarize|explain|remember)\b/i;

export function shouldRouteTopAskToCareContext({
  askContext,
  message,
}: {
  askContext: HomeContextAskContext;
  message: string;
}) {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return false;
  }

  if (supportTerms.test(trimmedMessage)) {
    return false;
  }

  if (askContext.level === "health_focus") {
    return true;
  }

  if (askContext.level === "appointment" || askContext.level === "careprep") {
    return true;
  }

  if (askContext.level === "visit_note") {
    return true;
  }

  if (careContextTerms.test(trimmedMessage)) {
    return true;
  }

  if (
    askContext.level === "home" &&
    (askContext.visibleItems?.length ?? 0) > 0 &&
    contextualReferenceTerms.test(trimmedMessage)
  ) {
    return true;
  }

  return false;
}
