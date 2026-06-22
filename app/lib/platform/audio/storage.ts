export type PreservedAudioStorageIntent =
  | "ask_input"
  | "ask_recovery"
  | "coordinator_message"
  | "receiver_message"
  | "audio_message"
  | "recovered_upload"
  | "unknown";

export type PreservedAudioStorageObject = {
  audioByteSize?: number;
  audioMimeType?: string;
  audioSha256?: string;
  audioUrl: string;
  createdAt?: string;
  storageKey?: string;
};

export type PreserveAudioInput = {
  audioBase64?: string;
  audioBlob?: Blob;
  audioMimeType?: string;
  fileNameHint?: string;
  intent: PreservedAudioStorageIntent;
  receiverId?: string;
};

export type PreservedAudioStorageAdapter = {
  preserveOriginalAudio(input: PreserveAudioInput): Promise<PreservedAudioStorageObject>;
};
