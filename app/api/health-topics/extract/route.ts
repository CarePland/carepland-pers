import { NextRequest, NextResponse } from "next/server";

import { extractTopicMentionsForNote } from "@/app/lib/healthTopics/server";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/server/supabase";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before extracting Health Focus topics.");
    }

    const body = await request.json().catch(() => ({}));
    const noteId = typeof body.noteId === "string" ? body.noteId.trim() : "";

    if (!noteId) {
      throw new Error("Visit Notes are required before extracting topics.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!userData.user?.id) {
      throw new Error("Please sign in before extracting Health Focus topics.");
    }

    const result = await extractTopicMentionsForNote({
      noteId,
      serviceClient: createSupabaseServiceClient(),
      userClient,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}
