'use client';

// Acil yardım canlı konum haritası: OpenStreetMap + Leaflet (API anahtarı gerekmez).
// Yalnızca istemcide yüklenir (next/dynamic ssr:false). Yeni konum gelince işaret taşınır, harita işareti takip eder.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function SosLiveMap({ lat, lng }: { lat: number; lng: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { center: [lat, lng], zoom: 16 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    markerRef.current = L.circleMarker([lat, lng], {
      radius: 9, color: '#ffffff', weight: 2, fillColor: '#e53935', fillOpacity: 1,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng]);
  }, [lat, lng]);

  return <div ref={boxRef} style={{ height: 240, width: '100%', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }} />;
}
