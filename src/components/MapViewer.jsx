// src/components/MapViewer.jsx
import React, { useEffect, useRef } from "react";
import { useGoogleMapsLoader } from "../components/useGoogleMapsLoader";

export default function MapViewer({ lat, lng, zoom = 15, height = 260 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const { loaded: gmapsLoaded, error: gmapsError } = useGoogleMapsLoader();

  useEffect(() => {
    if (gmapsError) return;
    if (!gmapsLoaded) return;
    if (!containerRef.current) return;
    const google = window.google;
    if (!google || !google.maps) return;

    const center = { lat: Number(lat) || 13.618770, lng: Number(lng) || 79.448387 };

    if (!mapRef.current) {
      const map = new google.maps.Map(containerRef.current, {
        center,
        zoom,
        disableDefaultUI: true,
        gestureHandling: "greedy",
      });
      mapRef.current = map;
      const marker = new google.maps.Marker({
        position: center,
        map,
        draggable: false, // change to true if you want admin to correct coordinates
      });
      markerRef.current = marker;
    } else {
      try {
        mapRef.current.setCenter(center);
        markerRef.current.setPosition(center);
        google.maps.event.trigger(mapRef.current, "resize");
      } catch (e) { /* ignore */ }
    }

    return () => {
      try {
        if (markerRef.current) google.maps.event.clearInstanceListeners(markerRef.current);
        if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      } catch (e) {}
    };
  }, [gmapsLoaded, gmapsError, lat, lng, zoom]);

  return (
    <div>
      <div ref={containerRef} style={{ width: "100%", height, borderRadius: 8, overflow: "hidden" }} className="bg-gray-100" />
      <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
        <div>
          {lat != null && lng != null ? (
            <>
              <span>Lat: <strong>{Number(lat).toFixed(6)}</strong></span>
              <span className="mx-2">·</span>
              <span>Lng: <strong>{Number(lng).toFixed(6)}</strong></span>
            </>
          ) : <span>Coordinates not available</span>}
        </div>
        {lat != null && lng != null && (
          <a
            className="text-indigo-600 hover:underline"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}