"use client";

import { FormEvent, useEffect, useId, useState } from "react";

export type HomeContextLevel =
  | "appointment"
  | "careprep"
  | "global"
  | "home"
  | "health_focus"
  | "visit_note";

export type HomeContextVisibleItem = {
  date?: string | null;
  id?: string | null;
  label: string;
  metadata?: Record<string, string | null | undefined>;
  type: "appointment" | "careprep" | "health_focus" | "provider" | "visit_note";
};

export type HomeContextAskContext = {
  appointmentId?: string | null;
  careprepId?: string | null;
  careSubjectId?: string | null;
  level: HomeContextLevel;
  noteId?: string | null;
  sourceIds?: string[];
  topicId?: string | null;
  topicName?: string | null;
  visibleItems?: HomeContextVisibleItem[];
};

const defaultAskContext: HomeContextAskContext = {
  level: "global",
};

const globalExamplePrompts = [
  "What follow-ups might still need attention?",
  "What has changed recently?",
  "What seems most important right now?",
  "What appointments are coming up?",
  "What should I prepare for next?",
  "Which providers have I seen most?",
  "What seems unresolved?",
  "What should I remember from recent visits?",
];

const healthFocusExamplePrompts = [
  "Summarize this story",
  "Why is this showing up?",
  "What providers discussed this?",
  "What changed recently?",
  "What follow-ups are related?",
  "What appointments mention this?",
  "How does this connect to other topics?",
  "What should I remember about this?",
];

const appointmentExamplePrompts = [
  "What should I remember from this visit?",
  "What follow-ups came from this?",
  "How does this connect to other visits?",
  "What should I bring up next time?",
  "What changed before this visit?",
  "What should I prepare next?",
];

const documentExamplePrompts = [
  "Explain this in plain language",
  "What are the main takeaways?",
  "What follow-ups are mentioned?",
  "What should I ask next time?",
  "What should I remember?",
  "How does this connect to my history?",
];

const classNames = {
  answer: {
    compact: "mt-3 rounded-md border border-blue-100 bg-white px-3 py-2",
    default: "mt-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3",
  },
  answerText: {
    compact: "text-sm leading-6 text-slate-800",
    default: "text-sm leading-6 text-slate-800",
  },
  button: {
    compact:
      "rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400",
    default:
      "rounded-full border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400",
  },
  description: {
    compact: "mt-1 text-xs leading-5 text-slate-600",
    default: "mt-1 text-sm text-slate-600",
  },
  input: {
    compact:
      "min-h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
    default:
      "min-h-12 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
  },
  panel: {
    compact: "rounded-md border border-blue-100 bg-white/70 p-3",
    default: "rounded-lg border border-slate-200 bg-white p-5 shadow-sm",
  },
  promptButton: {
    compact:
      "rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400",
    default:
      "rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400",
  },
  title: {
    compact: "text-sm font-semibold text-blue-800",
    default: "text-sm font-semibold text-blue-700",
  },
};

type HomeContextPanelProps = {
  answer: string;
  askContext?: HomeContextAskContext;
  error: string | null;
  isLoading: boolean;
  onAsk: (question: string, askContext: HomeContextAskContext) => Promise<void>;
  variant?: "compact" | "default";
};

function promptsForContext(askContext: HomeContextAskContext) {
  if (askContext.level === "health_focus") {
    return healthFocusExamplePrompts;
  }

  if (askContext.level === "appointment") {
    return appointmentExamplePrompts;
  }

  if (askContext.level === "careprep" || askContext.level === "visit_note") {
    return documentExamplePrompts;
  }

  return globalExamplePrompts;
}

function titleForContext(askContext: HomeContextAskContext) {
  if (askContext.level === "health_focus") {
    return "Get context on this story";
  }

  if (askContext.level === "appointment") {
    return "Get context on this visit";
  }

  if (askContext.level === "careprep" || askContext.level === "visit_note") {
    return "Get context on this note";
  }

  return "Get more context";
}

function descriptionForContext(askContext: HomeContextAskContext) {
  if (askContext.level === "health_focus" && askContext.topicName) {
    return `Focused on ${askContext.topicName} and the visits behind it.`;
  }

  if (askContext.level === "appointment") {
    return "Focused on this appointment first, with broader context when helpful.";
  }

  if (askContext.level === "careprep" || askContext.level === "visit_note") {
    return "Focused on this saved CarePland document.";
  }

  return "";
}

function placeholderForContext(askContext: HomeContextAskContext) {
  if (askContext.level === "health_focus" && askContext.topicName) {
    return `What would you like to understand about ${askContext.topicName}?`;
  }

  if (askContext.level === "appointment") {
    return "What would you like to understand about this visit?";
  }

  if (askContext.level === "careprep" || askContext.level === "visit_note") {
    return "What would you like explained?";
  }

  return "What would you like to understand better?";
}

function mobilePlaceholderForContext(askContext: HomeContextAskContext) {
  if (askContext.level === "global" || askContext.level === "home") {
    return "Anything to understand better";
  }

  return "Anything to understand?";
}

export function HomeContextPanel({
  answer,
  askContext = defaultAskContext,
  error,
  isLoading,
  onAsk,
  variant = "default",
}: HomeContextPanelProps) {
  const inputId = useId();
  const [askedPrompts, setAskedPrompts] = useState<string[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [question, setQuestion] = useState("");
  const examplePrompts = promptsForContext(askContext);
  const inputPlaceholder = isMobileViewport
    ? mobilePlaceholderForContext(askContext)
    : placeholderForContext(askContext);
  const visiblePromptCount = isMobileViewport
    ? 2
    : variant === "compact"
      ? 4
      : 5;
  const unusedPrompts = examplePrompts.filter(
    (prompt) => !askedPrompts.includes(prompt)
  );
  const visiblePrompts = (
    unusedPrompts.length >= visiblePromptCount ? unusedPrompts : examplePrompts
  ).slice(0, visiblePromptCount);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateViewportState = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    updateViewportState();
    mediaQuery.addEventListener("change", updateViewportState);

    return () => {
      mediaQuery.removeEventListener("change", updateViewportState);
    };
  }, []);

  async function submitQuestion(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion || isLoading) {
      return;
    }

    setQuestion(trimmedQuestion);
    if (examplePrompts.includes(trimmedQuestion)) {
      setAskedPrompts((currentPrompts) =>
        currentPrompts.includes(trimmedQuestion)
          ? currentPrompts
          : [...currentPrompts, trimmedQuestion]
      );
    }
    await onAsk(trimmedQuestion, askContext);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion();
  }

  return (
    <section className={classNames.panel[variant]}>
      <div>
        <p className={classNames.title[variant]}>{titleForContext(askContext)}</p>
        {descriptionForContext(askContext) ? (
          <p className={classNames.description[variant]}>
            {descriptionForContext(askContext)}
          </p>
        ) : null}
      </div>

      <form className="mt-4" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={inputId}>
          {inputPlaceholder}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={classNames.input[variant]}
            disabled={isLoading}
            id={inputId}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={inputPlaceholder}
            type="text"
            value={question}
          />
          <button
            className={classNames.button[variant]}
            disabled={isLoading || !question.trim()}
            type="submit"
          >
            {isLoading ? "Thinking..." : "Ask"}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {visiblePrompts.map((prompt) => (
          <button
            className={classNames.promptButton[variant]}
            disabled={isLoading}
            key={prompt}
            onClick={() => {
              setQuestion(prompt);
              void submitQuestion(prompt);
            }}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className={classNames.answer[variant]}>
          <p className={classNames.answerText[variant]}>{answer}</p>
        </div>
      ) : null}
    </section>
  );
}
