// src/pages/OrderCreate.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../shared-lib/axiosInstance";
import { useParams } from "react-router-dom";


/**
 * OrderCreate (production-ready)
 *
 * - Draft saved to localStorage
 * - Staff charge fetched from /api/caterers/:id/staff-charge/
 * - Submits to /api/orders/ and handles payment redirect
 *
 * Notes:
 * - axiosInstance should manage auth / CSRF as appropriate
 * - This file intentionally keeps some UI simple so it can be integrated
 *   with a map/location picker or design system later.
 */

function useQuery() {
  return new URLSearchParams(useLocation().search);
}
const formatINR = (v) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

const PriceRow = ({ label, value, strike = null, note = null }) => {
  const formatAmount = (v) => {
    if (v == null || v === "" || Number.isNaN(Number(v))) return "—";
    return `₹${Number(Number(v).toFixed(2)).toFixed(2)}`;
  };

  if (strike != null) {
    return (
      <div className="flex flex-col text-sm text-gray-700">
        <div className="flex justify-between items-baseline">
          <div className="text-sm">{label}</div>
          <div className="text-right">
            <div className="text-sm line-through text-gray-400">
              {formatAmount(strike)}
            </div>
            <div className="font-semibold text-green-600">
              {formatAmount(value)}
              <span className="text-xs text-gray-500 ml-2">
                {Number(value) === 0 ? "waived" : "final"}
              </span>
            </div>
          </div>
        </div>
        {note ? (
          <div className="text-xs text-gray-400 mt-1">{note}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex justify-between items-start gap-2 text-sm text-gray-700">
      <div className="flex-1 pr-2">{label}</div>
      <div className="font-semibold tabular-nums text-right break-all max-w-[45%]">
        {formatAmount(value)}
      </div>
    </div>
  );
};

export default function OrderCreate() {
  const query = useQuery();
  const navigate = useNavigate();
  const catererId = query.get("caterer");
  const packageIdFromQuery = query.get("package");
  const initialAddons = (query.get("addons") || "")
    .split(",")
    .filter(Boolean)
    .map((x) => Number(x));
  const initialPlates = Math.max(
    1,
    parseInt(query.get("plates") || "1", 10) || 1
  );

  const draftKey = (cId) => `pltr_order_draft_${cId}`;
  const pkgStorageKey = (cId) => `pltr_pkg_selections_${cId}`;
  const pkgSelectedKey = (cId) => `pltr_pkg_selected_${cId}`;
  const addonQtysKey = (cId) => `pltr_addon_qtys_${cId}`;
  const cachedPkgKey = (cId, pId) => `pltr_pkg_cached_${cId}_${pId}`;
  const [editingOrder, setEditingOrder] = useState(null);
  const { orderId } = useParams();
  const isEditMode = Boolean(orderId);
  const [isEditHydrated, setIsEditHydrated] = useState(false);

  // --- state ---
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState([]);
  const [caterer, setCaterer] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [pkgLoadError, setPkgLoadError] = useState("");
  const [attemptsLog, setAttemptsLog] = useState([]);

  const [selectedAddons, setSelectedAddons] = useState(new Set(initialAddons));
  const [addonQtys, setAddonQtys] = useState({});
  const [plates, setPlates] = useState(
    isEditMode ? 0 : initialPlates
  );
  const nearbyRef = useRef(null);

  const [primaryContact, setPrimaryContact] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("userProfile") || "{}");
      return s.username || s.phone || "";
    } catch {
      return "";
    }
  });
  const [secondaryContact, setSecondaryContact] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");
  const [locationVal, setLocationVal] = useState("");
  const [nearby, setNearby] = useState("");
  const [includeStaff, setIncludeStaff] = useState(true);
  const [eventLat, setEventLat] = useState(null);
  const [eventLng, setEventLng] = useState(null);
  const [nearbyInvalid, setNearbyInvalid] = useState(false);
  const eventDateRef = useRef(null);
  const eventTimeRef = useRef(null);
  const [eventDateInvalid, setEventDateInvalid] = useState(false);
  const [eventTimeInvalid, setEventTimeInvalid] = useState(false);
  const [eventTypeInvalid, setEventTypeInvalid] = useState(false);

  const buildSelectedPackageForPayload = () => {
    if (!pkg) return null;

    // 1) Base data from backend (this already has composition_structure without selected flags)
    const base = pkg.raw || {};

    // 2) Deep clone composition_structure so we can safely mutate
    const structure = JSON.parse(
      JSON.stringify(pkg.composition_structure || { sections: {} })
    );

    // 3) Read user's selection from localStorage (same source as selectedPackageDisplay)
    let selections = null;
    try {
      const raw = localStorage.getItem(pkgStorageKey(catererId));
      if (raw) {
        const parsed = JSON.parse(raw);
        const pkid = String(pkg.id);
        // assuming shape: { [packageId]: { sections: { starters: [0,1], ... } } }
        selections = parsed?.[pkid]?.sections || null;
      }
    } catch (e) {
      selections = null;
    }

    // 4) Mark options as selected: true/false
    if (selections && structure.sections) {
      Object.entries(selections).forEach(([sectionKey, idxArray]) => {
        const section = structure.sections[sectionKey];
        if (!section || !Array.isArray(section.options)) return;

        const indices = Array.isArray(idxArray)
          ? idxArray.map((x) => Number(x))
          : [];

        section.options.forEach((opt, idx) => {
          // add selected flag
          opt.selected = indices.includes(idx);
        });
      });
    }

    // 5) Return merged object for payload
    return {
      ...base,
      composition_structure: structure,
    };
  };

  useEffect(() => {
    if (nearbyRef.current && (!nearby || nearby.trim() === "")) {
      setNearbyInvalid(true);
      try {
        nearbyRef.current.focus();
        nearbyRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (e) { }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: this input snippet in your paste was just illustrative; kept logic in final JSX below.
  // input JSX (replace existing nearby input)
  // ...

  // extra plates / utensils / coupon / payment
  const [extraPlates, setExtraPlates] = useState(false);
  const [extraPlatesCount, setExtraPlatesCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [addonFilter, setAddonFilter] = useState("all");
  const [pkgExpanded, setPkgExpanded] = useState(false);
  const [draftMeta, setDraftMeta] = useState(null);

  // staff info
  const [staffInfo, setStaffInfo] = useState({
    staff_available: null,
    staff_charge_to_serve: null,
    staff_charge_free_above: null,
    updated_at: null,
    loading: false,
    error: null,
  });

  // water estimate state
  const [waterChoice, setWaterChoice] = useState("bottles"); // 'bottles' or 'can'
  const [waterEstimate, setWaterEstimate] = useState(null);
  const [estimatingWater, setEstimatingWater] = useState(false);
  const [waterEstimateError, setWaterEstimateError] = useState(null);

  // delivery type
  const [deliveryType, setDeliveryType] = useState("delivery");

  // delivery fee state
  const [deliveryEstimate, setDeliveryEstimate] = useState(null); // { delivery_fee, distance_km, total_with_delivery }
  const [estimatingDelivery, setEstimatingDelivery] = useState(false);
  const [deliveryEstimateError, setDeliveryEstimateError] = useState(null);

  // pricing defaults
  const UTENSILS_ADVANCE_PERCENT = 0.12;
  const STAFF_SERVICE_FEE_PER_PLATE = 0.7;

  // --- helpers: write / clear drafts (top-level so effects can use them) ---
  const clearDraft = () => {
    if (!catererId) return;
    try {
      localStorage.removeItem(draftKey(catererId));
    } catch (e) {
      // ignore
    } finally {
      setDraftMeta(null);
    }
  };

  const writeDraft = (patch = {}) => {
    if (!catererId) return;
    try {
      const key = draftKey(catererId);
      const raw = localStorage.getItem(key);
      const cur = raw ? JSON.parse(raw) : {};
      const merged = { ...cur, ...patch, savedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(merged));
      setDraftMeta(merged);
    } catch (e) {
      // ignore
    }
  };
  useEffect(() => {
    if (!catererId) return;
    estimateWater();
  }, [waterChoice, plates, catererId]);
  // --- draft load/save ---
  useEffect(() => {
    if (!catererId) return;
    try {
      const raw = localStorage.getItem(draftKey(catererId));
      if (!raw) return;
      const draft = JSON.parse(raw);
      setDraftMeta(draft || null);
      if (draft.primaryContact) setPrimaryContact(draft.primaryContact);
      if (draft.secondaryContact) setSecondaryContact(draft.secondaryContact);
      if (draft.eventDate) setEventDate(draft.eventDate);
      if (draft.eventTime) setEventTime(draft.eventTime);
      if (draft.locationVal) setLocationVal(draft.locationVal);
      if (draft.nearby) setNearby(draft.nearby);
      if (typeof draft.includeStaff === "boolean")
        setIncludeStaff(draft.includeStaff);
      if (draft.eventLat != null) setEventLat(draft.eventLat);
      if (draft.eventLng != null) setEventLng(draft.eventLng);
      if (typeof draft.extraPlates === "boolean")
        setExtraPlates(draft.extraPlates);
      if (typeof draft.extraPlatesCount === "number")
        setExtraPlatesCount(draft.extraPlatesCount);
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      if (draft.coupon) setCoupon(draft.coupon);
      if (draft.couponDiscount != null)
        setCouponDiscount(Number(draft.couponDiscount) || 0);
      if (typeof draft.plates === "number") setPlates(draft.plates);
      if (Array.isArray(draft.selectedAddons))
        setSelectedAddons(new Set(draft.selectedAddons));
      if (draft.addonQtys && typeof draft.addonQtys === "object")
        setAddonQtys(draft.addonQtys);
      if (draft.deliveryType) setDeliveryType(draft.deliveryType);
      if (draft.selectedEventType) setSelectedEventType(draft.selectedEventType);
      if (draft.selected_event) setSelectedEventType(draft.selected_event);
      if (draft.event_type) setSelectedEventType(draft.event_type);
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catererId]);

  useEffect(() => {
    if (!isEditMode || !orderId) return;

    const loadExistingOrder = async () => {
      try {
        const res = await axiosInstance.get(`/api/orders/${orderId}/`);
        const o = res.data;

        setAddonQtys(o.addon_item_qtys || {});
        setSelectedAddons(new Set(o.addon_item_ids || []));
        setPlates(Number(o.plates || 1));
        setEventDate(o.event_date || "");
        setEventTime(o.event_time || "");
        setSelectedEventType(o.event_type || "");
        setLocationVal(o.location || "");
        setNearby(o.nearby || "");
        setIncludeStaff(!!o.include_staff);
        setDeliveryType(o.delivery_type || "delivery");
        setCoupon(o.coupon_code || "");
        setCouponDiscount(o.coupon_discount || 0);
        setWaterChoice(o.water_choice || "bottles");

        setEditingOrder(o);

        // ✅ VERY IMPORTANT
        setIsEditHydrated(true);

        writeDraft({
          editing_order_id: orderId,
          order_in_progress: orderId,
        });
      } catch (err) {
        console.error("Failed to load order for edit", err);
        alert("Unable to edit this order.");
        navigate("/");
      }
    };

    loadExistingOrder();
  }, [isEditMode, orderId, catererId]);

  useEffect(() => {
    if (!isEditMode || !editingOrder) return;

    if (editingOrder.status !== "initiated") {
      alert("Only initiated orders can be edited");
      navigate("/");
    }
  }, [isEditMode, editingOrder]);

  useEffect(() => {
    if (!catererId) return;
    try {
      const payload = {
        primaryContact,
        secondaryContact,
        eventDate,
        eventTime,
        locationVal,
        nearby,
        includeStaff,
        eventLat,
        eventLng,
        extraPlates,
        extraPlatesCount,
        paymentMethod,
        coupon,
        couponDiscount,
        plates,
        deliveryType,
        coupon_discount: Number(couponDiscount || 0),
        selectedEventType,
        selected_event: selectedEventType || null,
        event_type: selectedEventType || null,
        selectedAddons: Array.from(selectedAddons),
        addonQtys,
        savedAt: Date.now(),
        ...(draftMeta && draftMeta.order_in_progress
          ? {
            order_in_progress: draftMeta.order_in_progress,
            order_amount: draftMeta.order_amount,
          }
          : {}),
      };
      localStorage.setItem(draftKey(catererId), JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
  }, [
    catererId,
    primaryContact,
    secondaryContact,
    eventDate,
    eventTime,
    locationVal,
    nearby,
    includeStaff,
    eventLat,
    eventLng,
    extraPlates,
    extraPlatesCount,
    paymentMethod,
    coupon,
    couponDiscount,
    plates,
    selectedAddons,
    addonQtys,
    draftMeta,
    selectedEventType,
  ]);

  // --- Sync event location from CatererList (localStorage + broadcast) ---
  useEffect(() => {
    // initial read from localStorage when form loads
    try {
      const raw = JSON.parse(
        localStorage.getItem("plater_selected_location") || "null"
      );
      if (raw && raw.label) {
        setLocationVal(raw.label);
        if (raw.lat != null && raw.lng != null) {
          setEventLat(Number(raw.lat));
          setEventLng(Number(raw.lng));
        }
      }
    } catch (e) {
      /* ignore */
    }

    // listen for broadcasts from CatererList
    const handler = (e) => {
      const obj = e?.detail ?? null;
      if (!obj) return;
      setLocationVal(obj.label || "");
      setEventLat(obj.lat ?? null);
      setEventLng(obj.lng ?? null);
      writeDraft({
        locationVal: obj.label || "",
        eventLat: obj.lat ?? null,
        eventLng: obj.lng ?? null,
      });
    };

    window.addEventListener("plater:selected-location-changed", handler);
    return () =>
      window.removeEventListener("plater:selected-location-changed", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- fetch menus + package + caterer details ---
  useEffect(() => {
    if (!catererId) {
      setPkgLoadError("Missing caterer id in query params.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPkg(null);
    setPkgLoadError("");
    setAttemptsLog([]);

    const menusReq = axiosInstance.get(`/api/caterers/${catererId}/menus/`);
    const catererReq = axiosInstance
      .get(`/api/caterers/${catererId}/`)
      .catch(() => ({ data: null }));

    const desiredPkgId =
      packageIdFromQuery || localStorage.getItem(pkgSelectedKey(catererId)) || null;

    (async () => {
      try {
        const [menusRes, catererRes] = await Promise.all([menusReq, catererReq]);
        if (cancelled) return;
        let data = Array.isArray(menusRes.data)
          ? menusRes.data
          : menusRes.data?.results || [];
        data = data.filter(
          (m) =>
            m && (m.is_active === true || String(m.is_active) === "true")
        );
        const normalized = data.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: Number(m.price || 0),
          is_addon: !!m.is_addon,
          cuisine: m.cuisine || "",
          raw: m,
        }));
        setMenus(normalized);
        setCaterer(catererRes.data || null);

        if (!desiredPkgId) {
          setPkg(null);
          setPkgLoadError(
            "No package selected. Please choose a package on the Caterer page (Checkout) before arriving here."
          );
          setLoading(false);
          return;
        }

        const logAttempt = (entry) =>
          setAttemptsLog((prev) => [...prev, entry]);

        // Attempt 1: public packages list
        try {
          const url = `/api/caterers/${catererId}/public-packages/`;
          logAttempt({ url, note: "GET list -> find id" });
          const res = await axiosInstance.get(url);
          if (cancelled) return;
          const arr = Array.isArray(res.data)
            ? res.data
            : res.data?.results || [];
          const found = arr.find(
            (x) => String(x.id) === String(desiredPkgId)
          );
          if (found) {
            const p = found;
            let cs = p.composition_structure ?? p.composition_struct ?? null;
            if (typeof cs === "string") {
              try {
                cs = JSON.parse(cs);
              } catch { }
            }
            setPkg({
              id: p.id,
              name: p.name,
              description: p.description,
              price_per_plate: Number(p.price_per_plate ?? p.price ?? 0),
              composition_structure: cs || { sections: {} },
              composition: p.composition || null,
              veg_only: !!p.veg_only,
              min_plates: p.min_plates ?? 0,
              max_plates: p.max_plates ?? null,
              raw: p,
              _fetched_from: url,
            });
            try {
              localStorage.setItem(
                cachedPkgKey(catererId, p.id),
                JSON.stringify(found)
              );
            } catch { }
            setLoading(false);
            return;
          } else {
            logAttempt({ url, found: false });
          }
        } catch (err) {
          logAttempt({
            url: `/api/caterers/${catererId}/public-packages/`,
            error: err?.response?.status || err.message,
          });
        }

        // Attempt 2: caterer-specific detail
        try {
          const url = `/api/caterers/${catererId}/packages/${desiredPkgId}/`;
          logAttempt({ url, note: "caterer-specific package detail" });
          const res = await axiosInstance.get(url);
          if (cancelled) return;
          const p = res.data;
          if (p) {
            let cs = p.composition_structure ?? p.composition_struct ?? null;
            if (typeof cs === "string") {
              try {
                cs = JSON.parse(cs);
              } catch { }
            }
            setPkg({
              id: p.id,
              name: p.name,
              description: p.description,
              price_per_plate: Number(p.price_per_plate ?? p.price ?? 0),
              composition_structure: cs || { sections: {} },
              composition: p.composition || null,
              veg_only: !!p.veg_only,
              min_plates: p.min_plates ?? 0,
              max_plates: p.max_plates ?? null,
              raw: p,
              _fetched_from: url,
            });
            try {
              localStorage.setItem(
                cachedPkgKey(catererId, p.id),
                JSON.stringify(p)
              );
            } catch { }
            setLoading(false);
            return;
          } else {
            logAttempt({ url, found: false });
          }
        } catch (err) {
          logAttempt({
            url: `/api/caterers/${catererId}/packages/${desiredPkgId}/`,
            error: err?.response?.status || err.message,
          });
        }

        // Attempt 3: global package detail
        try {
          const url = `/api/packages/${desiredPkgId}/`;
          logAttempt({ url, note: "global package detail" });
          const res = await axiosInstance.get(url);
          if (cancelled) return;
          const p = res.data;
          if (p) {
            let cs = p.composition_structure ?? p.composition_struct ?? null;
            if (typeof cs === "string") {
              try {
                cs = JSON.parse(cs);
              } catch { }
            }
            setPkg({
              id: p.id,
              name: p.name,
              description: p.description,
              price_per_plate: Number(p.price_per_plate ?? p.price ?? 0),
              composition_structure: cs || { sections: {} },
              composition: p.composition || null,
              veg_only: !!p.veg_only,
              min_plates: p.min_plates ?? 0,
              max_plates: p.max_plates ?? null,
              raw: p,
              _fetched_from: url,
            });
            try {
              localStorage.setItem(
                cachedPkgKey(catererId, p.id),
                JSON.stringify(p)
              );
            } catch { }
            setLoading(false);
            return;
          } else {
            logAttempt({ url, found: false });
          }
        } catch (err) {
          logAttempt({
            url: `/api/packages/${desiredPkgId}/`,
            error: err?.response?.status || err.message,
          });
        }

        // Attempt 4: authenticated caterer endpoint
        try {
          const url = `/api/caterers/me/packages/${desiredPkgId}/`;
          logAttempt({ url, note: "authenticated caterer package" });
          const res = await axiosInstance.get(url);
          if (cancelled) return;
          const p = res.data;
          if (p) {
            let cs = p.composition_structure ?? p.composition_struct ?? null;
            if (typeof cs === "string") {
              try {
                cs = JSON.parse(cs);
              } catch { }
            }
            setPkg({
              id: p.id,
              name: p.name,
              description: p.description,
              price_per_plate: Number(p.price_per_plate ?? p.price ?? 0),
              composition_structure: cs || { sections: {} },
              composition: p.composition || null,
              veg_only: !!p.veg_only,
              min_plates: p.min_plates ?? 0,
              max_plates: p.max_plates ?? null,
              raw: p,
              _fetched_from: url,
            });
            try {
              localStorage.setItem(
                cachedPkgKey(catererId, p.id),
                JSON.stringify(p)
              );
            } catch { }
            setLoading(false);
            return;
          } else {
            logAttempt({ url, found: false });
          }
        } catch (err) {
          logAttempt({
            url: `/api/caterers/me/packages/${desiredPkgId}/`,
            error: err?.response?.status || err.message,
          });
        }

        // Attempt 5: cached fallback
        try {
          const raw = localStorage.getItem(
            cachedPkgKey(catererId, desiredPkgId)
          );
          if (raw) {
            const p = JSON.parse(raw);
            let cs = p.composition_structure ?? p.composition_struct ?? null;
            if (typeof cs === "string") {
              try {
                cs = JSON.parse(cs);
              } catch { }
            }
            setPkg({
              id: p.id,
              name: p.name,
              description: p.description,
              price_per_plate: Number(p.price_per_plate ?? p.price ?? 0),
              composition_structure: cs || { sections: {} },
              composition: p.composition || null,
              veg_only: !!p.veg_only,
              min_plates: p.min_plates ?? 0,
              max_plates: p.max_plates ?? null,
              raw: p,
              _fetched_from: "localStorage (cached fallback)",
              _cached_stale: true,
            });
            logAttempt({ fallback: "localStorage cached package used" });
            setPkgLoadError(
              "Package loaded from cached data (localStorage). Network fetches failed or did not expose detail endpoint."
            );
            setLoading(false);
            return;
          }
        } catch (e) {
          // ignore
        }

        const msg = `Package details could not be loaded. Attempts: ${JSON.stringify(
          attemptsLog.concat([]).slice(-10)
        )}`;
        setPkg(null);
        setPkgLoadError(msg);
      } catch (err) {
        console.error("Package+menus load failed:", err);
        setMenus([]);
        setCaterer(null);
        setPkg(null);
        setPkgLoadError("Failed to load data. Check server or network.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catererId, packageIdFromQuery]);

  // addon qtys load
  useEffect(() => {
    if (!catererId) return;
    try {
      const raw = localStorage.getItem(addonQtysKey(catererId));
      if (raw) {
        const parsed = JSON.parse(raw);
        setAddonQtys((prev) => ({ ...(parsed || {}), ...(prev || {}) }));
        const sel = new Set(selectedAddons);
        Object.entries(parsed || {}).forEach(([k, v]) => {
          if (Number(v) > 0) sel.add(Number(k));
        });
        setSelectedAddons(sel);
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catererId]);

  const cancelExistingOrder = async (orderId) => {
    await axiosInstance.post(`/api/orders/${orderId}/cancel/`);
    setIsEditHydrated(false);
    clearDraft();
    navigate("/");
  };

  const defaultItems = useMemo(
    () => menus.filter((m) => !m.is_addon),
    [menus]
  );
  const addonItems = useMemo(() => menus.filter((m) => m.is_addon), [menus]);

  useEffect(() => {
    // NEVER override backend values during edit hydration
    if (isEditMode && !isEditHydrated) return;
    if (isEditMode) return;

    setAddonQtys((prev) => {
      const cp = { ...(prev || {}) };
      selectedAddons.forEach((id) => {
        if (!cp[id] || Number(cp[id]) <= 0) {
          cp[id] = Number(plates || 1);
        }
      });
      return cp;
    });
  }, [selectedAddons, plates, isEditMode, isEditHydrated]);

  const toggleAddon = (id) =>
    setSelectedAddons((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) {
        copy.delete(id);
        setAddonQtys((q) => ({ ...(q || {}), [id]: 0 }));
      } else {
        copy.add(id);
        setAddonQtys((q) => ({
          ...(q || {}),
          [id]: Number(q?.[id] || plates || 1),
        }));
      }
      return copy;
    });

  const setAddonQty = (id, qty) => {
    const n = Number(qty) || 0;
    setAddonQtys((prev) => ({ ...(prev || {}), [id]: n }));
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (n > 0) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedPackageDisplay = useMemo(() => {
    if (!pkg) return null;
    const pkid = String(pkg.id);
    const raw = (() => {
      try {
        return JSON.parse(
          localStorage.getItem(pkgStorageKey(catererId)) || "null"
        );
      } catch {
        return null;
      }
    })();
    const sel = raw && raw[pkid] ? raw[pkid] : null;
    if (!sel || !sel.sections) return null;
    const secs = pkg.composition_structure?.sections || {};
    return Object.entries(sel.sections || {}).map(([sectionKey, arr]) => ({
      sectionKey,
      label:
        secs[sectionKey]?.title ||
        secs[sectionKey]?.name ||
        sectionKey,
      items: Array.isArray(arr)
        ? arr.map((i) => ({
          idx: i,
          option: secs[sectionKey]?.options?.[i] || null,
        }))
        : [],
    }));
  }, [pkg, catererId]);

  const packagePriceTotal = useMemo(
    () =>
      pkg ? Number(pkg.price_per_plate || 0) * Number(plates || 0) : 0,
    [pkg, plates]
  );

  const defaultMenuTotal = useMemo(() => {
    const perPlate = defaultItems.reduce(
      (s, i) => s + (i.price || 0),
      0
    );
    return perPlate * Number(plates || 0);
  }, [defaultItems, plates]);

  const addonsTotal = useMemo(() => {
    let sum = 0;
    selectedAddons.forEach((aid) => {
      const a = addonItems.find((x) => x.id === aid);
      const qty = Number(addonQtys?.[aid] || plates || 1);
      if (a && qty > 0) sum += Number(a.price || 0) * qty;
    });
    return sum;
  }, [selectedAddons, addonItems, addonQtys, plates]);

  // subtotal BEFORE coupon and before staff/utensils etc (used for thresholds)
  const subtotalBeforeCoupon = useMemo(
    () =>
      packagePriceTotal +
      defaultMenuTotal +
      addonsTotal +
      (extraPlates ? extraPlatesCount * 20 : 0),
    [
      packagePriceTotal,
      defaultMenuTotal,
      addonsTotal,
      extraPlates,
      extraPlatesCount,
    ]
  );

  const totalAfterCoupon = useMemo(
    () =>
      Math.max(0, subtotalBeforeCoupon - (couponDiscount || 0)),
    [subtotalBeforeCoupon, couponDiscount]
  );

  // ---------------- Staff charge fetch & logic ----------------
  useEffect(() => {
    if (!catererId) return;
    let cancelled = false;
    const fetchStaff = async () => {
      setStaffInfo((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await axiosInstance.get(
          `/api/caterers/${catererId}/staff-charge/`
        );
        if (cancelled) return;
        const data = res.data || {};
        setStaffInfo({
          staff_available: !!data.staff_available,
          staff_charge_to_serve: data.staff_charge_to_serve
            ? Number(data.staff_charge_to_serve)
            : null,
          staff_charge_free_above: data.staff_charge_free_above
            ? Number(data.staff_charge_free_above)
            : null,
          updated_at: data.updated_at ?? null,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        console.warn("Staff-charge fetch failed:", err);
        setStaffInfo((s) => ({
          ...s,
          loading: false,
          error:
            err?.message || "Failed to fetch staff charge",
        }));
      }
    };
    fetchStaff();
    return () => {
      cancelled = true;
    };
  }, [catererId]);

  useEffect(() => {
    // only try to estimate when delivery selected
    if (deliveryType !== "delivery") {
      setDeliveryEstimate(null);
      setDeliveryEstimateError(null);
      return;
    }

    // debounce-ish
    let t = setTimeout(() => {
      estimateDelivery();
    }, 250);

    return () => clearTimeout(t);
  }, [
    deliveryType,
    eventLat,
    eventLng,
    subtotalBeforeCoupon,
    caterer,
  ]);

  // When user selects delivery, auto-enable staff (but allow user to uncheck)
  useEffect(() => {
    if (deliveryType === "delivery") {
      if (staffInfo.staff_available === false) {
        return;
      }
      setIncludeStaff(true);
      writeDraft({ includeStaff: true });
    }
  }, [deliveryType, staffInfo.staff_available]);

  // compute staff charge to apply (0 if waived or not selected)
  const staffChargeRaw = useMemo(() => {
    if (staffInfo?.staff_charge_to_serve != null)
      return Number(staffInfo.staff_charge_to_serve);
    return Number(plates || 0) * STAFF_SERVICE_FEE_PER_PLATE;
  }, [staffInfo, plates]);

  const staffFreeThreshold = useMemo(
    () =>
      staffInfo?.staff_charge_free_above != null
        ? Number(staffInfo.staff_charge_free_above)
        : null,
    [staffInfo]
  );

  const staffWaivedByThreshold = useMemo(() => {
    if (staffFreeThreshold == null) return false;
    return (
      Number(subtotalBeforeCoupon || 0) >=
      Number(staffFreeThreshold || 0)
    );
  }, [staffFreeThreshold, subtotalBeforeCoupon]);

  const appliedStaffCharge = useMemo(() => {
    if (!includeStaff) return 0;
    if (staffInfo?.staff_available === false) return 0;
    if (staffWaivedByThreshold) return 0;
    return staffChargeRaw || 0;
  }, [
    includeStaff,
    staffInfo,
    staffWaivedByThreshold,
    staffChargeRaw,
  ]);

  // ---------------- Utensils advance ----------------
  const utensilsAdvanceComputed = useMemo(() => {
    const parseNumber = (v) => {
      if (v == null) return NaN;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    try {
      const feeType = (caterer?.utensils_fee_type || "")
        .toString()
        .toLowerCase();
      const feeValueRaw = caterer?.utensils_fee_value ?? null;
      const feeValue = parseNumber(feeValueRaw);

      if (feeType === "percent" && !Number.isNaN(feeValue)) {
        const computed = Math.round(
          (subtotalBeforeCoupon * feeValue) / 100
        );
        return Math.max(50, computed);
      }

      if (
        (feeType === "fixed" || feeType === "fixed_amount") &&
        !Number.isNaN(feeValue)
      ) {
        const computed = Math.round(feeValue);
        return Math.max(50, computed);
      }

      const fallbackPercent =
        typeof UTENSILS_ADVANCE_PERCENT === "number"
          ? UTENSILS_ADVANCE_PERCENT
          : 0.12;
      const fallbackComputed = Math.round(
        subtotalBeforeCoupon * fallbackPercent
      );
      return Math.max(50, fallbackComputed);
    } catch (e) {
      const fallbackPercent =
        typeof UTENSILS_ADVANCE_PERCENT === "number"
          ? UTENSILS_ADVANCE_PERCENT
          : 0.12;
      const fallbackComputed = Math.round(
        subtotalBeforeCoupon * fallbackPercent
      );
      return Math.max(50, fallbackComputed);
    }
  }, [caterer, subtotalBeforeCoupon]);

  const utensilsAdvanceDisplayed = useMemo(
    () => (includeStaff ? 0 : utensilsAdvanceComputed),
    [includeStaff, utensilsAdvanceComputed]
  );

  // ---------------- Totals including staff ----------------
  const addonsRowPresent =
    selectedAddons && selectedAddons.size > 0;
  const [taxPercent, setTaxPercent] = useState(5);

  // 🔹 NEW: derive waterEstimatedPrice from waterEstimate
  const waterEstimatedPrice = useMemo(() => {
    if (!waterEstimate) return 0;
    const v = Number(waterEstimate.estimated_price ?? 0);
    return Number.isFinite(v) ? v : 0;
  }, [waterEstimate]);

  // 1️⃣ Base total before tax
  const clientTotal = useMemo(() => {
    const base =
      Number(totalAfterCoupon || 0) +
      Number(appliedStaffCharge || 0) +
      Number(deliveryEstimate?.delivery_fee || 0) +
      Number(waterEstimatedPrice || 0); // ✅ include water estimated_price
    return Math.round(base * 100) / 100;
  }, [
    totalAfterCoupon,
    appliedStaffCharge,
    deliveryEstimate,
    waterEstimatedPrice,
  ]);

  // 2️⃣ Compute tax based on that base total
  useEffect(() => {
    let cancelled = false;
    const fetchTaxPercent = async () => {
      try {
        const res = await axiosInstance.get(
          "/api/admin/tax/current/"
        );
        // API returns { percent: "5.00" }
        const parsed = Number(res?.data?.percent);
        if (Number.isFinite(parsed) && !cancelled)
          setTaxPercent(parsed);
        else if (!cancelled)
          console.warn(
            "Invalid tax percent, using fallback:",
            res?.data
          );
      } catch (err) {
        if (!cancelled)
          console.warn(
            "Failed to fetch tax percent; using fallback",
            err
          );
      }
    };
    fetchTaxPercent();
    return () => {
      cancelled = true;
    };
  }, []);

  const taxAmountVal = useMemo(() => {
    const base = Number(clientTotal || 0);
    const pct = Number(taxPercent || 0);
    const tax = base * (pct / 100);
    return Math.round(tax * 100) / 100; // cents rounding
  }, [clientTotal, taxPercent]);

  // 3️⃣ Final total including tax
  const clientTotalWithTax = useMemo(() => {
    return (
      Math.round(
        (Number(clientTotal || 0) + Number(taxAmountVal || 0)) *
        100
      ) / 100
    );
  }, [clientTotal, taxAmountVal]);

  // ---------------- date/time helpers & validation ----------------
  const todayDateString = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const minEventDateString = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2); // T + 2 days
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const minTimeForSelectedDate = useMemo(() => {
    if (!eventDate) return "00:00";
    if (eventDate !== todayDateString) return "00:00";
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); // small buffer
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mi}`;
  }, [eventDate, todayDateString]);

  const eventDateTimeValid = useMemo(() => {
    if (!eventDate || !eventTime) return false;
    const dt = new Date(`${eventDate}T${eventTime}`);
    return dt.getTime() >= Date.now() - 5000;
  }, [eventDate, eventTime]);

  const isFormValid = useMemo(() => {
    if (!pkg) return false;
    if (!eventDate || !eventTime) return false;
    if (!eventDateTimeValid) return false;
    if (!locationVal || !locationVal.trim()) return false;
    if (!nearby || !nearby.trim()) return false; // require nearby landmark
    if (pkg.min_plates && plates < pkg.min_plates) return false;
    if (pkg.max_plates && pkg.max_plates > 0 && plates > pkg.max_plates)
      return false;
    return true;
  }, [
    pkg,
    eventDate,
    eventTime,
    eventDateTimeValid,
    locationVal,
    nearby,
    plates,
  ]);

  // coupon apply
  const onApplyCoupon = async () => {
    if (!coupon || !coupon.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await axiosInstance.post(
        "/api/coupons/validate/",
        {
          code: coupon.trim(),
          caterer_id: Number(catererId),
          cart_total: Math.round(subtotalBeforeCoupon),
          plates: Number(plates || 1),
        }
      );

      if (res.data && res.data.valid) {
        const discount = Number(
          res.data.discount_amount ?? res.data.value ?? 0
        );
        setCouponDiscount(discount);
        // persist both code and discount so refresh restores discount too
        writeDraft({
          coupon: coupon.trim(),
          couponDiscount: discount,
        });
      } else {
        // invalid coupon — clear persisted discount
        setCouponDiscount(0);
        writeDraft({
          coupon: coupon.trim(),
          couponDiscount: 0,
        });
        alert(res.data?.message || "Coupon invalid");
      }
    } catch (e) {
      console.error("Coupon validation failed:", e);
      setCouponDiscount(0);
      // persist cleared discount so refresh doesn't restore stale value
      writeDraft({
        coupon: coupon.trim(),
        couponDiscount: 0,
      });
      alert("Coupon validation failed");
    } finally {
      setValidatingCoupon(false);
    }
  };

  useEffect(() => {
    if (!catererId) return;
    // Persist coupon + discount (ensure discount always saved as a number)
    try {
      writeDraft({
        coupon: coupon || "",
        couponDiscount: Number(couponDiscount || 0),
      });
    } catch (e) {
      // ignore
    }
  }, [catererId, coupon, couponDiscount]);

  // provide a simple "use my location" helper
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setEventLat(lat);
        setEventLng(lng);
        writeDraft({ eventLat: lat, eventLng: lng });
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Failed to get location permission");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const estimateWater = async () => {
    if (!catererId) {
      alert("Missing caterer id for water estimate.");
      return;
    }
    setEstimatingWater(true);
    setWaterEstimateError(null);
    setWaterEstimate(null);
    try {
      const payload = {
        caterer_id: Number(catererId),
        plates: Number(plates || 0),
        choice: String(waterChoice),
        order_total: Math.round(subtotalBeforeCoupon || 0),
      };
      const res = await axiosInstance.post(
        "/api/orders/estimate-water/",
        payload
      );
      setWaterEstimate(res.data || null);
    } catch (err) {
      console.error("Water estimation failed:", err);
      const serverErr =
        err?.response?.data?.detail ??
        err?.response?.data ??
        err?.message ??
        "Estimate failed";
      setWaterEstimateError(serverErr);
      setWaterEstimate(null);
    } finally {
      setEstimatingWater(false);
    }
  };

  const estimateDelivery = async () => {
    // only applicable for delivery type
    if (deliveryType !== "delivery") {
      setDeliveryEstimate(null);
      setDeliveryEstimateError(null);
      return;
    }

    if (!catererId) {
      setDeliveryEstimateError("Missing caterer id");
      return;
    }
    // require event coordinates
    if (eventLat == null || eventLng == null) {
      setDeliveryEstimateError("Event coordinates required");
      return;
    }

    // try to derive caterer coords (fallbacks)
    const catererLat =
      caterer?.active_location?.latitude ??
      caterer?.latitude ??
      caterer?.lat ??
      null;
    const catererLng =
      caterer?.active_location?.longitude ??
      caterer?.longitude ??
      caterer?.lng ??
      null;

    if (catererLat == null || catererLng == null) {
      setDeliveryEstimateError("Caterer location not available");
      return;
    }

    setEstimatingDelivery(true);
    setDeliveryEstimateError(null);
    setDeliveryEstimate(null);

    try {
      const payload = {
        caterer_id: Number(catererId),
        lat: Number(eventLat),
        lng: Number(eventLng),
        caterer_lat: Number(catererLat),
        caterer_lng: Number(catererLng),
        subtotal: Math.round(subtotalBeforeCoupon || 0),
      };
      const res = await axiosInstance.post(
        "/api/orders/estimate-delivery-fee/",
        payload
      );
      const data = res.data || null;
      if (data) {
        setDeliveryEstimate({
          delivery_fee: Number(
            data.delivery_fee != null
              ? data.delivery_fee
              : data.delivery_fee
          ),
          distance_km: Number(data.distance_km ?? 0),
          total_with_delivery: Number(
            data.total_with_delivery ?? 0
          ),
        });
      } else {
        setDeliveryEstimate(null);
      }
    } catch (err) {
      console.error("Delivery estimate failed:", err);
      setDeliveryEstimateError(
        err?.response?.data ?? err?.message ?? "Estimate failed"
      );
      setDeliveryEstimate(null);
    } finally {
      setEstimatingDelivery(false);
    }
  };

  const mapPaymentMethodToBackend = (pm) => {
    if (!pm) return "cod";
    const p = String(pm).toLowerCase();
    if (p === "online" || p === "card") return "card";
    if (p === "upi") return "upi";
    if (p === "cod") return "cod";
    return "cod";
  };

  const packageItemsCount = useMemo(() => {
    if (
      !pkg ||
      !pkg.composition_structure ||
      !pkg.composition_structure.sections
    )
      return 0;
    let total = 0;
    Object.values(pkg.composition_structure.sections).forEach(
      (sec) => {
        const allowed =
          sec.count ??
          (sec.options
            ? sec.options.filter((o) => o.required).length
            : 0);
        if (Number.isFinite(allowed))
          total += Number(allowed || 0);
        else
          total += sec.options
            ? sec.options.filter((o) => o.required).length
            : 0;
      }
    );
    return total || "—";
  }, [pkg]);

  // onOrderNow
  const onOrderNow = async () => {

    if (!pkg) {
      alert(
        "Please select a package from the Caterer page before placing an order."
      );
      return;
    }
    if (!primaryContact) {
      alert("Primary contact is required.");
      return;
    }
    if (!eventDate) {
      setEventDateInvalid(true);
      try {
        eventDateRef.current?.focus();
        eventDateRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (e) { }
      return;
    }
    if (!eventTime) {
      setEventTimeInvalid(true);
      try {
        eventTimeRef.current?.focus();
        eventTimeRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (e) { }
      return;
    }
    if (!eventDateTimeValid) {
      setEventTimeInvalid(true);
      try {
        eventTimeRef.current?.focus();
        eventTimeRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (e) { }
      alert(
        "Selected date/time is in the past. Pick a future date/time."
      );
      return;
    }
    if (!selectedEventType || selectedEventType.trim() === "") {
      setEventTypeInvalid(true);
      alert("Please select an event type.");
      return;
    }
    if (!locationVal || !locationVal.trim()) {
      alert("Event location/address is required.");
      return;
    }
    if (!nearby || !nearby.trim()) {
      setNearbyInvalid(true);
      try {
        nearbyRef.current?.focus();
        nearbyRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (e) { }
      alert(
        "Please enter a nearby landmark / building name for the venue."
      );
      return;
    }

    if (utensilsAdvanceDisplayed > 0 && !includeStaff) {
      const ok = window.confirm(
        `Note: A refundable utensils advance of ₹${utensilsAdvanceDisplayed} will be collected at the event. Click OK to proceed.`
      );
      if (!ok) return;
    }

    // ensure delivery estimate present for delivery orders
    if (deliveryType === "delivery") {
      if (!deliveryEstimate) {
        try {
          await estimateDelivery();
        } catch (e) {
          // estimateDelivery handles errors into state
        }
      }
    }

    setSubmitting(true);

    const payload = {
      caterer_id: Number(catererId),
      caterer_name: caterer?.name || caterer?.business_name || caterer?.title || null,
      package_id: pkg.id,
      package: pkg.id,
      package_composition: pkg.composition || null,
      selected_package: buildSelectedPackageForPayload(),
      plates: Number(plates || 1),
      default_item_ids: defaultItems.map((d) => d.id),
      addon_item_ids: Array.from(selectedAddons),
      addon_item_qtys: { ...addonQtys },
      event_date: eventDate,
      event_time: eventTime,
      contact_primary: primaryContact,
      contact_secondary: secondaryContact || null,
      location: locationVal,
      nearby: nearby || null,
      event_lat: eventLat,
      event_lng: eventLng,
      include_staff: !!includeStaff,
      staff_charge: appliedStaffCharge,
      delivery_option:
        deliveryType === "delivery" ? "delivery" : "selfpickup",
      delivery_type: deliveryType,
      utensils_advance: utensilsAdvanceDisplayed,
      delivery_fee: Number(
        deliveryEstimate?.delivery_fee ?? 0
      ),
      coupon_code: coupon.trim() || null,
      coupon_discount: Number(couponDiscount || 0),
      payment_method: null,
      payment_status: "initiated",
      total: Number(
        Math.round(
          (clientTotalWithTax + Number.EPSILON) * 100
        ) / 100
      ),
      tax_percent: Number(
        Math.round(
          (Number(taxPercent || 0) + Number.EPSILON) * 100
        ) / 100
      ),
      tax_amount: Number(
        Math.round(
          (Number(taxAmountVal || 0) + Number.EPSILON) * 100
        ) / 100
      ),
      water_choice:
        waterEstimate?.choice ?? (waterChoice || null),
      water_quantity: waterEstimate?.quantity ?? null,
      water_estimated_price:
        waterEstimate?.estimated_price != null
          ? Number(waterEstimate.estimated_price)
          : null,
      water_free: waterEstimate?.free ?? null,
      water_free_threshold:
        waterEstimate?.free_threshold ?? null,
      water_cans_needed:
        waterEstimate?.cans_needed ?? null,
      water_cups_needed:
        waterEstimate?.cups_needed ?? null,
      package_items_count: packageItemsCount,
      selected_event: selectedEventType || null,
      event_type: selectedEventType || null,
      event_types: selectedEventType
        ? [selectedEventType]
        : [],
    };

    try {
      const endpoint = isEditMode
        ? `/api/orders/${orderId}/`
        : `/api/orders/`;

      const method = isEditMode ? "put" : "post";

      const res = await axiosInstance[method](endpoint, payload);
      const order = res.data;
      const orderId = order?.id ?? order?.order_id ?? null;
      const amount =
        order?.total ?? payload.total ?? clientTotal;

      const identifier =
        orderId || order?.order_ref || order?.id || null;
      writeDraft({
        order_in_progress:
          identifier || `pending-${Date.now()}`,
        order_amount: amount,
        order_created_at: Date.now(),
      });

      if (mapPaymentMethodToBackend(paymentMethod) === "cod") {
        clearDraft();
        navigate("/order/success", { state: { order } });
        return;
      }

      try {
        if (!identifier) {
          navigate(
            `/payment?orderId=${encodeURIComponent(
              JSON.stringify(order || {})
            )}&amount=${amount}`
          );
          return;
        }
        if (mapPaymentMethodToBackend(paymentMethod) === "cod") {
          clearDraft();
          navigate("/order/success", { state: { order } });
          return;
        }

        // Edit OR new → redirect to payment page ONLY
        navigate(`/payment?orderId=${identifier}&amount=${amount}`);
        return;
      } catch (payErr) {
        console.error("Payment init failed:", payErr);
        const idFallback =
          identifier ||
          orderId ||
          order?.order_ref ||
          `mock-${Date.now()}`;
        navigate(
          `/payment?orderId=${idFallback}&amount=${amount}`
        );
        return;
      }
    } catch (err) {
      console.error("Order creation failed:", err);
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        const mockOrder = {
          id: `mock-${Date.now()}`,
          caterer: Number(catererId),
          package_id: pkg.id,
          plates: Number(plates || 1),
          addon_item_ids: Array.from(selectedAddons),
          coupon_code: coupon.trim() || null,
          tax_percent: Number(
            Math.round(
              (Number(taxPercent || 0) +
                Number.EPSILON) *
              100
            ) / 100
          ),
          tax_amount: Number(
            Math.round(
              (Number(taxAmountVal || 0) +
                Number.EPSILON) *
              100
            ) / 100
          ),
          total: Number(
            Math.round(
              (clientTotalWithTax + Number.EPSILON) * 100
            ) / 100
          ),
          package_items_count: packageItemsCount,
          selected_event: selectedEventType || null,
          event_type: selectedEventType || null,
          event_types: selectedEventType
            ? [selectedEventType]
            : [],
          payment_method: null,
          payment_status: "initiated",
        };
        try {
          const mocks = JSON.parse(
            localStorage.getItem("mockOrders") || "[]"
          );
          mocks.push(mockOrder);
          localStorage.setItem(
            "mockOrders",
            JSON.stringify(mocks)
          );
        } catch (e) {
          console.warn("Failed to persist mock order", e);
        }

        writeDraft({
          order_in_progress: mockOrder.id,
          order_amount: mockOrder.total,
          order_created_at: Date.now(),
        });

        if (
          mapPaymentMethodToBackend(paymentMethod) !== "cod"
        ) {
          navigate(
            `/payment?orderId=${encodeURIComponent(
              mockOrder.id
            )}&amount=${mockOrder.total}`
          );
        } else {
          clearDraft();
          navigate("/order/success", {
            state: { order: mockOrder },
          });
        }
      } else {
        alert(
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to create order. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <p className="text-center mt-20">
        Loading order details…
      </p>
    );
  const renderDeliveryFeeRow = () => {
    if (estimatingDelivery) {
      return (
        <div className="text-sm text-gray-500">
          Calculating delivery fee…
        </div>
      );
    }

    if (deliveryType !== "delivery") {
      return null;
    }

    if (!deliveryEstimate || deliveryEstimate.delivery_fee == null) {
      return (
        <div className="text-xs text-gray-500">
          Delivery fee will be calculated for selected address.
        </div>
      );
    }

    const fee = Number(deliveryEstimate.delivery_fee || 0);
    const distance = deliveryEstimate.distance_km;

    // 🟢 Waived with original fee
    if (fee === 0 && deliveryEstimate.original_fee) {
      return (
        <PriceRow
          label="Delivery fee"
          value={0}
          strike={Number(deliveryEstimate.original_fee)}
          note={
            distance
              ? `Free delivery applied (${distance} km)`
              : "Free delivery applied"
          }
        />
      );
    }

    // 🟢 Waived without original fee
    if (fee === 0) {
      return (
        <PriceRow
          label="Delivery fee"
          value={0}
          strike={Number(
            deliveryEstimate.delivery_fee_before_waiver || 50
          )}
          note="Free delivery applied"
        />
      );
    }

    // 🔵 Normal delivery fee
    return (
      <PriceRow
        label="Delivery fee"
        value={fee}
        note={distance ? `${distance} km` : null}
      />
    );
  };
  // ---------- Minimal inline CSS ----------
  const extraStyles = `
    @keyframes clt-fade-in-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0) } }
    .clt-fade-in-up { animation: clt-fade-in-up 360ms cubic-bezier(.22,.9,.32,1) both; }
    @keyframes clt-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.01); } 100% { transform: scale(1); } }
    .clt-cta-pulse { animation: clt-pulse 2200ms ease-in-out infinite; }
    @keyframes clt-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
    .clt-shiny { background: linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.0) 100%); background-size: 200% 100%; animation: clt-shimmer 2.2s linear infinite; }
    .clt-addon-compact { padding: 0.6rem; }
  `;

  const renderPkgSections = () => {
    if (
      pkg?.composition_structure &&
      pkg.composition_structure.sections
    ) {
      const sections = pkg.composition_structure.sections;
      const selDisplay = selectedPackageDisplay;
      if (selDisplay && selDisplay.length > 0) {
        return (
          <div className="space-y-3">
            {selDisplay.map((sec, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border rounded-md"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-800">
                    {sec.label || sec.sectionKey}
                  </div>
                  <div className="text-xs text-gray-500">
                    {sec.items?.length || 0} selected
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {sec.items.length === 0 ? (
                    <div className="text-xs text-gray-400">
                      No selection recorded for this section.
                    </div>
                  ) : (
                    sec.items.map((it, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3"
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1" />
                        <div>
                          <div className="text-sm font-medium text-gray-700">
                            {it.option?.name ||
                              it.option?.title ||
                              `Option ${it.idx}`}
                          </div>
                          {it.option?.description && (
                            <div className="text-xs text-gray-400">
                              {it.option.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {Object.entries(sections).map(
            ([key, sec], idx) => (
              <div
                key={idx}
                className="p-3 bg-white border rounded-md"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-800">
                    {sec.title || sec.name || key}
                  </div>
                  <div className="text-xs text-gray-500">
                    {sec.count ??
                      (sec.options
                        ? sec.options.length
                        : 0)}{" "}
                    items
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {Array.isArray(sec.options) &&
                    sec.options.length > 0 ? (
                    sec.options.map((op, j) => (
                      <div
                        key={j}
                        className="flex items-start gap-3"
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${op.required
                            ? "bg-emerald-600"
                            : "bg-gray-300"
                            } mt-1`}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-700">
                            {op.name ||
                              op.title ||
                              `Option ${j + 1}`}
                          </div>
                          {op.description && (
                            <div className="text-xs text-gray-400">
                              {op.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400">
                      No defined options in this section.
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      );
    }

    if (pkg?.composition) {
      return (
        <div className="prose prose-sm text-sm text-gray-700">
          {pkg.composition}
        </div>
      );
    }

    return (
      <div className="text-xs text-gray-400">
        Package composition not available.
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 clt-fade-in-up">
      <style>{extraStyles}</style>

      <div className="
  mb-4
  flex flex-col sm:flex-row
  sm:items-center sm:justify-between
  gap-3
">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="
      inline-flex items-center gap-1
      w-fit
      px-3 py-2
      rounded-lg border
      bg-gray-50 text-gray-700
      text-sm font-medium
      hover:bg-gray-100
      transition
    "
        >
          ← Back
        </button>

        {/* Title */}
        <h2 className="
    text-lg sm:text-2xl
    font-bold
    tracking-tight
    text-gray-800
    text-left sm:text-center
    flex-1
  ">
          {isEditMode ? `Edit Order #${orderId}` : "Create Order"}
        </h2>

        {/* Spacer for desktop alignment */}
        <div className="hidden sm:block w-[72px]" />
      </div>

      {/* Pending order banner */}
      {draftMeta?.order_in_progress && (
        <div className="mb-4 p-4 rounded-xl border-l-4 border-amber-400 bg-amber-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Text content */}
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-800 leading-snug">
              You have a pending order{" "}
              <span className="font-semibold">
                #{draftMeta.order_in_progress}
              </span>
              {draftMeta.order_amount && (
                <span className="ml-1">
                  — ₹{Number(draftMeta.order_amount).toFixed(2)}
                </span>
              )}
            </div>

            <div className="text-xs text-amber-700 mt-1">
              Complete payment or clear the draft to start a new order.
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                const id = draftMeta.order_in_progress;
                const amount = draftMeta.order_amount;
                if (!id) {
                  alert("No order id available to continue payment.");
                  return;
                }
                navigate(
                  `/payment?orderId=${encodeURIComponent(id)}&amount=${encodeURIComponent(amount ?? "")}`
                );
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition"
            >
              Continue payment
            </button>

            <button
              onClick={() => {
                if (
                  !window.confirm(
                    "Clear the pending draft? This will remove saved form data."
                  )
                ) return;
                clearDraft();
              }}
              className="w-full sm:w-auto px-4 py-2 bg-white border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Clear draft
            </button>
          </div>
        </div>
      )}

      {/* Package banner */}
      <div className="mb-4 p-4 rounded-2xl shadow-sm bg-gradient-to-r from-emerald-50 to-white border border-emerald-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          {/* LEFT */}
          <div className="flex items-center gap-3 w-full min-w-0">

            {/* Icon */}
            <div className="w-12 h-12 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center ring-1 ring-emerald-200">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-emerald-700"
              >
                <path d="M12 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 8v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Package text */}
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                {pkg ? pkg.name : "Package not available"}
              </div>
              <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                {pkg?.description}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Items: <strong className="text-gray-800">{packageItemsCount}</strong>
              </div>
            </div>

            {/*  PRICE — pushed to right */}
            <div className="ml-auto text-right shrink-0">
              <div className="text-xl sm:text-3xl font-extrabold text-emerald-700 leading-tight">
                {pkg ? `₹${Number(pkg.price_per_plate || 0).toFixed(2)}` : "—"}
              </div>
              <div className="text-[11px] text-gray-400">per plate</div>
            </div>

          </div>

          {/* RIGHT */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">

            {/* View items button — FIXED */}
            <button
              onClick={() => setPkgExpanded((s) => !s)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:shadow-md"
              aria-expanded={pkgExpanded}
            >
              <span className="text-sm font-medium text-gray-700">
                {pkgExpanded ? "Hide items" : "View items"}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${pkgExpanded ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="none"
              >
                <path d="M5 8l5 5 5-5" stroke="#4B5563" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* EXPANDABLE CONTENT */}
        <div className={`overflow-hidden transition-all ${pkgExpanded ? "max-h-[1000px] mt-3" : "max-h-0"}`}>
          <div className="p-3 rounded-lg bg-white border" aria-hidden={!pkgExpanded}>
            {renderPkgSections()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Defaults */}
          {defaultItems.length > 0 && (
            <div className="p-3 rounded-lg border bg-white shadow-sm">
              <h3 className="font-semibold mb-2 text-gray-800">
                Default Items (included)
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {defaultItems.map((it) => (
                  <div
                    key={it.id}
                    className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm flex items-center gap-2"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-indigo-500"
                    >
                      <path
                        d="M5 12l4 4L19 6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                    {it.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          <section className="p-3 rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">
                Add-on Items
              </h3>
              <div className="text-xs text-gray-500">
                Select extras
              </div>
            </div>

            {addonItems.length === 0 ? (
              <div className="text-gray-500">
                No add-ons available.
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {addonItems.map((it) => {
                  const checked = selectedAddons.has(it.id);
                  const qty =
                    addonQtys[it.id] ?? plates ?? 1;
                  return (
                    <div
                      key={it.id}
                      className={`clt-addon-compact clt-fade-in-up relative rounded-xl border bg-white
    flex flex-col justify-between transition-transform
    hover:-translate-y-1 hover:shadow-xl
    ${checked ? "ring-2 ring-emerald-200" : "hover:ring-1 hover:ring-indigo-50"}
  `}
                      style={{ minHeight: 110 }}
                    >
                      {/* TOP ROW */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="pr-2 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">
                            {it.name}
                          </div>
                          <div
                            className="text-xs text-gray-400 mt-1 truncate"
                            title={it.description || ""}
                          >
                            {it.description || "—"}
                          </div>
                        </div>

                        {/* PRICE + CUISINE */}
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-indigo-600">
                            ₹{it.price}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 whitespace-nowrap">
                            {it.cuisine || ""}
                          </div>
                        </div>
                      </div>

                      {/* BOTTOM ROW — HARD SAFE FOR 375px */}
                      <div className="mt-3 flex items-center gap-2 w-full overflow-hidden">
                        {/* Add checkbox */}
                        <label className="flex items-center gap-2 shrink-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(it.id)}
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span className="text-sm text-gray-700 whitespace-nowrap">
                            Add
                          </span>
                        </label>

                        {/* Spacer */}
                        <div className="flex-1 min-w-0" />

                        {/* QTY — CLAMPED */}
                        <div className="flex items-center gap-1 max-w-[96px] sm:max-w-none shrink-0">
                          <input
                            type="number"
                            min={0}
                            value={qty}
                            onChange={(e) =>
                              setAddonQty(it.id, Math.max(0, Number(e.target.value || 0)))
                            }
                            className="
        w-12 sm:w-20
        px-1 py-1
        border rounded
        text-sm text-center
        box-border
      "
                            aria-label={`Qty for ${it.name}`}
                          />
                          <span className="text-[11px] text-gray-500 whitespace-nowrap">
                            qty
                          </span>
                        </div>

                        {/* Premium badge */}
                        {it.price > 200 && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full
      text-[11px] font-medium text-white bg-indigo-600 clt-shiny">
                            Premium
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Event location */}
          <section className="p-3 rounded-lg border bg-white shadow-sm">
            <h3 className="font-semibold mb-2 text-gray-800">
              Event location
            </h3>
            <div className="text-xs text-gray-500 mb-2">
              Event address auto-fetched from your selected
              map:
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Event Address (read-only) */}
              <input
                value={locationVal}
                readOnly
                placeholder="Venue / Address (auto-fetched)"
                className="px-3 py-2 border rounded bg-gray-100 text-gray-600 cursor-not-allowed focus:ring-0"
              />

              {/* Nearby landmark (editable) */}
              <input
                ref={nearbyRef}
                value={nearby}
                onChange={(e) => {
                  const v = e.target.value;
                  setNearby(v);
                  if (v && v.trim() !== "")
                    setNearbyInvalid(false);
                  writeDraft({ nearby: v });
                }}
                onFocus={() => setNearbyInvalid(false)}
                onBlur={() => {
                  if (!nearby || nearby.trim() === "")
                    setNearbyInvalid(true);
                }}
                placeholder="Building Name / Nearby Landmark *"
                className={`px-3 py-2 border rounded focus:ring-2 ${nearbyInvalid
                  ? "border-red-500 bg-red-50 focus:ring-red-50"
                  : "border-gray-300 bg-white focus:ring-indigo-50"
                  }`}
                required
              />
              {nearbyInvalid && (
                <div className="text-xs text-red-600 mt-1">
                  Nearby landmark is required.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="bg-white border rounded-2xl p-4 shadow-md lg:sticky lg:top-6 overflow-x-hidden">
          <h4 className="font-semibold mb-3 text-gray-800">
            Order Summary
          </h4>

          <div className="mb-3">
            <div className="text-sm text-gray-600">
              Package
            </div>
            <div className="mt-1 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-800">
                    {pkg ? pkg.name : "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {pkg ? pkg.description : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-700 tabular-nums break-all max-w-[120px] text-right">
                    ₹{formatINR(pkg.price_per_plate || 0)}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  Items in package:{" "}
                  <strong className="text-gray-800">
                    {packageItemsCount}
                  </strong>
                </div>
                <button
                  onClick={() =>
                    setPkgExpanded((s) => !s)
                  }
                  className="text-xs text-indigo-600"
                >
                  {pkgExpanded ? "Hide items" : "View items"}
                </button>
              </div>

              <div
                className={`mt-3 transition-all ${pkgExpanded
                  ? "max-h-96"
                  : "max-h-0 overflow-hidden"
                  }`}
              >
                <div className="text-sm text-gray-700">
                  {pkgExpanded && (
                    <div className="space-y-2">
                      {selectedPackageDisplay ? (
                        selectedPackageDisplay.map(
                          (s, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2"
                            >
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1" />
                              <div>
                                <div className="text-sm font-medium">
                                  {s.label ||
                                    s.sectionKey}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {(s.items || [])
                                    .map(
                                      (it) =>
                                        it.option
                                          ?.name || "—"
                                    )
                                    .join(", ")}
                                </div>
                              </div>
                            </div>
                          )
                        )
                      ) : pkg?.composition ? (
                        <div className="text-xs text-gray-600">
                          {pkg.composition}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">
                          No package composition available to
                          display.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <PriceRow
              label="Package total"
              value={packagePriceTotal}
            />
            <PriceRow
              label="Defaults total"
              value={defaultMenuTotal}
            />
            {addonsRowPresent ? (
              <PriceRow
                label="Add-ons"
                value={addonsTotal}
              />
            ) : (
              <div className="text-xs text-gray-400">
                No add-ons added
              </div>
            )}
            {extraPlates && (
              <PriceRow
                label="Extra plates"
                value={extraPlatesCount * 20}
              />
            )}
          </div>

          <div className="border-t my-3" />

          <div className="space-y-2 text-sm">
            <label className="block">
              Primary Contact (required)
            </label>
            <input
              type="tel"
              value={primaryContact}
              readOnly
              className="w-full px-2 py-2 border rounded bg-gray-100 text-gray-600 cursor-not-allowed"
              title="Primary contact (auto-filled)"
            />
            <label className="block mt-2">
              Secondary Contact (optional)
            </label>
            <input
              type="tel"
              value={secondaryContact}
              onChange={(e) => {
                const val = e.target.value.replace(
                  /\D/g,
                  ""
                );
                setSecondaryContact(val);
                writeDraft({ secondaryContact: val });
              }}
              placeholder="Optional"
              className="w-full px-2 py-2 border rounded"
              maxLength={10}
              pattern="^[6-9][0-9]{9}$"
              title="Optional — enter a 10-digit mobile starting with 9,8,7, or 6"
            />

            <div className="mt-2">
              <label className="block">Plates</label>
              <input
                type="number"
                min={pkg?.min_plates || 1}
                max={pkg?.max_plates || 1000000}
                value={plates}
                onChange={(e) => {
                  const v = Math.max(
                    1,
                    Number(e.target.value || 1)
                  );
                  setPlates(v);
                  writeDraft({ plates: v });
                }}
                className="mt-1 w-full sm:w-32 px-3 py-2 border rounded"
              />
              {pkg?.min_plates && (
                <div className="text-xs text-gray-400">
                  Min plates for package:{" "}
                  {pkg.min_plates}
                </div>
              )}
            </div>

            <div className="mt-2">
              <label className="block">
                Event date &amp; time (required)
              </label>

              <div className="flex gap-2 mt-1">
                {/* 📅 Event Date (must be ≥ T+2) */}
                <input
                  ref={eventDateRef}
                  type="date"
                  value={eventDate}
                  onChange={(e) => {
                    setEventDate(e.target.value);
                    setEventDateInvalid(false);
                    writeDraft({
                      eventDate: e.target.value,
                    });
                  }}
                  className={`px-2 py-2 rounded ${eventDateInvalid
                    ? "border-red-500 bg-red-50 ring-1 ring-red-400"
                    : "border"
                    }`}
                  min={minEventDateString} // 👈 T+2 restriction
                />

                {/* ⏰ Event Time (same as before) */}
                <input
                  ref={eventTimeRef}
                  type="time"
                  value={eventTime}
                  onChange={(e) => {
                    setEventTime(e.target.value);
                    setEventTimeInvalid(false);
                    writeDraft({
                      eventTime: e.target.value,
                    });
                  }}
                  className={`px-2 py-2 rounded ${eventTimeInvalid
                    ? "border-red-500 bg-red-50 ring-1 ring-red-400"
                    : "border"
                    }`}
                  min={minTimeForSelectedDate}
                />
              </div>

              <div className="mt-1">
                {!eventDate && (
                  <div className="text-xs text-gray-400">
                    Choose the event date (minimum 2 days from today).
                  </div>
                )}

                {eventDate && !eventTime && (
                  <div className="text-xs text-gray-400">
                    Choose the event time.
                  </div>
                )}

                {eventDate && eventTime && !eventDateTimeValid && (
                  <div className="text-xs text-red-600">
                    Selected date/time is too early. Event must be at least 2 days from now.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2">
              <label className="block">
                Event type (required)
              </label>
              <select
                value={selectedEventType}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEventType(val);
                  setEventTypeInvalid(false);
                  writeDraft({ selectedEventType: val });
                }}
                onBlur={() => {
                  if (!selectedEventType)
                    setEventTypeInvalid(true);
                }}
                className={`mt-1 w-full px-2 py-2 border rounded focus:ring-2 ${eventTypeInvalid
                  ? "border-red-500 bg-red-50 focus:ring-red-100"
                  : "border-gray-300 bg-white focus:ring-indigo-50"
                  }`}
              >
                <option value="">
                  — Select event type —
                </option>
                {[
                  "Weddings",
                  "Festivals",
                  "Parties",
                  "Corporate Events",
                  "Rituals",
                  "Group Gatherings",
                  "All",
                ].map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>

              {eventTypeInvalid && (
                <div className="text-xs text-red-600 mt-1">
                  Event type is required.
                </div>
              )}
            </div>

            <div className="mt-2">
              <div className="text-sm mb-2">
                Delivery type
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="delivery"
                    checked={
                      deliveryType === "delivery"
                    }
                    onChange={() => {
                      setDeliveryType("delivery");
                      if (
                        staffInfo.staff_available ===
                        false
                      ) {
                        setIncludeStaff(false);
                        writeDraft({
                          deliveryType: "delivery",
                          includeStaff: false,
                        });
                      } else {
                        setIncludeStaff(true);
                        writeDraft({
                          deliveryType: "delivery",
                          includeStaff: true,
                        });
                      }
                    }}
                  />
                  <span>Delivery</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="selfpickup"
                    checked={
                      deliveryType === "selfpickup"
                    }
                    onChange={() => {
                      setDeliveryType("selfpickup");
                      setIncludeStaff(false);
                      writeDraft({
                        deliveryType: "selfpickup",
                        includeStaff: false,
                      });
                    }}
                  />
                  <span>Self pickup</span>
                </label>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeStaff}
                  onChange={(e) => {
                    if (deliveryType === "selfpickup")
                      return;
                    if (
                      staffInfo.staff_available === false
                    )
                      return;
                    setIncludeStaff(e.target.checked);
                    writeDraft({
                      includeStaff: e.target.checked,
                    });
                  }}
                  disabled={
                    deliveryType === "selfpickup" ||
                    staffInfo.staff_available === false
                  }
                />{" "}
                Include staff to serve
                {staffInfo.staff_available === false && (
                  <span className="ml-2 text-xs text-red-600">
                    {" "}
                    (not available)
                  </span>
                )}
                {deliveryType === "selfpickup" && (
                  <span className="ml-2 text-xs text-gray-500">
                    {" "}
                    (not applicable for self pickup)
                  </span>
                )}
              </label>
            </div>

            {/* Water estimate controls */}
            <div className="mt-3 border-t pt-3">
              <div className="text-sm font-medium">Drinking water</div>

              <div className="flex items-center gap-3 mt-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="waterChoice"
                    value="bottles"
                    checked={waterChoice === "bottles"}
                    onChange={() => {
                      setWaterChoice("bottles");
                      estimateWater(); // auto calculate
                    }}
                  />
                  <span>Bottles</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="waterChoice"
                    value="can"
                    checked={waterChoice === "can"}
                    onChange={() => {
                      setWaterChoice("can");
                      estimateWater(); // auto calculate
                    }}
                  />
                  <span>Cans + Cups</span>
                </label>
              </div>

              {/* Auto-filled estimate result */}
              {waterEstimate && (
                <div className="text-sm mt-3">
                  <div className="font-medium">
                    {waterEstimate.display_label ??
                      `${waterEstimate.choice} — qty: ${waterEstimate.quantity}`}
                  </div>
                  <div className="text-xs text-gray-500">
                    Est. ₹{Number(waterEstimate.estimated_price || 0).toFixed(2)}
                  </div>
                  {waterEstimate.free && (
                    <div className="text-xs text-green-600">
                      Free (threshold ₹
                      {Number(waterEstimate.free_threshold || 0).toFixed(2)})
                    </div>
                  )}
                </div>
              )}

              {waterEstimateError && (
                <div className="text-xs text-red-600 mt-2">
                  {String(waterEstimateError)}
                </div>
              )}
            </div>

            {staffInfo.staff_available &&
              staffInfo.staff_charge_to_serve != null && (
                <div className="mt-2 text-xs text-gray-600">
                  <div>
                    Staff charge (to serve): ₹
                    {Number(
                      staffInfo.staff_charge_to_serve
                    ).toFixed(2)}
                  </div>
                  {staffInfo.staff_charge_free_above !=
                    null && (
                      <div className="text-xs text-gray-500">
                        {Number(
                          subtotalBeforeCoupon || 0
                        ) >=
                          Number(
                            staffInfo.staff_charge_free_above
                          ) ? (
                          <span className="text-green-600">
                            ✅ Free staff to serve (you
                            qualify!)
                          </span>
                        ) : (
                          <>
                            Free staff to serve on orders ≥
                            ₹
                            {Number(
                              staffInfo.staff_charge_free_above
                            ).toFixed(2)}
                            .
                            <span className="ml-1 text-amber-600">
                              Add ₹
                              {(
                                Number(
                                  staffInfo.staff_charge_free_above
                                ) -
                                Number(
                                  subtotalBeforeCoupon || 0
                                )
                              ).toFixed(2)}{" "}
                              more to qualify.
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  {staffWaivedByThreshold && (
                    <div className="text-sm text-green-600">
                      Staff charge waived
                    </div>
                  )}
                </div>
              )}

            <div className="mt-2">
              <label className="block">Coupon</label>
              <div className="flex gap-2 mt-1">
                <input
                  value={coupon}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCoupon(v);

                    if (!v || !v.trim()) {
                      setCouponDiscount(0);
                      writeDraft({
                        coupon: "",
                        couponDiscount: 0,
                      });
                    } else {
                      writeDraft({
                        coupon: v,
                        couponDiscount,
                      });
                    }
                  }}
                  placeholder="Coupon code"
                  className="flex-1 px-2 py-2 border rounded"
                />
                <button
                  onClick={onApplyCoupon}
                  disabled={validatingCoupon}
                  className="px-3 py-2 bg-indigo-600 text-white rounded hover:scale-[1.02] transition-transform"
                >
                  {validatingCoupon
                    ? "Checking..."
                    : "Apply"}
                </button>
              </div>
              {couponDiscount > 0 && (
                <div className="text-sm text-green-600 mt-1">
                  Discount: ₹{couponDiscount}
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-3" />

          <div className="space-y-2">
            <PriceRow
              label="Subtotal"
              value={subtotalBeforeCoupon}
            />
            <PriceRow
              label="Coupon"
              value={-couponDiscount}
            />
            {waterEstimate && (
              waterEstimate.free ? (
                <div className="flex justify-between text-sm text-gray-700">
                  <div>{`Water (${waterEstimate.choice})`}</div>
                  <div className="font-semibold text-green-600">Free</div>
                </div>
              ) : (
                <PriceRow
                  label={`Water (${waterEstimate.choice})`}
                  value={Number(waterEstimate.estimated_price || 0)}
                  note={waterEstimate.display_label ?? null}
                />
              )
            )}
            {includeStaff &&
              staffInfo.staff_available !== false ? (
              staffWaivedByThreshold ? (
                <PriceRow
                  label="Staff charges"
                  value={0}
                  strike={staffChargeRaw}
                />
              ) : (
                <PriceRow
                  label="Staff charges"
                  value={appliedStaffCharge}
                />
              )
            ) : staffInfo.staff_available === false ? null : (
              <div className="text-xs text-gray-400">
                Staff not selected
              </div>
            )}
            {renderDeliveryFeeRow()}
            {/* TAX should appear AFTER delivery fee */}
            {typeof taxAmountVal !== "undefined" &&
              Number(taxAmountVal) > 0 && (
                <PriceRow
                  label="Tax"
                  value={taxAmountVal}
                />
              )}
          </div>

          <div className="border-t my-2" />
          <div className="flex items-start justify-between gap-2">
            {/* Left label */}
            <div className="text-sm">
              Utensils advance{" "}
              <span className="block text-xs text-gray-400">
                (refundable)
              </span>
            </div>

            {/* Right price */}
            <div className="text-right font-semibold tabular-nums break-all max-w-[55%]">
              {includeStaff ? (
                <>
                  <div className="line-through text-gray-400 text-sm">
                    ₹{Number(utensilsAdvanceComputed).toFixed(2)}
                  </div>
                  <div className="text-emerald-700 text-sm font-semibold">
                    ₹0
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Not required
                  </div>
                </>
              ) : (
                <div>
                  ₹{Number(utensilsAdvanceDisplayed).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            {includeStaff
              ? "Utensils refundable amount is covered when staff is included."
              : `A refundable utensils advance of ₹${utensilsAdvanceDisplayed} will be collected at delivery/pickup.`}
          </div>

          <div className="border-t my-2" />
          <div className="flex items-start justify-between gap-2 text-lg font-semibold">
            <div>Total</div>
            <div className="tabular-nums text-right break-all max-w-[50%]">
              ₹{formatINR(clientTotalWithTax)}
            </div>
          </div>

          <button
            onClick={onOrderNow}
            disabled={submitting}
            className={`mt-4 w-full py-3 text-white rounded-lg ${submitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 clt-cta-pulse"
              }`}
          >
            {submitting ? "Placing order..." : "Order Now"}
          </button>
          <div className="text-xs text-gray-500 mt-3">
            Note: Staff charge & utensils advance are
            estimates. Final charges are authoritative from
            server.
          </div>
        </aside>
      </div>
    </div>
  );
}