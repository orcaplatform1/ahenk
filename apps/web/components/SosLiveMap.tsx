'use client';

// Acil yardım canlı konum haritası. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY tanımlıysa Google Maps (JavaScript API), değilse
// OpenStreetMap + Leaflet (anahtar gerekmez; hata verilmez). Yalnızca istemcide yüklenir (next/dynamic ssr:false).
// Yeni konum gelince işaret taşınır, harita işareti takip eder.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type GMap = { panTo: (p: { lat: number; lng: number }) => void };
type GMarker = { setPosition: (p: { lat: number; lng: number }) => void };
type GoogleNS = { maps: { Map: new (el: HTMLElement, o: object) => GMap; Marker: new (o: object) => GMarker; SymbolPath: { CIRCLE: number } } };

let googleLoading: Promise<GoogleNS | null> | null = null;
function loadGoogle(): Promise<GoogleNS | null> {
  const w = window as unknown as { google?: GoogleNS };
  if (w.google?.maps) return Promise.resolve(w.google);
  if (!googleLoading) {
    googleLoading = new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY ?? '')}`;
      sc.async = true;
      sc.onload = () => resolve(w.google ?? null);
      sc.onerror = () => { googleLoading = null; resolve(null); };
      document.head.appendChild(sc);
    });
  }
  return googleLoading;
}

export default function SosLiveMap({ lat, lng }: { lat: number; lng: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const gMapRef = useRef<GMap | null>(null);
  const gMarkerRef = useRef<GMarker | null>(null);

  useEffect(() => {
    if (!boxRef.current || mapRef.current || gMapRef.current) return;
    let cancelled = false;
    const startLeaflet = () => {
      if (cancelled || !boxRef.current || mapRef.current) return;
      const map = L.map(boxRef.current, { center: [lat, lng], zoom: 16 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      markerRef.current = L.circleMarker([lat, lng], { radius: 9, color: '#ffffff', weight: 2, fillColor: '#e53935', fillOpacity: 1 }).addTo(map);
      mapRef.current = map;
    };
    if (GOOGLE_KEY) {
      // Google yüklenemezse Leaflet / OSM devam eder
      loadGoogle().then((g) => {
        if (cancelled || !boxRef.current) return;
        if (!g) { startLeaflet(); return; }
        const map = new g.maps.Map(boxRef.current, { center: { lat, lng }, zoom: 16, disableDefaultUI: true, zoomControl: true });
        gMarkerRef.current = new g.maps.Marker({
          map, position: { lat, lng },
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#e53935', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
        });
        gMapRef.current = map;
      });
    } else {
      startLeaflet();
    }
    return () => {
      cancelled = true;
      mapRef.current?.remove(); mapRef.current = null; markerRef.current = null;
      gMapRef.current = null; gMarkerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng]);
    }
    if (gMapRef.current && gMarkerRef.current) {
      gMarkerRef.current.setPosition({ lat, lng });
      gMapRef.current.panTo({ lat, lng });
    }
  }, [lat, lng]);

  return <div ref={boxRef} style={{ height: 240, width: '100%', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }} />;
}
