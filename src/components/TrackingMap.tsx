"use client";
import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import type { DriverLocation } from "@/lib/types";
import type * as Leaflet from "leaflet";

type Props = { location: DriverLocation | null };
export default function TrackingMap({ location }: Props) {
  const target = useRef<HTMLDivElement | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const latest = useRef(location);
  latest.current = location;
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const L = await import("leaflet");
      if (cancelled || !target.current || map.current) return;
      const pos = latest.current;
      const center: Leaflet.LatLngExpression = pos ? [pos.latitude, pos.longitude] : [-6.203, 106.827];
      const instance = L.map(target.current, { zoomControl: false, scrollWheelZoom: false }).setView(center, pos ? 15 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(instance);
      L.control.zoom({ position: "bottomright" }).addTo(instance);
      map.current = instance;
      if (pos) {
        marker.current = L.marker([pos.latitude, pos.longitude], { icon: L.divIcon({ className: "driver-pin", html: '<div class="driver-pin-inner">🚚</div>', iconSize: [47, 47], iconAnchor: [23, 23] }) }).addTo(instance);
      }
      setTimeout(() => { if (!cancelled) instance.invalidateSize(); }, 80);
    }
    setup();
    return () => { cancelled=true; marker.current?.remove(); marker.current=null; map.current?.remove(); map.current=null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!location) { marker.current?.remove(); marker.current=null; return; }
    const draw = async () => {
      const L = await import("leaflet");
      if (map.current !== instance) return;
      const latLng: Leaflet.LatLngExpression = [location.latitude, location.longitude];
      if (!marker.current) marker.current = L.marker(latLng, { icon: L.divIcon({ className: "driver-pin", html: '<div class="driver-pin-inner">🚚</div>', iconSize: [47,47], iconAnchor: [23,23] }) }).addTo(instance);
      else marker.current.setLatLng(latLng);
      instance.flyTo(latLng, 15, { animate: true, duration: 0.8 });
    };
    void draw();
  }, [location]);
  return <div className="map-wrap">
    <div ref={target} className="tracking-map" role="img" aria-label="Peta lokasi driver" />
    {!location && <div className="map-empty"><MapPin size={19}/><b>Belum ada posisi driver</b><small>Posisi muncul setelah driver menerima pesanan dan mengaktifkan tracking.</small></div>}
    <div className="map-attribution">OPENSTREETMAP · LIVE TRACKING</div>
  </div>;
}
