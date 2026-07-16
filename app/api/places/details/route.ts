import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  googlePlacesErrorKey,
  PlaceAddressResult,
  placesUnavailableMessage,
  PlaceDetailsResult,
} from "../../../lib/platform/integrations/places";

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
    p_context: { route: "places/details" },
    p_error_key: errorKey,
    p_error_message: message,
    p_integration_key: "google_places",
  });
}

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function addressComponentText(
  components: GoogleAddressComponent[],
  type: string,
  text: "longText" | "shortText" = "longText"
) {
  return (
    components.find((component) => component.types?.includes(type))?.[text] ??
    ""
  );
}

function placeAddressFromComponents(
  components: GoogleAddressComponent[] = [],
  formattedAddress = ""
): PlaceAddressResult | undefined {
  const country = addressComponentText(components, "country", "shortText");

  if (country && country !== "US") {
    return undefined;
  }

  const streetNumber = addressComponentText(components, "street_number");
  const route = addressComponentText(components, "route");
  const subpremise = addressComponentText(components, "subpremise");
  const city =
    addressComponentText(components, "locality") ||
    addressComponentText(components, "postal_town") ||
    addressComponentText(components, "sublocality_level_1") ||
    addressComponentText(components, "administrative_area_level_2");
  const region = addressComponentText(
    components,
    "administrative_area_level_1",
    "shortText"
  );
  const postalCode = addressComponentText(components, "postal_code");
  const postalCodeSuffix = addressComponentText(
    components,
    "postal_code_suffix"
  );
  const formattedPostalCode =
    formattedAddress.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? "";
  const addressLine1 = [streetNumber, route].filter(Boolean).join(" ").trim();

  if (!addressLine1 && !city && !region && !postalCode) {
    return undefined;
  }

  return {
    addressLine1,
    addressLine2: subpremise ? `#${subpremise}` : "",
    city,
    country: "US",
    postalCode: postalCodeSuffix
      ? `${postalCode}-${postalCodeSuffix}`
      : postalCode || formattedPostalCode,
    region,
  };
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
      throw new Error("Please sign in before loading location details.");
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
      throw new Error("Please sign in before loading location details.");
    }

    const body = (await request.json()) as {
      placeId?: unknown;
      sessionToken?: unknown;
    };
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const sessionToken =
      typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";

    if (!placeId) {
      throw new Error("Choose a location before loading details.");
    }

    const { data: counterData } = await supabase.rpc(
      "increment_integration_usage_counter",
      { p_integration_key: "google_places" }
    );
    const attemptedCallCount =
      typeof counterData === "number" ? counterData : null;
    const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);

    if (sessionToken) {
      url.searchParams.set("sessionToken", sessionToken);
    }

    const googleResponse = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleMapsApiKey,
        "X-Goog-FieldMask":
          "addressComponents,id,displayName,formattedAddress,nationalPhoneNumber,googleMapsUri",
      },
      method: "GET",
    });
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
          addressComponents?: GoogleAddressComponent[];
          displayName?: { text?: string };
          formattedAddress?: string;
          googleMapsUri?: string;
          id?: string;
          nationalPhoneNumber?: string;
        })
      : {};
    const place: PlaceDetailsResult = {
      formattedAddress: googleJson.formattedAddress ?? "",
      googleMapsUri: googleJson.googleMapsUri ?? "",
      nationalPhoneNumber: googleJson.nationalPhoneNumber ?? "",
      placeId: googleJson.id ?? placeId,
      placeName: googleJson.displayName?.text ?? "",
    };
    place.address = placeAddressFromComponents(
      googleJson.addressComponents,
      place.formattedAddress
    );

    return NextResponse.json({ place });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
