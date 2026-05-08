// Centralized portal URL helpers.
// Production always uses the official agency domain so links never expose
// preview/.lovable.app URLs that look suspicious to clients.

const PRODUCTION_BASE_URL = 'https://sistema.agenciaracun.com';

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('192.168.') ||
    host.endsWith('.local')
  );
}

export function getPortalBaseUrl(): string {
  if (typeof window === 'undefined') return PRODUCTION_BASE_URL;
  const host = window.location.hostname;
  // Use current origin only in clearly local development.
  if (isLocalHost(host)) return window.location.origin;
  // For lovable previews, sandbox URLs, or production custom domain → always
  // hand out the official production URL so shared links are professional.
  return PRODUCTION_BASE_URL;
}

export function buildPortalUrl(slugOrToken: string): string {
  return `${getPortalBaseUrl()}/portal/${slugOrToken}`;
}
