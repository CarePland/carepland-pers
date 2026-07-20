import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Sends the "you have a response" email for a single, just-created Ask
// message. Deliberately narrow in scope: this only ever fires for
// author_role = 'admin', is_internal = false messages (internal notes and
// the user's/assistant's own messages never need this). Mirrors
// /api/support-ticket-notifications's shape (same env vars, same SendGrid
// call, same app_content template keys, same last-seen suppression window)
// rather than inventing a parallel notification config surface -- Ask
// replaces tickets as the one place this needs to happen, not a second
// independent channel.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const sendGridApiKey = process.env.SENDGRID_API_KEY ?? "";
const supportEmailFrom =
  process.env.SUPPORT_EMAIL_FROM ?? "noreply@carepland.com";
const supportEmailFromName =
  process.env.SUPPORT_EMAIL_FROM_NAME ?? "CarePland Support";
const supportReplyEmailEnabled =
  process.env.SUPPORT_REPLY_EMAIL_ENABLED === "true";
const supportReplySuppressionMinutes = Number(
  process.env.SUPPORT_REPLY_EMAIL_SUPPRESSION_MINUTES ?? "0"
);
const defaultSupportReplyEmailSubject =
  "You have a response to your CarePland question";
const defaultSupportReplyEmailBody =
  "You've got a response to your CarePland question. Please log in to review it.\n\n{appUrl}";

type NotificationStatus = "failed" | "not_queued" | "queued" | "sent";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function displayNameFromProfile(profile: {
  display_name?: string | null;
  email?: string | null;
  family_name?: string | null;
  given_name?: string | null;
}) {
  const fullName = [profile.given_name, profile.family_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return profile.display_name?.trim() || fullName || profile.email || "";
}

function shouldSuppressEmailForRecentActivity(
  lastSeenAt: string | null,
  suppressionMinutes: number
) {
  if (
    !lastSeenAt ||
    !Number.isFinite(suppressionMinutes) ||
    suppressionMinutes <= 0
  ) {
    return false;
  }

  const lastSeenTime = new Date(lastSeenAt).getTime();

  if (Number.isNaN(lastSeenTime)) {
    return false;
  }

  return Date.now() - lastSeenTime < suppressionMinutes * 60 * 1000;
}

function appUrlFromRequest(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_CAREPLAND_APP_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  ).replace(/\/$/, "");
}

function applyEmailTemplate(
  template: string,
  values: { appUrl: string; recipientName: string }
) {
  return template
    .replaceAll("{appUrl}", values.appUrl)
    .replaceAll("{recipientName}", values.recipientName);
}

async function currentContentBody(
  supabase: unknown,
  contentKey: string,
  fallback: string
) {
  const { data, error } = await (
    supabase as {
      from: (tableName: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string | boolean
          ) => {
            eq: (
              column: string,
              value: string | boolean
            ) => {
              limit: (count: number) => {
                maybeSingle: () => Promise<{
                  data: { body?: unknown } | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      };
    }
  )
    .from("app_content_versions")
    .select("body")
    .eq("content_key", contentKey)
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Could not load app content for email notification", error);
    return fallback;
  }

  const contentRow = data as { body?: unknown } | null;

  return typeof contentRow?.body === "string" && contentRow.body.trim()
    ? contentRow.body
    : fallback;
}

async function updateMessageNotificationStatus(
  supabase: unknown,
  messageId: string,
  status: NotificationStatus
) {
  const { error } = await (
    supabase as {
      rpc: (
        functionName: string,
        args: Record<string, unknown>
      ) => Promise<{ error: unknown }>;
    }
  ).rpc("update_ask_message_notification_status", {
    p_message_id: messageId,
    p_status: status,
  });

  if (error) {
    console.error("Could not update Ask message notification status", error);
  }
}

async function sendAskReplyEmail({
  body,
  recipientEmail,
  recipientName,
  subject,
}: {
  body: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
}) {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    body: JSON.stringify({
      content: [
        {
          type: "text/plain",
          value: [
            recipientName ? `Hi ${recipientName},` : "Hi,",
            "",
            body,
            "",
            "Thanks,",
            "CarePland Support",
          ].join("\n"),
        },
      ],
      from: {
        email: supportEmailFrom,
        name: supportEmailFromName,
      },
      personalizations: [
        {
          to: [{ email: recipientEmail, name: recipientName || undefined }],
        },
      ],
      subject,
    }),
    headers: {
      Authorization: `Bearer ${sendGridApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `SendGrid email failed with ${response.status}: ${responseBody}`
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase server configuration.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before sending Ask notifications.");
    }

    const body = await request.json();
    const messageId = typeof body.messageId === "string" ? body.messageId : "";

    if (!messageId) {
      throw new Error("Ask message id is required.");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before sending Ask notifications.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,is_admin")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (profile?.is_admin !== true) {
      throw new Error("Admin access is required to send Ask notifications.");
    }

    const { data: message, error: messageError } = await supabase
      .from("ask_messages")
      .select("id,thread_id,author_role,is_internal,notification_status")
      .eq("id", messageId)
      .single();

    if (messageError) {
      throw messageError;
    }

    if (
      message.author_role !== "admin" ||
      message.is_internal ||
      message.notification_status === "sent"
    ) {
      return NextResponse.json({ status: "not_queued" });
    }

    const { data: thread, error: threadError } = await supabase
      .from("ask_threads")
      .select("id,user_id")
      .eq("id", message.thread_id)
      .single();

    if (threadError) {
      throw threadError;
    }

    const { data: recipientProfile, error: recipientError } = await supabase
      .from("profiles")
      .select("id,email,display_name,given_name,family_name,last_seen_at")
      .eq("id", thread.user_id)
      .single();

    if (recipientError) {
      throw recipientError;
    }

    if (!recipientProfile?.email) {
      await updateMessageNotificationStatus(supabase, message.id, "failed");
      return NextResponse.json({ status: "failed", reason: "missing_email" });
    }

    if (
      shouldSuppressEmailForRecentActivity(
        typeof recipientProfile.last_seen_at === "string"
          ? recipientProfile.last_seen_at
          : null,
        supportReplySuppressionMinutes
      )
    ) {
      await updateMessageNotificationStatus(supabase, message.id, "not_queued");
      return NextResponse.json({ status: "suppressed_recent_activity" });
    }

    if (!supportReplyEmailEnabled) {
      return NextResponse.json({
        status: "not_queued",
        reason: "support_reply_email_disabled",
      });
    }

    if (!sendGridApiKey) {
      return NextResponse.json({
        status: "not_queued",
        reason: "missing_sendgrid_configuration",
      });
    }

    await updateMessageNotificationStatus(supabase, message.id, "queued");

    const appUrl = appUrlFromRequest(request);
    const recipientName = displayNameFromProfile(recipientProfile);
    const [emailSubject, emailBodyTemplate] = await Promise.all([
      currentContentBody(
        supabase,
        "support_reply_email_subject",
        defaultSupportReplyEmailSubject
      ),
      currentContentBody(
        supabase,
        "support_reply_email_body",
        defaultSupportReplyEmailBody
      ),
    ]);

    try {
      await sendAskReplyEmail({
        body: applyEmailTemplate(emailBodyTemplate, {
          appUrl,
          recipientName,
        }),
        recipientEmail: recipientProfile.email,
        recipientName,
        subject: applyEmailTemplate(emailSubject, {
          appUrl,
          recipientName,
        }),
      });
    } catch (sendError) {
      await updateMessageNotificationStatus(supabase, message.id, "failed");
      throw sendError;
    }

    await updateMessageNotificationStatus(supabase, message.id, "sent");

    return NextResponse.json({ status: "sent" });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
