type ConnectParticipantIdInput = {
  person_id?: string | null;
};

export function uniqueConnectParticipantPersonIds(
  rows: ConnectParticipantIdInput[]
) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.person_id?.trim())
        .filter((personId): personId is string => Boolean(personId))
    )
  );
}

export function shouldListConnectPeopleFromParticipants(
  participantPersonIds: string[]
) {
  return participantPersonIds.length > 0;
}
