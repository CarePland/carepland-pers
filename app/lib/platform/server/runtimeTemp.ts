import { tmpdir } from "node:os";
import path from "node:path";

export function careplandRuntimeTempPath(...segments: string[]) {
  if (shouldUseSystemTempDir()) {
    return path.join(tmpdir(), "carepland", ...segments);
  }

  return path.join(process.cwd(), "tmp", ...segments);
}

function shouldUseSystemTempDir() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT === "/var/task" ||
      process.cwd().startsWith("/var/task")
  );
}
