export interface EarthquakeFeature {
  type: "Feature";
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    url: string;
    detail: string;
    status: string;
    tsunami: number;
    sig: number;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    nst: number | null;
    dmin: number | null;
    rms: number | null;
    gap: number | null;
    magType: string;
    type: string;
    title: string;
    felt: number | null;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number]; // Longitude, Latitude, Depth
  };
  id: string;
}

export interface EarthquakeData {
  type: "FeatureCollection";
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: EarthquakeFeature[];
}

export type ViewMode = 'list' | 'map' | 'safety';

export type TimePeriod = 'day' | 'week' | 'month';

export type MapStyle = 'standard' | 'satellite' | 'dark';

export interface LocationState {
  lat: number;
  lng: number;
}

export interface AlertZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  isVisible?: boolean;
}

export interface AlertNotification {
  id: string;
  quakeId: string;
  zoneId: string;
  zoneName: string;
  quakePlace: string;
  mag: number;
  timestamp: number;
}