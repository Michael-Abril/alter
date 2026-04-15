export type WorkProvider =
  | 'gmail'
  | 'github'
  | 'canvas'
  | 'drive'
  | 'calendar'
  | 'docs'
  | 'local';

export type WorkKind =
  | 'doc'
  | 'pr'
  | 'canvas'
  | 'canvas_prep'
  | 'gmail_draft'
  | 'calendar_event'
  | 'drive_file'
  | 'file';

export type WorkDestinationMetadata = {
  externalUrl?: string | null;
  provider?: WorkProvider;
  kind?: WorkKind;
  submissionUrl?: string | null;
  [key: string]: unknown;
};

export function parseWorkMetadata(metadata: unknown): WorkDestinationMetadata | null {
  if (!metadata) return null;
  try {
    if (typeof metadata === 'string') {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object') return parsed as WorkDestinationMetadata;
      return null;
    }
    if (typeof metadata === 'object') return metadata as WorkDestinationMetadata;
    return null;
  } catch {
    return null;
  }
}

export function linkLabel(meta: WorkDestinationMetadata): string {
  if (meta.kind === 'pr' || meta.provider === 'github') return 'View Pull Request';
  if (meta.kind === 'gmail_draft' || meta.provider === 'gmail') return 'Open Gmail Draft';
  if (meta.kind === 'canvas' || meta.kind === 'canvas_prep' || meta.provider === 'canvas') return 'Open in Canvas';
  if (meta.kind === 'calendar_event' || meta.provider === 'calendar') return 'Open Event';
  if (meta.kind === 'doc' || meta.kind === 'drive_file' || meta.provider === 'drive' || meta.provider === 'docs') {
    return 'Open Document';
  }
  return 'Open Link';
}
