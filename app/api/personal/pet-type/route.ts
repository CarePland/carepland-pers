import { NextRequest, NextResponse } from "next/server";

import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";

type CareCircleMembershipRow = {
  care_circle_id: string;
};

type CareSubjectRow = {
  care_circle_id: string;
  display_name: string | null;
  id: string;
  is_active: boolean | null;
  subject_type: string | null;
};

const allowedSimpleSubjectTypes = new Set(["cat", "dog", "other", "pet"]);

function accessTokenFromRequest(request: Request) {
  return (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error || "Pet details could not be saved.");

  if (
    message.includes("care_subject_type") ||
    message.includes("invalid input value for enum")
  ) {
    return "Pet type support needs the saved database patch before Cat, Dog, or Other can be saved.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Pet details could not be saved.");
}

function normalizeSubjectType(value: unknown) {
  const subjectType = String(value || "").trim();
  const normalizedType = subjectType.toLowerCase();

  if (allowedSimpleSubjectTypes.has(normalizedType)) {
    return normalizedType;
  }

  if (normalizedType.startsWith("pet:")) {
    const customLabel = subjectType.slice(4).trim();

    return customLabel ? `pet:${customLabel}` : "pet";
  }

  throw new Error("Choose Cat, Dog, Other, or Not a Pet.");
}

async function careCircleIdsForUser(
  userClient: ReturnType<typeof createSupabaseUserClient>,
  userId: string
) {
  const { data: memberships, error } = await userClient
    .from("care_circle_memberships")
    .select("care_circle_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return Array.from(
    new Set(
      ((memberships ?? []) as CareCircleMembershipRow[])
        .map((membership) => membership.care_circle_id)
        .filter(Boolean)
    )
  );
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = accessTokenFromRequest(request);

    if (!accessToken) {
      throw new Error("Please sign in before changing pet details.");
    }

    const body = (await request.json().catch(() => ({}))) as {
      personId?: unknown;
      subjectType?: unknown;
    };
    const personId = String(body.personId || "").trim();
    const subjectType = normalizeSubjectType(body.subjectType);

    if (!personId) {
      throw new Error("Choose a person before changing pet details.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before changing pet details.");
    }

    const careCircleIds = await careCircleIdsForUser(userClient, userId);

    if (careCircleIds.length === 0) {
      throw new Error("Choose a person from your CarePland collection.");
    }

    const { data: accessiblePerson, error: accessibleError } = await userClient
      .from("care_subjects")
      .select("id,care_circle_id,display_name,is_active,subject_type")
      .eq("id", personId)
      .in("care_circle_id", careCircleIds)
      .single();

    if (accessibleError) {
      throw accessibleError;
    }

    const person = accessiblePerson as CareSubjectRow;

    if (person.is_active === false) {
      throw new Error("Choose an active Care VIP before changing pet details.");
    }

    const serviceClient = createSupabaseServiceClient();
    const { data: updatedPerson, error: updateError } = await serviceClient
      .from("care_subjects")
      .update({ subject_type: subjectType })
      .eq("id", person.id)
      .select("id,care_circle_id,display_name,is_active,subject_type")
      .single();

    if (updateError) {
      throw updateError;
    }

    const row = updatedPerson as CareSubjectRow;

    return NextResponse.json({
      ok: true,
      personId: row.id,
      subjectType: row.subject_type ?? subjectType,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}
