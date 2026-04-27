// src/components/MapPicker.jsx
import React, { useEffect, useRef } from "react";

/**
 * MapPicker
 * Props:
 *  - apiKey (string) optional, falls back to env var
 *  - initial: { lat, lng } default center
 *  - onPick({ lat, lng, address })
 *  - onClose()
 */
const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export function useGoogleMapsLoader(apiKey) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(null);

  useEffect(() => {
    if (!apiKey) {
      setError(new Error("No Google Maps API key"));
      return;
    }
    if (typeof window === "undefined") {
      setError(new Error("No window available"));
      return;
    }
    if (window.google && window.google.maps) {
      setLoaded(true);
      return;
    }

    const id = `gmaps-script-${apiKey}`;
    if (document.getElementById(id)) {
      let cancelled = false;
      const wait = () => {
        if (cancelled) return;
        if (window.google && window.google.maps) setLoaded(true);
        else setTimeout(wait, 100);
      };
      wait();
      return () => { cancelled = true; };
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = (e) => setError(e || new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
    return () => { /* don't remove script */ };
  }, [apiKey]);

  return { loaded, error };
}

// MapPicker (updated) — drop-in replacement
function MapPicker({ apiKey, initial = { lat: 13.607577, lng: 79.448387 }, onPick, onClose }) {
  const { loaded: gmapsLoaded, error: gmapsError } = useGoogleMapsLoader(apiKey || GOOGLE_MAPS_KEY);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const mapRef = useRef(null);
  const initAttemptsRef = useRef(0);

  // Local selection state (do NOT call parent until user confirms)
  const [selected, setSelected] = React.useState({
    lat: initial.lat,
    lng: initial.lng,
    address: null,
  });
  const [reverseGeocoding, setReverseGeocoding] = React.useState(false);

  useEffect(() => {
    if (gmapsError) {
      console.error("Google Maps load error:", gmapsError);
      return;
    }
    if (!gmapsLoaded) return;
    if (!containerRef.current) return;

    const google = window.google;
    if (!google || !google.maps) {
      console.error("window.google.maps not available");
      return;
    }

    const tryInit = () => {
      initAttemptsRef.current += 1;
      const el = containerRef.current;
      const width = el?.offsetWidth || 0;
      const height = el?.offsetHeight || 0;

      if (width === 0 || height === 0) {
        if (initAttemptsRef.current < 8) {
          requestAnimationFrame(tryInit);
        } else {
          setTimeout(tryInit, 300);
        }
        return;
      }

      // If map exists, update center/marker
      if (mapRef.current && markerRef.current) {
        const center = { lat: Number(initial.lat) || 13.607577, lng: Number(initial.lng) || 79.448387 };
        mapRef.current.setCenter(center);
        markerRef.current.setPosition(center);
        google.maps.event.trigger(mapRef.current, "resize");
        // also update local selected
        setSelected((s) => ({ ...s, lat: center.lat, lng: center.lng }));
        return;
      }

      try {
        const center = { lat: Number(initial.lat) || 13.607577, lng: Number(initial.lng) || 79.448387 };
        const map = new google.maps.Map(el, { center, zoom: 13, clickableIcons: true });
        mapRef.current = map;

        const marker = new google.maps.Marker({ position: center, map, draggable: true });
        markerRef.current = marker;

        // helper: reverse-geocode -> update local address (no parent callback)
        const reverseGeocode = (latNum, lngNum) => {
          try {
            setReverseGeocoding(true);
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat: Number(latNum), lng: Number(lngNum) } }, (results, status) => {
              const addr = (status === "OK" && results && results[0]) ? results[0].formatted_address : null;
              setSelected({ lat: Number(latNum), lng: Number(lngNum), address: addr });
              setReverseGeocoding(false);
            });
          } catch (e) {
            setSelected({ lat: Number(latNum), lng: Number(lngNum), address: null });
            setReverseGeocoding(false);
          }
        };

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          // update local selection only
          reverseGeocode(Number(pos.lat()), Number(pos.lng()));
        });

        map.addListener("click", (e) => {
          if (!e?.latLng) return;
          marker.setPosition(e.latLng);
          map.panTo(e.latLng);
          // update local selection only
          reverseGeocode(Number(e.latLng.lat()), Number(e.latLng.lng()));
        });

        // wire up optional search box (if present in DOM)
        try {
          const input = document.getElementById("map-picker-search-input");
          if (input && google.maps.places) {
            const searchBox = new google.maps.places.SearchBox(input);
            map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
            searchBox.addListener("places_changed", () => {
              const places = searchBox.getPlaces();
              if (!places || places.length === 0) return;
              const p = places[0];
              if (!p.geometry || !p.geometry.location) return;
              const loc = p.geometry.location;
              marker.setPosition(loc);
              map.panTo(loc);
              // update local selection only
              reverseGeocode(Number(loc.lat()), Number(loc.lng()));
            });
          }
        } catch (e) {
          // ignore places errors
        }

        // small resize after animations
        setTimeout(() => {
          try {
            google.maps.event.trigger(map, "resize");
            map.setCenter(center);
          } catch (e) { /* ignore */ }
        }, 50);
      } catch (err) {
        console.error("Map init error:", err);
      }
    }; // tryInit

    tryInit();

    return () => {
      try {
        if (markerRef.current) google.maps.event.clearInstanceListeners(markerRef.current);
        if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      } catch (e) { /* ignore */ }
    };
  }, [gmapsLoaded, gmapsError, initial.lat, initial.lng]);

  // If parent changes initial, reflect it locally
  useEffect(() => {
    setSelected((s) => ({
      lat: Number(initial.lat) || s.lat,
      lng: Number(initial.lng) || s.lng,
      address: s.address,
    }));
  }, [initial.lat, initial.lng]);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-4" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-lg font-semibold">Pick location on map</div>
            <div className="text-xs text-gray-500">Drag marker or click on map to choose coordinates. Click <strong>Select this location</strong> to confirm.</div>
          </div>
          <div className="flex items-center gap-2">
            <input id="map-picker-search-input" placeholder="Search address (optional)" className="px-3 py-1 border rounded mr-2" />
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-100">Close</button>
          </div>
        </div>

        {/* Map container */}
        <div ref={containerRef} style={{ width: "100%", height: 420 }} className="rounded bg-gray-100" />

        {/* selection preview + actions */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <div><strong>Selected:</strong></div>
            <div className="text-xs text-gray-700">Lat: {selected.lat?.toFixed?.(6) ?? selected.lat}, Lng: {selected.lng?.toFixed?.(6) ?? selected.lng}</div>
            <div className="text-xs text-gray-600 mt-1">
              {reverseGeocoding ? "Resolving address…" : (selected.address || <span className="text-gray-400">No address</span>)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // call parent with selected and close
                if (typeof onPick === "function") {
                  onPick({
                    lat: selected.lat,
                    lng: selected.lng,
                    address: selected.address,
                  });
                }
                if (typeof onClose === "function") onClose();
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded"
            >
              Select this location
            </button>

            <button onClick={() => {
              // reset selection back to initial if user wants
              if (markerRef.current && mapRef.current) {
                const center = { lat: Number(initial.lat) || 13.607577, lng: Number(initial.lng) || 79.448387 };
                markerRef.current.setPosition(center);
                mapRef.current.panTo(center);
                setSelected({ lat: center.lat, lng: center.lng, address: null });
              }
            }} className="px-3 py-2 rounded bg-gray-100">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default MapPicker;