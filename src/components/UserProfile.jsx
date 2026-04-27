// src/pages/UserProfile.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "../shared-lib/axiosInstance";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import generateInvoicePdf from "../utils/invoice";
import axiosInstance from '../shared-lib/axiosInstance';

const TABS = ["Ongoing", "Completed", "Rejected", "Cancelled"];
const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const STATUS_MAP = {
  initiated: { label: "Initiated", group: "ongoing" },
  pending: { label: "Pending", group: "ongoing" },
  confirmed: { label: "Confirmed", group: "ongoing" },
  accepted: { label: "Accepted", group: "ongoing" },
  preparation_inprogress: { label: "Preparing", group: "ongoing" },
  preparation_completed: { label: "Ready to Deliver", group: "ongoing" },
  delivery_in_progress: { label: "On the way", group: "ongoing" },
  delivered: { label: "Delivered", group: "completed" },
  completed: { label: "Completed", group: "completed" },
  rejected: { label: "Rejected", group: "rejected" },
  cancelled: { label: "Cancelled", group: "cancelled" },
  processing: { label: "Processing", group: "ongoing" },
  in_progress: { label: "Preparing", group: "ongoing" },
  in_transit: { label: "On the way", group: "ongoing" },
};

const normalizeStatus = (s) => {
  if (!s) return { key: "pending", label: "Pending", group: "ongoing" };
  const key = String(s).trim().toLowerCase();
  return (
    STATUS_MAP[key] || {
      key,
      label: key,
      group: /cancel|reject/.test(key) ? "cancelled" : "ongoing",
    }
  );
};

function fmtAmt(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return `₹0.00`;
  return `₹${n.toFixed(2)}`;
}
function displayOrderTotal(order) {
  if (!order) return fmtAmt(0);
  const total = Number(order.total ?? 0) || 0;
  const utensils = Number(order.utensils_advance ?? 0) || 0;
  const chargeable = Math.max(0, total - utensils);
  return fmtAmt(chargeable);
}
function formatEventDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split("-");
  if (parts.length >= 3) {
    const [y, m, d] = parts;
    const mon = new Date(`${y}-${m}-01`).toLocaleString("en-US", { month: "short" }).toUpperCase();
    return `${String(d).padStart(2, "0")}-${mon}-${y}`;
  }
  try {
    const dt = new Date(dateStr);
    if (Number.isNaN(dt.getTime())) return dateStr;
    const day = String(dt.getDate()).padStart(2, "0");
    const mon = dt.toLocaleString("en-US", { month: "short" }).toUpperCase();
    return `${day}-${mon}-${dt.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function formatEventTime(timeStr) {
  if (!timeStr) return null;
  try {
    const [h, m] = String(timeStr).split(":");
    if (h === undefined || m === undefined) return timeStr;
    const d = new Date();
    d.setHours(Number(h));
    d.setMinutes(Number(m));
    return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return timeStr;
  }
}

/**
 * Hook: load Google Maps JS once
 * Usage: const { loaded, error } = useGoogleMapsLoader(apiKey)
 */
export function useGoogleMapsLoader(apiKey) {
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
      // script already added; wait a little for it to initialize
      let cancelled = false;
      const wait = () => {
        if (cancelled) return;
        if (window.google && window.google.maps) setLoaded(true);
        else setTimeout(wait, 100);
      };
      wait();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = (e) => setError(e || new Error("Failed to load Google Maps"));
    document.head.appendChild(script);

    // don't remove script on cleanup (other pages/components may rely on it)
    return () => { };
  }, [apiKey]);

  return { loaded, error };
}

/**
 * Hook: get user's current browser geolocation (custom hook)
 * Usage: const { coords, loading, error, get } = useCurrentLocation()
 * call get() to request coordinates
 */
function useCurrentLocation() {
  const [coords, setCoords] = useState({ latitude: "", longitude: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const get = useCallback(() => {
    if (!navigator.geolocation) {
      setError(new Error("Geolocation not supported"));
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude).toFixed(6);
        const lng = Number(pos.coords.longitude).toFixed(6);
        setCoords({ latitude: String(lat), longitude: String(lng) });
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
        console.error("geolocation error", err);
        toast.error("Unable to get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { coords, loading, error, get };
}

/**
 * MapPicker component
 * props:
 *  - apiKey (optional if app already loaded maps)
 *  - initial: { lat, lng }
 *  - onPick({ lat, lng, address }) called when user selects (marker dragend or map click)
 *  - onClose()
 *
 * Simpler version: displays map, draggable marker, and an optional Places search box
 */
// Robust MapPicker (replace your existing MapPicker)
function MapPicker({ apiKey, initial = { lat: 13.618770, lng: 79.421793 }, onPick, onClose }) {
  const { loaded: gmapsLoaded, error: gmapsError } = useGoogleMapsLoader(apiKey || GOOGLE_MAPS_KEY);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const mapRef = useRef(null);
  const initAttemptsRef = useRef(0);

  useEffect(() => {
    if (gmapsError) {
      console.error("Google Maps load error:", gmapsError);
      return;
    }
    if (!gmapsLoaded) {
      // not loaded yet — wait
      return;
    }
    if (!containerRef.current) {
      console.warn("Map container not mounted yet");
      return;
    }

    const google = window.google;
    if (!google || !google.maps) {
      console.error("window.google.maps not available even though gmapsLoaded is true");
      return;
    }

    // init map function (safe to call multiple times; will bail if already created)
    const tryInit = () => {
      initAttemptsRef.current += 1;
      const el = containerRef.current;
      const width = el?.offsetWidth || 0;
      const height = el?.offsetHeight || 0;

      if (width === 0 || height === 0) {
        // container not yet measured (modal might still be animating). retry a few times.
        if (initAttemptsRef.current < 8) {
          // schedule next try on next frame
          requestAnimationFrame(() => tryInit());
        } else {
          // fallback: small timeout
          setTimeout(() => tryInit(), 300);
        }
        return;
      }

      // If map already exists, just update center/marker
      if (mapRef.current && markerRef.current) {
        const center = { lat: Number(initial.lat) || 13.607577, lng: Number(initial.lng) || 79.448387 };
        mapRef.current.setCenter(center);
        markerRef.current.setPosition(center);
        google.maps.event.trigger(mapRef.current, "resize");
        return;
      }

      // create map
      try {
        const center = { lat: Number(initial.lat) || 13.607577, lng: Number(initial.lng) || 79.448387 };
        const map = new google.maps.Map(el, { center, zoom: 13, clickableIcons: true });
        mapRef.current = map;

        const marker = new google.maps.Marker({ position: center, map, draggable: true });
        markerRef.current = marker;

        const notify = (posLatLng) => {
          if (!posLatLng) return;
          const lat = Number(posLatLng.lat()).toFixed(6);
          const lng = Number(posLatLng.lng()).toFixed(6);
          // best-effort reverse geocode (optional)
          try {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results, status) => {
              const addr = (status === "OK" && results && results[0]) ? results[0].formatted_address : null;
              onPick && onPick({ lat: Number(lat), lng: Number(lng), address: addr });
            });
          } catch (e) {
            onPick && onPick({ lat: Number(lat), lng: Number(lng), address: null });
          }
        };

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          notify(pos);
        });

        map.addListener("click", (e) => {
          if (!e?.latLng) return;
          marker.setPosition(e.latLng);
          map.panTo(e.latLng);
          notify(e.latLng);
        });

        // If there is an input box with id 'map-picker-search-input', wire up SearchBox (if places lib available)
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
              notify(loc);
            });
          }
        } catch (e) {
          // ignore places errors
        }

        // after creating, trigger resize to ensure tiles paint (use a small timeout so modal finishing animations don't collapse container)
        setTimeout(() => {
          try {
            google.maps.event.trigger(map, "resize");
            map.setCenter({ lat: Number(initial.lat) || 13.618770, lng: Number(initial.lng) || 79.448387 });
          } catch (e) { /* ignore */ }
        }, 50);
      } catch (err) {
        console.error("Map init error:", err);
      }
    }; // tryInit

    tryInit();

    // cleanup listeners on unmount
    return () => {
      try {
        if (markerRef.current) google.maps.event.clearInstanceListeners(markerRef.current);
        if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      } catch (e) { /* ignore */ }
    };
  }, [gmapsLoaded, gmapsError, initial.lat, initial.lng, onPick]);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-4" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-lg font-semibold">Pick location on map</div>
            <div className="text-xs text-gray-500">Drag marker or click on map to choose coordinates</div>
          </div>
          <div className="flex items-center gap-2">
            <input id="map-picker-search-input" placeholder="Search address (optional)" className="px-3 py-1 border rounded mr-2" />
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-100">Close</button>
          </div>
        </div>

        {/* IMPORTANT: ensure this div has definite height (not collapsed by flex or hidden parent) */}
        <div ref={containerRef} style={{ width: "100%", height: "min(380px, 55vh)" }} className="rounded bg-gray-100" />

        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={() => {
              const marker = markerRef.current;
              if (!marker) return;
              const pos = marker.getPosition();
              if (!pos) return;
              const lat = Number(pos.lat()).toFixed(6);
              const lng = Number(pos.lng()).toFixed(6);
              try {
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results, status) => {
                  const addr = (status === "OK" && results && results[0]) ? results[0].formatted_address : null;
                  onPick && onPick({ lat: Number(lat), lng: Number(lng), address: addr });
                  onClose && onClose();
                });
              } catch {
                onPick && onPick({ lat: Number(lat), lng: Number(lng), address: null });
                onClose && onClose();
              }
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded"
          >
            Select this location
          </button>
        </div>
      </div>
    </div>
  );
}

const StarRow = ({ rating }) => {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < r ? "text-amber-500" : "text-gray-300"}`}>★</span>
      ))}
      <span className="ml-2 text-xs text-gray-600">({rating})</span>
    </div>
  );
};
const StarInput = ({ value, onChange }) => {
  const v = Math.max(0, Math.min(5, Number(value) || 0));

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < v;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="focus:outline-none"
          >
            <span
              className={`text-xl ${filled ? "text-amber-500" : "text-gray-300"
                }`}
            >
              ★
            </span>
          </button>
        );
      })}
      <span className="ml-2 text-xs text-gray-600">
        {v > 0 ? `${v}/5` : "Tap to rate"}
      </span>
    </div>
  );
};
const UserProfile = ({ setRole }) => {
  const navigate = useNavigate();

  // memoize stored so identity doesn't change every render
  const stored = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);
  const storedId = React.useMemo(() => stored?.id || stored?.pk || stored?.user_id || null, [stored]);

  const [user, setUser] = useState({
    first_name: stored.first_name || "",
    email: stored.email || "",
    phone: stored.username || stored.phone || "",
    role: stored.role || localStorage.getItem("userRole") || "user",
    id: stored.id || stored.pk || stored.user_id || null,
  });
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("Ongoing");
  const [editMode, setEditMode] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const [caterer, setCaterer] = useState(null);
  const [addrEditMode, setAddrEditMode] = useState(false);
  const [noteInputs, setNoteInputs] = useState({});
  const [addrForm, setAddrForm] = useState({
    address: "",
    city: "",
    pincode: "",
    latitude: "",
    longitude: "",
  });
  const [submittingLocation, setSubmittingLocation] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsAvg, setReviewsAvg] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);

  // Modal state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderModalLoading, setOrderModalLoading] = useState(false);

  // NEW: show/hide dropdown for extra orders (top-3 + dropdown UX)
  const [showExtraOrders, setShowExtraOrders] = useState(false);

  // Map picker visibility
  // Map picker visibility
  const [showMapPicker, setShowMapPicker] = useState(false);

  // UI toggles for order modal (move any of these into component scope)
  const [showPackageDetails, setShowPackageDetails] = useState(false);
  const [showItemsDetails, setShowItemsDetails] = useState(true);
  const [showChargesDetails, setShowChargesDetails] = useState(true);
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);

  // Cancel & refund flow (for pending orders)
  const [showCancelFlow, setShowCancelFlow] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Review form state (for completed orders)
  const [reviewDraft, setReviewDraft] = useState({ rating: 0, body: "" });
  const [submittingReview, setSubmittingReview] = useState(false);

  // hook: google maps loader (call inside component)
  const { loaded: gmapsLoaded, error: gmapsError } = useGoogleMapsLoader(GOOGLE_MAPS_KEY);

  // current-location hook (call inside component)
  const { coords: currentCoords, loading: locLoading, error: locError, get: fetchCurrentLocation } = useCurrentLocation();
  // Whenever currentCoords updates populate addrForm
  useEffect(() => {
    if (currentCoords.latitude && currentCoords.longitude) {
      setAddrForm((p) => ({ ...p, latitude: currentCoords.latitude, longitude: currentCoords.longitude }));
      toast.info("Coordinates populated. Edit address text if needed and submit for approval.");
    }
  }, [currentCoords]);

  useEffect(() => {
    axios
      .get("/api/profile/")
      .then((res) => {
        const data = res.data || {};
        const normalized = {
          first_name: data.first_name || data.first || "",
          email: data.email || "",
          phone: data.username || data.phone || "",
          role: data.role || localStorage.getItem("userRole") || "user",
          id: data.id || data.pk || data.user_id || null,
        };
        setUser(normalized);
        try {
          localStorage.setItem("userProfile", JSON.stringify(data));
          window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: data }));
        } catch { }
      })
      .catch((err) => console.error("Failed to fetch profile:", err));
  }, []);

  // --------- Stabilized refs for review fetching ----------
  const timeoutToastShownRef = React.useRef(false);
  const didFetchCatererOnceRef = React.useRef(false); // ensure we only call /api/caterers/me/ once from the reviews effect
  const ongoingFetchRef = React.useRef(null); // store AbortController for current fetch
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const DELETE_PHRASE = "DELETE";

  // keep debounce timeout ref (we will define debounced func later AFTER fetchReviews)
  const fetchTimeoutRef = React.useRef(null);

  // ---------------------- Reviews fetching ----------------------
  const fetchReviews = useCallback(
    async (opts = {}) => {
      const signal = opts.signal || null;

      // avoid parallel fetches started by this hook
      if (ongoingFetchRef.current && !ongoingFetchRef.current.signal.aborted) {
        return;
      }

      setReviewsLoading(true);
      const controller = new AbortController();
      const combinedSignal = signal || controller.signal;
      ongoingFetchRef.current = controller;

      try {
        let url = "/api/reviews/";
        if ((user.role || "").toLowerCase() === "caterer") {
          const catererId = caterer?.id ?? null;
          if (!catererId) {
            // nothing to fetch until caterer id available
            setReviews([]);
            setReviewsAvg(0);
            setReviewsCount(0);
            // clear ongoing fetch ref so later attempts are allowed
            if (ongoingFetchRef.current === controller) ongoingFetchRef.current = null;
            return;
          }
          url = `/api/reviews/?caterer=${catererId}`;
        } else {
          const userId = user.id || storedId || null;
          if (userId) {
            url = `/api/reviews/?user=${userId}`;
          } else {
            url = `/api/reviews/`;
          }
        }

        const res = await axios.get(url, { signal: combinedSignal });
        const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
        let filtered = arr;

        if ((user.role || "").toLowerCase() !== "caterer" && !(user.id)) {
          const uid = user.id || storedId || null;
          if (uid) filtered = arr.filter((r) => String(r.user || r.user_id || r.userId) === String(uid));
        }

        const cnt = filtered.length;
        const sum = filtered.reduce((s, r) => s + (Number(r.rating ?? 0) || 0), 0);
        const avg = cnt > 0 ? Number((sum / cnt).toFixed(2)) : 0;

        setReviews(filtered);
        setReviewsAvg(avg);
        setReviewsCount(cnt);

        // reset timeout toast gate on success
        timeoutToastShownRef.current = false;
      } catch (err) {
        if (err && (err.name === "CanceledError" || err.name === "AbortError")) {
          // silent if aborted
          return;
        }
        console.error("Failed to fetch reviews:", err);
        if (err?.code === "ECONNABORTED" || (err?.message && err.message.toLowerCase().includes("timeout"))) {
          if (!timeoutToastShownRef.current) {
            toast.error("Request timed out while fetching reviews. Try again later.");
            timeoutToastShownRef.current = true;
          }
        } else {
          toast.error("Unable to load reviews");
        }
      } finally {
        setReviewsLoading(false);
        if (ongoingFetchRef.current === controller) ongoingFetchRef.current = null;
      }
    },
    // minimal stable deps: only primitives or shallow optionally-changing values
    [user.role, user.id, caterer?.id, storedId]
  );

  // create debounced wrapper AFTER fetchReviews is defined (avoids referencing before init)
  const debouncedFetchReviews = useCallback((opts = {}) => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      fetchReviews(opts);
      fetchTimeoutRef.current = null;
    }, 350); // 350ms debounce
  }, [fetchReviews]);

  // effect that runs fetchReviews (debounced), cancels stale requests, and does a one-time /api/caterers/me/ if needed
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const signal = controller.signal;

    (async () => {
      try {
        // If user is a caterer but we don't have caterer.id yet -> attempt one-time fetch
        if ((user.role || "").toLowerCase() === "caterer" && !caterer?.id && !didFetchCatererOnceRef.current) {
          didFetchCatererOnceRef.current = true;
          try {
            const res = await axios.get("/api/caterers/me/", { signal });
            if (!mounted) return;
            if (res?.data) {
              setCaterer(res.data);
            }
          } catch (e) {
            // ignore; fetchReviews will bail if no caterer id
            console.warn("One-time /api/caterers/me/ failed or aborted:", e?.message || e);
          }
        }

        // run debounced reviews fetch (pass the same abort signal)
        debouncedFetchReviews({ signal });
      } catch (e) {
        // no-op
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
      // clear debounce timeout if pending
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      // also cancel ongoingFetchRef if it points to a controller we created earlier
      if (ongoingFetchRef.current) {
        try {
          ongoingFetchRef.current.abort();
        } catch { /* ignore */ }
        ongoingFetchRef.current = null;
      }
    };
  }, [debouncedFetchReviews, user.role, user.id, caterer?.id, storedId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if ((user.role || "").toLowerCase() === "caterer" && !caterer?.id) {
        try {
          const res = await axios.get("/api/caterers/me/");
          if (!mounted) return;
          setCaterer(res.data?.caterer_serialized || null);
        } catch (e) {
          console.warn("Could not fetch caterer:", e);
        }
      }
    })();
    return () => { mounted = false; };
  }, [user.role]); // run when role changes

  // ---------------------- end reviews ----------------------

  const fetchOrders = useCallback(async () => {
    try {
      let res = null;
      if (user.role === "caterer") {
        const catererRes = await axios.get("/api/caterers/me/");
        const catererId = catererRes?.data?.caterer_serialized?.id;

        if (catererId) {
          res = await axios.get(`/api/caterers/${catererId}/orders/`);
        } else {
          return setOrders([]);
        }
      } else {
        res = await axios.get("/api/orders/");
      }
      const list = res?.data || [];
      const normalized = (list || []).map((o) => {
        const mapped = normalizeStatus(o.status);
        return { ...o, _status_key: mapped.key, _status_label: mapped.label, _status_group: mapped.group };
      });
      normalized.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : (a.id || 0);
        const tb = b.created_at ? new Date(b.created_at).getTime() : (b.id || 0);
        return tb - ta;
      });
      setOrders(normalized);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setOrders([]);
    }
  }, [user.role]);

  useEffect(() => {
    let mounted = true;
    if (!mounted) return;
    fetchOrders();
    const id = setInterval(() => {
      if (!pollingEnabled) return;
      fetchOrders().catch(() => { });
    }, 20000);
    return () => {
      clearInterval(id);
      mounted = false;
    };
  }, [fetchOrders, pollingEnabled]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const payload = { first_name: user.first_name, email: user.email };
      const res = await axios.patch("/api/profile/", payload);
      const updated = res.data || {};
      setUser((prev) => ({
        ...prev,
        first_name: updated.first_name || prev.first_name,
        email: updated.email || prev.email,
        phone: updated.username || updated.phone || prev.phone,
      }));
      localStorage.setItem("userProfile", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: updated }));
      setEditMode(false);
      toast.success("✅ Profile updated!");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Update failed";
      toast.error(`❌ ${msg}`);
    }
  };

  const handleLogout = () => {
    setRole && setRole(null);
    localStorage.clear();
    toast.info("👋 Logged out");
    navigate("/");
  };

  const filteredOrders = orders.filter((o) => {
    const grp = o._status_group || "ongoing";
    if (activeTab === "Ongoing") return grp === "ongoing";
    if (activeTab === "Completed") return grp === "completed";
    if (activeTab === "Rejected") return grp === "rejected";
    if (activeTab === "Cancelled") return grp === "cancelled";
    return true;
  });

  const counts = {
    ongoing: orders.filter((o) => (o._status_group || "ongoing") === "ongoing").length,
    completed: orders.filter((o) => (o._status_group || "ongoing") === "completed").length,
    rejected: orders.filter((o) => (o._status_group || "ongoing") === "rejected").length,
    cancelled: orders.filter((o) => (o._status_group || "ongoing") === "cancelled").length,
  };

  // NEW: derive visible vs extra orders (most recent first)
  const visibleOrders = filteredOrders.slice(0, 3);
  const extraOrders = filteredOrders.length > 3 ? filteredOrders.slice(3) : [];

  const handleAddrField = (e) => {
    const { name, value } = e.target;
    setAddrForm((p) => ({ ...p, [name]: value }));
  };

  const handleMapPick = ({ lat, lng, address }) => {
    // set addrForm — address may be null if marker-only; keep existing fields intact
    setAddrForm((p) => ({
      ...p,
      latitude: lat != null ? String(Number(lat).toFixed(6)) : p.latitude,
      longitude: lng != null ? String(Number(lng).toFixed(6)) : p.longitude,
      address: address ?? p.address,
    }));
    toast.info("Coordinates selected from map. Edit address text if needed.");
    setShowMapPicker(false);
  };

  const submitNewLocation = async () => {
    const a = (addrForm.address || "").trim();
    const city = (addrForm.city || "").trim();
    const pin = (addrForm.pincode || "").trim();
    const lat = (addrForm.latitude || "").trim();
    const lng = (addrForm.longitude || "").trim();

    const normalizeCoord = (v) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      if (s === "") return undefined;
      const n = Number(s);
      if (Number.isNaN(n)) return undefined;
      return Number(n.toFixed(6));
    };

    if (!a && !(lat && lng)) {
      toast.error("Provide address or latitude & longitude before submitting");
      return;
    }

    // ✅ DO NOT SEND caterer ID
    const payload = {
      address: a || undefined,
      city: city || undefined,
      pincode: pin || undefined,
      latitude: normalizeCoord(lat),
      longitude: normalizeCoord(lng),
    };

    console.debug("POST /api/caterer-locations/ payload:", payload);

    setSubmittingLocation(true);
    try {
      const postRes = await axiosInstance.post("/api/caterer-locations/", payload);
      console.debug("POST /api/caterer-locations/ =>", postRes?.data);

      toast.success("Location submitted for admin approval");
      setAddrEditMode(false);

      // refresh caterer
      try {
        const meRes = await axiosInstance.get("/api/caterers/me/");
        setCaterer(meRes.data?.caterer_serialized || null);
        window.dispatchEvent(new Event("locationApprovalUpdate"));
      } catch { }
    } catch (err) {
      console.error("submitNewLocation error", err, err?.response?.data);
      const serverMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message;
      toast.error(serverMsg || "Failed to submit location");
    } finally {
      setSubmittingLocation(false);
    }
  };

  const [bankAccount, setBankAccount] = useState(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankEditMode, setBankEditMode] = useState(false);

  const fetchBankAccount = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await axiosInstance.get("/api/caterer/bank-account/");
      setBankAccount(res.data);
    } catch (err) {
      // 404 means not created yet → OK
      if (err?.response?.status !== 404) {
        console.error("Bank fetch failed", err);
        toast.error("Failed to load bank details");
      }
      setBankAccount(null);
    } finally {
      setBankLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((user.role || "").toLowerCase() === "caterer") {
      fetchBankAccount();
    }
  }, [user.role, fetchBankAccount]);

  const saveBankAccount = async () => {
    if (!bankAccount) return;

    setBankSaving(true);
    try {
      if (bankAccount.id) {
        // UPDATE → PATCH (will auto set is_verified=false backend)
        const res = await axiosInstance.patch(
          "/api/caterer/bank-account/",
          bankAccount
        );
        setBankAccount(res.data);
        toast.info("Bank details updated. Pending admin approval.");
      } else {
        // ➕ CREATE → POST
        const res = await axiosInstance.post(
          "/api/caterer/bank-account/",
          bankAccount
        );
        setBankAccount(res.data);
        toast.success("Bank details submitted for verification.");
      }
      setBankEditMode(false);
    } catch (err) {
      console.error("Bank save failed", err);
      toast.error(
        err?.response?.data?.detail || "Failed to save bank details"
      );
    } finally {
      setBankSaving(false);
    }
  };

  const BankStatusBadge = ({ verified }) => {
    if (verified) {
      return (
        <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs">
          ✅ Approved
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs">
        ⏳ Pending approval
      </span>
    );
  };
  // ---- NEW: fetch authoritative package details tied to an order's package id ----
  const fetchPackageForOrder = async (order) => {
    if (!order) return null;
    const pkgId =
      order?.selected_package?.id ??
      order?.selected_package_id ??
      order?.package_id ??
      order?.package ??
      (order?.selected_package && order.selected_package.id) ??
      null;
    if (!pkgId) return null;

    const catererId = order?.caterer ?? order?.caterer_id ?? null;

    const normalize = (p) => {
      if (!p) return null;
      let cs = p.composition_structure ?? p.composition_struct ?? null;
      try {
        if (typeof cs === "string") cs = JSON.parse(cs);
      } catch (e) { /* ignore */ }
      return {
        id: p.id,
        name: p.name ?? p.title ?? p.package_name ?? null,
        description: p.description ?? null,
        price_per_plate: Number(p.price_per_plate ?? p.price ?? 0),
        composition_structure: cs || null,
        composition: p.composition ?? null,
        raw: p,
        veg_only: p.veg_only === true ? true : p.veg_only === false ? false : undefined,
      };
    };

    try {
      // 1) public packages list for caterer
      if (catererId) {
        try {
          const url = `/api/caterers/${catererId}/public-packages/`;
          const res = await axios.get(url);
          const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
          const found = arr.find((x) => String(x.id) === String(pkgId));
          if (found) return normalize(found);
        } catch (e) { /* continue */ }
      }

      // 2) caterer-specific package detail
      if (catererId) {
        try {
          const url = `/api/caterers/${catererId}/packages/${pkgId}/`;
          const res = await axios.get(url);
          if (res?.data) return normalize(res.data);
        } catch (e) { /* continue */ }
      }

      // 3) global package detail
      try {
        const url = `/api/packages/${pkgId}/`;
        const res = await axios.get(url);
        if (res?.data) return normalize(res.data);
      } catch (e) { /* continue */ }

      // 4) authenticated caterer package
      try {
        const url = `/api/caterers/me/packages/${pkgId}/`;
        const res = await axios.get(url);
        if (res?.data) return normalize(res.data);
      } catch (e) { /* continue */ }

      // 5) cached fallback (localStorage)
      try {
        const raw = localStorage.getItem(`pltr_pkg_cached_${catererId || "unknown"}_${pkgId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return normalize(parsed);
        }
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.error("fetchPackageForOrder error:", e);
    }
    return null;
  };

  // ---- UPDATED openOrderModal: fetch order summary and attempt to attach package details ----
  const openOrderModal = async (order) => {
    if (!order) {
      setSelectedOrder(null);
      setOrderModalOpen(true);
      setPollingEnabled(false);
      return;
    }

    setOrderModalLoading(true);
    setOrderModalOpen(true);
    setPollingEnabled(false);

    try {
      // 1) fetch authoritative order summary/detail
      const res = await axios.get(`/api/orders/${order.id}/summary/`);
      const data = res?.data || null;
      const maybe = data && data.order ? data.order : data;
      let finalOrder = maybe || order;

      // 2) ensure package details are present; if only id present, try to fetch package
      const pkgCandidate = finalOrder.selected_package || finalOrder.package || null;
      const hasDetails =
        pkgCandidate &&
        (pkgCandidate.name || pkgCandidate.price_per_plate || pkgCandidate.price || (pkgCandidate.raw && (pkgCandidate.raw.price_per_plate || pkgCandidate.raw.price)));

      if (!hasDetails) {
        try {
          const fetchedPkg = await fetchPackageForOrder(finalOrder);
          if (fetchedPkg) {
            finalOrder = { ...(finalOrder || {}), selected_package: fetchedPkg };
          }
        } catch (e) {
          console.warn("Package fetch for modal failed", e);
        }
      }
      const mapped = normalizeStatus(finalOrder.status);
      finalOrder = {
        ...finalOrder,
        _status_key: mapped.key,
        _status_label: mapped.label,
        _status_group: mapped.group,
      };
      const existingReview =
        Array.isArray(reviews) && finalOrder?.id
          ? reviews.find(
            (r) =>
              String(r.order || r.order_id) === String(finalOrder.id)
          )
          : null;

      setReviewDraft({
        rating: existingReview?.rating || 0,
        body: existingReview?.body || "",
      });

      // reset cancel flow whenever a new order modal is opened
      setShowCancelFlow(false);
      setCancelReason("");
      setSelectedOrder(finalOrder);
    } catch (err) {
      console.error("Failed to fetch order summary for modal:", err);
      setSelectedOrder(order);
    } finally {
      setOrderModalLoading(false);
    }
  };
  const updateOrderInLists = (updatedOrder) => {
    // Update list view
    setOrders((prev) =>
      Array.isArray(prev)
        ? prev.map((o) =>
          o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o
        )
        : prev
    );

    // Update modal view
    setSelectedOrder((prev) =>
      prev && prev.id === updatedOrder.id ? { ...prev, ...updatedOrder } : prev
    );
  };
  const handleAddNoteForOrder = async (order) => {
    const body = (noteInputs[order.id] || "").trim();
    if (!body) return;

    // ✔ Immediately clear the textarea UI
    setNoteInputs((prev) => ({
      ...prev,
      [order.id]: "",
    }));

    try {
      await axiosInstance.post(`/api/orders/${order.id}/add-note/`, { body });

      toast.success("Note added successfully!");

      // 🔄 Refresh notes in summary
      const summaryRes = await axiosInstance.get(`/api/orders/${order.id}/summary/`);

      if (summaryRes.data?.order) {
        updateOrderInLists(summaryRes.data.order);
        setSelectedOrder(summaryRes.data.order);
      }
    } catch (err) {
      console.error("Failed to add note", err);
      toast.error("Failed to add note");
    }
  };

  const rawStatus = String(
    selectedOrder?._status_key || selectedOrder?.status || ""
  )
    .trim()
    .toLowerCase();

  const isPendingOrAccepted =
    rawStatus === "pending" || rawStatus === "accepted";
  const closeOrderModal = () => {
    setOrderModalOpen(false);
    setSelectedOrder(null);
    setShowCancelFlow(false);
    setCancelReason("");
    setReviewDraft({ rating: 0, body: "" });
    setPollingEnabled(true);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && orderModalOpen) closeOrderModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderModalOpen]);

  const normalizePkg = (rawPkg) => {
    if (!rawPkg) return null;
    let cs = rawPkg.composition_structure ?? rawPkg.composition_struct ?? null;
    try {
      if (typeof cs === "string") cs = JSON.parse(cs);
    } catch { }
    return {
      id: rawPkg.id,
      name: rawPkg.name ?? rawPkg.title ?? rawPkg.package_name ?? null,
      description: rawPkg.description ?? null,
      price_per_plate: Number(rawPkg.price_per_plate ?? rawPkg.price ?? 0),
      composition_structure: cs || null,
      composition: rawPkg.composition ?? null,
      raw: rawPkg,
      veg_only: rawPkg.veg_only === true ? true : rawPkg.veg_only === false ? false : undefined,
    };
  };

  const renderPackageSummary = (pkgCandidate, plates) => {
    if (!pkgCandidate) return null;
    const pkg = normalizePkg(pkgCandidate);
    const price = Number(pkg.price_per_plate ?? 0);
    const plateCount = Number(plates || 0);

    const vegFlag = pkg && pkg.veg_only === true;
    const mixedFlag = pkg && pkg.veg_only === false;

    return (
      <div className="mb-4 p-3 rounded-lg bg-gray-50 border">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="text-sm text-gray-600">Package</div>
            <div className="font-medium text-gray-900">{pkg.name ?? "Package"}</div>
            {pkg.description ? <div className="text-xs text-gray-500 mt-1">{pkg.description}</div> : null}
            {pkg.composition_structure?.sections && (
              <div className="mt-2 text-xs text-gray-600">
                Total items:&nbsp;
                <span className="font-medium text-gray-800">
                  {Object.values(pkg.composition_structure.sections).reduce((sum, sec) => sum + (sec.count || 0), 0)}
                </span>
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-500">Price / plate</div>
            <div className="mt-1 inline-flex items-center px-3 py-1 rounded-full bg-white shadow-sm border">
              <span className="text-sm font-semibold text-emerald-700">{fmtAmt(price)}</span>
            </div>
            <div className="mt-2">
              {vegFlag ? (
                <div className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-block mt-2">Veg</div>
              ) : mixedFlag ? (
                <div className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 inline-block mt-2">Veg + Non-Veg</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-between text-sm text-gray-700">
          <div>Plates</div>
          <div className="font-medium">{plateCount || "—"}</div>
        </div>

        <div className="mt-2 flex justify-between text-sm text-gray-700">
          <div>
            <div className="text-xs text-gray-500">Package cost</div>
            <div className="text-xs text-gray-500">{fmtAmt(price)} × {plateCount} plates</div>
          </div>
          <div className="font-semibold">{fmtAmt(price * plateCount)}</div>
        </div>
      </div>
    );
  };

  const renderItemsList = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return <div className="text-sm text-gray-500">No items available</div>;
    }
    return (
      <div className="space-y-3">
        {items.map((it) => {
          const qty = Number(it.quantity ?? 1);
          const unit = Number(it.price ?? 0);
          const lineTotal = unit * qty;
          return (
            <div key={it.id ?? `${it.menu_item}_${it.quantity}`} className="flex justify-between items-start gap-4">
              <div>
                <div className="font-medium text-gray-800">{it.menu_item_name ?? it.name ?? `Item #${it.menu_item ?? ""}`}</div>
                <div className="text-xs text-gray-500">
                  {fmtAmt(unit)} × {qty} = <span className="font-medium text-gray-800">{fmtAmt(lineTotal)}</span>
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-800">{fmtAmt(lineTotal)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const calculateTotals = (order) => {
    const pkgPriceFromSelected = Number(order?.selected_package?.price_per_plate ?? order?.selected_package?.raw?.price_per_plate ?? 0);
    const pkgPriceFromOrder = Number(order?.package_price_per_plate ?? order?.package_price ?? 0);
    const pkgPrice = pkgPriceFromSelected || pkgPriceFromOrder || 0;
    const packageCost = pkgPrice * Number(order?.plates ?? 0);

    const itemsTotal = (Array.isArray(order?.items) ? order.items.reduce((s, it) => s + (Number(it.price ?? 0) * Number(it.quantity ?? 1)), 0) : 0);
    const delivery = Number(order?.delivery_charge ?? 0);
    const staff = Number(order?.staff_charge ?? 0);
    const bottles = Number(order?.bottles_charge ?? 0);
    const tax = Number(order?.tax_amount ?? 0);
    const coupon = Number(order?.coupon_discount ?? 0);
    const total = Number(order?.total ?? packageCost + itemsTotal + delivery + staff + bottles + tax - coupon);
    return { packageCost, itemsTotal, delivery, staff, bottles, tax, coupon, total };
  };
  const handleConfirmCancelPending = async () => {
    if (!selectedOrder) return;
    setCancelSubmitting(true);
    try {
      await axios.patch(`/api/orders/${selectedOrder.id}/status/`, {
        status: "cancelled",
        // optional: backend must support this
        cancel_reason: cancelReason || undefined,
      });

      toast.success("Order cancelled and full refund initiated");
      setShowCancelFlow(false);
      closeOrderModal();
      fetchOrders();
    } catch (err) {
      console.error("Cancel (pending) order failed", err);
      toast.error("Failed to cancel order");
    } finally {
      setCancelSubmitting(false);
    }
  };
  const handleSubmitReview = async () => {
    if (!selectedOrder) return;

    const rating = Number(reviewDraft.rating || 0);
    if (!rating || rating < 1) {
      toast.error("Please select a rating before submitting");
      return;
    }

    const catererId =
      selectedOrder.caterer ||
      selectedOrder.caterer_id ||
      selectedOrder.catererId ||
      null;

    if (!catererId) {
      toast.error("Caterer info missing for this order.");
      return;
    }

    const payload = {
      caterer: catererId,
      order: selectedOrder.id,
      rating,
      body: reviewDraft.body || "",
    };

    setSubmittingReview(true);
    try {
      await axios.post("/api/reviews/", payload);
      toast.success("Thanks for your feedback!");

      // Refresh reviews so it appears in the Reviews panel
      try {
        fetchReviews();
      } catch (e) {
        console.warn("Failed to refresh reviews after submit", e);
      }
    } catch (err) {
      console.error("Review submit failed:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to submit review";
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
    }
  };
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="bg-white shadow px-4 py-3 sm:py-4 flex justify-between items-center sticky top-0 z-10">
        <h2 className="text-lg font-bold text-indigo-700">My Profile</h2>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
        >
          Logout
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-8">
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Profile Info</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-gray-600">First Name</label>
              <input
                name="first_name"
                value={user.first_name}
                disabled={!editMode}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg ${editMode
                  ? "border-indigo-400 focus:ring focus:ring-indigo-200"
                  : "bg-gray-100 cursor-not-allowed"
                  }`}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <input
                name="email"
                value={user.email}
                disabled={!editMode}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg ${editMode
                  ? "border-indigo-400 focus:ring focus:ring-indigo-200"
                  : "bg-gray-100 cursor-not-allowed"
                  }`}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Phone</label>
              <input
                value={user.phone}
                disabled
                className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            {editMode ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-5 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Reviews, Orders, etc. (unchanged, omitted here to save space) */}
        {/* ... the rest of your JSX remains as in your original file ... */}
        {/* Reviews panel */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Reviews</h3>
              <div className="text-sm text-gray-500">Ratings & feedback {(user.role || "").toLowerCase() === "caterer" ? "for your caterer" : "you posted"}</div>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-500">Average</div>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-indigo-600">{reviewsAvg || 0}</div>
                <div className="text-xs text-gray-500">{reviewsCount} review{reviewsCount === 1 ? "" : "s"}</div>
              </div>
            </div>
          </div>

          {reviewsLoading ? (
            <div className="text-center text-gray-600 p-6">Loading reviews…</div>
          ) : reviews.length === 0 ? (
            <div className="text-sm text-gray-500">No reviews yet.</div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="p-3 border rounded-lg bg-white">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        {/* <div className="text-sm font-medium text-gray-800">
                          {r.user_first_name || r.user_name || r.user || `User #${r.user || ""}`}
                        </div> */}
                        <div className="text-xs text-gray-500">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                        </div>
                      </div>

                      {/* ✅ New line for Caterer */}
                      {r.caterer_name || r.caterer ? (
                        <div className="text-xs text-gray-600 mt-1">
                          for <span className="font-medium text-indigo-600">{r.caterer_name || `Caterer #${r.caterer}`}</span>
                        </div>
                      ) : null}

                      <div className="mt-2">
                        <StarRow rating={r.rating} />
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      {r.verified ? (
                        <span className="px-2 py-1 rounded bg-green-50 text-green-700 text-xs">
                          Verified
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {r.body ? <div className="mt-3 text-gray-700 text-sm">{r.body}</div> : null}
                  {Array.isArray(r.photos) && r.photos.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-auto">
                      {r.photos.map((p, i) => (
                        <img key={i} src={p.image || p.url || p} alt={`photo-${i}`} className="w-20 h-20 object-cover rounded" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-5 sm:p-6">
          {/* Header */}
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            My Orders
          </h3>

          {/* Tabs */}
          <div className="mb-5 -mx-5 px-5 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max">
              {TABS.map((tab) => {
                let count = 0;
                if (tab === "Ongoing") count = counts.ongoing;
                if (tab === "Completed") count = counts.completed;
                if (tab === "Rejected") count = counts.rejected;
                if (tab === "Cancelled") count = counts.cancelled;

                const isActive = activeTab === tab;

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition
              ${isActive
                        ? "bg-indigo-600 text-white shadow"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {tab}
                    <span className="ml-1 opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Empty state */}
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-gray-500">
              No {activeTab.toLowerCase()} orders.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Top 3 orders */}
              {visibleOrders.map((order) => {
                const notes = Array.isArray(order.notes) ? order.notes : [];
                const hasNotes = notes.length > 0;
                const firstNote = hasNotes ? notes[0] : null;

                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      setShowExtraOrders(false);
                      openOrderModal(order);
                    }}
                    className="
              rounded-2xl border bg-white p-4
              transition-all duration-200
              hover:shadow-lg hover:border-indigo-200
              active:scale-[0.99]
              cursor-pointer
            "
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          Order #{order.id} — {order.caterer_name || order.customer_name || "Order"}
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          {order.plates} plates · {order._status_label || order.status}
                        </div>

                        {order.event_date && (
                          <div className="mt-1 text-xs text-gray-400">
                            Event: {formatEventDate(order.event_date)}
                            {order.event_time && ` · ${formatEventTime(order.event_time)}`}
                          </div>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-indigo-600">
                          {fmtAmt(order.total)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString()
                            : ""}
                        </div>
                      </div>
                    </div>

                    {/* Refund */}
                    {String(order.status || "").toLowerCase() === "cancelled" &&
                      (order.refund_required ||
                        ["refund_pending", "refunded"].includes(
                          String(order.payment_status || "").toLowerCase()
                        )) && (
                        <div className="mt-2 text-xs text-emerald-700">
                          Refund:&nbsp;
                          <span className="font-semibold">
                            {fmtAmt(order.refund_amount || 0)}
                          </span>
                          <span className="ml-1 text-[11px] text-emerald-800">
                            {String(order.payment_status || "")
                              .replace(/_/g, " ")
                              .toLowerCase() === "refund_pending"
                              ? "(pending)"
                              : "(processed)"}
                          </span>
                        </div>
                      )}

                    {/* Notes preview */}
                    {hasNotes && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-2 text-xs">
                        <div className="flex items-center gap-1 font-semibold text-gray-700">
                          📝 Notes ({notes.length})
                        </div>
                        <div className="mt-1 text-gray-600 line-clamp-2">
                          {firstNote?.body}
                          {notes.length > 1 && (
                            <span className="ml-1 text-[10px] text-gray-400">
                              +{notes.length - 1} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Show more */}
              {extraOrders.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowExtraOrders((s) => !s)}
                    className="
              w-full flex items-center justify-between
              px-4 py-2 rounded-xl
              bg-gray-50 border
              text-sm text-gray-700
              hover:bg-gray-100
            "
                  >
                    <span>
                      {showExtraOrders
                        ? `Hide ${extraOrders.length} older orders`
                        : `Show ${extraOrders.length} more orders`}
                    </span>
                    <span className="text-xs">
                      {showExtraOrders ? "▲" : "▼"}
                    </span>
                  </button>

                  {showExtraOrders && (
                    <div className="mt-3 space-y-3">
                      {extraOrders.map((order) => (
                        <div
                          key={order.id}
                          onClick={() => {
                            setShowExtraOrders(false);
                            openOrderModal(order);
                          }}
                          className="
                    rounded-xl border bg-white p-3
                    hover:shadow-md transition
                    cursor-pointer
                  "
                        >
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                Order #{order.id} — {order.caterer_name || "Order"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {order.plates} plates · {order._status_label || order.status}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-semibold text-indigo-600">
                                {fmtAmt(order.total)}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {order.created_at
                                  ? new Date(order.created_at).toLocaleDateString()
                                  : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Address block (the part we modified for map / geolocation) */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-2">📍 Address</h3>
            {user.role === "caterer" ? (
              <>
                <div className="mb-3">
                  <div className="text-sm font-medium">Saved / Active Location</div>
                  <div className="mt-2 text-sm text-gray-700">
                    {caterer?.active_location ? (
                      <>
                        <div>{caterer.active_location.address || "—"}</div>
                        <div className="text-xs text-gray-500">{caterer.active_location.city || ""} — {caterer.active_location.pincode || "—"}</div>
                        <div className="text-xs text-gray-500">
                          {caterer.active_location.latitude != null && caterer.active_location.longitude != null
                            ? `Lat: ${Number(caterer.active_location.latitude).toFixed(6)}, Lng: ${Number(caterer.active_location.longitude).toFixed(6)}`
                            : "Coordinates not available"}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">No active location saved.</div>
                    )}
                  </div>
                </div>

                {/* ✅ Pending location: show pending_location OR fallback pending_* fields */}
                {(() => {
                  const pendingObj =
                    caterer?.pending_location ||
                    (caterer?.pending_address ||
                      caterer?.pending_city ||
                      caterer?.pending_pincode ||
                      caterer?.pending_latitude ||
                      caterer?.pending_longitude
                      ? {
                        address: caterer?.pending_address,
                        city: caterer?.pending_city,
                        pincode: caterer?.pending_pincode,
                        latitude: caterer?.pending_latitude,
                        longitude: caterer?.pending_longitude,
                      }
                      : null);

                  if (!pendingObj) return null;

                  return (
                    <div className="mb-3 p-3 bg-yellow-50 border rounded">
                      <div className="text-sm font-medium">
                        Pending location (awaiting admin approval)
                      </div>

                      <div className="mt-2 text-sm text-gray-700">
                        <div>{pendingObj.address || "—"}</div>
                        <div className="text-xs text-gray-500">
                          {pendingObj.city || ""} — {pendingObj.pincode || "—"}
                        </div>

                        <div className="text-xs text-gray-500">
                          {pendingObj.latitude != null && pendingObj.longitude != null
                            ? `Lat: ${Number(pendingObj.latitude).toFixed(6)}, Lng: ${Number(
                              pendingObj.longitude
                            ).toFixed(6)}`
                            : "Coordinates not available"}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {!addrEditMode ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddrEditMode(true)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded"
                    >
                      Edit / Submit Location
                    </button>
                    <button
                      onClick={() => {
                        const pending = caterer?.pending_location || null;
                        const active = caterer?.active_location || null;

                        const legacyPending =
                          caterer?.pending_address ||
                            caterer?.pending_city ||
                            caterer?.pending_pincode ||
                            caterer?.pending_latitude ||
                            caterer?.pending_longitude
                            ? {
                              address: caterer?.pending_address,
                              city: caterer?.pending_city,
                              pincode: caterer?.pending_pincode,
                              latitude: caterer?.pending_latitude,
                              longitude: caterer?.pending_longitude,
                            }
                            : null;

                        // ✅ Priority: pending_location > legacyPending > active_location
                        const source = pending || legacyPending || active || {};
                        setAddrForm({
                          address: source.address || caterer?.address || "",
                          city: source.city || caterer?.city || "",
                          pincode: source.pincode || caterer?.pincode || "",
                          latitude: source.latitude != null ? String(source.latitude) : (caterer?.latitude != null ? String(caterer.latitude) : ""),
                          longitude: source.longitude != null ? String(source.longitude) : (caterer?.longitude != null ? String(caterer.longitude) : ""),
                        });
                        setAddrEditMode(true);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded"
                    >
                      Edit (prefill)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm text-gray-600">Address</label>
                      <input
                        name="address"
                        value={addrForm.address}
                        onChange={handleAddrField}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-sm text-gray-600">City</label>
                        <input name="city" value={addrForm.city} onChange={handleAddrField} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Pincode</label>
                        <input name="pincode" value={addrForm.pincode} onChange={handleAddrField} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Coords (lat,long)</label>
                        <div className="flex gap-2">
                          <input name="latitude" value={addrForm.latitude} onChange={handleAddrField} className="w-1/2 px-3 py-2 border rounded-lg" placeholder="lat" />
                          <input name="longitude" value={addrForm.longitude} onChange={handleAddrField} className="w-1/2 px-3 py-2 border rounded-lg" placeholder="lng" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <button
                        onClick={() => { fetchCurrentLocation(); }}
                        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">📍 <span>Current</span>
                      </button>

                      <button
                        onClick={() => setShowMapPicker(true)}
                        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        🗺️ <span>Map</span>
                      </button>

                      <button
                        onClick={async () => { await submitNewLocation(); }}
                        disabled={submittingLocation}
                        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {submittingLocation ? "…Saving" : "Save"}
                      </button>

                      <button
                        onClick={() => setAddrEditMode(false)}
                        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-300 hover:bg-gray-350"
                      >
                        ✖ <span>Close</span>
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 mt-2">
                      Note: Submitted locations will be reviewed by admins. Only after admin approval the location becomes active and visible across the site.
                    </div>
                  </div>

                )}
              </>
            ) : (
              <>
                <div className="text-sm text-gray-600">Manage your saved delivery addresses.</div>
                <div className="mt-3">
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded">Add Address</button>
                </div>
              </>
            )}
          </div>

          {/* other panels like Favorites, Membership, Help remain unchanged */}
          {(user.role || "").toLowerCase() === "caterer" ? (
            /* ================== CATERER: BANK DETAILS ================== */
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center justify-between">
                🏦 Bank Account Details
                {bankAccount && <BankStatusBadge verified={bankAccount.is_verified} />}
              </h3>

              {bankLoading ? (
                <p className="text-sm text-gray-500">Loading bank details…</p>
              ) : (
                <>
                  {/* Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Account Holder */}
                    <div>
                      <label className="text-xs text-gray-500">Account Holder Name</label>
                      <input
                        value={bankAccount?.account_holder_name || ""}
                        disabled={!bankEditMode}
                        onChange={(e) =>
                          setBankAccount((p) => ({ ...p, account_holder_name: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 text-sm border rounded"
                      />
                    </div>

                    {/* Bank Name */}
                    <div>
                      <label className="text-xs text-gray-500">Bank Name</label>
                      <input
                        value={bankAccount?.bank_name || ""}
                        disabled={!bankEditMode}
                        onChange={(e) =>
                          setBankAccount((p) => ({ ...p, bank_name: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 text-sm border rounded"
                      />
                    </div>

                    {/* Account Number */}
                    <div>
                      <label className="text-xs text-gray-500">Account Number</label>
                      <input
                        value={bankAccount?.account_number || ""}
                        disabled={!bankEditMode}
                        onChange={(e) =>
                          setBankAccount((p) => ({ ...p, account_number: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 text-sm border rounded"
                      />
                    </div>

                    {/* IFSC */}
                    <div>
                      <label className="text-xs text-gray-500">IFSC Code</label>
                      <input
                        value={bankAccount?.ifsc_code || ""}
                        disabled={!bankEditMode}
                        onChange={(e) =>
                          setBankAccount((p) => ({
                            ...p,
                            ifsc_code: e.target.value.toUpperCase(),
                          }))
                        }
                        className="w-full px-2 py-1.5 text-sm border rounded uppercase"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    {!bankEditMode ? (
                      <button
                        onClick={() => setBankEditMode(true)}
                        className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded"
                      >
                        {bankAccount ? "Edit" : "Add Bank Details"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={saveBankAccount}
                          disabled={bankSaving}
                          className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded disabled:opacity-60"
                        >
                          {bankSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setBankEditMode(false)}
                          className="px-4 py-1.5 text-sm bg-gray-200 rounded"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>

                  {/* Info text */}
                  {bankAccount && !bankAccount.is_verified && (
                    <p className="mt-2 text-xs text-yellow-700">
                      ⚠️ Any update will require admin re-verification before payouts.
                    </p>
                  )}

                  {bankAccount?.is_verified && !bankEditMode && (
                    <p className="mt-2 text-xs text-green-700">
                      ✅ Approved by admin. Click “Edit” if you need to change details.
                    </p>
                  )}
                </>
              )}
            </div>) : (
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-4">❣️ Favorites</h3>

              <p className="text-sm text-gray-600">
                Your saved caterers and packages will appear here.
              </p>

              {/* later you can map favorites */}
              {/* favorites.length === 0 → empty state */}
              <div className="mt-3 text-sm text-gray-400">
                No favorites added yet.
              </div>
            </div>
          )}
        </div>

        {/* ... remainder of the page ... */}
        {/* Danger Zone (Ultra-Compact → Expand) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

          {/* Compact Header */}
          <button
            type="button"
            onClick={() => setDangerOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left focus:outline-none hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm">⚠️</span>
              <span className="text-sm font-medium text-gray-700">
                Account deletion
              </span>
            </div>

            <span
              className="text-gray-400 text-sm transition-transform"
              style={{ transform: dangerOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              ▼
            </span>
          </button>

          {/* Expanded Content */}
          {dangerOpen && (
            <div className="px-4 pb-4 pt-2 space-y-4 border-t">

              <p className="text-sm text-gray-700">
                Deleting your account will permanently remove your profile and
                personal data from FrameMyEvent.
              </p>

              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-gray-700">
                <strong>Note:</strong> This action cannot be undone.
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Type <span className="font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-red-200 text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  disabled={deleteText !== DELETE_PHRASE}
                  onClick={async () => {
                    const ok = window.confirm(
                      "This will permanently delete your account.\n\nAre you absolutely sure?"
                    );
                    if (!ok) return;

                    try {
                      await axiosInstance.post("/api/account/delete/", {
                        confirm: true, // ✅ REQUIRED BY BACKEND
                      });

                      toast.success(
                        "Your account has been deleted and personal data anonymized."
                      );

                      localStorage.clear();
                      setRole && setRole(null);
                      navigate("/");

                    } catch (err) {
                      const msg =
                        err?.response?.data?.detail ||
                        err?.response?.data?.message ||
                        "Unable to delete account at this time.";

                      toast.error(msg);
                    }
                  }}
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white text-sm font-medium ${deleteText === DELETE_PHRASE
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-gray-400 cursor-not-allowed"
                    }`}
                >
                  Delete account
                </button>

                <button
                  onClick={() => {
                    setDangerOpen(false);
                    setDeleteText("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Order Details Modal (unchanged) */}
      {orderModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black opacity-40"
            onClick={closeOrderModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-3xl mx-2 sm:mx-4 my-6 sm:my-10">
            <div
              className="
    bg-white rounded-2xl shadow-xl overflow-hidden
    flex flex-col
    h-[75vh] sm:h-[80vh]
    max-h-[75vh] sm:max-h-[80vh]
  "
            >
              {/* header */}
              <div className="flex items-start justify-between p-3 sm:p-4 border-b">
                <div>
                  <div className="text-sm text-gray-500">Order Details</div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold">#{selectedOrder.id}</div>
                    <div
                      className={`text-xs px-2 py-1 rounded ${selectedOrder._status_group === "completed"
                        ? "bg-green-100 text-green-700"
                        : selectedOrder._status_group === "cancelled"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-yellow-50 text-yellow-800"
                        }`}
                    >
                      {selectedOrder._status_label || selectedOrder.status}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedOrder.caterer_name || selectedOrder.customer_name || ""}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-500">Total</div>
                  {/* ✅ show final total from summary.total */}
                  <div className="text-xl font-bold text-indigo-600">
                    {fmtAmt(selectedOrder.total || 0)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {selectedOrder.created_at
                      ? new Date(selectedOrder.created_at).toLocaleString()
                      : ""}
                  </div>
                </div>
              </div>


              {/* body */}
              {/* body */}
              {/* body */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto overscroll-contain">
                {showCancelFlow &&
                  (
                    selectedOrder?._status_key === "pending" ||
                    selectedOrder?._status_key === "accepted" ||
                    ["pending", "accepted"].includes(
                      String(selectedOrder?.status || "").toLowerCase()
                    )
                  ) ? (
                  <>
                    {/* Cancel & Refund page for pending/accepted orders */}
                    <div className="mb-3">
                      <div className="text-sm font-semibold text-gray-800">
                        Cancel order & refund
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        You&apos;ll get full refund. No cancellation charges will be
                        deducted.
                      </div>
                    </div>

                    {/* Basic order summary */}
                    <div className="border rounded p-3 text-sm text-gray-700 leading-relaxed space-y-1">
                      <div className="flex justify-between">
                        <span>Order ID</span>
                        <span className="font-medium">#{selectedOrder.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Event date</span>
                        <span className="font-medium">
                          {formatEventDate(selectedOrder.event_date) ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Plates</span>
                        <span className="font-medium">
                          {selectedOrder.plates ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Package</span>
                        <span className="font-medium">
                          {selectedOrder.selected_package?.name ||
                            selectedOrder.package_name ||
                            "—"}
                        </span>
                      </div>
                    </div>

                    {/* Refund summary */}
                    {(() => {
                      const paid = Number(selectedOrder.paid_amount || 0);
                      const total = Number(selectedOrder.total || 0);
                      const refundable = paid || total; // full refund
                      const deducted = 0;

                      return (
                        <div className="border rounded p-3 text-sm text-gray-700 space-y-2 bg-emerald-50">
                          <div className="flex justify-between">
                            <span>Paid amount</span>
                            <span className="font-semibold">
                              {fmtAmt(paid || total)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Refundable amount</span>
                            <span className="font-semibold text-emerald-700">
                              {fmtAmt(refundable)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Deducted</span>
                            <span className="font-semibold text-gray-700">
                              {fmtAmt(deducted)}
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-800">
                            Full refund. No cancellation charges. Refund in 2–3 working days.
                          </div>
                        </div>
                      );
                    })()}

                    {/* Reason textarea */}
                    <div className="mt-3">
                      <label className="text-sm text-gray-700">
                        Reason for cancellation (optional)
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={3}
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Eg: change of plan, booked wrong date, etc."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Original details view */}

                    {/* event & contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                      <div>
                        <div className="text-xs text-gray-500">Event Date &amp; Time</div>
                        <div className="font-medium text-gray-800">
                          {formatEventDate(selectedOrder.event_date) ?? "—"}
                        </div>
                        {selectedOrder.event_time ? (
                          <div className="text-s text-gray-800">
                            {formatEventTime(selectedOrder.event_time)}
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Contact</div>
                        <div className="font-medium text-gray-800">
                          {selectedOrder.contact ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Location: {selectedOrder.location ?? "—"}
                        </div>
                      </div>
                    </div>

                    {/* Package summary (collapsible) */}
                    <div className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Package</div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-500">
                            {selectedOrder.selected_package?.name ??
                              selectedOrder.package_name ??
                              "—"}
                          </div>
                          <button
                            onClick={() => setShowPackageDetails((s) => !s)}
                            className="text-xs px-2 py-1 rounded bg-gray-100"
                          >
                            {showPackageDetails ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      {showPackageDetails && (
                        <div className="mt-3 space-y-2">
                          {renderPackageSummary(
                            selectedOrder.selected_package ||
                            selectedOrder.package || {
                              name: selectedOrder.package_name,
                              price_per_plate: selectedOrder.package_price_per_plate,
                              description: selectedOrder.package_description,
                            },
                            selectedOrder.plates
                          )}

                          {/* ✅ show package_items_count if available */}
                          {typeof selectedOrder.package_items_count === "number" && (
                            <div className="text-xs text-gray-600">
                              Items in package:&nbsp;
                              <span className="font-semibold text-gray-800">
                                {selectedOrder.package_items_count}
                              </span>
                            </div>
                          )}

                          {/* composition_structure.sections (if available) */}
                          {selectedOrder.selected_package?.composition_structure?.sections && (
                            <div className="mt-3 text-sm text-gray-700">
                              <div className="text-xs text-gray-500 mb-1">Composition</div>
                              <div className="space-y-2">
                                {Object.entries(
                                  selectedOrder.selected_package.composition_structure
                                    .sections
                                ).map(([secKey, sec]) => (
                                  <div
                                    key={secKey}
                                    className="flex justify-between items-start"
                                  >
                                    <div>
                                      <div className="font-medium capitalize">
                                        {secKey.replace(/_/g, " ")}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        count: {sec.count ?? 0}
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {Array.isArray(sec.options) &&
                                        sec.options.length > 0 ? (
                                        <div className="text-right">
                                          {sec.options.map((opt, i) => (
                                            <div key={i}>
                                              {opt.name || JSON.stringify(opt)}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-right text-gray-400">
                                          no options
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Items (ordered items, complimentary + add-ons) */}
                    <div className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Items Ordered</div>
                        <button
                          onClick={() => setShowItemsDetails((s) => !s)}
                          className="text-xs px-2 py-1 rounded bg-gray-100"
                        >
                          {showItemsDetails ? "Hide" : "Show"}
                        </button>
                      </div>

                      {showItemsDetails && (
                        <div className="mt-3 space-y-3 text-sm text-gray-700">
                          {(() => {
                            const items = Array.isArray(selectedOrder.items)
                              ? selectedOrder.items
                              : [];

                            const complimentary = items.filter(
                              (it) => it.is_complementary === true
                            );
                            const addons = items.filter(
                              (it) => it.is_complementary === false
                            );

                            return (
                              <>
                                {/* Complimentary (free / included in package) */}
                                {complimentary.length > 0 && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                      Included in package (no extra cost)
                                    </div>
                                    <div className="space-y-1">
                                      {complimentary.map((it, idx) => (
                                        <div
                                          key={it.id ?? `compl-${idx}`}
                                          className="flex justify-between items-start gap-3"
                                        >
                                          <div>
                                            <div className="font-medium">
                                              {it.menu_item_name ||
                                                it.name ||
                                                `Item ${idx + 1}`}
                                            </div>
                                            {it.description ? (
                                              <div className="text-xs text-gray-500">
                                                {it.description}
                                              </div>
                                            ) : null}
                                          </div>
                                          <div className="text-xs font-medium text-emerald-600">
                                            Free
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Add-on items (chargeable) */}
                                {addons.length > 0 && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                      Add-on items
                                    </div>
                                    <div className="space-y-1">
                                      {addons.map((it, idx) => {
                                        const qty = Number(it.quantity ?? 1);
                                        const unit = Number(it.price ?? 0);
                                        const lineTotal = qty * unit;
                                        return (
                                          <div
                                            key={it.id ?? `addon-${idx}`}
                                            className="flex justify-between items-start gap-3"
                                          >
                                            <div>
                                              <div className="font-medium">
                                                {it.menu_item_name ||
                                                  it.name ||
                                                  `Addon ${idx + 1}`}
                                              </div>
                                              <div className="text-xs text-gray-500">
                                                {qty} × {fmtAmt(unit)}
                                              </div>
                                            </div>
                                            <div className="text-right text-sm font-medium">
                                              {fmtAmt(lineTotal)}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* default_menu_items (if present) */}
                                {Array.isArray(selectedOrder.default_menu_items) &&
                                  selectedOrder.default_menu_items.length > 0 && (
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">
                                        Default menu items
                                      </div>
                                      <div className="space-y-1">
                                        {selectedOrder.default_menu_items.map((it, i) => (
                                          <div
                                            key={`def-${i}`}
                                            className="flex justify-between"
                                          >
                                            <div className="text-sm">
                                              {it.name ||
                                                it.menu_item_name ||
                                                `Item ${i + 1}`}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              {fmtAmt(Number(it.price ?? 0))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Charges / breakdown */}
                    <div className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Amount Breakdown</div>
                        <button
                          onClick={() => setShowChargesDetails((s) => !s)}
                          className="text-xs px-2 py-1 rounded bg-gray-100"
                        >
                          {showChargesDetails ? "Hide" : "Show"}
                        </button>
                      </div>

                      {showChargesDetails && (
                        <div className="mt-3 text-sm text-gray-700">
                          {(() => {
                            const items = Array.isArray(selectedOrder.items)
                              ? selectedOrder.items
                              : [];
                            const addonItems = items.filter(
                              (it) => it.is_complementary === false
                            );
                            const addonsCost = addonItems.reduce((sum, it) => {
                              const qty = Number(it.quantity ?? 1);
                              const unit = Number(it.price ?? 0);
                              return sum + qty * unit;
                            }, 0);

                            // Try to get package cost from summary
                            const packageCost = Number(
                              selectedOrder.package_cost ??
                              selectedOrder.amount_breakdown?.package_cost ??
                              selectedOrder.package_total ??
                              0
                            );

                            const subtotal = packageCost + addonsCost;

                            const deliveryOption =
                              (selectedOrder.delivery_option || "").toLowerCase() ||
                              "delivery";
                            const deliveryCharge = Number(
                              selectedOrder.delivery_charge ?? 0
                            );

                            const includeStaff = selectedOrder.include_staff;
                            const staffCharge = Number(selectedOrder.staff_charge ?? 0);

                            const waterFree = selectedOrder.water_free === true;
                            const waterChoice = selectedOrder.water_choice;
                            const waterQuantity = selectedOrder.water_quantity;
                            const waterCans = selectedOrder.water_cans_needed;
                            const waterCups = selectedOrder.water_cups_needed;
                            const waterEstimated = Number(
                              selectedOrder.water_estimated_price ??
                              selectedOrder.water_charge ??
                              0
                            );

                            const tax = Number(selectedOrder.tax_amount ?? 0);
                            const coupon = Number(selectedOrder.coupon_discount ?? 0);
                            const total = Number(selectedOrder.total ?? 0);

                            return (
                              <>
                                {/* ✅ Delivery option logic */}
                                <div className="flex justify-between">
                                  <div>
                                    {deliveryOption === "selfpickup" ||
                                      deliveryOption === "self_pickup" ||
                                      deliveryOption === "pickup"
                                      ? "Self pickup"
                                      : "Delivery"}
                                  </div>
                                  <div>
                                    {deliveryOption === "selfpickup" ||
                                      deliveryOption === "self_pickup" ||
                                      deliveryOption === "pickup"
                                      ? "—"
                                      : deliveryCharge === 0
                                        ? "Free"
                                        : fmtAmt(deliveryCharge)}
                                  </div>
                                </div>
                                {deliveryOption === "selfpickup" ||
                                  deliveryOption === "self_pickup" ||
                                  deliveryOption === "pickup" ? (
                                  <div className="text-[11px] text-gray-500 mb-2">
                                    Pickup address and timings will be shared once your order
                                    status moves to{" "}
                                    <span className="font-semibold">"Preparation"</span>.
                                  </div>
                                ) : null}

                                {/* ✅ Staff logic */}
                                <div className="flex justify-between">
                                  <div>Staff</div>
                                  <div>
                                    {includeStaff === false
                                      ? "Not selected"
                                      : includeStaff === true
                                        ? staffCharge === 0
                                          ? "Free"
                                          : fmtAmt(staffCharge)
                                        : fmtAmt(staffCharge)}
                                  </div>
                                </div>

                                {/* 🚰 Water Section */}
                                <div className="mt-2">
                                  <div className="flex justify-between">
                                    <div>Water</div>
                                    <div>
                                      {selectedOrder.water_free
                                        ? "Free"
                                        : Number(
                                          selectedOrder.water_estimated_price || 0
                                        ) > 0
                                          ? fmtAmt(selectedOrder.water_estimated_price)
                                          : "—"}
                                    </div>
                                  </div>

                                  {selectedOrder.water_choice && (
                                    <div className="mt-1 text-[11px] text-gray-600 space-y-1">
                                      <div>
                                        Choice:&nbsp;
                                        <span className="font-medium capitalize">
                                          {selectedOrder.water_choice}
                                        </span>
                                      </div>

                                      {/* bottles */}
                                      {selectedOrder.water_choice.toLowerCase() ===
                                        "bottles" &&
                                        !!selectedOrder.water_quantity && (
                                          <div>
                                            Bottles:&nbsp;
                                            <span className="font-medium">
                                              {selectedOrder.water_quantity}
                                            </span>
                                          </div>
                                        )}

                                      {/* cans */}
                                      {selectedOrder.water_choice.toLowerCase() ===
                                        "cans" && (
                                          <>
                                            {selectedOrder.water_cans_needed !== null && (
                                              <div>
                                                Cans needed:&nbsp;
                                                <span className="font-medium">
                                                  {selectedOrder.water_cans_needed}
                                                </span>
                                              </div>
                                            )}
                                            {selectedOrder.water_cups_needed !== null && (
                                              <div>
                                                Cups needed:&nbsp;
                                                <span className="font-medium">
                                                  {selectedOrder.water_cups_needed}
                                                </span>
                                              </div>
                                            )}
                                          </>
                                        )}
                                    </div>
                                  )}
                                </div>

                                {/* Tax & coupon */}
                                <div className="mt-2 flex justify-between">
                                  <div>Tax</div>
                                  <div>{fmtAmt(tax)}</div>
                                </div>
                                <div className="flex justify-between">
                                  <div>Coupon</div>
                                  <div className="text-rose-600">
                                    {coupon ? `-${fmtAmt(coupon)}` : fmtAmt(0)}
                                  </div>
                                </div>

                                {/* Grand total */}
                                <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
                                  <div>Total</div>
                                  <div>{fmtAmt(total)}</div>
                                </div>

                                {/* ✅ Utensils advance + note */}
                                <div className="mt-2 text-xs text-gray-600">
                                  <div className="flex justify-between">
                                    <div>Utensils advance</div>
                                    <div>
                                      {fmtAmt(selectedOrder.utensils_advance || 0)}
                                    </div>
                                  </div>
                                  {selectedOrder.utensils_refund && (
                                    <div className="flex justify-between">
                                      <div>Utensils refund</div>
                                      <div>-{fmtAmt(selectedOrder.utensils_refund)}</div>
                                    </div>
                                  )}
                                  <div className="mt-1 text-[11px]">
                                    Collected at time of pickup / delivery and refunded fully
                                    once utensils are returned.
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Payment / advance info */}
                    <div className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Payment</div>
                        <button
                          onClick={() => setShowPaymentDetails((s) => !s)}
                          className="text-xs px-2 py-1 rounded bg-gray-100"
                        >
                          {showPaymentDetails ? "Hide" : "Show"}
                        </button>
                      </div>

                      {showPaymentDetails && (
                        <div className="mt-3 text-sm text-gray-700">
                          {(() => {
                            const paid = Number(selectedOrder.paid_amount || 0);
                            const remaining = Number(selectedOrder.remaining_due || 0);

                            const paymentStatus = String(selectedOrder.payment_status || "")
                              .trim()
                              .toLowerCase();

                            const statusKey = String(
                              selectedOrder._status_key || selectedOrder.status || ""
                            )
                              .trim()
                              .toLowerCase();

                            const isPickup = (selectedOrder.delivery_option || "")
                              .toLowerCase()
                              .includes("pickup");

                            return (
                              <>
                                {/* Remaining due */}
                                <div className="flex justify-between mt-2">
                                  <div>Remaining due</div>
                                  <div className="font-medium">{fmtAmt(remaining)}</div>
                                </div>

                                {/* FIXED CONDITION */}
                                {remaining > 0 &&
                                  statusKey !== "cancelled" &&
                                  paymentStatus !== "unpaid" && (
                                    <div className="mt-2 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded">
                                      Payable to caterer at time of{" "}
                                      {isPickup ? "pickup" : "delivery"}.
                                    </div>
                                  )}

                                {/* Status */}
                                <div className="mt-2 text-xs">
                                  <strong>Status: </strong>
                                  <span className="ml-1 capitalize">
                                    {selectedOrder.payment_status ||
                                      (remaining > 0 ? "Partially Paid" : "Paid")}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    {/*  Rating & Review (only for completed/delivered orders & customers) */}
                    {(() => {
                      if (!selectedOrder) return null;

                      const rawStatus = String(
                        selectedOrder._status_key ||
                        selectedOrder.status ||
                        ""
                      )
                        .trim()
                        .toLowerCase();

                      const isCompletedOrder =
                        rawStatus === "completed";

                      // Only customers can review
                      const isCaterer = (user.role || "").toLowerCase() === "caterer";
                      if (!isCompletedOrder || isCaterer) return null;

                      const existingReview =
                        Array.isArray(reviews) && selectedOrder?.id
                          ? reviews.find(
                            (r) => String(r.order || r.order_id) === String(selectedOrder.id)
                          )
                          : null;

                      if (existingReview) {
                        // ✅ Show "your rating" section
                        return (
                          <div className="border rounded p-3 mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">Your rating</div>
                              <div className="text-xs text-gray-500">
                                {existingReview.created_at
                                  ? new Date(existingReview.created_at).toLocaleDateString()
                                  : ""}
                              </div>
                            </div>
                            <StarRow rating={existingReview.rating} />
                            {existingReview.body ? (
                              <div className="mt-2 text-sm text-gray-700">
                                {existingReview.body}
                              </div>
                            ) : null}
                            <div className="mt-1 text-[11px] text-gray-500">
                              Thank you for rating this order.
                            </div>
                          </div>
                        );
                      }

                      // ❌ No existing review → show form
                      return (
                        <div className="border rounded p-3 mt-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Rate this order</div>
                            <div className="text-[11px] text-gray-500">
                              Help others by sharing your experience
                            </div>
                          </div>

                          <div className="mt-2">
                            <StarInput
                              value={reviewDraft.rating}
                              onChange={(val) =>
                                setReviewDraft((prev) => ({
                                  ...prev,
                                  rating: val,
                                }))
                              }
                            />
                          </div>

                          <div className="mt-3">
                            <label className="text-xs text-gray-600">
                              Comments (optional)
                            </label>
                            <textarea
                              rows={3}
                              value={reviewDraft.body}
                              onChange={(e) =>
                                setReviewDraft((prev) => ({
                                  ...prev,
                                  body: e.target.value,
                                }))
                              }
                              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                              placeholder="How was the food, service, and overall experience?"
                            />
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={handleSubmitReview}
                              disabled={submittingReview}
                              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {submittingReview ? "Submitting..." : "Submit Review"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    {/* ⭐ Notes Section (always visible if notes exist) */}
                    {Array.isArray(selectedOrder.notes) && selectedOrder.notes.length > 0 && (
                      <div className="border rounded p-3 mx-4 mb-2 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span role="img" aria-label="notes">📝</span>
                          <div className="text-sm font-medium text-gray-800">
                            Order Notes ({selectedOrder.notes.length})
                          </div>
                        </div>

                        <div className="space-y-2 max-h-32 overflow-auto pr-1">
                          {selectedOrder.notes.map((note) => (
                            <div
                              key={note.id}
                              className="text-xs bg-white p-2 rounded-lg border shadow-sm"
                            >
                              <div className="text-gray-700">{note.body}</div>
                              <div className="mt-1 text-[10px] text-gray-400 flex justify-between">
                                <span>{note.user_name || "Caterer"}</span>
                                <span>
                                  {note.created_at
                                    ? new Date(note.created_at).toLocaleString()
                                    : ""}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* ✍️ Add Note – only when order is active */}
                    {(() => {
                      if (!selectedOrder) return null;

                      const allowedStatuses = [
                        "pending",
                        "accepted",
                        "preparation_in_progress",
                        "ready_to_pickup",
                        "delivery_in_progress",
                        "customer_picked_up",
                      ];

                      const statusKey = String(
                        selectedOrder._status_key || selectedOrder.status || ""
                      )
                        .trim()
                        .toLowerCase();

                      if (!allowedStatuses.includes(statusKey)) return null;

                      return (
                        <div className="border rounded-lg bg-white p-3 mt-3 mx-4">
                          <div className="text-sm font-medium text-gray-800 mb-2">
                            Add a Note for Caterer
                          </div>

                          <textarea
                            className="w-full text-sm border rounded-lg px-3 py-2"
                            rows={3}
                            placeholder="Eg: Please reduce spicy, delay 30 mins etc"
                            value={noteInputs[selectedOrder.id] || ""}
                            onChange={(e) =>
                              setNoteInputs((prev) => ({
                                ...prev,
                                [selectedOrder.id]: e.target.value,
                              }))
                            }
                          />

                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => handleAddNoteForOrder(selectedOrder)}
                              disabled={!noteInputs[selectedOrder.id]?.trim()}
                              className="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              Add Note
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                  </>
                )}
              </div>

              {/* footer */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t">
                {(() => {
                  const statusKey = (
                    selectedOrder?._status_key ||
                    String(selectedOrder?.status || "")
                  )
                    .trim()
                    .toLowerCase();

                  // 1) INITIATED → continue payment + cancel
                  if (statusKey === "initiated") {
                    return (
                      <div className="flex items-center gap-3 w-full">
                        <button
                          onClick={() => {
                            closeOrderModal();
                            navigate(`/payment?orderId=${selectedOrder.id}`);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Continue Order
                        </button>

                        {/* Push this button to the right */}
                        <button
                          onClick={async () => {
                            try {
                              await axios.patch(
                                `/api/orders/${selectedOrder.id}/status/`,
                                { status: "cancelled" }
                              );
                              toast.success("Order cancelled successfully");
                              closeOrderModal();
                              fetchOrders();
                            } catch (err) {
                              console.error("Cancel order failed", err);
                              toast.error("Failed to cancel order");
                            }
                          }}
                          className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Cancel Order
                        </button>
                      </div>
                    );
                  }

                  // 2) PENDING or ACCEPTED → Download + Cancel, and cancel opens refund page
                  if (statusKey === "pending" || statusKey === "accepted") {
                    if (showCancelFlow) {
                      // confirm cancel + refund
                      return (
                        <div className="flex items-center gap-3">
                          {/* Confirm cancel */}
                          <button
                            onClick={handleConfirmCancelPending}
                            disabled={cancelSubmitting}
                            className="w-36 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {cancelSubmitting ? "Cancelling…" : "Confirm Cancel"}
                          </button>

                          {/* Back on right */}
                          <button
                            onClick={() => setShowCancelFlow(false)}
                            className="w-36 ml-auto px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          >
                            Back
                          </button>
                        </div>
                      );
                    }

                    // default view: show Download + Cancel
                    return (
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            generateInvoicePdf(selectedOrder);
                          }}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Download Invoice
                        </button>

                        {/* moves to right */}
                        <button
                          onClick={() => setShowCancelFlow(true)}
                          className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Cancel Order
                        </button>
                      </div>
                    );
                  }

                  // 3) All other statuses → only Download Invoice
                  return (
                    <button
                      onClick={() => {
                        generateInvoicePdf(selectedOrder);
                      }}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Download Invoice
                    </button>
                  );
                })()}

                {/* Right side — Close */}
                <button
                  onClick={closeOrderModal}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {showMapPicker && (
        <MapPicker
          apiKey={GOOGLE_MAPS_KEY}
          initial={{
            lat: addrForm.latitude ? Number(addrForm.latitude) : (caterer?.active_location?.latitude ? Number(caterer.active_location.latitude) : 13.61857),
            lng: addrForm.longitude ? Number(addrForm.longitude) : (caterer?.active_location?.longitude ? Number(caterer.active_location.longitude) : 79.42527),
          }}
          onPick={handleMapPick}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};

export default UserProfile;