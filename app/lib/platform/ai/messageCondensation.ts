export type MessageCondensationInput = {
  maxLength: number;
  transcript: string;
};

export type MessageCondensationResult = {
  draft: string;
  method: "deterministic_receiver_speech_v1";
  originalLength: number;
  wasCondensed: boolean;
};

const discoursePrefixes = [
  /^and\s+/i,
  /^um[, ]+/i,
  /^uh[, ]+/i,
  /^please\s+/i,
  /^i\s+(?:just\s+)?(?:want|wanted)\s+(?:you\s+)?to\s+(?:know|say|tell)\s+(?:that\s+)?/i,
  /^(?:can|could)\s+you\s+(?:please\s+)?(?:tell|let)\s+[^,]+?\s+(?:that\s+)?/i,
];

export function condenseReceiverSpeechMessage({
  maxLength,
  transcript,
}: MessageCondensationInput): MessageCondensationResult {
  const normalized = normalizeMessageText(transcript);
  const originalLength = normalized.length;
  const safeMaxLength = Math.max(20, maxLength);
  if (!normalized || normalized.length <= safeMaxLength) {
    return {
      draft: normalized,
      method: "deterministic_receiver_speech_v1",
      originalLength,
      wasCondensed: false,
    };
  }

  const structuredDraft = buildStructuredReceiverMessageDraft(
    normalized,
    safeMaxLength
  );
  if (structuredDraft) {
    return {
      draft: structuredDraft,
      method: "deterministic_receiver_speech_v1",
      originalLength,
      wasCondensed: structuredDraft !== normalized,
    };
  }

  const compressed = normalizeMessageText(
    compressCommonSpeechPhrases(
      selectMeaningfulSentences(normalized)
        .map(cleanSpeechSentence)
        .filter(Boolean)
        .join(" ")
    )
  );
  const draft = truncateAtWordBoundary(
    fitImportantClauses(compressed, safeMaxLength),
    safeMaxLength
  );

  return {
    draft,
    method: "deterministic_receiver_speech_v1",
    originalLength,
    wasCondensed: draft !== normalized,
  };
}

function normalizeMessageText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function buildStructuredReceiverMessageDraft(text: string, maxLength: number) {
  return (
    buildAppointmentPreparationDraft(text, maxLength) ||
    buildShoppingOrSupplyDraft(text, maxLength) ||
    buildHealthConcernDraft(text, maxLength)
  );
}

function buildAppointmentPreparationDraft(text: string, maxLength: number) {
  const lower = text.toLowerCase();
  if (!/\b(?:appointment|doctor|dr\.?|visit)\b/.test(lower)) return "";
  if (!/\b(?:bring|prepare|get ready|get together|things together|coming up|before|need|make sure)\b/.test(lower)) return "";

  const explicitPrepItems = extractAppointmentPreparationItems(text);
  const spokenListItems = extractListAfter(text, [
    /\bmake sure (?:we |i )?bring\s+(.+?)(?:\band maybe\b|\bmaybe\b|\bbefore\b|$)/i,
    /\bmake sure (?:we |i )?(?:have|take|get|remember)\s+(.+?)(?:\band maybe\b|\bmaybe\b|\bbefore\b|$)/i,
    /\b(?:we|i)\s+need\s+to\s+bring\s+(.+?)(?:\band maybe\b|\bmaybe\b|\bbefore\b|$)/i,
    /\b(?:we|i)\s+(?:need|have)\s+to\s+(?:get|take|have|remember)\s+(.+?)(?:\band maybe\b|\bmaybe\b|\bbefore\b|$)/i,
    /\bbring\s+(.+?)(?:\band maybe\b|\bmaybe\b|\bbefore\b|$)/i,
  ]);
  const items = uniqueCondensedItems([...explicitPrepItems, ...spokenListItems]);
  const supportRequest = extractSupportRequest(text);
  const topic = lower.includes("doctor") || lower.includes("dr.")
    ? "doctor appointment"
    : "appointment";
  if (!items.length && /\b(?:things|stuff|everything)\b.*\b(?:together|ready|make sure)\b/i.test(text)) {
    return fitDraftSentences([`Prepare for the ${topic}.`], maxLength);
  }
  if (items.length) {
    const bringDraft = buildAppointmentBringDraft(topic, items, maxLength);
    if (bringDraft) return bringDraft;
  }
  const candidates = [
    `Prepare for the ${topic}.`,
  ];
  if (supportRequest) candidates.push(supportRequest);

  return fitDraftSentences(candidates, maxLength);
}

function buildAppointmentBringDraft(topic: string, items: string[], maxLength: number) {
  const compactItems = uniqueCondensedItems(items.map(normalizeAppointmentPreparationItem));
  const topics = uniqueCondensedItems([topic, "appointment"]);
  for (let count = compactItems.length; count >= 1; count -= 1) {
    for (const candidateTopic of topics) {
      const candidate = ensureSentenceEnding(
        `For the ${candidateTopic}, bring ${formatList(compactItems.slice(0, count))}`
      );
      if (candidate.length <= maxLength) return candidate;
    }
  }
  return "";
}

function normalizeAppointmentPreparationItem(value: string) {
  const normalized = normalizeMessageText(value)
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\b(?:we|i)\s+(?:have|need)\s+to\s+/i, "")
    .replace(/\b(?:have|take|get|remember|make)\s+/i, "")
    .replace(/[,.!?;:]+$/g, "")
    .trim();
  const lower = normalized.toLowerCase();
  if (/\b(?:medication list|medicine list|med list|list of (?:my |the |all )?(?:medications|medicines|meds)|prescription (?:medications|medicines|meds)|rx (?:medications|medicines|meds))\b/.test(lower)) {
    return "med list";
  }
  if (/\b(?:non[-\s]?rx|non[-\s]?prescription|over[-\s]?the[-\s]?counter|otc)\s+(?:medications|medicines|meds|medicine)\b/.test(lower)) {
    return "OTC meds";
  }
  if (/\b(?:blood sugar|glucose)\s+(?:sensor|monitor|meter)\b/.test(lower)) {
    return "blood sugar sensor";
  }
  if (/\b(?:exercise|activity|walking)\s+(?:log|journal|record|tracker)\b/.test(lower)) {
    return "exercise log";
  }
  return normalized;
}

function extractAppointmentPreparationItems(text: string) {
  const lower = text.toLowerCase();
  const items: string[] = [];
  if (/\b(?:insurance card|insurance cards)\b/.test(lower)) items.push("insurance card");
  if (/\b(?:medication list|medicine list|med list|list of (?:my |the |all )?(?:medications|medicines|meds)|prescription (?:medications|medicines|meds)|rx (?:medications|medicines|meds))\b/.test(lower)) {
    items.push("med list");
  }
  if (/\b(?:non[-\s]?rx|non[-\s]?prescription|over[-\s]?the[-\s]?counter|otc)\s+(?:medications|medicines|meds|medicine)\b/.test(lower)) {
    items.push("OTC meds");
  }
  if (/\b(?:blood sugar|glucose)\s+(?:sensor|monitor|meter)\b/.test(lower)) {
    items.push("blood sugar sensor");
  }
  if (/\b(?:exercise|activity|walking)\s+(?:log|journal|record|tracker)\b/.test(lower)) {
    items.push("exercise log");
  }
  if (/\bhearing aids?\b/.test(lower)) items.push("hearing aids");
  return items;
}

function buildShoppingOrSupplyDraft(text: string, maxLength: number) {
  const lower = text.toLowerCase();
  if (!/\b(?:store|grocery|groceries|milk|bread|supplies|pick up|running low|out of)\b/.test(lower)) {
    return "";
  }
  const lowItems = extractListAfter(text, [
    /\b(?:running low on|almost out of|out of|need)\s+(.+?)(?:\bbefore\b|\btomorrow\b|$)/i,
  ]);
  const candidates = [
    lowItems.length
      ? `We need to stop by the store. Running low on ${formatList(lowItems)}.`
      : "We need to stop by the store.",
  ];
  return fitDraftSentences(candidates, maxLength);
}

function buildHealthConcernDraft(text: string, maxLength: number) {
  const lower = text.toLowerCase();
  const concernMatches = text.match(
    /\b(?:dizzy|pain|hurt|hurts|sick|fell|fall|breath|breathing|medicine|medication|pill|prescription)\b[^.!?]*/gi
  );
  if (!concernMatches?.length || !/\b(?:dizzy|pain|hurt|hurts|sick|fell|fall|breath|breathing|medicine|medication|pill|prescription)\b/.test(lower)) {
    return "";
  }
  const concern = normalizeMessageText(concernMatches.slice(0, 2).join(" and "));
  return truncateAtWordBoundary(`Health concern: ${concern}.`, maxLength);
}

function extractListAfter(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const listText = match[1]
      .replace(/\b(?:and\s+)?(?:maybe\s+)?ask\s+[A-Z]?[a-z]+\s+.*$/i, "")
      .replace(/\b(?:and\s+)?(?:make sure|remember)\s+.*$/i, "");
    const items = splitListItems(listText);
    if (items.length) return items;
  }
  return [];
}

function splitListItems(value: string) {
  return value
    .replace(/\b(?:the|a|an)\s+/gi, "")
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((item) =>
      item
        .replace(/^(?:and|also|then|maybe)\s+/i, "")
        .replace(/[,.!?;:]+$/g, "")
        .trim()
    )
    .filter((item) => !isGenericPreparationItem(item))
    .filter((item) => item.length > 1)
    .slice(0, 4);
}

function uniqueCondensedItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isGenericPreparationItem(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  return /^(?:(?:quite|a|few|some|more)\s+)*(?:things|stuff|everything)(?:\s+(?:together|ready|we have to make|we need to make|to make))?$/.test(normalized);
}

function extractSupportRequest(text: string) {
  const match = text.match(/\bask\s+([A-Z][a-z]+)\s+to\s+help\s+(.+?)(?:[.!?]|$)/);
  if (!match?.[1]) return "";
  const action = normalizeMessageText(match[2] || "get ready").replace(/[,.!?;:]+$/g, "");
  return `Ask ${match[1]} to help ${action}.`;
}

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function fitDraftSentences(sentences: string[], maxLength: number) {
  const normalized = sentences.map(normalizeMessageText).filter(Boolean);
  while (normalized.length) {
    const candidate = normalizeMessageText(normalized.join(" "));
    if (candidate.length <= maxLength) return ensureSentenceEnding(candidate);
    normalized.pop();
  }
  return "";
}

function selectMeaningfulSentences(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+|\s+(?=(?:and|but|also|then)\s+(?:we|i|he|she|they|there|the)\b)/i)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return sentences;

  const scored = sentences.map((sentence, index) => ({
    index,
    score: sentenceImportanceScore(sentence, index),
    sentence,
  }));
  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
}

function sentenceImportanceScore(sentence: string, index: number) {
  const lower = sentence.toLowerCase();
  let score = index === 0 ? 3 : 0;
  if (/\b(?:need|needs|needed|running low|out of|almost out|pick up|bring|take|call|tell|send|remind)\b/.test(lower)) {
    score += 5;
  }
  if (/\b(?:doctor|appointment|medicine|medication|pill|prescription|pain|hurt|dizzy|sick|fell|fall|breath|breathing)\b/.test(lower)) {
    score += 5;
  }
  if (/\b(?:today|tomorrow|tonight|morning|afternoon|evening|later|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/.test(lower)) {
    score += 3;
  }
  if (/\b[A-Z][a-z]+\b/.test(sentence)) {
    score += 2;
  }
  return score;
}

function cleanSpeechSentence(sentence: string) {
  let cleaned = sentence.trim();
  discoursePrefixes.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "");
  });
  return capitalizeSentence(cleaned.replace(/[,.!?;:]+$/g, ""));
}

function compressCommonSpeechPhrases(text: string) {
  return text
    .replace(/\bwe(?:'re| are)\s+going\s+to\s+have\s+to\s+go\s+to\b/gi, "we need to go to")
    .replace(/\bwe(?:'re| are)\s+going\s+to\s+have\s+to\b/gi, "we need to")
    .replace(/\bi(?:'m| am)\s+going\s+to\s+have\s+to\b/gi, "I need to")
    .replace(/\bpick\s+up\s+a\s+few\s+more\s+things\b/gi, "pick up a few things")
    .replace(/\bpick\s+up\s+a\s+few\s+things\b/gi, "pick up")
    .replace(/\bbecause\s+we(?:'re| are)\s+almost\s+out\s+of\b/gi, "We are running low on")
    .replace(/\bwe(?:'re| are)\s+almost\s+out\s+of\b/gi, "We are running low on")
    .replace(/\bWe are running low on\b/g, "Need")
    .replace(/\bi\s+want\s+you\s+to\s+know\s+that\s+/gi, "");
}

function truncateAtWordBoundary(text: string, maxLength: number) {
  if (text.length <= maxLength) return ensureSentenceEnding(text);
  const slice = text.slice(0, maxLength + 1);
  const boundary = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("; "),
    slice.lastIndexOf(", "),
    slice.lastIndexOf(" ")
  );
  const end = boundary >= Math.floor(maxLength * 0.65) ? boundary : maxLength;
  return ensureSentenceEnding(text.slice(0, end).trim());
}

function fitImportantClauses(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  const clauses = text
    .split(/(?<=[.!?])\s+|\s+(?=(?:and|but|also|then)\s+(?:i|we|he|she|they|there|the|my)\b)/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  if (clauses.length <= 1) return text;

  const selected = clauses
    .map((clause, index) => ({
      clause: cleanSpeechSentence(clause),
      index,
      score: sentenceImportanceScore(clause, index),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .sort((left, right) => left.index - right.index);

  while (selected.length > 1) {
    const candidate = normalizeMessageText(selected.map((item) => item.clause).join(" "));
    if (candidate.length <= maxLength) return candidate;
    selected.sort((left, right) => left.score - right.score || right.index - left.index).shift();
    selected.sort((left, right) => left.index - right.index);
  }

  return normalizeMessageText(selected[0]?.clause || text);
}

function capitalizeSentence(text: string) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ensureSentenceEnding(text: string) {
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
