import type { FamilyTask } from "../types";

export const sampleFamilyTasks: FamilyTask[] = [
  {
    id: "task-1",
    careVipName: "Mom",
    title: "Pick up prescriptions",
    description: "Confirm pharmacy pickup and mark complete after delivery.",
    status: "assigned",
    assignedMemberName: "Casey",
    dueLabel: "Today",
  },
  {
    id: "task-2",
    careVipName: "Mom",
    title: "Check bathroom supplies",
    description: "Look for toilet paper, gloves, wipes, and cleaning spray.",
    status: "available",
    dueLabel: "Tomorrow",
  },
  {
    id: "task-3",
    careVipName: "Mom",
    title: "Trash bins to curb",
    description: "Move bins out tonight and confirm when done.",
    status: "completed",
    assignedMemberName: "Jamie",
    dueLabel: "Yesterday",
  },
];
