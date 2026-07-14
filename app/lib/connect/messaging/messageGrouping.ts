import type { ConnectMessageRecord } from "./types";

export type MessageGroupMode = "appointment";

export type GroupableMessage = Pick<
  Partial<ConnectMessageRecord>,
  "appointmentId" | "appointmentStartsAt" | "appointmentTitle" | "createdAt"
>;

export type MessageGroup<TMessage extends GroupableMessage = GroupableMessage> = {
  id: string;
  label: string;
  messages: TMessage[];
  sortDate: string;
};

export function groupMessagesByAppointment<
  TMessage extends GroupableMessage,
>(messages: TMessage[]): MessageGroup<TMessage>[] {
  const groups = new Map<string, MessageGroup<TMessage>>();

  for (const message of messages) {
    const appointmentId = String(message.appointmentId || "").trim();
    const groupId = appointmentId ? `appointment:${appointmentId}` : "general";
    const existing = groups.get(groupId);
    const label = appointmentId
      ? String(message.appointmentTitle || "").trim() || "Appointment"
      : "General";
    const appointmentDate = appointmentId
      ? String(message.appointmentStartsAt || "").trim()
      : "";
    const messageDate = String(message.createdAt || "").trim();

    if (existing) {
      existing.messages.push(message);
      if (!existing.sortDate || compareDateValues(appointmentDate, existing.sortDate) < 0) {
        existing.sortDate = appointmentDate || existing.sortDate;
      }
      continue;
    }

    groups.set(groupId, {
      id: groupId,
      label,
      messages: [message],
      sortDate: appointmentDate || messageDate,
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      messages: [...group.messages].sort(compareMessagesNewestFirst),
    }))
    .sort(compareGroupsByAppointmentDate);
}

function compareMessagesNewestFirst(
  left: GroupableMessage,
  right: GroupableMessage
) {
  return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
}

function compareGroupsByAppointmentDate(
  left: Pick<MessageGroup, "id" | "label" | "sortDate">,
  right: Pick<MessageGroup, "id" | "label" | "sortDate">
) {
  const leftIsGeneral = left.id === "general";
  const rightIsGeneral = right.id === "general";

  if (leftIsGeneral !== rightIsGeneral) {
    return leftIsGeneral ? 1 : -1;
  }

  const byDate = compareDateValues(left.sortDate, right.sortDate);
  if (byDate !== 0) return byDate;
  return left.label.localeCompare(right.label);
}

function compareDateValues(left: string, right: string) {
  if (left && right) return left.localeCompare(right);
  if (left) return -1;
  if (right) return 1;
  return 0;
}
