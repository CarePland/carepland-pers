export const defaultAudioHearingProfileStorageKey = "carepland.audio.hearingProfile.v1";

export function createAudioHearingProfile(options = {}) {
  return {
    version: 1,
    subjectId: options.subjectId || "",
    subjectName: options.subjectName || "",
    careVipName: options.careVipName || options.subjectName || "",
    receiverId: options.receiverId || "",
    summary: {
      total: 0,
      helped: 0,
      didNotHelp: 0,
      preferredPlaybackGain: Number(options.preferredPlaybackGain || 1.6),
      lastHelpfulProfile: null,
      lastUpdatedAt: "",
    },
    events: [],
  };
}

export function createAudioHearingFeedbackEvent(options = {}) {
  return {
    id: options.id || `hearing-feedback-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: options.createdAt || new Date().toISOString(),
    receiverId: options.receiverId || "",
    subjectId: options.subjectId || "",
    subjectName: options.subjectName || options.careVipName || "",
    careVipName: options.careVipName || options.subjectName || "",
    artifactId: options.artifactId || "",
    artifactKind: options.artifactKind || "",
    audioDirection: options.audioDirection || "",
    messageId: options.messageId || "",
    messageFrom: options.messageFrom || "",
    messageSource: options.messageSource || "",
    audioUrl: options.audioUrl || "",
    improved: Boolean(options.improved),
    enhancement: options.enhancement && typeof options.enhancement === "object" ? options.enhancement : {},
    audioEnhancementProfile:
      options.audioEnhancementProfile && typeof options.audioEnhancementProfile === "object"
        ? options.audioEnhancementProfile
        : null,
  };
}

export function applyAudioHearingFeedback(profile, event, options = {}) {
  const nextProfile = profile?.summary && Array.isArray(profile.events)
    ? { ...profile, summary: { ...profile.summary }, events: [...profile.events] }
    : createAudioHearingProfile(options);
  const normalizedEvent = createAudioHearingFeedbackEvent(event);
  const maxEvents = Number(options.maxEvents || 80);

  nextProfile.receiverId = nextProfile.receiverId || normalizedEvent.receiverId || options.receiverId || "";
  nextProfile.subjectId = nextProfile.subjectId || normalizedEvent.subjectId || options.subjectId || "";
  nextProfile.subjectName = nextProfile.subjectName || normalizedEvent.subjectName || options.subjectName || "";
  nextProfile.careVipName = nextProfile.careVipName || normalizedEvent.careVipName || nextProfile.subjectName || "";
  nextProfile.events.unshift(normalizedEvent);
  nextProfile.events = nextProfile.events.slice(0, maxEvents);
  nextProfile.summary.total += 1;
  if (normalizedEvent.improved) {
    nextProfile.summary.helped += 1;
    nextProfile.summary.preferredPlaybackGain =
      normalizedEvent.enhancement.playbackGain || nextProfile.summary.preferredPlaybackGain;
    nextProfile.summary.lastHelpfulProfile = normalizedEvent.audioEnhancementProfile;
  } else {
    nextProfile.summary.didNotHelp += 1;
  }
  nextProfile.summary.lastUpdatedAt = normalizedEvent.createdAt;
  return nextProfile;
}

export function loadAudioHearingProfile(options = {}) {
  const storage = options.storage || window.localStorage;
  const key = options.storageKey || defaultAudioHearingProfileStorageKey;
  try {
    const stored = JSON.parse(storage.getItem(key) || "null");
    if (stored?.summary && Array.isArray(stored.events)) {
      return stored;
    }
  } catch {
    // Fall through to a fresh profile.
  }
  return createAudioHearingProfile(options);
}

export function saveAudioHearingProfile(profile, options = {}) {
  const storage = options.storage || window.localStorage;
  const key = options.storageKey || defaultAudioHearingProfileStorageKey;
  storage.setItem(key, JSON.stringify(profile));
  return profile;
}

export async function postAudioHearingFeedback(event, options = {}) {
  const response = await fetch(absoluteApiUrl(options.baseUrl, options.path || "/audio/hearing-feedback"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Hearing feedback request failed: ${response.status}`);
  }
  return payload;
}

function absoluteApiUrl(baseUrl, pathOrUrl) {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return `${String(baseUrl || "").replace(/\/$/, "")}${pathOrUrl}`;
}
