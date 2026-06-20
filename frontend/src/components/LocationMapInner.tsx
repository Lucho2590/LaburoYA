'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { IGeoLocation } from '@/types';

// El bundler rompe las URLs por defecto de los iconos de Leaflet; las apuntamos a unpkg.
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const MDP_FALLBACK: IGeoLocation = { lat: -38.0023, lng: -57.5575 };

function ClickHandler({ onPick }: { onPick: (loc: IGeoLocation) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

// Recentra el mapa cuando el padre cambia `focus` (GPS / resultado de búsqueda),
// sin interferir con clicks/drag (que no tocan focus).
function Recenter({ focus }: { focus: IGeoLocation | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 14));
  }, [focus, map]);
  return null;
}

interface Props {
  value: IGeoLocation | null;
  onChange: (loc: IGeoLocation) => void;
  center?: IGeoLocation;
  radiusKm?: number;
  focus: IGeoLocation | null;
}

export default function LocationMapInner({ value, onChange, center, radiusKm, focus }: Props) {
  const initial = value || center || MDP_FALLBACK;
  // El círculo del radio se dibuja alrededor del punto elegido (si hay), o del
  // centro de la ciudad como referencia.
  const circleCenter = value || center;

  return (
    <MapContainer
      center={[initial.lat, initial.lng]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onChange} />
      {circleCenter && radiusKm ? (
        <Circle
          center={[circleCenter.lat, circleCenter.lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#E10600', weight: 1, fillColor: '#E10600', fillOpacity: 0.05 }}
        />
      ) : null}
      {value ? (
        <Marker
          position={[value.lat, value.lng]}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = (e.target as L.Marker).getLatLng();
              onChange({ lat: m.lat, lng: m.lng });
            }
          }}
        />
      ) : null}
      <Recenter focus={focus} />
    </MapContainer>
  );
}
