import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Early Access signup is temporarily unavailable.");
    }

    const body = await request.json();
    const firstName = cleanText(body.firstName, 80);
    const lastName = cleanText(body.lastName, 80);
    const email = cleanText(body.email, 254).toLowerCase();
    const interestContext = cleanText(body.interestContext, 1200);
    const communicationConsent = body.communicationConsent === true;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Please enter your first and last name." },
        { status: 400 }
      );
    }

    if (!isLikelyEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!communicationConsent) {
      return NextResponse.json(
        { error: "Please confirm that CarePland may contact you about Early Access." },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from("early_access_intake").insert({
      admin_notes: "",
      care_role: "unspecified",
      communication_consent: true,
      communication_preference: "email",
      email,
      first_name: firstName,
      interest_context: interestContext,
      last_name: lastName,
      phone: null,
      source: "public_website",
      status: "new",
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true });
      }

      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Early Access signup is temporarily unavailable.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
