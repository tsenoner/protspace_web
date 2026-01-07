export function isMacOrIos(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaData = (navigator as any).userAgentData;
  const platform = uaData?.platform;

  if (platform) {
    return platform === 'macOS' || platform === 'iOS';
  }

  const ua = navigator.userAgent || '';
  return /Macintosh;.*Mac OS X/.test(ua) || /iPhone|iPad|iPod/.test(ua);
}
