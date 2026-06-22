export type ConnectMessageRecord = {
  audioArtifactId?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioUrl?: string;
  body: string;
  createdAt: string;
  from: string;
  heardAt?: string;
  id: string;
  mainConnectUserPersonId?: string;
  messageType?: string;
  readAt?: string;
  receiverId?: string;
  source?: string;
  to: string;
  transcript?: string;
  transcriptStatus?: string;
};
