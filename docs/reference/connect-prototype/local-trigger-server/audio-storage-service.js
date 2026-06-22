const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function ensureAudioStorage(uploadsDir) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function saveAudioBase64Artifact({
  uploadsDir,
  audioBase64,
  audioMimeType = "",
  filePrefix = "audio",
  transcribe = transcribeAudioFile,
}) {
  const audioBuffer = Buffer.from(String(audioBase64 || "").trim(), "base64");
  if (!audioBuffer.length) {
    return { ok: false, status: 400, error: "Audio payload is empty" };
  }

  ensureAudioStorage(uploadsDir);
  const safePrefix = String(filePrefix || "audio").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const audioId = `${safePrefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}${audioExtensionForMimeType(audioMimeType)}`;
  const audioPath = path.join(uploadsDir, audioId);
  fs.writeFileSync(audioPath, audioBuffer);

  const transcription = await transcribe(audioPath, audioMimeType);
  return {
    ok: true,
    audioUrl: `/uploads/${audioId}`,
    audioPath,
    audioByteSize: audioBuffer.length,
    audioSha256: crypto.createHash("sha256").update(audioBuffer).digest("hex"),
    transcript: transcription.transcript,
    transcriptStatus: transcription.status,
  };
}

async function saveAudioBase64Message(options) {
  return saveAudioBase64Artifact({
    ...options,
    filePrefix: options.filePrefix || "message",
  });
}

function audioExtensionForMimeType(mimeType) {
  const value = String(mimeType || "").toLowerCase();
  if (value.includes("webm")) return ".webm";
  if (value.includes("mpeg") || value.includes("mp3")) return ".mp3";
  if (value.includes("wav")) return ".wav";
  if (value.includes("ogg")) return ".ogg";
  return ".m4a";
}

async function transcribeAudioFile(audioPath, audioMimeType = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "not_configured", transcript: "" };
  }

  try {
    const form = new FormData();
    const bytes = fs.readFileSync(audioPath);
    form.append("file", new Blob([bytes], { type: audioMimeType || "audio/mp4" }), path.basename(audioPath));
    form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    form.append("response_format", "text");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const text = await response.text();
    if (!response.ok) {
      console.warn("Transcription failed:", response.status, text.slice(0, 240));
      return { status: "failed", transcript: "" };
    }
    return { status: "completed", transcript: text.trim() };
  } catch (error) {
    console.warn("Transcription failed:", error.message);
    return { status: "failed", transcript: "" };
  }
}

module.exports = {
  ensureAudioStorage,
  saveAudioBase64Artifact,
  saveAudioBase64Message,
  transcribeAudioFile,
};
