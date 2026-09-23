export type GpsPosition = { longitude: number; latitude: number; accuracy: number; timestamp: number };
export function subscribeToLocation(geolocation: Pick<Geolocation, "watchPosition" | "clearWatch">,
  onPosition: (position: GpsPosition) => void, onError: (error: GeolocationPositionError) => void) {
  let active = true;
  const id = geolocation.watchPosition((position) => {
    if (active) onPosition({ longitude: position.coords.longitude, latitude: position.coords.latitude,
      accuracy: position.coords.accuracy, timestamp: position.timestamp });
  }, (error) => { if (active) onError(error); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  return () => { active = false; geolocation.clearWatch(id); };
}
export function distanceMeters(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }) {
  const radians = Math.PI / 180;
  const deltaLat = (b.latitude - a.latitude) * radians;
  const deltaLon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function usablePosition(position: GpsPosition, now = Date.now()) {
  return Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180
    && Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90
    && Number.isFinite(position.accuracy) && position.accuracy >= 0
    && Number.isFinite(position.timestamp) && now - position.timestamp <= 30000 && position.timestamp <= now + 1000;
}
export function nearPlot(position: GpsPosition, destination: { longitude: number; latitude: number }, now = Date.now()) {
  return usablePosition(position, now) && position.accuracy <= 15 && distanceMeters(position, destination) <= 15;
}
