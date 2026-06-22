export const receiverModel = {
  id: "living-room-receiver",
  displayName: "Living Room Receiver",
  locationLabel: "Living Rm",
  careVipName: "Mom",
  status: "available",
};

export const connectContacts = [
  {
    id: "contact-andrew",
    displayName: "Andrew",
    availabilityLabel: "Free",
    availability: "free",
    lastActiveLabel: "Last active 5 min ago",
    canCall: true,
    canMessage: true,
  },
  {
    id: "contact-susan",
    displayName: "Susan",
    availabilityLabel: "Busy",
    availability: "busy",
    lastActiveLabel: "On a call",
    canCall: true,
    canMessage: true,
  },
  {
    id: "contact-family",
    displayName: "Family",
    availabilityLabel: "Free",
    availability: "free",
    lastActiveLabel: "Family group available",
    canCall: true,
    canMessage: true,
  },
];

export const nextAppointment = {
  id: "appointment-cardiology",
  label: "Next up:",
  title: "Cardiology Follow-Up",
  dayLabel: "Tomorrow",
  timeLabel: "2 PM",
};

export const receiverMessages = [
  {
    id: "message-audio-1",
    from: "Andrew",
    to: "Mom",
    messageType: "audio",
    body: "Don't forget I'll pick you up at 1:30.",
    transcript: "Don't forget I'll pick you up at 1:30.",
    transcriptStatus: "completed",
    audioUrl: "",
    audioDurationMs: 5300,
    heardAt: "",
    createdAt: new Date().toISOString(),
  },
  {
    id: "message-text-1",
    from: "Andrew",
    to: "Mom",
    messageType: "text",
    body: "See you tomorrow.",
    transcript: "",
    transcriptStatus: "not_requested",
    audioUrl: "",
    audioDurationMs: 0,
    heardAt: "seen",
    createdAt: new Date().toISOString(),
  },
];

export const receiverSettings = {
  retroSounds: true,
  buttonBeeps: true,
  retroRingers: true,
  comfortVolume: "med",
  messageTextSize: "standard",
};

export const reminders = [
  {
    id: "reminder-bedtime",
    name: "Bedtime Reminder",
    careVip: "Elizabeth",
    scheduledTime: "22:00",
    message:
      "Elizabeth, it's your scheduled bedtime. Don't forget to put your hearing aids in the charger on your bedside nightstand.",
    allowSnooze: true,
    snoozeMinutes: 15,
    active: true,
    status: "scheduled",
  },
];
