//src/components/useGoogleMapsLoader.js
import { useEffect, useState } from "react";

const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export function useGoogleMapsLoader(apiKey = GOOGLE_MAPS_KEY) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

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
    return () => { /* keep script loaded for reuse */ };
  }, [apiKey]);

  return { loaded, error };
}
