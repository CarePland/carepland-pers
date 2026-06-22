import { NextRequest, NextResponse } from "next/server";

import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import { createSupabaseUserClient } from "@/app/lib/platform/server/supabase";

type JsonObject = Record<string, unknown>;

const openAiApiKey = process.env.OPENAI_API_KEY ?? "";
const maxImageCount = 10;
const maxImageSizeBytes = 8 * 1024 * 1024;
const supportedImageTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function responseText(response: JsonObject): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) {
        return [];
      }

      const content = Array.isArray(item.content) ? item.content : [];
      return content.map((contentItem: unknown) => {
        if (
          contentItem &&
          typeof contentItem === "object" &&
          "text" in contentItem
        ) {
          return String(contentItem.text);
        }

        return "";
      });
    })
    .join("")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    if (!openAiApiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before extracting text.");
    }

    const supabase = createSupabaseUserClient(accessToken);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!userData.user?.id) {
      throw new Error("Please sign in before extracting text.");
    }

    const formData = await request.formData();
    const scope =
      formData.get("scope") === "import_anything"
        ? "import_anything"
        : "appointments";
    const images = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File);

    if (images.length === 0) {
      throw new Error("Choose one or more images before extracting text.");
    }

    if (images.length > maxImageCount) {
      throw new Error(`Use up to ${maxImageCount} images at a time.`);
    }

    for (const image of images) {
      if (!supportedImageTypes.has(image.type)) {
        throw new Error("Use PNG, JPG, GIF, or WebP images.");
      }

      if (image.size > maxImageSizeBytes) {
        throw new Error("Each image must be smaller than 8 MB.");
      }
    }

    const extractionInstruction =
      scope === "import_anything"
        ? "Extract all visible healthcare-related text from these images. Preserve line breaks, dates, times, provider names, locations, addresses, phone numbers, medication names, doses, instructions, questions, labels, and section headings. Process images in the order provided. Do not summarize, classify, infer, or add commentary. Return only the extracted text. Use page markers like --- Image 1 --- before each image's extracted text."
        : "Extract all visible appointment-related text from these images. Preserve line breaks, dates, times, provider names, locations, addresses, phone numbers, and labels. Process images in the order provided. Do not summarize, classify, infer, or add commentary. Return only the extracted text. Use page markers like --- Image 1 --- before each image's extracted text.";
    const content: JsonObject[] = [
      {
        text: extractionInstruction,
        type: "input_text",
      },
    ];

    for (const [index, image] of images.entries()) {
      const bytes = Buffer.from(await image.arrayBuffer());
      const dataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;

      content.push({
        text: `Image ${index + 1}`,
        type: "input_text",
      });
      content.push({
        image_url: dataUrl,
        type: "input_image",
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
        model: "gpt-4.1-mini",
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
      throw new Error(String(apiError ?? "Image text extraction failed."));
    }

    const extractedText = responseText(openAiJson);

    if (!extractedText) {
      throw new Error("No text was found in that image.");
    }

    await logOpenAiOperationCost({
      metadata: { image_count: images.length, scope },
      model: "gpt-4.1-mini",
      openAiJson,
      operationKey: "image_text_extraction",
      operationLabel: "Image text extraction",
      providerRequestId:
        openAiResponse.headers.get("x-request-id") ??
        openAiResponse.headers.get("openai-request-id"),
      supabase,
      userId: userData.user.id,
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
