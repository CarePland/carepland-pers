import type { Errand, ErrandEvent, FamilyMember } from "../types";

export const sampleFamilyMembers: FamilyMember[] = [
  {
    id: "member-casey",
    displayName: "Casey",
    relationshipLabel: "Care Coordinator",
    phoneNumber: "+15550101001",
    lastActiveLabel: "Today",
  },
  {
    id: "member-jamie",
    displayName: "Jamie",
    relationshipLabel: "Family member",
    phoneNumber: "+15550101002",
    lastActiveLabel: "Yesterday",
  },
  {
    id: "member-taylor",
    displayName: "Taylor",
    relationshipLabel: "Neighbor",
    phoneNumber: "+15550101003",
    lastActiveLabel: "Last week",
  },
];

export const sampleErrands: Errand[] = [
  {
    id: "errand-1",
    careVipName: "Mom",
    title: "Pick up prescriptions",
    description: "Confirm pharmacy pickup and mark complete after delivery.",
    status: "assigned",
    assignedMemberName: "Casey",
    dueLabel: "Today",
  },
  {
    id: "errand-2",
    careVipName: "Mom",
    title: "Check bathroom supplies",
    description: "Look for toilet paper, gloves, wipes, and cleaning spray.",
    status: "available",
    dueLabel: "Tomorrow",
  },
  {
    id: "errand-3",
    careVipName: "Mom",
    title: "Pick up prescription refill",
    description: "The current owner cannot make it before the pharmacy closes.",
    status: "unable_to_complete",
    assignedMemberName: "Jamie",
    dueLabel: "Yesterday",
  },
];

export const sampleErrandEvents: ErrandEvent[] = [
  {
    id: "event-1",
    errandId: "errand-1",
    type: "created",
    actorName: "Casey",
    detail: "Created errand: Pick up prescriptions",
    createdLabel: "Today, 8:15 AM",
  },
  {
    id: "event-2",
    errandId: "errand-1",
    type: "assigned",
    actorName: "Casey",
    detail: "Assigned to Casey",
    createdLabel: "Today, 8:16 AM",
  },
  {
    id: "event-3",
    errandId: "errand-1",
    type: "assigned",
    actorName: "Casey",
    detail: "Ownership accepted by Casey",
    createdLabel: "Today, 8:19 AM",
  },
  {
    id: "event-4",
    errandId: "errand-2",
    type: "released",
    actorName: "System",
    detail: "Released to the Care Family",
    createdLabel: "Yesterday, 6:30 PM",
  },
  {
    id: "event-5",
    errandId: "errand-3",
    type: "unable_to_complete",
    actorName: "Jamie",
    detail: "Unable to complete; needs reassignment",
    createdLabel: "Yesterday, 8:04 PM",
  },
];
