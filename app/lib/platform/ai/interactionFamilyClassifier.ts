import type {
  InteractionFamily,
  InteractionFamilyClassification,
  MeaningFrame,
} from "./contracts";

export function classifyInteractionFamily(
  meaningFrame: MeaningFrame
): InteractionFamilyClassification {
  const text = meaningFrame.normalizedText.trim();
  const lower = text.toLowerCase();
  const family = primaryFamilyForText(lower);
  const secondaryFamilies = secondaryFamiliesForText(lower, family);

  return {
    candidateFamilies: [
      {
        confidence: confidenceForFamily(family, lower),
        kind: family,
      },
      ...secondaryFamilies.map((secondaryFamily) => ({
        confidence: 0.52,
        kind: secondaryFamily,
        rejectionReason: "Secondary human purpose; primary family selected for current Receiver response.",
      })),
    ],
    confidence: confidenceForFamily(family, lower),
    family,
    meaningFrame,
    requiresClarification: !text,
    secondaryFamilies,
  };
}

function primaryFamilyForText(text: string): InteractionFamily {
  if (!text) return "unclear";

  if (isContextualResponse(text)) return "contextual_response";

  if (
    /\b(fell|fallen|can't get up|cannot get up|can't breathe|cannot breathe|hard to breathe|breathe well|trouble breathing|need help now|right away|chest hurts|something is wrong)\b/.test(
      text
    )
  ) {
    return "escalate";
  }

  if (
    /^(should|should i|do i need to|which)\b/.test(text) ||
    /\b(help me choose|is this important|is this bad)\b/.test(text)
  ) {
    return "decide";
  }

  if (
    /^(tell|message|send|let|ask)\b/.test(text) ||
    /\b(?:i\s+need\s+to|need\s+to|want\s+to)\s+(?:talk\s+to|tell|message|send|call|phone)\b/.test(text) ||
    /\b(?:daughter|son|sister|brother|mom|mother|dad|father|caregiver|doctor|nurse|family|someone|somebody)\s+(?:ought\s+to|needs?|should)\s+(?:to\s+)?(?:hear|know|be told|call|phone|tell|message|let)\b/.test(text) ||
    /\b(?:needs?|should|ought\s+to)\s+(?:to\s+)?(?:hear|know|be told|call|phone|tell|message|let)\b/.test(text) ||
    /\b(call|phone)\s+[a-z]/.test(text)
  ) {
    return "communicate";
  }

  if (
    /\b(remind me|reminder|don't let me forget|do not let me forget|help me remember|remember later)\b/.test(
      text
    )
  ) {
    return "remind";
  }

  if (/^(can|could)\s+(somebody|someone|anyone)\s+help\s+me\b/.test(text)) {
    return "need";
  }

  if (/\b(what is this|read this|this letter|this bill|this form|this bottle|this document|this photo)\b/.test(text)) {
    return "discover";
  }

  if (/^(help me get ready|help me prepare|make a list|help me plan)\b/.test(text)) {
    return "plan";
  }

  if (/^i forgot\.?$/.test(text)) {
    return "unclear";
  }

  if (
    /^(when|what|who|where|why|how|did|do|does|can|could|is|are|has|have)\b/.test(text) ||
    text.endsWith("?")
  ) {
    return "ask";
  }

  if (/\b(i need|we need|need milk|out of|almost out of|need someone|need help with|pick up|picked up)\b/.test(text)) {
    return "need";
  }

  if (/\b(worried|lonely|frustrated|confused|nervous|scared|don't like|do not like)\b/.test(text)) {
    return "express";
  }

  if (
    /\b(went|walk|walked|walking|weighed|weight|took|missed|slept|felt|feel|hurts|hurt|pain|dizzy|called|forgot)\b/.test(
      text
    )
  ) {
    return "observe";
  }

  return "unclear";
}

function secondaryFamiliesForText(
  text: string,
  primaryFamily: InteractionFamily
): InteractionFamily[] {
  const secondary = new Set<InteractionFamily>();

  if (
    primaryFamily !== "remind" &&
    primaryFamily !== "communicate" &&
    !/^what should i ask\b/.test(text) &&
    /\b(tell|message|send|call|phone|ask|talk to|hear this|know this)\b/.test(text)
  ) {
    secondary.add("communicate");
  }
  if (
    primaryFamily !== "need" &&
    /\b(i need|we need|out of|almost out of|forgot (?:my |the |their |his |her )?(?:medicine|medication|meds|pills?))\b/.test(text)
  ) {
    secondary.add("need");
  }
  if (primaryFamily !== "observe" && /\b(hurts|hurt|pain|dizzy|felt|feel|went|walked|took|missed|forgot)\b/.test(text)) {
    secondary.add("observe");
  }
  if (primaryFamily !== "express" && /\b(worried|lonely|frustrated|confused|nervous|scared|dizzy)\b/.test(text)) {
    secondary.add("express");
  }
  if (
    primaryFamily !== "escalate" &&
    /\b(fell|fallen|can't get up|cannot get up|can't breathe|cannot breathe|hard to breathe|breathe well|trouble breathing|need help now|right away|chest hurts)\b/.test(text)
  ) {
    secondary.add("escalate");
  }

  return [...secondary].slice(0, 3);
}

function confidenceForFamily(family: InteractionFamily, text: string) {
  if (!text) return 0;
  if (family === "unclear") return 0.25;
  if (family === "contextual_response") return 0.92;
  if (family === "ask" && (text.endsWith("?") || /^(when|what|who|where|why|how)\b/.test(text))) {
    return 0.9;
  }
  if (family === "communicate" || family === "remind" || family === "need") {
    return 0.88;
  }
  if (family === "observe" || family === "discover" || family === "escalate") {
    return 0.82;
  }
  return 0.74;
}

function isContextualResponse(text: string) {
  const normalized = text.trim().replace(/[.?!]+$/g, "").trim();
  return /^(yes|yeah|yep|sure|no|nope|maybe|that'?s right|that is right|that’s right|that'?s not right|that is not right|that’s not right|that'?s the one|that is the one|that’s the one|not that one|close enough|not quite|try again|never mind|nevermind|i changed my mind|the other one|that wasn'?t what i meant|that was not what i meant)$/i.test(
    normalized
  );
}
