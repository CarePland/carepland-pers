export const createAccountProcessingText = "Creating your account...";

export type CreateAccountFeedbackState =
  | {
      email: string;
      status: "idle";
    }
  | {
      email: string;
      status: "processing";
    }
  | {
      email: string;
      status: "success";
    }
  | {
      email: string;
      errorMessage: string;
      status: "error";
    };

export function createInitialAccountFeedbackState(
  email = ""
): CreateAccountFeedbackState {
  return { email, status: "idle" };
}

export function beginCreateAccountFeedback(
  state: CreateAccountFeedbackState,
  email: string
): { accepted: boolean; state: CreateAccountFeedbackState } {
  if (state.status === "processing") {
    return { accepted: false, state };
  }

  return {
    accepted: true,
    state: { email: email.trim(), status: "processing" },
  };
}

export function completeCreateAccountFeedback(
  state: CreateAccountFeedbackState
): CreateAccountFeedbackState {
  return { email: state.email, status: "success" };
}

export function failCreateAccountFeedback(
  state: CreateAccountFeedbackState,
  errorMessage: string
): CreateAccountFeedbackState {
  return {
    email: state.email,
    errorMessage,
    status: "error",
  };
}

export function canSubmitCreateAccount(
  state: CreateAccountFeedbackState
): boolean {
  return state.status !== "processing";
}
