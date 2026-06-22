import { NextRequest, NextResponse } from "next/server";

import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";

const avatarBucket = "carepland-avatars";
const maxAvatarSizeBytes = 5 * 1024 * 1024;
const supportedAvatarTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type CareCircleMembershipRow = {
  care_circle_id: string;
};

type CareSubjectAvatarRow = {
  avatar_alt_text: string | null;
  avatar_type: "generated" | "initials" | "uploaded" | null;
  avatar_url: string | null;
  display_name?: string | null;
  id: string;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Unable to load avatars.");
}

function accessTokenFromRequest(request: Request) {
  return (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isMissingAvatarColumn(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  const message = String(maybeError.message || "").toLowerCase();

  return maybeError.code === "42703" || message.includes("avatar_");
}

async function signedAvatarUrl(avatarUrl: string | null) {
  if (!avatarUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(avatarUrl)) {
    return avatarUrl;
  }

  const { data, error } = await createSupabaseServiceClient().storage
    .from(avatarBucket)
    .createSignedUrl(avatarUrl, 60 * 60 * 24);

  if (error) {
    return "";
  }

  return data.signedUrl;
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

async function loadAccessiblePerson(personId: string, accessToken: string) {
  const userClient = createSupabaseUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("Please sign in before changing avatars.");
  }

  const careCircleIds = await careCircleIdsForUser(userClient, userId);

  if (careCircleIds.length === 0) {
    throw new Error("Choose a person from your CarePland collection.");
  }

  const { data, error } = await userClient
    .from("care_subjects")
    .select("id,display_name,avatar_url,avatar_type,avatar_alt_text")
    .eq("id", personId)
    .in("care_circle_id", careCircleIds)
    .single();

  if (error) {
    throw error;
  }

  return { person: data as CareSubjectAvatarRow, userId };
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = accessTokenFromRequest(request);

    if (!accessToken) {
      throw new Error("Please sign in before loading avatars.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!userData.user?.id) {
      throw new Error("Please sign in before loading avatars.");
    }

    const careCircleIds = await careCircleIdsForUser(
      userClient,
      userData.user.id
    );

    if (careCircleIds.length === 0) {
      return NextResponse.json({ avatars: {}, ok: true });
    }

    const { data: subjects, error: subjectsError } = await userClient
      .from("care_subjects")
      .select("id,avatar_url,avatar_type,avatar_alt_text")
      .in("care_circle_id", careCircleIds)
      .eq("is_active", true);

    if (subjectsError) {
      if (isMissingAvatarColumn(subjectsError)) {
        return NextResponse.json({ avatars: {}, ok: true });
      }

      throw subjectsError;
    }

    const entries = await Promise.all(
      ((subjects ?? []) as CareSubjectAvatarRow[]).map(async (subject) => [
        subject.id,
        {
          avatarAltText: subject.avatar_alt_text ?? "",
          avatarType: subject.avatar_type ?? "initials",
          avatarUrl: await signedAvatarUrl(subject.avatar_url),
        },
      ])
    );

    return NextResponse.json({
      avatars: Object.fromEntries(entries),
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = accessTokenFromRequest(request);

    if (!accessToken) {
      throw new Error("Please sign in before changing an avatar.");
    }

    const formData = await request.formData();
    const personId = String(formData.get("personId") || "").trim();
    const image = formData.get("avatar");

    if (!personId) {
      throw new Error("Choose a person before changing an avatar.");
    }

    if (!(image instanceof File)) {
      throw new Error("Choose a photo first.");
    }

    const extension = supportedAvatarTypes.get(image.type);

    if (!extension) {
      throw new Error("Use a JPG, PNG, or WebP photo.");
    }

    if (image.size > maxAvatarSizeBytes) {
      throw new Error("Use a photo smaller than 5 MB.");
    }

    const { person, userId } = await loadAccessiblePerson(personId, accessToken);
    const serviceClient = createSupabaseServiceClient();
    const storagePath = [
      userId,
      person.id,
      `avatar-${Date.now()}.${extension}`,
    ].join("/");
    const bytes = Buffer.from(await image.arrayBuffer());
    const { error: uploadError } = await serviceClient.storage
      .from(avatarBucket)
      .upload(storagePath, bytes, {
        cacheControl: "3600",
        contentType: image.type,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const userClient = createSupabaseUserClient(accessToken);
    const avatarAltText = person.display_name
      ? `${person.display_name} avatar`
      : "CarePland person avatar";
    const { data: updatedPerson, error: updateError } = await userClient
      .from("care_subjects")
      .update({
        avatar_alt_text: avatarAltText,
        avatar_type: "uploaded",
        avatar_url: storagePath,
      })
      .eq("id", person.id)
      .select("id,display_name,avatar_url,avatar_type,avatar_alt_text")
      .single();

    if (updateError) {
      await serviceClient.storage.from(avatarBucket).remove([storagePath]);
      throw updateError;
    }

    if (person.avatar_url && !/^https?:\/\//i.test(person.avatar_url)) {
      void serviceClient.storage.from(avatarBucket).remove([person.avatar_url]);
    }

    const row = updatedPerson as CareSubjectAvatarRow;

    return NextResponse.json({
      avatarAltText: row.avatar_alt_text ?? avatarAltText,
      avatarType: row.avatar_type ?? "uploaded",
      avatarUrl: await signedAvatarUrl(row.avatar_url),
      ok: true,
      personId: row.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accessToken = accessTokenFromRequest(request);

    if (!accessToken) {
      throw new Error("Please sign in before removing an avatar.");
    }

    const personId = request.nextUrl.searchParams.get("personId")?.trim() ?? "";

    if (!personId) {
      throw new Error("Choose a person before removing an avatar.");
    }

    const { person } = await loadAccessiblePerson(personId, accessToken);
    const userClient = createSupabaseUserClient(accessToken);
    const { data: updatedPerson, error: updateError } = await userClient
      .from("care_subjects")
      .update({
        avatar_alt_text: null,
        avatar_type: "initials",
        avatar_url: null,
      })
      .eq("id", person.id)
      .select("id,display_name,avatar_url,avatar_type,avatar_alt_text")
      .single();

    if (updateError) {
      throw updateError;
    }

    if (person.avatar_url && !/^https?:\/\//i.test(person.avatar_url)) {
      void createSupabaseServiceClient().storage
        .from(avatarBucket)
        .remove([person.avatar_url]);
    }

    const row = updatedPerson as CareSubjectAvatarRow;

    return NextResponse.json({
      avatarAltText: row.display_name ? `${row.display_name} avatar` : "",
      avatarType: row.avatar_type ?? "initials",
      avatarUrl: "",
      ok: true,
      personId: row.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}
