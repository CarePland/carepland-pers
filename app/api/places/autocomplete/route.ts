import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  googlePlacesErrorKey,
  placesUnavailableMessage,
  PlaceAutocompleteSuggestion,
} from "../../../lib/places";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

async function recordPlacesError(
  supabase: unknown,
  errorKey: string,
  message: string,
  attemptedCallCount: number | null
) {
  const rpcClient = supabase as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<unknown>;
  };

  await rpcClient.rpc("record_integration_error", {
    p_attempted_call_count: attemptedCallCount,
    p_context: { route: "places/autocomplete" },
    p_error_key: errorKey,
    p_error_message: message,
    p_integration_key: "google_places",
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase server configuration.");
    }

    if (!googleMapsApiKey) {
      throw new Error("Missing GOOGLE_MAPS_API_KEY in environment variables.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before searching locations.");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!userData.user?.id) {
      throw new Error("Please sign in before searching locations.");
    }

    const body = (await request.json()) as {
      input?: unknown;
      sessionToken?: unknown;
    };
    const input = typeof body.input === "string" ? body.input.trim() : "";
    const sessionToken =
      typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";

    if (input.length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    const { data: counterData } = await supabase.rpc(
      "increment_integration_usage_counter",
      { p_integration_key: "google_places" }
    );
    const attemptedCallCount =
      typeof counterData === "number" ? counterData : null;

    const googleResponse = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        body: JSON.stringify({
          input,
          includedRegionCodes: ["us"],
          sessionToken: sessionToken || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleMapsApiKey,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
        },
        method: "POST",
      }
    );
    const responseText = await googleResponse.text();

    if (!googleResponse.ok) {
      const errorKey = googlePlacesErrorKey(googleResponse.status, responseText);
      await recordPlacesError(
        supabase,
        errorKey,
        responseText,
        attemptedCallCount
      );

      return NextResponse.json(
        { error: placesUnavailableMessage },
        { status: googleResponse.status === 429 ? 429 : 503 }
      );
    }

    const googleJson = responseText
      ? (JSON.parse(responseText) as {
          suggestions?: Array<{
            placePrediction?: {
              placeId?: string;
              text?: { text?: string };
            };
          }>;
        })
      : {};
    const suggestions: PlaceAutocompleteSuggestion[] =
      googleJson.suggestions
        ?.map((suggestion) => suggestion.placePrediction)
        .filter(Boolean)
        .map((prediction) => ({
          placeId: prediction?.placeId ?? "",
          text: prediction?.text?.text ?? "",
        }))
        .filter((suggestion) => suggestion.placeId && suggestion.text) ?? [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
