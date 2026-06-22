import { NextRequest, NextResponse } from "next/server";

import { processInboundSms } from "../../../../lib/family/sms/SmsIntakeService";
import { createInitialSmsWorkflowState } from "../../../../lib/family/sms/sampleState";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const fromPhone = String(formData.get("From") ?? "");
  const toPhone = String(formData.get("To") ?? "");
  const body = String(formData.get("Body") ?? "");
  const providerMessageId = String(formData.get("MessageSid") ?? "");

  const result = processInboundSms(createInitialSmsWorkflowState(), {
    fromPhone,
    toPhone,
    body,
    providerMessageId,
    transport: "twilio",
  });

  return new NextResponse(buildTwiMl(result.replyBody), {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

function buildTwiMl(message: string) {
  return `<Response><Message>${escapeXml(message)}</Message></Response>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
