import { EarthquakeData, TimePeriod } from '../types';

const URLS: Record<TimePeriod, string> = {
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
  month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson',
};

export const fetchEarthquakes = async (period: TimePeriod = 'day'): Promise<EarthquakeData> => {
  try {
    const response = await fetch(URLS[period]);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data: EarthquakeData = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch earthquake data:", error);
    throw error;
  }
};

export const formatTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat('bn-BD', {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
};

export const getRegionName = (place: string): string => {
  if (!place) return '';
  const parts = place.split(',');
  // If there is a comma, usually the part after the last comma is the country or state
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  // If no comma, the whole string is likely the region name (e.g. "Northern Mid-Atlantic Ridge")
  return place;
};