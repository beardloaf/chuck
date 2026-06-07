export type AttachmentType = "audio" | "image" | "video";

export interface Attachment {
  /** Stable local id for React keys. */
  id: string;
  file: File;
  type: AttachmentType;
  /** Object URL for preview. Revoke when removed. */
  previewUrl: string;
  /** Original source ("recorded" vs "uploaded") — purely cosmetic. */
  source: "recorded" | "uploaded";
  durationMs?: number;
  width?: number;
  height?: number;
  /** Waveform peaks (0–255) for audio attachments. */
  peaks?: number[];
}
