"use client";

import { createClient } from "@supabase/supabase-js";
import { type ReactNode, useEffect, useState } from "react";

import { carePlandSignInPath } from "../../../lib/platform/authRedirect";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type FamilyAdminGateProps = {
  children: ReactNode;
};

type AccessState = "checking" | "allowed" | "redirecting";

export function FamilyAdminGate({ children }: FamilyAdminGateProps) {
  const [accessState, setAccessState] = useState<AccessState>("checking");

  useEffect(() => {
    let cancelled = false;

    function currentReturnTo() {
      return `${window.location.pathname}${window.location.search}`;
    }

    async function verifyFamilyAccess() {
      setAccessState("checking");

      const { data: userData } = await supabase.auth.getUser();
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
        setAccessState("redirecting");
        window.location.replace(carePlandSignInPath(currentReturnTo()));
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
