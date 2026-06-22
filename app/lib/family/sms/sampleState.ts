import {
  sampleErrands,
  sampleFamilyMembers,
} from "../errands/sampleData";
import type { SmsWorkflowState } from "./types";

export function createInitialSmsWorkflowState(): SmsWorkflowState {
  return {
    householdId: "household-demo",
    coordinatorPhone: "+15550109999",
    careVipName: "Mom",
    members: sampleFamilyMembers,
    errands: sampleErrands,
    messages: [],
    promptContexts: [],
    auditEvents: [],
    concerns: [],
  };
}
