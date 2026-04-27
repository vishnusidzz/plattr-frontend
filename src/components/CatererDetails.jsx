// src/components/CatererDetails.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import CatererReviews from "./CatererReviews";

/**
 * CatererDetails
 *
 * Improvements:
 *  - package cards are attractive gradient tiles
 *  - clicking a card opens a modal overlay (click outside or press Escape to close)
 *  - mandatory options auto-selected and cannot be unselected
 *  - optional options selectable, enforced so mandatory+optional equals legacy counts
 *  - inline error highlighting for package validation (no toasts for these errors)
 *  - selections persist to localStorage
 *  - sticky panel shows package summary chip
 *  - Order Now is disabled if selected package invalid
 *  - small animations, animated SVG accent in modal
 *
 * NOTE: Core endpoints and existing logic preserved.
 */
const formatINR = (value = 0) => {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(n);
};
const CatererDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Core state
  const [caterer, setCaterer] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const packagesRef = useRef(null);

  // Menus
  const [menusLoading, setMenusLoading] = useState(true);
  const [menus, setMenus] = useState([]);

  // Packages
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packages, setPackages] = useState([]);

  // UI state
  const [selectedAddons, setSelectedAddons] = useState(new Set());
  const [addonQtys, setAddonQtys] = useState({}); // { addonId: qty }
  const [menuOpen, setMenuOpen] = useState(true);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [addonFilter, setAddonFilter] = useState("all"); // "all" | "veg" | "nonveg"

  // Plates selection
  const PRESET_PLATES = [30, 50, 100, 200, 300, 400, 500, 700, 1000];
  const [plates, setPlates] = useState(30);
  const [plateMode, setPlateMode] = useState("preset");
  const [customPlates, setCustomPlates] = useState(""); // used when >1000
  const [customApplied, setCustomApplied] = useState(false);

  // Modal state for package details (advanced: use modal overlay)
  const [modalPackageId, setModalPackageId] = useState(null); // string id of package open in modal
  // selected package top-level
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  // per-package selections: { [pkgId]: { sections: { [sectionKey]: Set(optionIndex) } } }
  const [packageSelections, setPackageSelections] = useState({});
  // inline validation errors per modal package: { [sectionKey]: message }
  const [packageErrors, setPackageErrors] = useState({});

  // --- Persisted snapshot for selected package to detect edits ---
  const [selectedPackageSnapshot, setSelectedPackageSnapshot] = useState({});
  // add these states near your other useState declarations
  const [thumbStart, setThumbStart] = useState(0); // first visible thumbnail index
  const [thumbAnim, setThumbAnim] = useState(''); // small rotate animation class

  const [conflictOrder, setConflictOrder] = useState(null); // holds existing initiated order returned by backend
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [activeSelectionId, setActiveSelectionId] = useState(null);


  // Helper: serialize selections (convert Sets -> arrays)
  const serializeSelections = (selObj) => {
    if (!selObj || !selObj.sections) return {};
    const out = {};
    Object.entries(selObj.sections).forEach(([k, s]) => {
      out[k] = Array.from(s || []);
    });
    return out;
  };

  // Helper: deep-equals for selection snapshots
  const isSelectionEqual = (a, b) => {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  };

  // Called when user confirms (Select this package)
  const confirmSelectPackage = (pkgId) => {
    // ensure selections exist for pkg
    ensurePkgSelection(pkgId, packages.find(p => String(p.id) === String(pkgId)));
    setSelectedPackageId(String(pkgId));
    // create snapshot
    setSelectedPackageSnapshot((prev) => ({
      ...prev,
      [String(pkgId)]: serializeSelections(packageSelections[String(pkgId)] || { sections: {} }),
    }));
  };

  // Unselect package (Delete action)
  const unselectPackage = (pkgId) => {
    setSelectedPackageId((prev) => (String(prev) === String(pkgId) ? null : prev));
    setSelectedPackageSnapshot((prev) => {
      const copy = { ...prev };
      delete copy[String(pkgId)];
      return copy;
    });
  };

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imgLoading, setImgLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSelectionSummary, setShowSelectionSummary] = useState(false);
  const [lastSelectionSummary, setLastSelectionSummary] = useState(null);

  // safe builder for incoming image entries (string or object)
  const buildImageUrl = (img) => {
    // string -> probably a direct URL
    if (typeof img === 'string') {
      return img;
    }

    // null/undefined -> ignore
    if (!img || typeof img !== 'object') return null;

    // if object has explicit approval flag, only accept approved ones
    if (Object.prototype.hasOwnProperty.call(img, 'is_approved')) {
      if (!img.is_approved) return null;
    }
    // prefer common url fields
    return img.image || img.url || img.path || null;
  };

  // ---------- LocalStorage helpers ----------
  const pkgStorageKey = (catererId) => `pltr_pkg_selections_${catererId}`;
  const pkgSelectedKey = (catererId) => `pltr_pkg_selected_${catererId}`;
  const platesKey = (catererId) => `pltr_plates_${catererId}`;
  const addonQtysKey = (catererId) => `pltr_addon_qtys_${catererId}`;

  // Load persisted selections on mount
  useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(pkgStorageKey(id));
      if (raw) {
        const parsed = JSON.parse(raw);
        // normalize into Set structure
        const norm = {};
        Object.entries(parsed || {}).forEach(([pkgId, data]) => {
          norm[pkgId] = { sections: {} };
          if (data && data.sections && typeof data.sections === "object") {
            Object.entries(data.sections).forEach(([k, arr]) => {
              norm[pkgId].sections[k] = new Set(Array.isArray(arr) ? arr : []);
            });
          }
        });
        setPackageSelections(norm);
      }
      const sel = localStorage.getItem(pkgSelectedKey(id));
      if (sel) setSelectedPackageId(sel);

      const storedPlates = localStorage.getItem(platesKey(id));
      if (storedPlates) {
        const n = Number(storedPlates);
        if (!isNaN(n) && n >= 1) {
          setPlates(n);
          if (n > 1000) setCustomPlates(String(n));
        }
      }

      const rawAddonQtys = localStorage.getItem(addonQtysKey(id));
      if (rawAddonQtys) {
        const parsed = JSON.parse(rawAddonQtys);
        setAddonQtys(parsed || {});
        // set selected addons if qty > 0
        const selected = new Set();
        Object.entries(parsed || {}).forEach(([k, v]) => {
          if (Number(v) > 0) selected.add(Number(k));
        });
        setSelectedAddons(selected);
      }
    } catch (e) {
      console.debug("Failed to load package selections from localStorage", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Persist selections
  useEffect(() => {
    if (!id) return;
    try {
      const toStore = {};
      Object.entries(packageSelections).forEach(([pkgId, data]) => {
        toStore[pkgId] = { sections: {} };
        Object.entries(data.sections || {}).forEach(([k, setObj]) => {
          toStore[pkgId].sections[k] = Array.from(setObj || []);
        });
      });
      localStorage.setItem(pkgStorageKey(id), JSON.stringify(toStore));
      if (selectedPackageId) localStorage.setItem(pkgSelectedKey(id), String(selectedPackageId));
      else localStorage.removeItem(pkgSelectedKey(id));
      localStorage.setItem(platesKey(id), String(plates));
      localStorage.setItem(addonQtysKey(id), JSON.stringify(addonQtys || {}));
    } catch (e) {
      console.debug("Failed to persist package selections", e);
    }
  }, [packageSelections, selectedPackageId, id, plates, addonQtys]);

  // Fetch caterer details (public)
  useEffect(() => {
    setLoading(true);
    axiosInstance
      .get(`/api/caterers/${id}/`)
      .then((res) => {
        setCaterer(res.data || {});
        // Normalize images: map -> buildImageUrl -> keep only non-empty strings
        let imgs = [];
        if (Array.isArray(res.data?.images) && res.data.images.length > 0) {
          imgs = res.data.images
            .map(buildImageUrl) // convert object -> url or null
            .filter((u) => typeof u === 'string' && u.trim()); // keep only valid non-empty strings
        } else if (res.data?.logo) {
          const u = buildImageUrl(res.data.logo);
          if (typeof u === 'string' && u.trim()) imgs = [u];
        } else {
          imgs = []; // no default
        }

        setImages(imgs);
      })
      .catch((err) => {
        console.error("Error fetching caterer details:", err);
        setCaterer(null);
        setImages([`${process.env.PUBLIC_URL}/default-plater-logo.png`]);
      })
      .finally(() => setLoading(false));
  }, [id]);
  const buildPackageSelectionPayload = () => {
    if (!selectedPackageId || !caterer) return null;

    const pkg = packages.find((p) => String(p.id) === String(selectedPackageId));
    if (!pkg) return null;

    const pkgIdStr = String(pkg.id);
    const sel = packageSelections[pkgIdStr] || { sections: {} };
    const csSections = pkg.composition_structure?.sections || {};

    const sectionsPayload = {};

    Object.entries(csSections).forEach(([sectionKey, sec]) => {
      const opts = Array.isArray(sec.options) ? sec.options : [];
      const selSet = sel.sections?.[sectionKey] || new Set();

      sectionsPayload[sectionKey] = {
        // this helps backend / future UI, but is optional
        count: getAllowedCountForSection(pkg, sectionKey),
        options: opts.map((opt, idx) => ({
          name: opt?.name || "",
          required: !!opt?.required,
          selected: selSet.has(idx), // 👈 true/false from your Set of indices
        })),
      };
    });

    return {
      caterer_id: caterer.id,
      package_id: pkg.id,
      sections: sectionsPayload,
      // add notes later if you want a notes field in UI
      // order_id can be attached later after order is created
    };
  };
  // Fetch active menu items (public endpoint)
  useEffect(() => {
    setMenusLoading(true);
    axiosInstance
      .get(`/api/caterers/${id}/menus/`)
      .then((res) => {
        let data = Array.isArray(res.data) ? res.data : res.data.results || [];
        const active = data.filter((m) => m && (m.is_active === true || String(m.is_active) === "true"));
        const normalized = active.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: Number(m.price || 0),
          is_addon: !!m.is_addon,
          cuisine: String(m.cuisine || "").toLowerCase(),
          composition_type: m.composition_type || null,
        }));
        setMenus(normalized);
      })
      .catch((err) => {
        console.error("Error fetching menus:", err);
        setMenus([]);
      })
      .finally(() => setMenusLoading(false));
  }, [id]);

  // Fetch packages for this caterer (public)
  useEffect(() => {
    setPackagesLoading(true);
    axiosInstance
      .get(`/api/caterers/${id}/public-packages/`)
      .then((res) => {
        let data = Array.isArray(res.data) ? res.data : res.data.results || [];
        const normalized = data.map((p) => {
          // parse composition_structure
          let cs = p.composition_structure ?? p.composition_struct ?? null;
          if (typeof cs === "string") {
            try {
              cs = JSON.parse(cs);
            } catch {
              cs = null;
            }
          }
          if (!cs || !cs.sections) {
            cs = { sections: {} };
            const mapping = {
              starters_count: "starters",
              mains_count: "main_course",
              rice_count: "rice",
              bread_count: "bread",
              dessert_count: "dessert",
              beverage_count: "drinks",
            };
            Object.keys(mapping).forEach((legacy) => {
              const count = Number(p[legacy] || 0);
              if (count > 0 && !cs.sections[mapping[legacy]]) {
                cs.sections[mapping[legacy]] = { count, options: [] };
              }
            });
          }
          // coerce options to {name, required}
          Object.entries(cs.sections || {}).forEach(([k, v]) => {
            if (!Array.isArray(v.options)) v.options = [];
            v.options = v.options.map((o) => {
              if (o == null) return { name: "", required: false };
              if (typeof o === "string") return { name: o, required: false };
              return { name: String(o.name ?? o.label ?? ""), required: !!o.required };
            });
          });

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            min_plates: p.min_plates ?? 0,
            max_plates: p.max_plates ?? 0,
            veg_only: !!p.veg_only,
            price_per_plate: Number(p.price_per_plate ?? 0),
            is_active: !!p.is_active,
            composition: p.composition || null,
            composition_structure: cs,
            event_types: Array.isArray(p.event_types) ? p.event_types.map((et) => (typeof et === "string" ? et : String(et?.name ?? ""))) : [],
            starters_count: p.starters_count ?? 0,
            mains_count: p.mains_count ?? 0,
            rice_count: p.rice_count ?? 0,
            bread_count: p.bread_count ?? 0,
            dessert_count: p.dessert_count ?? 0,
            beverage_count: p.beverage_count ?? 0,
          };
        });
        setPackages(normalized);
      })
      .catch((err) => {
        console.debug("Packages endpoint missing or failed:", err?.message || err);
        setPackages([]);
      })
      .finally(() => setPackagesLoading(false));
  }, [id]);

  // Lightbox + ESC handler
  const handleKeyDown = useCallback(
    (e) => {
      if (modalPackageId && e.key === "Escape") {
        setModalPackageId(null);
        setPackageErrors({});
      }
      if (!lightboxOpen) return;
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setPhotoIndex((p) => (p + 1) % images.length);
      if (e.key === "ArrowLeft") setPhotoIndex((p) => (p - 1 + images.length) % images.length);
    },
    [lightboxOpen, images.length, modalPackageId]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Derived lists
  const defaultItems = useMemo(() => menus.filter((m) => !m.is_addon), [menus]);
  const addonItems = useMemo(() => menus.filter((m) => m.is_addon), [menus]);

  const visibleAddons = useMemo(() => {
    const f = addonFilter && String(addonFilter).toLowerCase();
    if (f === "veg") return addonItems.filter((a) => String(a.cuisine || "").includes("veg"));
    if (f === "nonveg") return addonItems.filter((a) => String(a.cuisine || "").includes("non"));
    return addonItems;
  }, [addonItems, addonFilter]);

  // per-plate total (only default items considered)
  const perPlateTotal = useMemo(() => {
    const defaultSum = defaultItems.reduce((s, i) => s + (i.price || 0), 0);
    return defaultSum;
  }, [defaultItems]);

  // Toggle addon selection and qty
  const toggleAddon = (id) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // reset qty to 0
        setAddonQtys((qprev) => {
          const cp = { ...(qprev || {}) };
          cp[id] = 0;
          return cp;
        });
      } else {
        next.add(id);
        // default qty 1
        setAddonQtys((qprev) => ({ ...(qprev || {}), [id]: Number(qprev?.[id] || 1) || 1 }));
      }
      return next;
    });
  };

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

  // Order now - keep signin toast behavior
  const handleOrderNow = async () => {
    // 1) Validate package selections (same as before)
    if (selectedPackageId) {
      const pkg = packages.find((p) => String(p.id) === String(selectedPackageId));
      if (pkg) {
        const res = validatePackageSelections(pkg);
        if (!res.ok) {
          setPackageErrors(res.errors || {});
          setModalPackageId(String(pkg.id));
          return;
        }
      }
    }

    // 2) Ensure user logged in (same as before)
    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "null");
    if (!userProfile || !userProfile.username) {
      toast.info("Please sign in to place an order.");
      return;
    }

    // 3) If a package is selected, SAVE selection to backend first
    let selectionId = null;
    if (selectedPackageId) {
      const payload = buildPackageSelectionPayload();
      if (!payload) {
        toast.error("Could not prepare package selection. Please try again.");
        return;
      }

      try {
        const res = await axiosInstance.post("/api/package-selections/", payload);
        selectionId = res?.data?.id || null;
        if (selectionId) {
          setActiveSelectionId(selectionId);
        }
      } catch (e) {
        console.error("Failed to save package selection", e);
        toast.error("Failed to save your package selection. Please try again.");
        return;
      }
    } else {
      // if you ever allow order without package, it's fine: no selectionId
      setActiveSelectionId(null);
    }

    // 4) Build query string (includes selection if present)
    const addons = Array.from(selectedAddons);
    const qs = new URLSearchParams();
    qs.set("caterer", String(caterer.id));
    if (addons.length) qs.set("addons", addons.join(","));
    if (selectedPackageId) qs.set("package", String(selectedPackageId));
    qs.set("plates", String(plates));
    if (selectionId) qs.set("selection", String(selectionId));

    // 5) PROACTIVE CHECK: ask backend if user already has an initiated order (same logic as before)
    try {
      setCreatingOrder(true);
      setConflictOrder(null);
      setShowConflictModal(false);

      const res = await axiosInstance.get("/api/orders/?status=initiated");

      const existing = Array.isArray(res.data)
        ? res.data.find((o) => String(o.status).toLowerCase() === "initiated") || null
        : res.data.results
          ? res.data.results.find((o) => String(o.status).toLowerCase() === "initiated") || null
          : (res.data?.order && String(res.data.order.status).toLowerCase() === "initiated"
            ? res.data.order
            : null);

      if (existing && String(existing.status).toLowerCase() === "initiated") {
        setConflictOrder(existing);
        setShowCheckout(true); // ensure checkout modal stays open
        return;
      }

      // No conflict -> go to order create page WITH selection id
      navigate(`/order/create?${qs.toString()}`);
    } catch (err) {
      const status = err?.response?.status;

      if (status === 409 && err.response?.data?.order) {
        setConflictOrder(err.response.data.order);
        setShowConflictModal(true);
        setCreatingOrder(false);
        return;
      }

      console.error("Failed checking existing initiated order:", err);
      toast.error("Failed to check existing orders. Please try again.");
    } finally {
      setCreatingOrder(false);
    }
  };
  // Replace your existing cancelExistingOrder with this improved version
  const cancelExistingOrder = async (orderId) => {
    if (!orderId) return;
    if (!window.confirm("Cancel the existing initiated order? This will allow you to create a new order.")) return;

    setCreatingOrder(true);
    try {
      // Primary attempt (what you already do)
      await axiosInstance.patch(`/api/orders/${orderId}/status/`, { status: "cancelled" });

      toast.success("Cancelled existing order. You may now create a new order.");
      setShowConflictModal(false);
      setConflictOrder(null);

      // after cancelling, proceed to create page (preserve selections)
      const addons = Array.from(selectedAddons);
      const qs = new URLSearchParams();
      qs.set("caterer", String(caterer.id));
      if (addons.length) qs.set("addons", addons.join(","));
      if (selectedPackageId) qs.set("package", String(selectedPackageId));
      qs.set("plates", String(plates));
      if (activeSelectionId) qs.set("selection", String(activeSelectionId)); // 👈 NEW
      navigate(`/order/create?${qs.toString()}`);
      return;
    } catch (err) {
      console.error("Failed to cancel order:", err);

      // Extract common error details
      const status = err?.response?.status;
      const data = err?.response?.data;

      // Auth problems: prompt login
      if (status === 401) {
        toast.error("You need to sign in to cancel this order.");
        // Optionally redirect to login (adjust route)
        // navigate('/login');
        setCreatingOrder(false);
        return;
      }

      // Forbidden: show server message when available and attempt optional fallback
      if (status === 403) {
        // show the server-provided message if present
        const serverMsg = (data && (data.detail || data.message || JSON.stringify(data))) || "You don't have permission to cancel this order.";
        toast.error(`Cancel failed: ${serverMsg}`);

        // OPTIONAL FALLBACK: try an alternative endpoint that some backends provide
        // (Uncomment this block if your backend exposes e.g. /cancel/ or /actions/cancel/)
        /*
        try {
          console.debug("Attempting fallback cancel endpoint for order", orderId);
          await axiosInstance.post(`/api/orders/${orderId}/cancel/`, {});
          toast.success("Cancelled existing order (via fallback endpoint). You may now create a new order.");
          setShowConflictModal(false);
          setConflictOrder(null);
          const addons = Array.from(selectedAddons);
          const qs = new URLSearchParams();
          qs.set("caterer", String(caterer.id));
          if (addons.length) qs.set("addons", addons.join(","));
          if (selectedPackageId) qs.set("package", String(selectedPackageId));
          qs.set("plates", String(plates));
          navigate(`/order/create?${qs.toString()}`);
          setCreatingOrder(false);
          return;
        } catch (fallbackErr) {
          console.error("Fallback cancel also failed:", fallbackErr);
          toast.error("Cancel failed (fallback attempt also failed). Please contact support.");
        }
        */

        setCreatingOrder(false);
        return;
      }

      // If backend responded with a 400-ish message, show it
      if (status >= 400 && status < 500) {
        const msg = (data && (data.detail || data.error || data.message || JSON.stringify(data))) || `Request failed (${status}).`;
        toast.error(`Cancel failed: ${msg}`);
        setCreatingOrder(false);
        return;
      }

      // Network/other errors
      toast.error("Failed to cancel order. Please try again or contact support.");
      setCreatingOrder(false);
    }
  };

  // Edit existing order: navigate to your edit route (pass id in query or state)
  const editExistingOrder = (orderId, catererId) => {
    if (!catererId) {
      console.error("Missing caterer id while editing order");
      toast.error("Unable to edit order. Caterer not found.");
      return;
    }

    navigate(`/order/edit/${orderId}?caterer=${catererId}`);
  };

  // --- Package helpers ---
  const ensurePkgSelection = (pkgId, pkg) => {
    setPackageSelections((prev) => {
      if (prev[String(pkgId)]) return prev;
      const sections = {};
      const secs = (pkg?.composition_structure?.sections) || {};
      Object.keys(secs).forEach((k) => {
        sections[k] = new Set();
        const opts = secs[k].options || [];
        opts.forEach((opt, idx) => {
          if (opt && opt.required) sections[k].add(idx);
        });
      });
      return { ...prev, [String(pkgId)]: { sections } };
    });
  };

  const legacyMap = {
    starters: "starters_count",
    main_course: "mains_count",
    rice: "rice_count",
    bread: "bread_count",
    dessert: "dessert_count",
    drinks: "beverage_count",
    beverage: "beverage_count",
  };

  const getAllowedCountForSection = (pkg, sectionKey) => {
    const legacyField = legacyMap[sectionKey];
    const legacyVal = legacyField ? Number(pkg?.[legacyField] || 0) : 0;
    const sec = pkg?.composition_structure?.sections?.[sectionKey];
    const secCount = sec && sec.count ? Number(sec.count) : 0;
    if (legacyVal > 0) return legacyVal;
    if (secCount > 0) return secCount;
    return Infinity;
  };

  const togglePackageOption = (pkg, sectionKey, optionIndex) => {
    const pkgId = String(pkg.id);
    ensurePkgSelection(pkgId, pkg);
    setPackageSelections((prev) => {
      const copy = { ...(prev || {}) };
      if (!copy[pkgId]) copy[pkgId] = { sections: {} };
      if (!copy[pkgId].sections[sectionKey]) copy[pkgId].sections[sectionKey] = new Set();
      const setObj = new Set(copy[pkgId].sections[sectionKey]);

      const sec = pkg.composition_structure?.sections?.[sectionKey] || { options: [], count: 0 };
      const allowed = getAllowedCountForSection(pkg, sectionKey);

      const option = sec.options?.[optionIndex];
      if (option && option.required) {
        // required items remain selected
        setObj.add(optionIndex);
      } else {
        if (setObj.has(optionIndex)) {
          setObj.delete(optionIndex);
        } else {
          // compute current mandatory count present
          const mandatoryCount = sec.options?.reduce((acc, o) => acc + (o && o.required ? 1 : 0), 0);
          const selectedOptionalCount = Array.from(setObj).filter((i) => !(sec.options[i] && sec.options[i].required)).length;
          if (selectedOptionalCount + 1 + mandatoryCount > allowed) {
            // set inline error for modal
            setPackageErrors((prevErr) => ({ ...prevErr, [sectionKey]: `You can select up to ${allowed - mandatoryCount} optional item(s).` }));
            return prev; // do not mutate
          } else {
            // clear any previous error for this section
            setPackageErrors((prevErr) => {
              const cp = { ...(prevErr || {}) };
              delete cp[sectionKey];
              return cp;
            });
            setObj.add(optionIndex);
          }
        }
      }

      copy[pkgId] = { sections: { ...(copy[pkgId].sections || {}) } };
      copy[pkgId].sections[sectionKey] = setObj;
      return copy;
    });
  };

  const computePackageCounts = (pkg) => {
    const pkgId = String(pkg.id);
    const selections = packageSelections[pkgId] || { sections: {} };
    const secs = pkg.composition_structure?.sections || {};
    let selectedMandatory = 0;
    let selectedOptional = 0;
    Object.entries(secs).forEach(([k, sec]) => {
      const opts = sec.options || [];
      const selSet = selections.sections?.[k] || new Set();
      Array.from(selSet).forEach((idx) => {
        const opt = opts[idx];
        if (opt && opt.required) selectedMandatory += 1;
        else selectedOptional += 1;
      });
      const mandatoryTotal = opts.reduce((acc, o) => acc + (o && o.required ? 1 : 0), 0);
      if (mandatoryTotal > selectedMandatory) selectedMandatory = Math.max(selectedMandatory, mandatoryTotal);
    });
    return { selectedMandatory, selectedOptional };
  };

  const validatePackageSelections = (pkg) => {
    const pkgId = String(pkg.id);
    const selections = packageSelections[pkgId] || { sections: {} };
    const secs = pkg.composition_structure?.sections || {};
    const errors = {};
    for (const [k, sec] of Object.entries(secs)) {
      const allowed = getAllowedCountForSection(pkg, k);
      const selSet = selections.sections?.[k] || new Set();
      const mandatoryTotal = (sec.options || []).reduce((acc, o) => acc + (o && o.required ? 1 : 0), 0);
      const selectedCount = selSet.size;
      if (Number.isFinite(allowed)) {
        if (selectedCount !== allowed) {
          errors[k] = `Please select ${allowed} item(s) for ${k.replace(/_/g, " ")} (${selectedCount} selected).`;
        }
      } else {
        if (selectedCount < mandatoryTotal) {
          errors[k] = `At least ${mandatoryTotal} mandatory item(s) must be selected for ${k.replace(/_/g, " ")}.`;
        }
      }
    }
    return { ok: Object.keys(errors).length === 0, errors };
  };

  const selectPackage = (pkgId) => {
    // select/deselect top-level package; ensure selection exists
    const pkg = packages.find((p) => String(p.id) === String(pkgId));
    if (pkg) ensurePkgSelection(String(pkgId), pkg);
    setSelectedPackageId((prev) => (prev === String(pkgId) ? null : String(pkgId)));
  };

  // Derived: packageSummary for sticky panel
  const packageSummary = useMemo(() => {
    if (!selectedPackageId) return null;
    const pkg = packages.find((p) => String(p.id) === String(selectedPackageId));
    if (!pkg) return null;
    const counts = computePackageCounts(pkg);
    return { pkg, counts };
  }, [selectedPackageId, packages, packageSelections]);

  // When user opens modal, we ensure selections exist and clear errors
  const openPackageModal = (pkgId) => {
    const pkg = packages.find((p) => String(p.id) === String(pkgId));
    if (pkg) {
      ensurePkgSelection(String(pkgId), pkg);
      setPackageErrors({});
      setModalPackageId(String(pkgId));
    }
  };

  // Close modal (click outside or ESC)
  const closePackageModal = () => {
    setModalPackageId(null);
    setPackageErrors({});
  };

  // validate selected package when user tries to order — disable Order Now if invalid
  const selectedPackageValid = useMemo(() => {
    if (!selectedPackageId) return true; // no package required
    const pkg = packages.find((p) => String(p.id) === String(selectedPackageId));
    if (!pkg) return false;
    const res = validatePackageSelections(pkg);
    return res.ok;
  }, [selectedPackageId, packages, packageSelections]);

  // === Plates selector handlers ===


  useEffect(() => {
    if (plates <= 1000) {
      setCustomPlates("");
    }
  }, [plates]);

  // === Price calculations ===
  // package price = package.price_per_plate * plates
  const selectedPackage = useMemo(() => {
    if (!selectedPackageId) return null;
    return packages.find((p) => String(p.id) === String(selectedPackageId)) || null;
  }, [selectedPackageId, packages]);

  const packagePriceTotal = useMemo(() => {
    if (!selectedPackage) return 0;
    const p = Number(selectedPackage.price_per_plate || 0);
    const pl = Number(plates || 0);
    return p * pl;
  }, [selectedPackage, plates]);

  const addonsTotal = useMemo(() => {
    let sum = 0;
    selectedAddons.forEach((aid) => {
      const addon = addonItems.find((a) => a.id === aid);
      const qty = Number(addonQtys?.[aid] || 0);
      if (addon && qty > 0) {
        sum += addon.price * qty;
      }
    });
    return sum;
  }, [selectedAddons, addonQtys, addonItems]);

  const defaultMenuTotal = useMemo(() => {
    // default items are per-plate and counted in perPlateTotal * plates
    return perPlateTotal * Number(plates || 0);
  }, [perPlateTotal, plates]);

  const finalTotal = useMemo(() => {
    return (defaultMenuTotal || 0) + (packagePriceTotal || 0) + (addonsTotal || 0);
  }, [defaultMenuTotal, packagePriceTotal, addonsTotal]);

  // ---- IMAGE SANITIZATION & INDEX SAFETY ----
  // --- sanitizedImages: only keep non-empty string URLs (and convert other valid objects to url if needed) ---
  const sanitizedImages = useMemo(() => {
    if (!Array.isArray(images) || images.length === 0) return [];
    return images
      .map((img) => {
        // if already a string, keep it
        if (typeof img === 'string') return img && img.trim() ? img : null;
        // if object, prefer common fields
        if (img && typeof img === 'object') return (img.image || img.url || img.path || null);
        return null;
      })
      .filter((u) => typeof u === 'string' && u.trim());
  }, [images]);
  useEffect(() => {
    // If images changed, ensure photoIndex stays valid.
    if (!Array.isArray(sanitizedImages) || sanitizedImages.length === 0) {
      if (photoIndex !== 0) setPhotoIndex(0);
      return;
    }
    if (photoIndex >= sanitizedImages.length) {
      setPhotoIndex(0);
      return;
    }
    if (photoIndex < 0) {
      setPhotoIndex(0);
    }
  }, [sanitizedImages, photoIndex]);

  // clamp photoIndex & thumbStart whenever sanitizedImages changes so indices never go OOB
  useEffect(() => {
    if (!sanitizedImages || sanitizedImages.length === 0) {
      setPhotoIndex(0);
      setThumbStart(0);
      return;
    }
    setPhotoIndex((p) => {
      if (p < 0) return 0;
      if (p >= sanitizedImages.length) return 0;
      return p;
    });
    setThumbStart((s) => {
      if (s < 0) return 0;
      if (s >= sanitizedImages.length) return 0;
      return s;
    });
  }, [sanitizedImages]);

  // --- EARLY RETURNS ---
  if (loading) return <p className="text-center mt-20">Loading caterer…</p>;
  if (!caterer) return <p className="text-center mt-20">Caterer not found.</p>;

  // ---------- RENDER ----------
  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 transition"
      >
        ← Back
      </button>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left gallery */}
        <div className="w-full lg:w-1/3 flex flex-col gap-3 items-center">
          {sanitizedImages && sanitizedImages.length > 0 ? (
            <div className="relative w-full">
              {/* Main image — shows the currently selected thumbnail image */}
              <img
                src={sanitizedImages[photoIndex]}
                alt={caterer.name}
                className="w-full h-56 sm:h-64 lg:h-72 object-cover rounded-lg shadow-lg cursor-zoom-in"
                onClick={() => {
                  setLightboxOpen(true);
                  setImgLoading(true);
                }}
              />

              {/* Prev button */}
              {sanitizedImages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();

                    // compute new thumbStart similar to existing logic
                    const len = sanitizedImages.length || 1;
                    const newStart = (() => {
                      if (len <= 4) {
                        // rotate one step back circularly
                        return (thumbStart - 1 + len) % len;
                      }
                      // page back by 4
                      return (thumbStart - 4 + len) % len;
                    })();

                    setThumbStart(newStart);
                    // set the main image to the first visible thumbnail after paging
                    setPhotoIndex(newStart);

                    // brief rotate animation (same as before)
                    setThumbAnim('rotate-[-20deg]');
                    setTimeout(() => setThumbAnim(''), 140);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 py-1 rounded-full hover:bg-black/60"
                >
                  ‹
                </button>
              )}

              {/* Next button */}
              {sanitizedImages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();

                    const len = sanitizedImages.length || 1;
                    const newStart = (() => {
                      if (len <= 4) {
                        // rotate forward one step circularly
                        return (thumbStart + 1) % len;
                      }
                      // page forward by 4
                      return (thumbStart + 4) % len;
                    })();

                    setThumbStart(newStart);
                    // set the main image to the first visible thumbnail after paging
                    setPhotoIndex(newStart);

                    setThumbAnim('rotate-[20deg]');
                    setTimeout(() => setThumbAnim(''), 140);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 py-1 rounded-full hover:bg-black/60"
                >
                  ›
                </button>
              )}
            </div>
          ) : (
            <div className="w-full h-72 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
              No images
            </div>
          )}
          {/* Next thumbnail control (inside thumbnails area) */}
          {/* Thumbnails: show up to 4 at a time with prev/next controls */}
          <div className="mt-2 flex items-center justify-center gap-3">
            {/* <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();

                // compute new thumbStart similar to existing logic
                const len = sanitizedImages.length || 1;
                const newStart = (() => {
                  if (len <= 4) {
                    // rotate one step back circularly
                    return (thumbStart - 1 + len) % len;
                  }
                  // page back by 4
                  return (thumbStart - 4 + len) % len;
                })();

                setThumbStart(newStart);
                // set the main image to the first visible thumbnail after paging
                setPhotoIndex(newStart);

                // brief rotate animation (same as before)
                setThumbAnim('rotate-[-20deg]');
                setTimeout(() => setThumbAnim(''), 140);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 py-1 rounded-full hover:bg-black/60"
            >
              ‹
            </button> */}
            <div className="flex gap-2">
              {(() => {
                if (!Array.isArray(images) || images.length === 0) return null;
                const visible = 4;
                // compute the slice of images to show (wrap if needed)
                const out = [];
                for (let i = 0; i < Math.min(visible, images.length); i += 1) {
                  const idx = (thumbStart + i) % images.length;
                  out.push({ src: images[idx], idx });
                }
                return out.map(({ src, idx }) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`${caterer?.name || 'Caterer'} ${idx + 1}`}
                    className={`w-16 h-16 object-cover rounded cursor-pointer hover:scale-105 transition-transform ${thumbAnim}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoIndex(idx);
                      setLightboxOpen(true);
                      setImgLoading(true);
                    }}
                  />
                ));
              })()}
            </div>
            {/* <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();

                const len = sanitizedImages.length || 1;
                const newStart = (() => {
                  if (len <= 4) {
                    // rotate forward one step circularly
                    return (thumbStart + 1) % len;
                  }
                  // page forward by 4
                  return (thumbStart + 4) % len;
                })();

                setThumbStart(newStart);
                // set the main image to the first visible thumbnail after paging
                setPhotoIndex(newStart);

                setThumbAnim('rotate-[20deg]');
                setTimeout(() => setThumbAnim(''), 140);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 py-1 rounded-full hover:bg-black/60"
            >
              ›
            </button> */}
          </div>

          {/* Lightbox */}
          {/* Plates selector (compact + attractive) */}
          {/* Plates selector (compact, self-contained, no overlap) */}
          {/* Plates selector — pills only (no dropdown, no overlay) */}
          {/* Plates selector block */}
          <div className="w-full bg-gradient-to-r from-indigo-50 via-emerald-50 to-indigo-50 rounded-xl shadow-md border border-gray-200 p-4">
            <label className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 text-xs rounded-full bg-indigo-100 text-indigo-600">#</span>
              <div className="text-xs text-gray-500">
                Choose a preset or enter a custom number of plates
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {PRESET_PLATES.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPlates(p);
                    setPlateMode("preset");
                    setCustomApplied(false);
                    setCustomPlates("");
                  }}
                  className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 shadow-sm
          ${plates === p
                      ? "bg-indigo-600 text-white shadow-md scale-105"
                      : "bg-white/80 text-gray-800 hover:bg-indigo-100 hover:text-indigo-700 border"}`}
                  title={`Choose ${p} plates`}
                >
                  {p}
                </button>
              ))}
              {/* Custom button */}
              <button
                onClick={() => {
                  setPlateMode("custom");
                  setCustomPlates(String(plates || 1));
                  setCustomApplied(false);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition
    ${plateMode === "custom"
                    ? "bg-indigo-600 text-white scale-105"
                    : "bg-white/80 text-gray-800 hover:bg-indigo-100 border"}`}
              >
                Custom
              </button>

              {/* Custom input block – ONLY visible when Custom is selected */}
              {plateMode === "custom" && (
                <div className="flex flex-col gap-2 px-3 py-2 rounded-lg border bg-white/90 shadow-sm transition-all duration-200">

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={customPlates}
                      disabled={customApplied}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomPlates(v);
                        setCustomApplied(false);
                      }}
                      className={`w-32 px-2 py-1 rounded-md text-sm border
          focus:ring-2 focus:ring-indigo-300
          ${customApplied
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "bg-white text-gray-800"}`}
                      placeholder="Enter plates"
                    />

                    <button
                      onClick={() => {
                        const n = Number(customPlates);
                        if (!isNaN(n) && n >= 1) {
                          setPlates(n);
                          setCustomApplied(true);
                        }
                      }}
                      disabled={customApplied}
                      className={`px-3 py-1 rounded-md text-sm transition
          ${customApplied
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
                    >
                      {customApplied ? "Applied" : "Apply"}
                    </button>
                  </div>

                  {customApplied && (
                    <div className="text-xs text-gray-500">
                      Applied custom plates: <strong>{plates}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Helper row */}
            <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
              <span>
                Selected plates: <strong className="text-gray-900">{plates || 1}</strong>
              </span>
              {customApplied && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shadow-sm animate-pulse">
                  Custom applied
                </span>
              )}
            </div>
          </div>


        </div>

        {/* Right side */}
        <div className="flex-1 space-y-6">
          {/* Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{caterer.name}</h1>
              <div className="text-sm text-gray-500 mt-1">{caterer.city || ""}</div>
            </div>
            <div className="text-sm text-gray-500 px-3 py-1 rounded-full bg-gray-100">
              <span className="text-indigo-700">{caterer.cuisine || caterer.cuisine_type || "—"}</span>
            </div>
          </div>
          {/* Reviews section (inserted here, just above Packages) */}
          <div className="w-full mt-4">
            <CatererReviews catererId={id} />
          </div>
          {/* Packages */}
          <div ref={packagesRef}>
            <h2 className="text-xl font-semibold mb-3">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">Packages</span>
              <span className="ml-2 text-xs text-gray-400">{packagesLoading ? " (loading…)" : ` (${packages.length})`}</span>
            </h2>

            {packagesLoading ? (
              <p className="text-gray-500">Loading packages…</p>
            ) : packages.length === 0 ? (
              <p className="text-gray-500">No packages available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => {
                  const isSelected = String(selectedPackageId) === String(pkg.id);

                  // compute displayItems safely
                  const sections = pkg.composition_structure?.sections || {};
                  let displayItems = 0;

                  Object.entries(sections).forEach(([sectionKey, sec]) => {
                    const allowed = getAllowedCountForSection(pkg, sectionKey);
                    if (Number.isFinite(allowed)) {
                      displayItems += allowed;
                    } else {
                      const mandatory = (sec.options || []).reduce(
                        (acc, o) => acc + (o?.required ? 1 : 0),
                        0
                      );
                      displayItems += mandatory;
                    }
                  });

                  return (
                    <div
                      key={pkg.id}
                      onClick={() => openPackageModal(String(pkg.id))}
                      className={`relative cursor-pointer rounded-xl p-4 min-h-[120px]
          shadow-md transition-transform duration-300
          hover:scale-[1.02]
          ${isSelected ? "ring-4 ring-indigo-200" : ""}
        `}
                      style={{
                        background: isSelected
                          ? pkg.veg_only
                            ? "linear-gradient(135deg,#a8e063,#56ab2f)"
                            : "linear-gradient(135deg,#f83600,#f9d423)"
                          : pkg.veg_only
                            ? "linear-gradient(135deg,#e6f8e8,#d3f0d1)"
                            : "linear-gradient(135deg,#fff5e6,#ffe6d6)",
                        color: isSelected ? "white" : "black",
                      }}
                    >
                      {/* TOP BADGES */}
                      <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
                        {isSelected && (
                          <span className="bg-white/90 text-green-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold shadow">
                            ✓ Selected
                          </span>
                        )}

                        <span
                          className={`w-2 h-2 rounded-full ring-2 ring-white
              ${pkg.veg_only ? "bg-emerald-500" : "bg-rose-500"}
            `}
                          title={pkg.veg_only ? "Pure Veg" : "Veg & Non-Veg"}
                        />
                      </div>

                      {/* MAIN CONTENT */}
                      <div className="flex items-start justify-between mt-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{pkg.name}</div>
                          <div className={`text-xs mt-1 truncate ${isSelected ? "text-white/80" : "text-gray-700"}`}>
                            {pkg.event_types?.join(", ") || "All events"}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-base">
                            ₹{pkg.price_per_plate}/plate
                          </div>
                          <div className="text-xs opacity-80">
                            {pkg.veg_only ? "Pure Veg" : "Veg & Non-Veg"}
                          </div>
                        </div>
                      </div>

                      {/* DESCRIPTION */}
                      <div className="mt-3 text-sm line-clamp-2 opacity-90">
                        {pkg.description || pkg.composition || ""}
                      </div>

                      {/* BOTTOM BAR */}
                      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                        <span className="bg-white/90 text-gray-800 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full shadow font-medium">
                          <strong>{displayItems}</strong> items
                        </span>

                        <span className="bg-white/90 text-gray-800 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full shadow font-medium">
                          Ordered <strong>0</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Menu Items */}
          {!menusLoading && defaultItems.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-500 to-emerald-500">
                  Complimentary
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  ({defaultItems.length})
                </span>
              </h2>

              <div className="flex flex-wrap gap-2 text-xs">
                {defaultItems.map((it) => (
                  <span
                    key={it.id}
                    className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 transition cursor-default"
                  >
                    {it.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">Add-ons</span>
                <span className="ml-2 text-xs text-gray-400">{menusLoading ? " (loading…)" : ` (${addonItems.length})`}</span>
              </h2>

              <div className="flex items-center gap-2">
                {[
                  { key: "all", label: "All", cls: "from-indigo-600 to-indigo-400" },
                  { key: "veg", label: "Veg", cls: "from-emerald-500 to-green-400" },
                  { key: "nonveg", label: "Non-Veg", cls: "from-rose-500 to-red-400" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setAddonFilter(opt.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${addonFilter === opt.key ? "text-white" : "text-gray-700"} ${addonFilter === opt.key ? "bg-gradient-to-r " + opt.cls : "bg-gray-200"}`}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add-ons (compact grid, 4 per row on md+, beautified) */}
            <div className="mt-2">
              {menusLoading ? (
                <p className="text-gray-500">Loading add-ons…</p>
              ) : visibleAddons.length === 0 ? (
                <p className="text-gray-500">No add-ons available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {visibleAddons.map((it) => {
                    const checked = selectedAddons.has(it.id);
                    return (
                      <label
                        key={it.id}
                        className={`group relative flex flex-col justify-between gap-2 p-3 rounded-lg border transition-transform duration-200 bg-white shadow-sm hover:shadow-md
                          ${checked ? "ring-2 ring-indigo-200 scale-[1.01]" : "hover:-translate-y-0.5"}`}
                        title={it.description || it.name}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              // compute new checked state deterministically
                              const newChecked = !checked;

                              // toggle selection (this updates selectedAddons)
                              toggleAddon(it.id);

                              // if user just selected the addon, ensure qty is at least plates
                              if (newChecked) {
                                setAddonQty(it.id, Number(plates) || 1);
                              }
                              // if you prefer to clear qty on uncheck, uncomment:
                              // else { setAddonQty(it.id, 0); }
                            }}
                            className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            aria-label={`Select addon ${it.name}`}
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900 truncate">{it.name}</div>
                              {it.is_spicy && <span className="text-[10px] px-1 py-0.5 rounded bg-red-50 text-red-600">Spicy</span>}
                            </div>
                            <div className="text-xs text-gray-400 truncate">{it.description || "—"}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-2">
                          <div className="text-sm font-semibold text-indigo-600">₹{it.price}</div>

                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-gray-600 font-medium">Qty:</span>
                            <input
                              type="number"
                              min={plates || 1}
                              value={addonQtys[it.id] ? Number(addonQtys[it.id]) : (plates || 1)}
                              onChange={(e) => setAddonQty(it.id, e.target.value)}
                              className="w-16 text-sm text-center border border-gray-300 rounded-md px-2 py-1 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                              aria-label={`Quantity for ${it.name}`}
                            />
                          </div>
                        </div>

                        {/* small footer row */}
                        <div className="absolute left-3 -bottom-3 text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-50 to-white text-indigo-700 shadow-sm hidden group-hover:inline">
                          Add-on
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal overlay for expanded package */}
      {modalPackageId && (
        <PackageModal
          pkg={packages.find((p) => String(p.id) === String(modalPackageId))}
          onClose={closePackageModal}
          packageSelections={packageSelections}
          setPackageSelections={setPackageSelections}
          togglePackageOption={togglePackageOption}
          selectPackage={confirmSelectPackage}       // NOTE: use confirmSelectPackage
          selectedPackageId={selectedPackageId}
          packageErrors={packageErrors}
          setPackageErrors={setPackageErrors}
          validatePackageSelections={validatePackageSelections}
          unselectPackage={unselectPackage}          // NEW
          selectedPackageSnapshot={selectedPackageSnapshot} // NEW
        />
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative flex items-center justify-center w-full h-full">
            {sanitizedImages.length > 1 && (
              <button
                className="absolute left-5 text-white text-4xl font-bold bg-black/40 rounded-full px-3 py-1 hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoIndex((p) => (p - 1 + sanitizedImages.length) % sanitizedImages.length);
                  setImgLoading(true);
                }}
              >
                ‹
              </button>
            )}

            {imgLoading && <div className="absolute text-white">Loading...</div>}
            {sanitizedImages && sanitizedImages.length > 0 ? (
              <img
                src={sanitizedImages[photoIndex]}
                alt={`${caterer.name} ${photoIndex + 1}`}
                className={`max-h-[90%] max-w-[90%] rounded-lg shadow-lg transition-opacity duration-300 ${imgLoading ? "opacity-0" : "opacity-100"}`}
                onClick={(e) => e.stopPropagation()}
                onLoad={() => setImgLoading(false)}
              />
            ) : (
              <div className="text-white">No images</div>
            )}

            {sanitizedImages.length > 1 && (
              <button
                className="absolute right-5 text-white text-4xl font-bold bg-black/40 rounded-full px-3 py-1 hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoIndex((p) => (p + 1) % sanitizedImages.length);
                  setImgLoading(true);
                }}
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sticky bottom panel (improved) */}
      {!modalPackageId && ( // hide checkout panel while package card modal is open
        <div className="fixed z-40 bottom-0 inset-x-0 sm:inset-x-auto sm:right-6 sm:bottom-6 flex justify-center sm:justify-end px-3 sm:px-0 pb-safe">
          <div className="pointer-events-auto bg-white border rounded-2xl shadow-2xl p-4 w-full max-w-[380px] max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col h-full">
              {/* ===== TOP: SUMMARY ===== */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-500">Order summary</div>

                {packageSummary ? (
                  <div className="flex items-center gap-2 bg-indigo-50 text-indigo-800 text-[11px] px-2 py-1 rounded-full shadow-sm max-w-full">
                    <span className="font-semibold truncate max-w-[140px]">
                      {packageSummary.pkg.name}
                    </span>
                    <span className="px-1 py-0.5 rounded bg-indigo-100">
                      M:{packageSummary.counts.selectedMandatory}
                    </span>
                    <span className="px-1 py-0.5 rounded bg-indigo-100">
                      O:{packageSummary.counts.selectedOptional}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">No package selected</div>
                )}
              </div>

              {/* ===== PRICE ===== */}
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-lg font-bold text-gray-900 tabular-nums">
                  ₹{formatINR(finalTotal)}
                </span>
              </div>

              {/* ===== BREAKDOWN ===== */}
              <div className="mt-3 border-t pt-3 space-y-2 text-xs text-gray-600">
                {/* Plates */}
                <div className="grid grid-cols-[1fr_96px] items-center">
                  <span>Plates</span>
                  <span className="text-right font-medium text-gray-800 tabular-nums">
                    {plates || 1}
                  </span>
                </div>

                {/* Complimentaries */}
                <div className="grid grid-cols-[1fr_96px] items-center">
                  <span>Complimentaries</span>
                  <span className="text-right font-semibold text-emerald-600 tabular-nums">
                    FREE
                  </span>
                </div>

                {/* Package */}
                <div className="grid grid-cols-[1fr_96px] items-center">
                  <span>Package</span>
                  <span className="text-right font-medium text-gray-800 tabular-nums">
                    ₹{(() => {
                      const pkgObj = packages?.find(
                        (p) => String(p.id) === String(selectedPackageId)
                      );
                      return pkgObj
                        ? Number(pkgObj.price_per_plate || 0) * Number(plates || 1)
                        : 0;
                    })()}
                  </span>
                </div>

                {/* Add-ons */}
                <div className="grid grid-cols-[1fr_96px] items-center">
                  <span>Add-ons</span>
                  <span className="text-right font-medium text-gray-800 tabular-nums">
                    ₹{(
                      Array.from(selectedAddons || []).reduce((acc, aid) => {
                        const menu =
                          addonItems.find((a) => a.id === aid) ||
                          addonItems.find((a) => String(a.id) === String(aid));

                        const qty = Number(addonQtys?.[aid] || plates || 1);
                        const pricePaise = menu ? Math.round(Number(menu.price || 0) * 100) : 0;

                        return acc + pricePaise * qty;
                      }, 0) / 100
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* ===== FOOTER CTA ===== */}
              <div className="mt-auto pt-4 border-t">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => {
                      const userProfile = JSON.parse(localStorage.getItem("userProfile") || "null");

                      // Package not selected → scroll to packages
                      if (!selectedPackageId) {
                        packagesRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });

                        //  subtle highlight animation
                        packagesRef.current?.classList.add("ring-2", "ring-indigo-400");
                        setTimeout(() => {
                          packagesRef.current?.classList.remove("ring-2", "ring-indigo-400");
                        }, 900);

                        return;
                      }

                      //  Not logged in
                      if (!userProfile || !userProfile.username) {
                        alert("⚠️ Please sign in to continue checkout.");
                        return;
                      }

                      //  All good → open checkout
                      setShowCheckout(true);
                    }}
                    disabled={!selectedPackageValid}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-semibold transition shadow-md
    ${!selectedPackageId || !selectedPackageValid
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:shadow-lg"
                      }`}
                  >
                    Proceed to checkout
                  </button>

                  {!selectedPackageId && (
                    <div className="text-[11px] text-red-600">
                      Select a package to continue
                    </div>
                  )}

                  {!selectedPackageValid && (
                    <div className="text-[11px] text-red-600">
                      Fix package selections
                    </div>
                  )}

                  <div className="text-[11px] text-gray-500 text-right">
                    Add-ons: <strong>{selectedAddons.size || 0}</strong> · Defaults:{" "}
                    <strong>{defaultItems.length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Modal */}
          {showCheckout && (
            <CheckoutModal
              onClose={() => setShowCheckout(false)}
              handleOrderNow={handleOrderNow}
              plates={plates}
              defaultItems={defaultItems}
              packages={packages}
              selectedPackageId={selectedPackageId}
              packageSelections={packageSelections}
              selectedAddons={selectedAddons}
              addonQtys={addonQtys || {}}
              addonItems={addonItems}
              finalizeComputed={{
                defaultMenuTotal,
                packagePriceTotal,
                addonsTotal,
                finalTotal,
              }}
              // NEW props to enable inline conflict UI:
              conflictOrder={conflictOrder}
              conflictMode={!!conflictOrder}
              onEditExisting={editExistingOrder}           // re-use existing handler
              onCancelExisting={cancelExistingOrder}       // re-use existing handler
              processing={creatingOrder}
            />
          )}
        </div>
      )}
      {/* Selection summary popup (small) */}
      {showSelectionSummary && lastSelectionSummary && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-4">
            <div className="flex items-start gap-3">
              {/* LEFT: Title + time */}
              <div className="flex-1 min-w-0">
                <div className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {lastSelectionSummary.pkgName}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {new Date(lastSelectionSummary.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* RIGHT: Close */}
              <button
                onClick={() => setShowSelectionSummary(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full
               text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 text-sm text-gray-700 divide-y">
              {lastSelectionSummary.items.length === 0 ? (
                <div className="py-3 text-xs text-gray-500">No specific items were selected (package uses flexible composition).</div>
              ) : lastSelectionSummary.items.map((it, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-gray-400">{it.required ? "Mandatory" : "Optional"}</div>
                  </div>
                  <div className="text-xs text-indigo-700">{it.required ? "Included" : "Selected"}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowSelectionSummary(false)} className="px-3 py-1.5 rounded border text-sm">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- CheckoutModal (paste this above `export default CatererDetails;`) ----------
function CheckoutModal({
  onClose,
  handleOrderNow,
  plates = 1,
  defaultItems = [],
  packages = [],
  selectedPackageId = null,
  packageSelections = {},
  selectedAddons = new Set(),
  addonQtys = {},
  addonItems = [],
  finalizeComputed = {},

  // NEW props (conflict handling)
  conflictOrder = null,
  conflictMode = false,
  onEditExisting = () => { },
  onCancelExisting = () => { },
  processing = false,
}) {
  const { defaultMenuTotal = 0, packagePriceTotal = 0, addonsTotal = 0, finalTotal = 0 } = finalizeComputed || {};
  const platesNum = Number(plates || 1);
  const pkg = packages?.find((p) => String(p.id) === String(selectedPackageId));

  // If there's a conflict (existing initiated order), show the inline conflict UI instead
  if (conflictMode || (conflictOrder && String(conflictOrder.status) === "initiated")) {
    return (
      <div
        data-modal="checkout-backdrop"
        onClick={(e) => {
          if (e.target && e.target.dataset && e.target.dataset.modal === "checkout-backdrop") onClose();
        }}
        className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

              {/* LEFT */}
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-semibold text-gray-900">
                  You have an in-progress order
                </div>

                {conflictOrder && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    Order #{conflictOrder.id}
                    {conflictOrder.caterer_name ? ` • ${conflictOrder.caterer_name}` : ""}
                  </div>
                )}
              </div>

              {/* RIGHT */}
              <div className="flex items-center justify-between sm:justify-end gap-3">

                {/* TOTAL */}
                <div className="text-right">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">
                    Grand total
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    ₹{conflictOrder ? (conflictOrder.total || 0) : finalTotal}
                  </div>
                </div>

                {/* CLOSE */}
                <button
                  onClick={onClose}
                  aria-label="Close checkout"
                  className="
          shrink-0
          w-9 h-9
          flex items-center justify-center
          rounded-full
          text-gray-500
          hover:text-gray-700 hover:bg-gray-100
          transition
          focus:outline-none
          focus-visible:ring-2 focus-visible:ring-indigo-400
        "
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            <div className="text-sm text-yellow-800">
              {conflictMode
                ? "You have an in-progress order. Cancel or edit this order to continue, or proceed to payment."
                : (conflictOrder && conflictOrder.status === "initiated") ? "This order is in 'initiated' state. You can edit, cancel, or continue to payment." : ""}
            </div>

            <div className="mt-2">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-800"><strong>Order ID:</strong> {conflictOrder?.id ?? "—"}</div>
                <div className="text-sm text-gray-800"><strong>Plates:</strong> {conflictOrder?.plates ?? "—"}</div>
                <div className="text-sm text-gray-800"><strong>Total:</strong> ₹{conflictOrder?.total ?? "—"}</div>
                <div className="text-xs text-gray-500 mt-2">Created: {conflictOrder?.created_at ? new Date(conflictOrder.created_at).toLocaleString() : "—"}</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">

                {/* Edit */}
                <button
                  onClick={() => onEditExisting(conflictOrder?.id ?? null)}
                  disabled={processing}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border
                 text-sm font-medium text-gray-700
                 hover:bg-gray-50 transition
                 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Edit Existing Order
                </button>

                {/* Cancel */}
                <button
                  onClick={() => onCancelExisting(conflictOrder?.id ?? null)}
                  disabled={processing}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border
                 text-sm font-medium text-red-600 border-red-200
                 hover:bg-red-50 transition
                 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {processing ? "Cancelling…" : "Cancel Existing Order."}
                </button>

                {/* Continue */}
                <button
                  onClick={() => {
                    onClose();
                    setTimeout(() => {
                      if (conflictOrder?.id) {
                        window.location.href = `/payment?orderId=${conflictOrder.id}`;
                      } else if (typeof handleOrderNow === "function") {
                        handleOrderNow();
                      }
                    }, 80);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg
                 text-sm font-semibold text-white
                 bg-gradient-to-r from-emerald-600 to-emerald-700
                 hover:from-emerald-700 hover:to-emerald-800
                 shadow-md hover:shadow-lg transition"
                >
                  Continue with Existing
                </button>

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal checkout UI (unchanged)
  return (
    <div
      data-modal="checkout-backdrop"
      onClick={(e) => {
        if (e.target && e.target.dataset && e.target.dataset.modal === "checkout-backdrop") onClose();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <div className="text-lg font-semibold text-gray-900">{pkg ? pkg.name : "Order Summary"}</div>
            <div className="text-xs text-gray-500">{pkg ? `${pkg.veg_only ? "Pure Veg" : "Veg & Non-Veg"} • ${platesNum} plates` : ""}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Grand total</div>
              <div className="text-xl font-bold tabular-nums">₹{formatINR(finalTotal)}</div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md"
              aria-label="Close checkout"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Plates & Defaults */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">Plates & Defaults</div>
              <div className="text-xs text-gray-400">{platesNum} plates</div>
            </div>

            <div className="border rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-600 mb-2">Default items (per plate)</div>
              <div className="space-y-1">
                {(defaultItems || []).map((it) => {
                  const lineTotal = Math.round((Number(it.price || 0) * platesNum) * 100) / 100;
                  return (
                    <div key={it.id} className="flex justify-between text-sm">
                      <div className="text-gray-800">{it.name}</div>
                      <div className="text-gray-700">₹{lineTotal}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 border-t pt-2 flex justify-between text-sm font-medium">
                <div>Defaults subtotal</div>
                <div>₹{defaultMenuTotal}</div>
              </div>
            </div>
          </section>

          {/* Package */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">Package</div>
              <div className="text-xs text-gray-400">{pkg ? `₹${pkg.price_per_plate}/plate` : ""}</div>
            </div>

            <div className="border rounded-lg p-3">
              <div className="flex justify-between">
                <div className="text-gray-800">{pkg ? pkg.name : "No package selected"}</div>
                <div className="text-gray-800">₹{packagePriceTotal}</div>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                {pkg ? `Price per plate × ${platesNum} plates` : "Select a package to see pricing"}
              </div>
            </div>
          </section>

          {/* Add-ons */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">Add-ons</div>
              <div className="text-xs text-gray-400">{Array.from(selectedAddons || []).length} selected</div>
            </div>

            <div className="border rounded-lg bg-gray-50 p-3 space-y-2">
              {Array.from(selectedAddons || []).length === 0 ? (
                <div className="text-xs text-gray-500">No add-ons selected</div>
              ) : (
                Array.from(selectedAddons).map((aid) => {
                  const menu = addonItems.find((a) => a.id === aid) || addonItems.find((a) => String(a.id) === String(aid));
                  const qty = Number((addonQtys && addonQtys[aid]) ? addonQtys[aid] : platesNum);
                  const sub = Math.round((Number(menu?.price || 0) * qty) * 100) / 100;
                  return (
                    <div key={aid} className="flex justify-between text-sm">
                      <div>
                        <div className="text-gray-800">{menu?.name || `Addon ${aid}`}</div>
                        <div className="text-xs text-gray-500">{menu?.description || ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">₹{sub}</div>
                        <div className="text-xs text-gray-500">× {qty}</div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="mt-2 border-t pt-2 flex justify-between text-sm font-medium">
                <div>Add-ons subtotal</div>
                <div>₹{addonsTotal}</div>
              </div>
            </div>
          </section>


          {/* Final summary & actions */}
          <div className="pt-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              {/* Subtotal */}
              <div className="text-center sm:text-left">
                <div className="text-xs text-gray-500">Subtotal</div>
                <div className="text-2xl font-bold text-gray-900">₹{finalTotal}</div>
                <div className="text-[11px] text-gray-400 mt-1 max-w-xs">
                  Taxes & delivery calculated at checkout (if applicable)
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">

                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border text-sm
                   text-gray-700 hover:bg-gray-50 transition"
                >
                  Continue browsing
                </button>

                <button
                  onClick={() => {
                    onClose();
                    setTimeout(() => {
                      handleOrderNow();
                    }, 120);
                  }}
                  disabled={!pkg}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold
                   text-white bg-gradient-to-r from-indigo-600 to-indigo-700
                   hover:from-indigo-700 hover:to-indigo-800
                   shadow-md hover:shadow-lg transition
                   disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Order Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================
   PackageModal component
   ====================== */
/* ======================
   PackageModal component (REPLACEMENT)
   - Uses a local copy of selections so edits are staged until "Select this package"
   - If package already selected, shows "Selected ✓" disabled and "Delete" to unselect
   - On successful select, persists into parent packageSelections and opens a selection summary popup
   ====================== */
/* PackageModal - drop-in replacement (put this where your current PackageModal is) */
/* PackageModal — REPLACE the existing function with this one */
function PackageModal({
  pkg,
  onClose,
  packageSelections,
  setPackageSelections,
  togglePackageOption,
  selectPackage,
  selectedPackageId,
  packageErrors,
  setPackageErrors,
  validatePackageSelections,
  unselectPackage,
  selectedPackageSnapshot = {},
}) {
  const pkgId = pkg ? String(pkg.id) : null;

  // -----------------------
  // Hooks: MUST run always
  // -----------------------

  // Ensure selections exist for this package (runs always but is a no-op when no pkg)
  React.useEffect(() => {
    if (!pkg || !pkgId) return;
    if (!packageSelections[pkgId]) {
      setPackageSelections((prev) => {
        if (prev && prev[pkgId]) return prev;
        const sections = {};
        const secs = (pkg?.composition_structure?.sections) || {};
        Object.keys(secs).forEach((k) => {
          sections[k] = new Set();
          const opts = secs[k].options || [];
          opts.forEach((opt, idx) => {
            if (opt && opt.required) sections[k].add(idx);
          });
        });
        return { ...(prev || {}), [pkgId]: { sections } };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, pkgId, packageSelections, setPackageSelections]);

  // initial snapshot ref (always defined)
  const initialSnapshotRef = React.useRef({});
  React.useEffect(() => {
    if (!pkgId) {
      initialSnapshotRef.current = {};
      return;
    }
    const cur = packageSelections[pkgId] || { sections: {} };
    const snap = {};
    Object.entries(cur.sections || {}).forEach(([k, setObj]) => {
      snap[k] = Array.from(setObj || []).slice().sort();
    });
    initialSnapshotRef.current = snap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgId, packageSelections]);

  // hasEdits memo (always declared)
  const hasEdits = React.useMemo(() => {
    if (!pkgId) return false;
    const initial = initialSnapshotRef.current || {};
    const current = (packageSelections[pkgId] && packageSelections[pkgId].sections) || {};
    const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
    for (const k of keys) {
      const a = (initial[k] || []).slice().sort().join(",");
      const b = Array.from(current[k] || new Set()).slice().sort().join(",");
      if (a !== b) return true;
    }
    return false;
  }, [packageSelections, pkgId]);

  // selections alias for rendering (always declared)
  const selections = packageSelections[pkgId] || { sections: {} };

  // summary memo (always declared)
  const summary = React.useMemo(() => {
    if (!pkg) return { mandatory: 0, optional: 0, left: 0 };
    const secs = pkg.composition_structure?.sections || {};
    let mandatory = 0, optional = 0, left = 0;
    Object.entries(secs).forEach(([k, sec]) => {
      const opts = sec.options || [];
      const req = opts.reduce((acc, o) => acc + (o && o.required ? 1 : 0), 0);
      mandatory += req;
      const selSet = selections.sections?.[k] || new Set();
      const selectedOpt = Array.from(selSet).filter(i => !(opts[i] && opts[i].required)).length;
      optional += selectedOpt;
      const allowed = (function () {
        const mapping = {
          starters: "starters_count",
          main_course: "mains_count",
          rice: "rice_count",
          bread: "bread_count",
          dessert: "dessert_count",
          drinks: "beverage_count",
          beverage: "beverage_count",
        };
        const legacy = mapping[k];
        const legacyVal = legacy ? Number(pkg[legacy] || 0) : 0;
        const secCount = sec.count ? Number(sec.count) : 0;
        if (legacyVal > 0) return legacyVal;
        if (secCount > 0) return secCount;
        return Infinity;
      })();
      if (Number.isFinite(allowed)) {
        const alreadySelected = selSet.size;
        left += Math.max(0, allowed - alreadySelected);
      }
    });
    return { mandatory, optional, left };
  }, [pkg, selections]);

  // helper callbacks (always declared)
  const onResetClick = React.useCallback(() => {
    if (!pkgId || !pkg) return;

    const secs = pkg?.composition_structure?.sections || {};
    const resetSections = {};

    Object.entries(secs).forEach(([k, sec]) => {
      const s = new Set();
      (sec.options || []).forEach((opt, idx) => {
        if (opt && opt.required) s.add(idx);
      });
      resetSections[k] = s;
    });

    setPackageSelections((prev) => ({
      ...(prev || {}),
      [pkgId]: { sections: resetSections },
    }));

    setPackageErrors((prev) => {
      const cp = { ...(prev || {}) };
      Object.keys(cp).forEach((k) => {
        if (k in resetSections) delete cp[k];
      });
      return cp;
    });
  }, [pkg, pkgId, setPackageSelections, setPackageErrors]);

  const handleResetClick = (e) => {
    const btn = e.currentTarget;

    // visual refresh sweep
    btn.classList.add("btn-refresh-anim");

    setTimeout(() => {
      btn.classList.remove("btn-refresh-anim");
    }, 700);

    // actual reset logic
    onResetClick();
  };

  const handleValidationFailure = React.useCallback((errors) => {
    setPackageErrors(errors || {});
    const keys = Object.keys(errors || {});
    if (!keys.length) return;
    const firstKey = keys[0];
    const elId = `pkg-err-${pkgId}-${firstKey}`;
    setTimeout(() => {
      try {
        const el = document.getElementById(elId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("pkg-error-highlight");
          setTimeout(() => el.classList.remove("pkg-error-highlight"), 1400);
        }
      } catch (e) { }
    }, 60);
  }, [pkgId, setPackageErrors]);

  const onSelectClick = React.useCallback(() => {
    if (!pkg) return;
    const res = validatePackageSelections(pkg);
    if (!res.ok) {
      handleValidationFailure(res.errors || {});
      return;
    }
    setPackageErrors({});
    if (typeof selectPackage === "function") selectPackage(String(pkgId));
    onClose();
  }, [pkg, pkgId, selectPackage, validatePackageSelections, handleValidationFailure, onClose, setPackageErrors]);

  // -----------------------
  // Now safe to early-return render null if no pkg
  // -----------------------
  if (!pkg) return null;

  // --- Render JSX ---
  return (
    <div
      data-modal="backdrop"
      onClick={(e) => {
        if (e.target && e.target.dataset && e.target.dataset.modal === "backdrop") onClose();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-gradient-to-br from-amber-300 to-pink-400 p-1">
              <svg className="w-14 h-14" viewBox="0 0 100 100">
                <defs>
                  <radialGradient id={`rg${pkgId}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0.05" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="40" fill={`url(#rg${pkgId})`} className="animate-pulse-slow" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{pkg.name}</div>
              <div className="text-xs text-gray-500">{pkg.event_types?.join(", ") || "All events"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-700">
              ₹{pkg.price_per_plate}/plate
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {pkg.description && <div className="text-sm text-gray-700">{pkg.description}</div>}

          <div className="flex gap-3 text-xs text-gray-500">
            <div className="px-2 py-1 bg-gray-50 rounded">Min: {pkg.min_plates}</div>
            <div className="px-2 py-1 bg-gray-50 rounded">Max: {pkg.max_plates || "No limit"}</div>
            <div className="px-2 py-1 bg-gray-50 rounded">{pkg.veg_only ? "Pure Veg" : "Veg & Non-Veg"}</div>
          </div>

          {/* small summary row (mandatory/optional/remaining) */}
          <div className="px-3 py-2 rounded bg-indigo-50 text-indigo-800 text-sm inline-flex items-center gap-3">
            <div className="text-xs">Mandatory: <strong className="text-indigo-900">{summary.mandatory}</strong></div>
            <div className="text-xs">Optional chosen: <strong className="text-indigo-900">{summary.optional}</strong></div>
            <div className="text-xs">Remaining: <strong className="text-indigo-900">{Number.isFinite(summary.left) ? summary.left : "—"}</strong></div>
          </div>

          {/* Structured composition with inline highlighting */}
          {pkg.composition_structure?.sections && (
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(pkg.composition_structure.sections).map(([sectionKey, sec]) => {
                const displayName = sectionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const options = Array.isArray(sec.options) ? sec.options : [];
                const allowed = (function () {
                  const map = {
                    starters: "starters_count",
                    main_course: "mains_count",
                    rice: "rice_count",
                    bread: "bread_count",
                    dessert: "dessert_count",
                    drinks: "beverage_count",
                    beverage: "beverage_count",
                  };
                  const legacy = map[sectionKey];
                  const legacyVal = legacy ? Number(pkg[legacy] || 0) : 0;
                  const secCount = sec.count ? Number(sec.count) : 0;
                  if (legacyVal > 0) return legacyVal;
                  if (secCount > 0) return secCount;
                  return Infinity;
                })();

                const selSet = selections.sections?.[sectionKey] || new Set();
                const selectedCount = selSet.size;
                const mandatoryTotal = options.reduce((acc, o) => acc + (o && o.required ? 1 : 0), 0);
                const err = packageErrors[sectionKey];

                return (
                  <div
                    id={`pkg-err-${pkgId}-${sectionKey}`}
                    key={sectionKey}
                    className={`p-3 rounded ${err ? "border-2 border-red-300 bg-red-50" : "border bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{displayName}</div>
                      <div className="text-xs text-gray-500">
                        {Number.isFinite(allowed) ? `${selectedCount}/${allowed} selected` : `${selectedCount} selected`}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {options.length > 0 ? options.map((opt, idx) => {
                        const optionName = opt?.name || "—";
                        const requiredFlag = !!opt?.required;
                        const isChecked = selSet.has(idx);
                        return (
                          <label key={idx} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-white cursor-pointer">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePackageOption(pkg, sectionKey, idx)}
                                className="w-4 h-4"
                                aria-checked={isChecked}
                                disabled={requiredFlag}
                              />
                              <div>
                                <div className="text-sm text-gray-900">{optionName}</div>
                                <div className="text-xs text-gray-400">{requiredFlag ? "Mandatory" : "Optional"}</div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">{requiredFlag ? "Included" : ""}</div>
                          </label>
                        );
                      }) : <div className="text-xs text-gray-500">No fixed options listed.</div>}
                    </div>

                    {err && <div className="mt-2 text-xs text-red-700 font-medium">{err}</div>}

                    <div className="mt-2 text-xs text-gray-400 flex items-center justify-between">
                      <div>{Number.isFinite(allowed) ? `Choose exactly ${allowed}` : `At least ${mandatoryTotal} mandatory included`}</div>
                      <div className="text-xs text-indigo-600">{`${Math.max(0, Number.isFinite(allowed) ? (allowed - selectedCount) : 0)} left`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* fallback composition */}
          {!pkg.composition_structure?.sections && pkg.composition && (
            <div className="text-sm text-gray-700">{pkg.composition}</div>
          )}
        </div>

        {/* Footer: Responsive actions */}
        <div className="px-4 sm:px-6 py-4 border-t bg-white rounded-b-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            {/* Left meta */}
            <div className="text-[11px] text-gray-400 text-center sm:text-left">
              Last updated: —
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">

              {/* Cancel */}
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border text-sm text-gray-700
                   hover:bg-gray-50 transition"
              >
                Cancel
              </button>

              {/* Reset */}
              <button
                onClick={handleResetClick}
                title="Reset selections to required items"
                className="
    w-full sm:w-auto
    px-4 py-2
    rounded-lg
    border border-gray-300
    text-sm font-medium text-gray-700
    bg-white
    shadow-sm

    transition-all duration-150 ease-out
    hover:bg-gray-50 hover:shadow-md hover:-translate-y-[1px]
    active:scale-[0.97] active:shadow-inner

    focus:outline-none
    focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2
  "
              >
                Reset
              </button>

              {/* Primary CTA */}
              <button
                onClick={onSelectClick}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold
                   text-white bg-gradient-to-r from-indigo-600 to-indigo-700
                   hover:from-indigo-700 hover:to-indigo-800
                   shadow-md hover:shadow-lg transition"
                title="Validate & select this package"
              >
                Select this package
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CatererDetails;