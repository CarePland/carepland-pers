import { readFile } from "node:fs/promises";
import path from "node:path";

export type ConnectAudioTranscriptionResult = {
  status: "completed" | "failed" | "not_configured";
  transcript: string;
};

export async function transcribeConnectAudioFile(
  audioPath: string,
  audioMimeType = "",
  env: Record<string, string | undefined> = process.env
): Promise<ConnectAudioTranscriptionResult> {
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return { status: "not_configured", transcript: "" };
  }

  try {
    const bytes = await readFile(audioPath);
    const form = new FormData();
    form.append(
      "file",
      new Blob([bytes], { type: audioMimeType || "audio/mp4" }),
      path.basename(audioPath)
    );
    form.append("model", env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    form.append("response_format", "text");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      body: form,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: "POST",
    });
    const text = await response.text();

    if (!response.ok) {
      return { status: "failed", transcript: "" };
    }

    return { status: "completed", transcript: text.trim() };
  } catch {
    return { status: "failed", transcript: "" };
  }
}
