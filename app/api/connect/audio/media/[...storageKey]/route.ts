import { readFile } from "node:fs/promises";
import path from "node:path";

import { localConnectAudioUploadsDir } from "@/app/lib/connect/audio/server/localAudioArtifacts";

type RouteContext = {
  params: Promise<{ storageKey: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { storageKey } = await context.params;
  const uploadsDir = localConnectAudioUploadsDir();
  const filePath = path.resolve(uploadsDir, ...storageKey);
  const safeRoot = path.resolve(uploadsDir);

  if (!filePath.startsWith(`${safeRoot}${path.sep}`)) {
    return Response.json({ error: "Invalid audio path", ok: false }, { status: 400 });
  }

  try {
    const bytes = await readFile(filePath);

    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "Content-Type": contentTypeForAudioPath(filePath),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Audio file not found", ok: false }, { status: 404 });
  }
}

function contentTypeForAudioPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".webm") return "audio/webm";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}
