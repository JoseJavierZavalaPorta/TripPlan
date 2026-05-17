// src/components/map/MapView.tsx
// Leaflet map component — must only be used with dynamic import ssr:false
'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { Trip, ItineraryDay } from '@/types';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon path issue with webpack
// ASSUMPTION: Using CDN URLs for marker icons to avoid webpack asset config complexity
import L from 'leaflet';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const activityIcon = L.divIcon({
  html: `<div style="background:#38BDF8;color:#0F172A;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid #0F172A;">A</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface MapViewProps {
  tripId: string;
  trip: Trip;
  itinerary: ItineraryDay[];
}

export function MapView({ trip, itinerary }: MapViewProps) {
  // Collect all points with coordinates
  const points: Array<{ lat: number; lng: number; label: string; type: string }> = [];

  if (trip.destinationLat && trip.destinationLng) {
    points.push({
      lat: trip.destinationLat,
      lng: trip.destinationLng,
      label: trip.destination,
      type: 'destination',
    });
  }

  for (const day of itinerary) {
    for (const item of day.items) {
      if (item.locationLat && item.locationLng) {
        points.push({
          lat: item.locationLat,
          lng: item.locationLng,
          label: item.title,
          type: item.itemType,
        });
      }
    }
  }

  if (points.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
        Sin coordenadas disponibles
      </div>
    );
  }

  const center: LatLngExpression = [points[0].lat, points[0].lng];

  // Build polyline from ordered item coordinates
  const routePoints: LatLngExpression[] = points
    .filter((p) => p.type !== 'destination')
    .map((p) => [p.lat, p.lng] as LatLngExpression);

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route polyline */}
      {routePoints.length > 1 && (
        <Polyline
          positions={routePoints}
          color="#38BDF8"
          weight={3}
          opacity={0.7}
          dashArray="8,6"
        />
      )}

      {/* Markers */}
      {points.map((p, i) => (
        <Marker
          key={i}
          position={[p.lat, p.lng]}
          icon={p.type === 'destination' ? defaultIcon : activityIcon}
        >
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 140 }}>
              <strong style={{ fontSize: 13, color: '#0F172A' }}>{p.label}</strong>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
