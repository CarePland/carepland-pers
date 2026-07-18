"use client";

import { useEffect } from "react";

import { installHelpDiagnosticsRecorder } from "../../lib/platform/helpDiagnostics";

export function HelpDiagnosticsRuntime() {
  useEffect(() => {
    installHelpDiagnosticsRecorder();
  }, []);

  return null;
}
