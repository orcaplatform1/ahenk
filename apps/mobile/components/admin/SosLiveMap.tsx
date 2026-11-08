// apps/web/components/SosLiveMap.tsx karşılığı: OpenStreetMap + Leaflet (1.9.4, web ile aynı sürüm) WebView içinde.
// Yeni konum gelince işaret taşınır, harita işareti takip eder (setLatLng + panTo). baseUrl ahenk.co: OSM karo isteği web ile aynı Referer'la gider.
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';

// Paket tipi: WebView<P = undefined> → props & undefined = never (TS 7). Aynı bileşen doğru prop tipiyle kullanılır.
const Web = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;

const html = (lat: number, lng: number) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%}</style></head>
<body><div id="m"></div><script>
var map=L.map('m',{center:[${lat},${lng}],zoom:16});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var mk=L.circleMarker([${lat},${lng}],{radius:9,color:'#ffffff',weight:2,fillColor:'#e53935',fillOpacity:1}).addTo(map);
window.setPos=function(a,o){mk.setLatLng([a,o]);map.panTo([a,o]);};
</script></body></html>`;

export function SosLiveMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<WebView>(null);
  // İlk konum yalnız haritayı kurarken kullanılır (web: harita bir kez oluşturulur)
  const first = useRef({ lat, lng }).current;
  const source = useRef({ html: html(first.lat, first.lng), baseUrl: 'https://ahenk.co' }).current;
  useEffect(() => {
    ref.current?.injectJavaScript(`window.setPos&&window.setPos(${lat},${lng});true;`);
  }, [lat, lng]);
  return (
    <View style={{ height: 240, width: '100%', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      <Web ref={ref} originWhitelist={['*']} source={source} scrollEnabled={false} nestedScrollEnabled javaScriptEnabled style={{ backgroundColor: 'transparent' }} />
    </View>
  );
}
