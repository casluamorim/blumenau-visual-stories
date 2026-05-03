// Helpers to handle Google Drive links and turn them into embeddable previews.

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function getDrivePreviewUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function isDriveUrl(url: string): boolean {
  return /(?:drive|docs)\.google\.com/.test(url);
}
