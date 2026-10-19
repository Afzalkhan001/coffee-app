/**
 * Open a location in the phone's own maps app (iOS: Apple Maps, Android: the default `geo:` handler,
 * usually Google Maps), with the Google Maps web page as the fallback (web, or no maps app). A plain
 * https Google Maps link opened Safari on iPhones without the Google Maps app installed.
 */
import { Linking, Platform } from 'react-native';

export interface MapPoint {
  lat: number;
  lng: number;
  /** Pin label shown by the maps app. */
  label: string;
}

export function mapsWebUrl({ lat, lng }: MapPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** The native maps deep link for this platform (the web URL on web). */
export function mapsUrl(point: MapPoint, os: string = Platform.OS): string {
  const { lat, lng } = point;
  const label = encodeURIComponent(point.label);
  // Apple Maps uses `q` as the pin's label when the position is given by `ll`.
  if (os === 'ios') return `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
  // geo: intent with a labelled pin at the exact coordinates.
  if (os === 'android') return `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
  return mapsWebUrl(point);
}

/** Never throws: falls back to the web page, and silently gives up if even that can't open. */
export async function openInMaps(point: MapPoint): Promise<void> {
  const opened = await Linking.openURL(mapsUrl(point)).then(
    () => true,
    () => false,
  );
  if (!opened) await Linking.openURL(mapsWebUrl(point)).catch(() => undefined);
}
