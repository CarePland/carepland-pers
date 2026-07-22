import { NextRequest, NextResponse } from "next/server";

import { normalizeImportAnythingSourceName } from "@/app/lib/personal/importAnything/sources";
import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";
import { openAiResponseText } from "@/app/lib/platform/ai/responses";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import {
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "@/app/lib/platform/server/supabase";

type JsonObject = Record<string, unknown>;

const openAiApiKey = process.env.OPENAI_API_KEY ?? "";
const maxPdfCount = 4;
const maxPdfSizeBytes = 12 * 1024 * 1024;
const model = "gpt-4.1-mini";

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
    if (!openAiApiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before extracting PDF text.");
    }

    const supabase = createSupabaseUserClient(accessToken);
    const user = await getActiveSupabaseUser(
      supabase,
      "Please sign in before extracting PDF text."
    );

    const formData = await request.formData();
    const pdfs = formData
      .getAll("pdfs")
      .filter((item): item is File => item instanceof File);

    if (pdfs.length === 0) {
      throw new Error("Choose one or more PDFs before extracting text.");
    }

    if (pdfs.length > maxPdfCount) {
      throw new Error(`Use up to ${maxPdfCount} PDFs at a time.`);
    }

    for (const pdf of pdfs) {
      const isPdf =
        pdf.type === "application/pdf" || /\.pdf$/i.test(pdf.name);

      if (!isPdf) {
        throw new Error("Use PDF files for PDF text extraction.");
      }

      if (pdf.size > maxPdfSizeBytes) {
        throw new Error("Each PDF must be smaller than 12 MB.");
      }
    }

    const content: JsonObject[] = [
      {
        text: [
          "Extract readable healthcare-related text from these PDFs for CarePland Import Anything.",
          "Preserve dates, times, provider names, locations, addresses, phone numbers, medication names, doses, instructions, questions, section headings, and follow-up details.",
          "Process PDFs in the order provided.",
          "Do not summarize, classify, infer, or add commentary.",
          "Return only extracted text, with a source marker like --- filename.pdf --- before each PDF's text.",
        ].join(" "),
        type: "input_text",
      },
    ];

    for (const pdf of pdfs) {
      const bytes = Buffer.from(await pdf.arrayBuffer());
      const filename = normalizeImportAnythingSourceName(
        pdf.name || "source.pdf"
      );

      content.push({
        text: `PDF source: ${filename}`,
        type: "input_text",
      });
      content.push({
        file_data: `data:application/pdf;base64,${bytes.toString("base64")}`,
        filename,
        type: "input_file",
      });
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content,
            role: "user",
          },
        ],
        model,
        temperature: 0,
      }),
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const openAiJson = (await openAiResponse.json()) as JsonObject;

    if (!openAiResponse.ok) {
      const apiError =
        openAiJson.error && typeof openAiJson.error === "object"
          ? (openAiJson.error as JsonObject).message
          : null;
      throw new Error(String(apiError ?? "PDF text extraction failed."));
    }

    const extractedText = openAiResponseText(openAiJson);

    if (!extractedText) {
      throw new Error("No text was found in that PDF.");
    }

    await logOpenAiOperationCost({
      metadata: { pdf_count: pdfs.length },
      model,
      openAiJson,
      operationKey: "pdf_text_extraction",
      operationLabel: "PDF text extraction",
      providerRequestId:
        openAiResponse.headers.get("x-request-id") ??
        openAiResponse.headers.get("openai-request-id"),
      supabase,
      userId: user.id,
    });

    return NextResponse.json({ extractedText });
  } catch (error) {
    if (isMissingServerEnvError(error)) {
      return NextResponse.json(
        { error: "CarePland is missing required server configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
