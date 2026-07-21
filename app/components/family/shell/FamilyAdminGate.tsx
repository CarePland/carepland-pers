"use client";

import { type ReactNode, useEffect, useState } from "react";

import { browserSupabase as supabase } from "../../../lib/platform/browserSupabase";
import { carePlandSignInPath } from "../../../lib/platform/authRedirect";
import {
  currentReturnTo,
  reportSessionLossFromError,
  sessionValidityStore,
} from "../../../lib/platform/sessionValidity";

type FamilyAdminGateProps = {
  children: ReactNode;
};

type AccessState = "checking" | "allowed" | "redirecting";

export function FamilyAdminGate({ children }: FamilyAdminGateProps) {
  const [accessState, setAccessState] = useState<AccessState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function verifyFamilyAccess() {
      setAccessState("checking");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        reportSessionLossFromError(userError, {
          returnTo: currentReturnTo(),
          surface: "family",
        });
      }
      const userId = userData.user?.id;

      if (cancelled) return;

      if (!userId) {
        setAccessState("redirecting");
        window.location.replace(carePlandSignInPath(currentReturnTo()));
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.is_admin === true) {
        setAccessState("allowed");
        return;
      }

      setAccessState("redirecting");
      window.location.replace("/?adminAccessDenied=1");
    }

    void verifyFamilyAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_OUT" && event !== "TOKEN_REFRESHED") return;
      if (event === "SIGNED_OUT" || !session?.user?.id) {
        sessionValidityStore.reportSessionLost(
          "family",
          "Family session ended.",
          currentReturnTo()
        );
        setAccessState("redirecting");
        window.location.replace(carePlandSignInPath(currentReturnTo()));
      }
      if (event === "TOKEN_REFRESHED" && session?.user?.id) {
        sessionValidityStore.markAuthenticated();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (accessState !== "allowed") {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-700">
        <p className="text-sm font-semibold">
          {accessState === "redirecting"
            ? "Redirecting..."
            : "Checking access..."}
        </p>
      </main>
    );
  }

  return children;
}
