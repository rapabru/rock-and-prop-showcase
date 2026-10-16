/**
 * Geometry shared by the map and the database.
 *
 * The same formulas exist as SQL functions; the catalogue is filtered in
 * Postgres, and the test suite holds the database's answers to these
 * TypeScript versions so the two can never drift apart.
 */

/** Great-circle (haversine) distance between two coordinates, in meters. */
export function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** A closed or open ring of [lng, lat] points, GeoJSON order. */
export type Ring = [number, number][];

/**
 * Even-odd (ray-casting) test used for "draw a zone on the map" searches
 * and for neighbourhood boundaries. The ring need not repeat its first point.
 */
export function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
