// src/components/CatererList.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../shared-lib/axiosInstance';
import ImageCarousel from './ImageCarousel';
import { getCurrentPosition } from '../utils/geolocation';
import { haversineDistanceKm } from '../utils/distance';

/* ------------------------------------------------------------------ */
/* Config / keys / storage keys                                        */
/* ------------------------------------------------------------------ */

// const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const GMAPS_SCRIPT_ID = 'plater-gmaps-script';
const SELECTED_LOCATION_KEY = 'plater_selected_location';
const RECENT_KEY = 'plater_recent_locations';

/* ------------------------------------------------------------------ */
/* Helpers: local save + broadcast                                     */
/* ------------------------------------------------------------------ */
const saveSelectedLocation = (payload) => {
  // payload: { label, lat?, lng?, address?, place_id?, updated_at? }
  try {
    const normalized = {
      label: (payload.label || '').trim(),
      lat: payload.lat != null ? Number(payload.lat) : null,
      lng: payload.lng != null ? Number(payload.lng) : null,
      address: payload.address ?? null,
      place_id: payload.place_id ?? null,
      updated_at: payload.updated_at ?? Date.now(),
    };
    localStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('plater:selected-location-changed', { detail: normalized }));
    return normalized;
  } catch (e) {
    // localStorage may fail in some environments
    return payload;
  }
};

/* ------------------------------------------------------------------ */
/* Load Google Maps script (single instance)                           */
/* ------------------------------------------------------------------ */
const loadGoogleMaps = () =>
  new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve(window.google.maps);
    if (document.getElementById(GMAPS_SCRIPT_ID)) {
      const check = () =>
        (window.google && window.google.maps) ? resolve(window.google.maps) : setTimeout(check, 150);
      return check();
    }
    const s = document.createElement('script');
    s.id = GMAPS_SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`;
    s.onload = () => (window.google && window.google.maps ? resolve(window.google.maps) : reject(new Error('Google maps failed to load')));
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });

/* ------------------------------------------------------------------ */
/* MapModal: draggable pin, reverse geocode, returns {lat,lng,address}  */
/* ------------------------------------------------------------------ */
const MapModal = ({ open, onClose, center = { lat: 13.623989, lng: 79.42431 }, marker = null, onConfirm }) => {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [addr, setAddr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    let map;

    loadGoogleMaps()
      .then((maps) => {
        if (!mounted) return;
        map = new maps.Map(containerRef.current, {
          center,
          zoom: 16,
          streetViewControl: false,
          fullscreenControl: false,
        });
        geocoderRef.current = new maps.Geocoder();

        const initialPos = marker ?? center;
        markerRef.current = new maps.Marker({
          position: initialPos,
          map,
          draggable: true,
        });

        const reverse = (lat, lng) => {
          if (!geocoderRef.current) return;
          setBusy(true);
          geocoderRef.current.geocode({ location: { lat, lng } }, (res, status) => {
            setBusy(false);
            if (status === 'OK' && res?.length) setAddr(res[0].formatted_address);
            else setAddr(null);
          });
        };

        reverse(initialPos.lat, initialPos.lng);

        maps.event.addListener(map, 'click', (ev) => {
          const lat = ev.latLng.lat();
          const lng = ev.latLng.lng();
          markerRef.current.setPosition({ lat, lng });
          reverse(lat, lng);
        });

        maps.event.addListener(markerRef.current, 'dragend', (ev) => {
          const lat = ev.latLng.lat();
          const lng = ev.latLng.lng();
          reverse(lat, lng);
        });

        mapRef.current = map;
      })
      .catch((err) => {
        console.error('GMAPS load error', err);
      });

    return () => {
      mounted = false;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
    };
  }, [open, center, marker]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!markerRef.current) return;
    const pos = markerRef.current.getPosition();
    const lat = pos.lat();
    const lng = pos.lng();
    onConfirm?.({ lat, lng, address: addr || null });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[95%] max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="text-lg font-medium">Move map to adjust location</h3>
          <button onClick={onClose} className="text-sm px-2 py-1">✕</button>
        </div>

        <div style={{ height: 440 }} className="w-full">
          <div ref={containerRef} className="w-full h-full" />
        </div>

        <div className="px-4 py-3 border-t flex items-center gap-3">
          <div className="flex-1 text-sm">
            <div>
              Picked:&nbsp;
              <strong>
                {markerRef.current ? `${markerRef.current.getPosition().lat().toFixed(6)}, ${markerRef.current.getPosition().lng().toFixed(6)}` : '—'}
              </strong>
            </div>
            <div className="text-xs text-gray-500">{addr ? addr : busy ? 'Resolving address…' : 'Address not available'}</div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleConfirm} className="bg-indigo-600 text-white px-4 py-2 rounded">Confirm Location</button>
            <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */
const StarBar = ({ rating = 0 }) => {
  const v = Number(rating) || 0;
  const full = Math.round(Math.max(0, Math.min(5, v)));
  return (
    <span className="inline-flex items-center" aria-label={`Rating ${v.toFixed(1)} out of 5`}>
      <span className="text-yellow-500" aria-hidden>
        {'★'.repeat(full) || '★'}
        <span className="text-gray-300">{'★'.repeat(5 - full)}</span>
      </span>
      <span className="text-gray-600 text-sm ml-2">{v.toFixed(1)}</span>
    </span>
  );
};

const CuisineBadge = ({ text }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
    {text}
  </span>
);

const SkeletonCard = () => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="h-40 w-full bg-gray-200 rounded-lg mb-3" />
    <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
    <div className="h-4 w-1/2 bg-gray-200 rounded mb-2" />
    <div className="h-4 w-2/3 bg-gray-200 rounded" />
  </div>
);

const PLATE_OPTIONS = [30, 50, 100, 200, 300, 400, 500, 700, 1000, '1000+'];

const buildImageUrl = (img) => {
  if (!img && img !== '') return null;
  if (typeof img === 'string') return img.trim() || null;
  if (typeof img === 'object' && img !== null) {
    const url = img.image || img.url || img.path || img.src || null;
    if ('is_approved' in img) return img.is_approved === true && url ? url : null;
    return url || null;
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Main: CatererList                                                   */
/* ------------------------------------------------------------------ */
const CatererList = ({ refreshKey, userRole }) => {
  const navigate = useNavigate();

  // list / loading
  const [caterers, setCaterers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingImageCounts, setPendingImageCounts] = useState({});

  // filters / UI
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState('Any');
  const [selectedPlates, setSelectedPlates] = useState(null);
  const [location, setLocation] = useState('');
  const [sortBy, setSortBy] = useState('ratingHigh');
  const [eventType, setEventType] = useState('Any');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const today = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // location state
  const [userLocation, setUserLocation] = useState(null); // { latitude, longitude }
  const [radiusKm] = useState(20);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locDropdownOpen, setLocDropdownOpen] = useState(false);
  const [recentLocations, setRecentLocations] = useState([]);
  const locDropdownRef = useRef(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const defaultCenter = { lat: 13.623989, lng: 79.42431 };
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [markerPos, setMarkerPos] = useState(defaultCenter);
  const [pickedAddress, setPickedAddress] = useState(null);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [hasExplicitLocation, setHasExplicitLocation] = useState(false);
  const isAuthenticated = !!userRole;

  // pagination
  const itemsPerPage = 8;
  const [page, setPage] = useState(1);

  const formatCoordForServer = (v, decimals = 6) => {
    if (v == null) return null;
    // clamp to decimals and remove any trailing zeros
    const num = Number(v);
    if (!Number.isFinite(num)) return null;
    // use toFixed(decimals) then parseFloat so we send a number with limited fraction digits
    return parseFloat(num.toFixed(decimals));
  };
  /* -------------------------
     Server helpers
     ------------------------- */
  const postSelectedLocationToServer = useCallback(async ({ label, address = null, lat = null, lng = null, place_id = '' }) => {
    const payload = {
      label: label || null,
      address: address || null,
      lat: lat != null ? formatCoordForServer(lat, 6) : null,
      lng: lng != null ? formatCoordForServer(lng, 6) : null,
      place_id: place_id == null ? '' : String(place_id),
    };
    try {
      const res = await axiosInstance.post('/api/users/me/selected-location/', payload);
      return res.data;
    } catch (err) {
      // If auth error, return null so caller falls back to local save
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        console.warn('Skipping server save (no auth), will fallback to local.');
        return null;
      }
      throw err;
    }
  }, []);
  const getSelectedLocationFromServer = useCallback(async () => {
    const res = await axiosInstance.get('/api/users/me/selected-location/');
    if (!res || !res.data) return null;
    const d = res.data;
    return Array.isArray(d) ? (d.length ? d[0] : null) : d;
  }, []);

  /* -------------------------
     Load recent & local selected location
     ------------------------- */
  useEffect(() => {
    try {
      const rawRecent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      const normalized = Array.isArray(rawRecent)
        ? rawRecent.map((it) => {
          if (!it) return null;
          if (typeof it === 'string') return { label: it, lat: null, lng: null };
          if (typeof it === 'object' && it.label) return { label: it.label, lat: it.lat ?? null, lng: it.lng ?? null };
          return null;
        }).filter(Boolean) : [];
      setRecentLocations(normalized);
    } catch (e) {
      setRecentLocations([]);
    }

    try {
      const selected = JSON.parse(localStorage.getItem(SELECTED_LOCATION_KEY) || 'null');
      if (selected && selected.label) {
        setLocation(selected.label);
        if (selected.lat != null && selected.lng != null) {
          setUserLocation({ latitude: Number(selected.lat), longitude: Number(selected.lng) });
          setMarkerPos({ lat: Number(selected.lat), lng: Number(selected.lng) });
          setMapCenter({ lat: Number(selected.lat), lng: Number(selected.lng) });
          setHasExplicitLocation(true);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  /* -------------------------
     Try browser geolocation once (don't override saved selected location)
     ------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(SELECTED_LOCATION_KEY) || 'null');
        if (saved && saved.lat != null && saved.lng != null) return;
        const pos = await getCurrentPosition();
        setUserLocation({ latitude: pos.latitude, longitude: pos.longitude });
      } catch (err) {
        setLocationPermissionDenied(true);
      }
    })();
  }, []);

  /* -------------------------
     Try to load server-saved selected location (if authenticated)
     ------------------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Only attempt server call if we have a token in localStorage
        const token = localStorage.getItem('accessToken');
        if (!token) {
          // no token yet — skip server call
          return;
        }

        const serverLoc = await getSelectedLocationFromServer();
        if (!mounted || !serverLoc) return;
        if (serverLoc.label) setLocation(serverLoc.label);
        if (serverLoc.lat != null && serverLoc.lng != null) {
          setUserLocation({ latitude: Number(serverLoc.lat), longitude: Number(serverLoc.lng) });
          setMarkerPos({ lat: Number(serverLoc.lat), lng: Number(serverLoc.lng) });
          setMapCenter({ lat: Number(serverLoc.lat), lng: Number(serverLoc.lng) });
          saveSelectedLocation({
            label: serverLoc.label,
            lat: Number(serverLoc.lat),
            lng: Number(serverLoc.lng),
            address: serverLoc.address ?? null,
            place_id: serverLoc.place_id ?? null,
            updated_at: serverLoc.updated_at ?? Date.now()
          });
        }
      } catch (err) {
        // ignore — fallback to localStorage
        console.warn('Loading server saved location skipped/failed:', err);
      }
    })();
    return () => { mounted = false; };
  }, [getSelectedLocationFromServer]);

  /* -------------------------
     Fetch caterers and pending images (simple)
     ------------------------- */
  const fetchCaterers = useCallback(async () => {
    setLoading(true);

    try {
      // get event coords from selected location (preferred)
      let eventLat = null;
      let eventLng = null;

      // 1) Try from state
      if (userLocation?.latitude != null && userLocation?.longitude != null) {
        eventLat = userLocation.latitude;
        eventLng = userLocation.longitude;
      }

      // 2) Fallback from saved selected location (localStorage)
      if (eventLat == null || eventLng == null) {
        try {
          const saved = JSON.parse(localStorage.getItem(SELECTED_LOCATION_KEY) || "null");
          if (saved?.lat != null && saved?.lng != null) {
            eventLat = Number(saved.lat);
            eventLng = Number(saved.lng);
          }
        } catch { }
      }

      // build request URL based on whether location exists
      const params = {};
      if (eventLat != null && eventLng != null) {
        params.event_lat = formatCoordForServer(eventLat, 6);
        params.event_lng = formatCoordForServer(eventLng, 6);
      }

      const res = await axiosInstance.get("/api/caterers/", { params });

      const withUX = (res.data || []).map((c, i) => {
        const rawAvg = c.rating_avg ?? c.rating ?? c.reviews_avg ?? 0;
        const rating = typeof rawAvg === "string" || typeof rawAvg === "number" ? Number(rawAvg) || 0 : 0;

        const minPlate =
          Number(c.min_plate_capacity ?? c.minPlates ?? c.min_capacity ?? 0) ||
          Math.floor(Math.random() * 80) + 20;

        const maxPlate =
          Number(c.max_plate_capacity ?? c.maxPlates ?? c.max_capacity ?? 0) ||
          Math.max(minPlate + Math.floor(Math.random() * 400), minPlate + 20);

        const activeLocation = c.active_location ?? c.location ?? null;
        const al_lat = activeLocation?.latitude ?? activeLocation?.lat ?? null;
        const al_lng = activeLocation?.longitude ?? activeLocation?.lng ?? null;
        const serviceRadiusKm = Number(activeLocation?.service_radius_km ?? 0);

        return {
          ...c,
          id: c.id ?? i,
          rating,
          images: Array.isArray(c.images) ? c.images.map(buildImageUrl).filter(Boolean) : [],
          cuisine_type: c.cuisine_type ?? c.cuisine ?? null,
          active_location: activeLocation
            ? {
              latitude: Number(al_lat),
              longitude: Number(al_lng),
              service_radius_km: serviceRadiusKm,
            }
            : null,
          max_delivery_distance: serviceRadiusKm,
          min_plate_capacity: Number(minPlate),
          max_plate_capacity: Number(maxPlate),
          distance_km: null,
        };
      });

      // Distance calculation remains same
      let computed = withUX;
      if (userLocation) {
        computed = withUX.map((ct) => {
          if (ct.active_location?.latitude && ct.active_location?.longitude) {
            const km = haversineDistanceKm(
              [userLocation.latitude, userLocation.longitude],
              [Number(ct.active_location.latitude), Number(ct.active_location.longitude)]
            );
            return { ...ct, distance_km: Number(km.toFixed(2)) };
          }
          return ct;
        });
      }

      setCaterers(computed);
    } catch (err) {
      console.error("Fetch caterers failed:", err);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    // whenever user selects event location -> refetch caterers with event_lat/lng
    if (userLocation?.latitude != null && userLocation?.longitude != null) {
      fetchCaterers();
    }
  }, [userLocation, fetchCaterers]);


  const fetchPendingImageCounts = useCallback(async () => {
    if (userRole !== 'admin') return;
    try {
      const res = await axiosInstance.get('/api/caterer-images/', { params: { is_approved: 'false', is_rejected: 'false' } });
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      const counts = {};
      data.forEach((img) => {
        const cid = img.caterer ?? img.caterer_id ?? null;
        if (!cid) return;
        counts[cid] = (counts[cid] || 0) + 1;
      });
      setPendingImageCounts(counts);
    } catch (err) {
      setPendingImageCounts({});
    }
  }, [userRole]);

  useEffect(() => {
    fetchCaterers();
    fetchPendingImageCounts();
  }, [fetchCaterers, fetchPendingImageCounts, refreshKey]);

  useEffect(() => {
    if (!userLocation || !caterers.length) return;
    setCaterers((prev) =>
      prev.map((ct) => {
        if (ct.active_location?.latitude && ct.active_location?.longitude) {
          const km = haversineDistanceKm(
            [userLocation.latitude, userLocation.longitude],
            [Number(ct.active_location.latitude), Number(ct.active_location.longitude)]
          );
          return { ...ct, distance_km: Number(km.toFixed(2)) };
        }
        return ct;
      })
    );
  }, [userLocation]); // eslint-disable-line

  /* -------------------------
     UI helpers: recent list, save recent, choose recent
     ------------------------- */
  const saveRecentLocation = (label, lat = null, lng = null) => {
    if (!label || !label.trim()) return;
    const obj = { label: label.trim(), lat: lat ?? null, lng: lng ?? null, updated_at: Date.now() };
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      const filtered = (Array.isArray(raw) ? raw : []).filter((r) => (r.label || '').toLowerCase() !== obj.label.toLowerCase());
      const updated = [obj, ...filtered].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      setRecentLocations(updated);
    } catch (e) {
      // ignore
    }
  };

  const handleChooseRecent = (value) => {
    let label = null; let lat = null; let lng = null;
    if (typeof value === 'string') label = value;
    else if (value && typeof value === 'object') { label = value.label; lat = value.lat ?? null; lng = value.lng ?? null; }
    if (!label) return;
    setLocation(label);
    saveRecentLocation(label, lat, lng);
    setLocDropdownOpen(false);
    if (lat != null && lng != null) {
      const loc = { latitude: Number(lat), longitude: Number(lng) };
      setUserLocation(loc);
      setMarkerPos({ lat: Number(lat), lng: Number(lng) });
      setMapCenter({ lat: Number(lat), lng: Number(lng) });
      try { localStorage.setItem('userLocation', JSON.stringify(loc)); } catch { }
    }
    setHasExplicitLocation(true);
  };

  /* -------------------------
     Use My Location
     ------------------------- */
  const handleUseMyLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      const loc = { latitude: pos.latitude, longitude: pos.longitude };
      setUserLocation(loc);
      try { localStorage.setItem('userLocation', JSON.stringify(loc)); } catch { }
      const label = 'My current location';
      saveSelectedLocation({ label, lat: loc.latitude, lng: loc.longitude, updated_at: Date.now() });
      setLocation(label);
      setMarkerPos({ lat: loc.latitude, lng: loc.longitude });
      setMapCenter({ lat: loc.latitude, lng: loc.longitude });
      setLocDropdownOpen(false);
    } catch (err) {
      setLocationPermissionDenied(true);
      console.warn('Unable to get location:', err);
    }
    setHasExplicitLocation(true);
  };

  /* -------------------------
     Map confirm flow (persist to server, fallback to local)
     ------------------------- */
  const handleMapConfirm = async ({ lat, lng, address, place_id = '' }) => {
    const label = address || location || 'Pinned location';
    // optimistic UI update
    setPickedAddress(address || null);
    setLocation(label);
    setUserLocation({ latitude: Number(lat), longitude: Number(lng) });
    setMarkerPos({ lat: Number(lat), lng: Number(lng) });
    setMapCenter({ lat: Number(lat), lng: Number(lng) });
    saveRecentLocation(label, lat, lng);

    // try server persist
    try {
      const saved = await postSelectedLocationToServer({
        label,
        address: address || null,
        lat,
        lng,
        place_id: place_id || ''
      });

      const payload = {
        label: saved.label || label,
        address: saved.address ?? address ?? null,
        lat: saved.lat != null ? Number(saved.lat) : formatCoordForServer(lat, 6),
        lng: saved.lng != null ? Number(saved.lng) : formatCoordForServer(lng, 6),
        place_id: saved.place_id ?? place_id ?? '',
        updated_at: saved.updated_at ?? Date.now(),
      };
      saveSelectedLocation(payload);
    } catch (err) {
      // fallback: save locally and broadcast
      console.warn('Persisting selected location to server failed — falling back to localStorage.', err?.message || err);
      saveSelectedLocation({
        label, lat: formatCoordForServer(lat, 6), lng: formatCoordForServer(lng, 6), address: address || null, place_id: place_id || '', updated_at: Date.now(),
      });
    } finally {
      setMapModalOpen(false);
      setLocDropdownOpen(false);
    }
    setHasExplicitLocation(true);
  };
  /********************************************************************************
 * Helper: when user clicks a caterer card
 * - If not authenticated => show sign-in prompt (existing UX)
 * - If authenticated and a selected location exists (userLocation OR saved SELECTED_LOCATION_KEY with lat/lng),
 *   navigate to caterer
 * - Otherwise highlight + scroll the location input so user knows to set event location
 ********************************************************************************/
  const highlightLocationInput = () => {
    try {
      const el = document.getElementById('plater-location-input');
      if (!el) return;
      // add temporary highlight classes (Tailwind utility classes). If your build strips unknown classes,
      // you can use inline style changes instead.
      el.classList.add('ring-2', 'ring-red-400', 'animate-pulse');
      // scroll into view near center
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // for extra visibility, focus it
      el.focus({ preventScroll: true });
      // remove highlight after a short delay
      setTimeout(() => {
        try {
          el.classList.remove('ring-2', 'ring-red-400', 'animate-pulse');
        } catch (e) { }
      }, 1400);
    } catch (e) {
      console.warn('highlightLocationInput failed', e);
    }
  };

  const userHasSelectedCoords = () => {
    if (!hasExplicitLocation) return false;

    if (userLocation?.latitude != null && userLocation?.longitude != null) return true;

    try {
      const raw = JSON.parse(localStorage.getItem(SELECTED_LOCATION_KEY) || 'null');
      return raw?.lat != null && raw?.lng != null;
    } catch {
      return false;
    }
  };

  const handleCatererClick = (caterer) => {
    // if not signed in, keep previous behavior (open sign in prompt)
    if (!isAuthenticated) {
      setShowSignInPrompt(true);
      return;
    }

    // if user already has event coordinates selected, proceed to detail page
    if (userHasSelectedCoords()) {
      navigate(`/caterer/${caterer.id}`);
      return;
    }

    // else highlight the input location box so user understands they need to set event location
    highlightLocationInput();

    // optionally, show a small toast/message so it's clearer
    try {
      // if you use toast elsewhere (react-toastify), use it; otherwise comment out
      // toast.info('Please choose your event location before viewing caterer details.');
      // fallback quick UI: set locDropdownOpen true so map / recent shows
      setLocDropdownOpen(true);
    } catch (e) { }
  };
  /* -------------------------
     Small UI handlers
     ------------------------- */
  useEffect(() => {
    const handleOutside = (e) => {
      if (locDropdownRef.current && !locDropdownRef.current.contains(e.target)) setLocDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => { setPage(1); }, [search, cuisine, selectedPlates, location, sortBy, eventType, nearbyOnly, radiusKm, eventDate, eventTime]);

  const handleLocationKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (location && location.trim()) {
        saveRecentLocation(location);
        setLocDropdownOpen(false);
      }
    } else if (e.key === 'ArrowDown') {
      setLocDropdownOpen(true);
    }
  };
  const onLocationArrowClick = () => {
    if (!isAuthenticated) {
      // ask to sign in
      setShowSignInPrompt(true);
      return;
    }
    setLocDropdownOpen((s) => !s);
  };

  const handleClearAll = () => {
    setSearch('');
    setCuisine('Any');
    setSelectedPlates(null);
    setLocation('');
    setSortBy('ratingHigh');
    setEventType('Any');
    setNearbyOnly(false);
    setPage(1);
    setEventDate('');
    setEventTime('');
    setUserLocation(null);
    setHasExplicitLocation(false);
    localStorage.removeItem(SELECTED_LOCATION_KEY);
    try { localStorage.removeItem(SELECTED_LOCATION_KEY); } catch { }
  };

  /* -------------------------
     Filtering / sorting / partitioning
     ------------------------- */
  const filteredThenPartitioned = useMemo(() => {
    let out = [...caterers];

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        ((c.cuisine_type || '')).toLowerCase().includes(q) ||
        (Array.isArray(c.services) && c.services.join(' ').toLowerCase().includes(q))
      );
    }

    if (cuisine !== 'Any') {
      const test = cuisine.toLowerCase();
      out = out.filter((c) => (c.cuisine_type || '').toLowerCase().includes(test));
    }

    if (eventType !== 'Any') {
      const ev = eventType.toLowerCase();
      out = out.filter((c) => Array.isArray(c.services) && c.services.some((s) => (s || '').toLowerCase().includes(ev)));
    }

    if (selectedPlates !== null) {
      if (selectedPlates === '1000+') {
        out = out.filter((c) => {
          const min = Number(c.min_plate_capacity ?? 0);
          const max = Number(c.max_plate_capacity ?? 0);
          if (!min && !max) return false;
          return max >= 1001 || min >= 1001;
        });
      } else {
        const want = Number(selectedPlates);
        out = out.filter((c) => {
          const min = Number(c.min_plate_capacity ?? 0);
          const max = Number(c.max_plate_capacity ?? 0);
          if (!min && !max) return false;
          if (min && !max) return want >= min;
          if (!min && max) return want <= max;
          return want >= min && want <= max;
        });
      }
    }

    let hasSelectedCoords = false;
    try {
      const savedSelected = JSON.parse(localStorage.getItem(SELECTED_LOCATION_KEY) || 'null');
      hasSelectedCoords = !!(savedSelected && savedSelected.lat != null && savedSelected.lng != null);
    } catch (e) {
      hasSelectedCoords = false;
    }

    if (location.trim() && !hasSelectedCoords) {
      const loc = location.toLowerCase();
      out = out.filter((c) =>
        (c.city || '').toLowerCase().includes(loc) ||
        (c.address || '').toLowerCase().includes(loc)
      );
    }

    if (nearbyOnly && userLocation) {
      out = out.filter((c) => typeof c.distance_km === 'number' && c.distance_km <= radiusKm);
    }

    if (sortBy === 'ratingHigh') out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'priceLow') out.sort((a, b) => (a.price_per_plate || 0) - (b.price_per_plate || 0));
    else if (sortBy === 'priceHigh') out.sort((a, b) => (b.price_per_plate || 0) - (a.price_per_plate || 0));
    else if (sortBy === 'distance') out.sort((a, b) => (a.distance_km ?? 99999) - (b.distance_km ?? 99999));

    const inRange = [];
    const outRange = [];
    const unknown = [];
    out.forEach((c) => {
      const radius = Number(c.active_location?.service_radius_km ?? c.max_delivery_distance ?? 0);

      if (userLocation && c.active_location?.latitude && c.active_location?.longitude && radius > 0) {
        const dist = haversineDistanceKm(
          [userLocation.latitude, userLocation.longitude],
          [Number(c.active_location.latitude), Number(c.active_location.longitude)]
        );
        if (dist <= radius) {
          inRange.push({ ...c, distance_km: Number(dist.toFixed(2)), within_delivery: true });
        } else {
          outRange.push({ ...c, distance_km: Number(dist.toFixed(2)), within_delivery: false });
        }
      } else if (!userLocation) {
        unknown.push({ ...c, within_delivery: null });
      } else {
        unknown.push({ ...c, within_delivery: null });
      }
    });

    return [...inRange, ...unknown, ...outRange];
  }, [caterers, search, cuisine, selectedPlates, location, sortBy, eventType, nearbyOnly, radiusKm, userLocation]);

  const totalPages = Math.max(1, Math.ceil(filteredThenPartitioned.length / itemsPerPage));
  const start = (page - 1) * itemsPerPage;
  const current = filteredThenPartitioned.slice(start, start + itemsPerPage);

  /* -------------------------
     Render
     ------------------------- */
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Heading simplified for brevity */}
      <h2 className="mb-6 text-center text-2xl font-semibold">Book your catering services</h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
        <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="border p-2 rounded-md md:col-span-2" />

        <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="border p-2 rounded-md">
          <option value="Any">Event: Any</option>
          <option value="Weddings">Weddings</option>
          <option value="Festivals">Festivals</option>
          <option value="Birthdays">Parties</option>
          <option value="Corporate">Corporate Events</option>
          <option value="Corporate">Rituals</option>
          <option value="Corporate">Group Gatherings</option>
        </select>

        <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="border p-2 rounded-md">
          <option value="Any">Cuisine: Any</option>
          <option value="Veg">Only Veg</option>
          <option value="Non-Veg">Only Non-Veg</option>
          <option value="Both">Both</option>
        </select>

        {/* Location input + dropdown */}
        <div className="relative" ref={locDropdownRef}>
          <div className="flex items-center">
            <input id="plater-location-input" type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={handleLocationKeyDown} className="border p-2 rounded-l-md w-full" />
            <button type="button" onClick={onLocationArrowClick} className="border border-l-0 px-3 rounded-r-md h-10" aria-label="Open location menu">
              ▼
            </button>
          </div>

          {locDropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 bg-white border rounded-xl shadow-lg z-30 overflow-hidden">

              {/* CURRENT LOCATION */}
              <button
                onClick={handleUseMyLocation}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition"
              >
                <span className="text-xl">📍</span>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">
                    Use current location
                  </div>
                  <div className="text-xs text-gray-500">
                    Detect your GPS location as Event location
                  </div>
                </div>
              </button>

              {/* MAP PICKER */}
              <button
                onClick={() => {
                  setMapCenter(
                    userLocation
                      ? { lat: Number(userLocation.latitude), lng: Number(userLocation.longitude) }
                      : defaultCenter
                  );
                  setMarkerPos(
                    userLocation
                      ? { lat: Number(userLocation.latitude), lng: Number(userLocation.longitude) }
                      : defaultCenter
                  );
                  setMapModalOpen(true);
                  setLocDropdownOpen(false);
                }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition border-t"
              >
                <span className="text-xl">🗺️</span>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">
                    Choose location on map
                  </div>
                  <div className="text-xs text-gray-500">
                    Pin exact event venue location
                  </div>
                </div>
              </button>

              {/* RECENT LOCATIONS */}
              {recentLocations.length > 0 && (
                <>
                  <div className="border-t px-4 py-2 text-xs font-semibold text-gray-500">
                    RECENT LOCATIONS
                  </div>
                  <ul className="max-h-44 overflow-auto">
                    {recentLocations.map((r) => (
                      <li
                        key={r.label}
                        onClick={() => handleChooseRecent(r)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm flex items-center gap-2"
                      >
                        <span className="text-base">📌</span>
                        <span className="truncate">{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border p-2 rounded-md">
          <option value="ratingHigh">Sort: Rating</option>
          <option value="priceLow">Price: Low → High</option>
          <option value="distance">Distance</option>
        </select>
      </div>

      {/* Event date/time + plates */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <div className="text-sm">Event date</div>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="border p-2 rounded" min={today} />
        </label>

        <div className="flex items-center gap-2">
          <div className="text-sm">Plates</div>
          <select value={selectedPlates ?? ''} onChange={(e) => { const v = e.target.value; setSelectedPlates(v === '' ? null : (v === '1000+' ? '1000+' : Number(v))); }} className="border p-2 rounded">
            <option value=''>Any</option>
            {PLATE_OPTIONS.map((opt) => (<option key={String(opt)} value={opt === '1000+' ? '1000+' : opt}>{opt === '1000+' ? '>1000' : `${opt} plates`}</option>))}
          </select>
        </div>

        <div className="ml-auto">
          {(search || cuisine !== 'Any' || location || selectedPlates !== null || eventType !== 'Any' || nearbyOnly || eventDate || eventTime) && (
            <button onClick={handleClearAll} className="text-sm text-red-600">Clear all</button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filteredThenPartitioned.length === 0 ? (
        <p className="text-center text-gray-500">No caterers found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {current.map((c) => {
            const isInactive =
              c?.is_active === false ||
              c?.is_active === "false" ||
              c?.status === "inactive";

            return (
              <div
                key={c.id}
                className={`group bg-white rounded-2xl border shadow-sm transition ${isInactive
                  ? "opacity-60 grayscale cursor-not-allowed"
                  : "hover:shadow-xl cursor-pointer"
                  }`}
                onClick={isInactive ? undefined : () => handleCatererClick(c)}
              >
                <div className="relative h-40 w-full overflow-hidden">
                  <ImageCarousel
                    images={Array.isArray(c.images) ? c.images : []}
                    height="h-40"
                    rounded="rounded-2xl"
                    autoplay
                  />

                  {/* Discount badge */}
                  {c.discount && (
                    <span className="absolute top-2 left-2 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">
                      {c.discount}% OFF
                    </span>
                  )}

                  {/* Active / Inactive badge */}
                  {c.is_active && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full">
                      Active
                    </span>
                  )}
                  {isInactive && (
                    <span className="absolute top-2 right-2 bg-gray-500 text-white text-[10px] px-2 py-1 rounded-full">
                      Not available
                    </span>
                  )}

                  {userRole === "admin" && (pendingImageCounts[c.id] || 0) > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/image-approvals?caterer_id=${c.id}`);
                      }}
                      className="absolute bottom-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full"
                    >
                      {pendingImageCounts[c.id]}
                    </button>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold line-clamp-1">{c.name}</h3>
                    <StarBar rating={c.rating_avg ?? c.rating} />
                  </div>

                  <div className="mt-3 text-sm text-gray-700">
                    {(() => {
                      const pkgs = Array.isArray(c.public_packages)
                        ? c.public_packages
                        : Array.isArray(c.packages)
                          ? c.packages
                          : [];
                      const numericPkgs = pkgs
                        .map((p) => ({
                          ...p,
                          _priceNum: Number(p.price_per_plate ?? p.price ?? NaN),
                        }))
                        .filter((p) => Number.isFinite(p._priceNum));
                      const cheapest = numericPkgs.length
                        ? numericPkgs.reduce((a, b) =>
                          a._priceNum <= b._priceNum ? a : b
                        )
                        : pkgs.length
                          ? pkgs[0]
                          : null;
                      const displayPrice =
                        cheapest &&
                          Number.isFinite(
                            Number(cheapest.price_per_plate ?? cheapest.price)
                          )
                          ? `₹${Number(
                            cheapest.price_per_plate ?? cheapest.price
                          ).toFixed(2)}`
                          : null;
                      return displayPrice ? (
                        <div>
                          <span className="font-medium text-gray-900">
                            {displayPrice}
                          </span>
                          <span className="text-gray-500 ml-1">/ plate</span>
                        </div>
                      ) : (
                        <div className="text-gray-400">Price on request</div>
                      );
                    })()}
                    {isInactive && (
                      <p className="mt-1 text-xs font-semibold text-red-500">
                        Caterer inactive or fully booked
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredThenPartitioned.length > itemsPerPage && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-200 rounded">Previous</button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 bg-gray-200 rounded">Next</button>
        </div>
      )}

      {/* Map Picker Modal */}
      <MapModal open={mapModalOpen} onClose={() => setMapModalOpen(false)} center={mapCenter} marker={markerPos} onConfirm={handleMapConfirm} />
    </div>
  );
};

export default CatererList;