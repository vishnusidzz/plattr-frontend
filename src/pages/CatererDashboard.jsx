import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "../shared-lib/axiosInstance";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const StatCard = ({ title, value, hint, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white shadow rounded-lg p-4 w-full min-w-0 active:scale-[0.98] transition ${onClick ? "cursor-pointer hover:shadow-md transition" : ""}`}
  >
    <div className="text-xs text-gray-500">{title}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
    {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
  </div>
);

const CatererDashboard = () => {
  const [caterer, setCaterer] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingCaterer, setLoadingCaterer] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");
  const [selectedStat, setSelectedStat] = useState(null);
  const [activeItemsList, setActiveItemsList] = useState([]);
  const [orders, setOrders] = useState([]); // loaded customer orders for this caterer
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const navigate = useNavigate();
  const [refreshingMenus, setRefreshingMenus] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [imageTouched, setImageTouched] = useState(false);

  // NEW/UPDATED STATE FOR IMAGES
  // imagePreviews is an array of objects: { id?: number, src: string, file?: File, existing?: boolean }
  const [imagePreviews, setImagePreviews] = useState([]);
  const imagePreviewsRef = useRef([]);
  const [imageError, setImageError] = useState("");
  // keep newly-selected File objects to upload when user triggers an upload action
  const [newImages, setNewImages] = useState([]);
  // --- Reviews rating state (public endpoint) ---
  const [reviewsRating, setReviewsRating] = useState(null);
  const [reviewsCount, setReviewsCount] = useState(0);

  // ---------- Helper to build image URL ----------
  const buildImageUrl = (img) => {
    if (!img) return "";

    const raw =
      typeof img === "object"
        ? img.url || img.path || img.image || ""
        : String(img);

    if (!raw) return "";

    // already absolute (prod CDN, S3, etc.)
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }

    /**
     * LOCAL:
     * React runs on :3000
     * Django media on :8000
     *
     * PROD:
     * Same origin → empty string is correct
     */
    const API_BASE =
      process.env.REACT_APP_API_BASE ||
      process.env.REACT_APP_API_BASE_URL ||
      (window.location.port === "3000"
        ? "http://127.0.0.1:8000"
        : "");

    return `${API_BASE}${raw}`;
  };
  const fetchMyCaterer = useCallback(async () => {
    setLoadingCaterer(true);

    try {
      const res = await axios.get("/api/caterers/me/");
      const catererObj = res.data?.caterer_serialized;

      setCaterer(catererObj);

      const imgs = Array.isArray(catererObj?.images) ? catererObj.images : [];

      const normalized = imgs.map((it) => ({
        id: it.id,
        src: it.url,
        approved: !!it.approved,
        existing: true,
      }));

      setImagePreviews(normalized);
      imagePreviewsRef.current = normalized;
      setImagesLoaded(true);
    } catch (err) {
      toast.error("Failed to refresh images");
    } finally {
      setLoadingCaterer(false);
    }
  }, []);
  // Fetch caterer on mount
  useEffect(() => {
    const controller = new AbortController();


    fetchMyCaterer();

    return () => {
      controller.abort();
      imagePreviewsRef.current.forEach((p) => {
        if (p?.src?.startsWith("blob:")) {
          URL.revokeObjectURL(p.src);
        }
      });
    };
  }, []);

  // helper to ask for deactivation reason (replace with modal later)
  const askDeactivateReason = () => {
    const reason = window.prompt("Please provide a reason for deactivating (required):", "");
    return (reason || "").trim();
  };

  // Toggle active using owner endpoint: POST /api/caterers/me/toggle/
  const toggleActive = async () => {
    if (!caterer) return;
    setToggling(true);

    const willDeactivate = !!caterer.is_active;
    let reason = "";

    if (willDeactivate) {
      reason = askDeactivateReason();
      if (!reason) {
        toast.error("Deactivation cancelled — a reason is required.");
        setToggling(false);
        return;
      }
    }

    try {
      const payload = {
        is_active: !caterer.is_active,
      };
      if (reason) payload.reason = reason;

      const res = await axios.post("/api/caterers/me/toggle/", payload);

      // backend returns { message, is_active } or similar — update local state
      const newIsActive = res.data?.is_active ?? !caterer.is_active;
      setCaterer((prev) => ({
        ...prev,
        is_active: newIsActive,
        admin_comment: reason || prev?.admin_comment,
      }));

      toast.success(`Caterer is now ${newIsActive ? "Open" : "Closed"}`);
    } catch (err) {
      console.error("Failed to toggle:", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        `Request failed (${err?.response?.status || "unknown"})`;
      toast.error(`Failed to change status — ${msg}`);
    } finally {
      setToggling(false);
    }
  };

  // fetch owner stats (if available) when caterer loads
  useEffect(() => {
    if (!caterer?.id) return;
    let mounted = true;
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const r = await axios.get("/api/caterers/me/stats/");
        if (mounted) setStats(r.data);
      } catch (err) {
        console.warn("Stats endpoint failed or missing, using fallback:", err);
        const fallback = {
          completed_orders: 0,
          ongoing_orders: 0,
          revenue: 0,
          customer_cancellations: 0,
          caterer_cancellations: 0,
          rating: caterer.rating ?? null,
          menu_count: caterer.menu_count ?? null,
        };
        if (mounted) setStats(fallback);
      } finally {
        if (mounted) setLoadingStats(false);
      }
    };
    fetchStats();
    return () => {
      mounted = false;
    };
  }, [caterer]);
  // fetch public reviews summary (unauthenticated GET)
  useEffect(() => {
    if (!caterer?.id) return;
    let mounted = true;
    const fetchReviewsSummary = async () => {
      try {
        const res = await axios.get("/api/reviews/", {
          params: { caterer: caterer.id, page: 1, page_size: 50 }, // adjust page_size if needed
          // 👆 axiosInstance will still send token, backend should allow GET w/o it
        });
        const data = res.data;
        const results = Array.isArray(data) ? data : (data.results || []);
        const total = data.count ?? results.length;
        if (!results.length) {
          if (mounted) {
            setReviewsRating(null);
            setReviewsCount(0);
          }
          return;
        }
        const sum = results.reduce((s, r) => s + (Number(r.rating) || 0), 0);
        const avg = +(sum / results.length).toFixed(1);
        if (mounted) {
          setReviewsRating(avg);
          setReviewsCount(total);
        }
      } catch (err) {
        console.warn("Failed to fetch public reviews:", err?.response?.status || err);
      }
    };
    fetchReviewsSummary();
    return () => { mounted = false; };
  }, [caterer?.id]);

  // refreshMenuCounts fetches menus and updates active_menu_count & menu_count
  const refreshMenuCounts = useCallback(async () => {
    if (!caterer?.id) return;

    try {
      const res = await axios.get(`/api/caterers/${caterer.id}/menus/`);

      // Normalize response (supports paginated & non-paginated)
      let menus = res?.data;
      if (menus && Array.isArray(menus.results)) {
        menus = menus.results;
      }
      if (!Array.isArray(menus)) {
        menus = [];
      }

      const activeItems = menus.filter(
        (m) => m && (m.is_active === true || String(m.is_active) === "true")
      );

      setStats((prev) => ({
        ...(prev || {}),
        active_menu_count: activeItems.length,
        menu_count: menus.length,
      }));

      setActiveItemsList(
        activeItems.map((m) => ({
          id: m.id,
          name: m.name,
          price: m.price,
        }))
      );
    } catch (err) {
      console.error("Failed to refresh menus for counts:", err);

      // Safe fallback (don’t wipe existing stats unexpectedly)
      setStats((prev) => ({
        ...(prev || {}),
        active_menu_count: prev?.active_menu_count ?? 0,
        menu_count: prev?.menu_count ?? 0,
      }));

      setActiveItemsList([]);
    }
  }, [caterer?.id]);

  useEffect(() => {
    if (caterer?.id) {
      refreshMenuCounts().catch((e) => console.warn("Initial refreshMenuCounts failed:", e));
    }
  }, [caterer?.id, refreshMenuCounts]);

  // ---------------- Orders handling ----------------
  // Try multiple endpoints (best-effort) so that front-end works with different backend setups:
  // 1) GET /api/orders/?caterer_id=<id>
  // 2) GET /api/caterers/<id>/orders/ (if you add that backend)
  // 3) GET /api/caterers/me/orders/ (if you implement owner-scoped endpoint)
  const fetchOrders = async () => {
    if (!caterer?.id) return;
    setOrdersLoading(true);
    setOrdersError("");
    let tried = [];
    try {
      // Try 1: query orders by caterer_id
      tried.push(`/api/orders/?caterer_id=${caterer.id}`);
      const res = await axios.get(`/api/orders/?caterer_id=${caterer.id}`);
      setOrders(Array.isArray(res.data) ? res.data : res.data.results || []);
      setOrdersLoading(false);
      return;
    } catch (err1) {
      console.warn("GET /api/orders/?caterer_id= failed:", err1);
    }

    // fallback attempt 2
    try {
      tried.push(`/api/caterers/${caterer.id}/orders/`);
      const res2 = await axios.get(`/api/caterers/${caterer.id}/orders/`);
      setOrders(Array.isArray(res2.data) ? res2.data : res2.data.results || []);
      setOrdersLoading(false);
      return;
    } catch (err2) {
      console.warn("GET /api/caterers/<id>/orders/ failed:", err2);
    }

    // fallback attempt 3: owner-scoped
    try {
      tried.push(`/api/caterers/me/orders/`);
      const res3 = await axios.get(`/api/caterers/me/orders/`);
      setOrders(Array.isArray(res3.data) ? res3.data : res3.data.results || []);
      setOrdersLoading(false);
      return;
    } catch (err3) {
      console.warn("GET /api/caterers/me/orders/ failed:", err3);
    }

    setOrdersError("Failed to load orders. Backend may not expose caterer orders endpoint or you lack permission.");
    setOrders([]);
    setOrdersLoading(false);
  };

  useEffect(() => {
    // fetch orders when caterer comes online
    if (caterer?.id) {
      fetchOrders().catch(() => { });
      // keep them reasonably fresh
      const t = setInterval(() => {
        fetchOrders().catch(() => { });
      }, 20_000);
      return () => clearInterval(t);
    }
  }, [caterer?.id]);

  // derive counts (pending considered ongoing)
  const pendingCount = (orders || []).filter((o) => o.status === "pending").length;
  const ongoingCount = (orders || []).filter((o) => ["pending", "confirmed", "in_progress", "preparation_inprogress", "preparation_completed", "delivery_in_progress"].includes(o.status)).length;
  const recentCompleted = (orders || [])
    .filter((o) => ["completed", "delivered"].includes(o.status))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);
  const pastOrders = (orders || []).filter((o) => o.status === "cancelled" || (o.status === "completed" && !recentCompleted.includes(o)));

  // modal-specific derived lists
  const completedOrdersList = (orders || []).filter((o) => ["completed", "delivered"].includes(o.status)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const ongoingOrdersList = (orders || []).filter((o) => ["pending", "confirmed", "in_progress", "preparation_inprogress", "preparation_completed", "delivery_in_progress"].includes(o.status)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const customerCancelledList = (orders || []).filter((o) => o.status === "cancelled" && (o.cancelled_by === "customer" || o.cancelled_by === undefined));
  const catererCancelledList = (orders || []).filter((o) => o.status === "cancelled" && o.cancelled_by === "caterer");

  // open detail modal helpers
  const openStatModal = async (key) => {
    // refresh source data first
    if (key === "menus") {
      await refreshMenuCounts();
    } else {
      await fetchOrders();
    }
    setSelectedStat(key);
  };

  // open orders modal and refresh orders first
  const openOrdersModal = async () => {
    await fetchOrders();
    setOrdersModalOpen(true);
  };

  // attempt to change status of an order — best-effort:
  const updateOrderStatus = async (orderId, targetStatus, extra = {}) => {
    try {
      // special-case: if marking as "confirmed" and backend supports confirm-payment action, call it
      if (targetStatus === "confirmed") {
        try {
          await axios.post(`/api/orders/${orderId}/confirm-payment/`, { payment_id: extra.payment_id || null });
        } catch (e) {
          // fallback to patch
          await axios.patch(`/api/orders/${orderId}/`, { status: targetStatus });
        }
      } else {
        // prefer status endpoint if available, otherwise generic PATCH
        try {
          await axios.patch(`/api/orders/${orderId}/status/`, { status: targetStatus, note: extra.note || "" });
        } catch (errStatus) {
          // fallback
          await axios.patch(`/api/orders/${orderId}/`, { status: targetStatus });
        }
      }
      toast.success(`Order ${orderId} updated to ${targetStatus}`);
      // refresh local orders
      await fetchOrders();
    } catch (err) {
      console.error("Failed to update order status:", err);
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.response?.data || err.message;
      toast.error(`Failed to update order: ${msg}`);
    }
  };

  // small helper to try notifying customer (best-effort)
  const notifyCustomer = async (order) => {
    try {
      await axios.post(`/api/orders/${order.id}/notify/`, { message: "Your order status updated by caterer" });
      toast.success("Customer notified (attempt).");
    } catch (err) {
      // many backends won't have this; ignore
      console.debug("Notify API not available or failed", err);
    }
  };

  // ---------------- IMAGE HANDLERS ----------------
  // This handles file selection and updates previews + newImages state.
  const handleImageChange = (e) => {
    setImageTouched(true);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // total currently selected (existing previews count + new files)
    const totalCurrent = imagePreviews.length;
    if (totalCurrent + files.length > 10) {
      setImageError("You can upload a maximum of 10 images.");
      return;
    }

    // clear any previous error
    setImageError("");

    // create preview entries for the newly selected files
    const newPreviews = files.map((f) => {
      const src = URL.createObjectURL(f);
      return { src, file: f, existing: false };
    });

    // append to state
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    setNewImages((prev) => [...prev, ...files]);
  };

  // Delete a preview by index. If it refers to an existing image (has id or existing true and no file),
  // attempt to delete from server; if it's a newly selected file, remove it locally and revoke objectURL.
  const handleDeletePreview = async (index) => {
    setImageTouched(true);

    const entry = imagePreviews[index];
    if (!entry) return;

    //  CONFIRM POPUP
    const confirmed = window.confirm(
      "Are you sure you want to delete this image? This action cannot be undone."
    );

    if (!confirmed) return;

    // Existing image on server → delete via API
    if (entry.id) {
      try {
        await axios.delete(`/api/caterers/me/images/${entry.id}/`);
        toast.success("Image deleted.");
      } catch (err) {
        console.error("Failed to delete image on server:", err);
        toast.error("Failed to delete image from server.");
        return;
      }
    }

    // Newly added (local-only) image → cleanup blob + state
    if (entry.file && entry.src?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(entry.src);
      } catch { }

      setNewImages((prev) =>
        prev.filter(
          (f) =>
            !(
              f.name === entry.file.name &&
              f.size === entry.file.size &&
              f.lastModified === entry.file.lastModified
            )
        )
      );
    }

    // Remove from previews
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));

    // Clear only max-limit errors
    setImageError((prev) =>
      prev && prev.includes("maximum") ? "" : prev
    );
  };

  // Optional helper to upload newImages to backend immediately (not used automatically).
  // Call this function wherever appropriate to persist newly-selected files.
  const uploadNewImages = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!newImages.length) return;

    const fd = new FormData();
    newImages.forEach((f) => fd.append("images", f));

    try {
      await axios.post("/api/caterers/me/images/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Images uploaded");

      setNewImages([]);
      setImageTouched(false);

      //  REFRESH FROM BACKEND (NO PAGE RELOAD)
      await fetchMyCaterer();

    } catch (err) {
      toast.error("Upload failed");
    }
  };


  // ---------------- END IMAGE HANDLERS ----------------

  if (loadingCaterer) return <div className="p-6">Loading dashboard…</div>;

  if (!caterer)
    return (
      <div className="p-6">
        <p className="text-red-600">No caterer data available.</p>
        <p className="text-sm text-gray-600 mt-2">
          If you believe this is incorrect, make sure your account has an approved caterer record.
        </p>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
      {/* ---- HEADER ---- */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="space-y-3">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {caterer.name}
              <span className="text-gray-400 font-semibold">  Dashboard</span>
            </h2>

            {/* City chip */}
            <span className="inline-flex items-center w-fit px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              📍 {caterer.city}
            </span>
          </div>

          {/* Action + Status */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Primary action */}
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white
        shadow-sm transition active:scale-[0.97] disabled:opacity-60
        ${caterer.is_active
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
                }`}
            >
              {toggling
                ? "Updating…"
                : caterer.is_active
                  ? "Close Business"
                  : "Open Business"}
            </button>

            {/* Status panel */}
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-x-4 gap-y-1
                    w-full sm:w-auto px-4 py-2.5 rounded-xl border bg-gray-50 text-xs sm:text-sm">
              <div className="text-gray-600">
                Status:
                <span
                  className={`ml-1 font-semibold ${caterer.status === "approved"
                    ? "text-green-600"
                    : "text-yellow-600"
                    }`}
                >
                  {caterer.status}
                </span>
              </div>

              <div className="flex items-center gap-1 text-gray-600">
                <span className="text-gray-300">•</span>
                <span>
                  Active:
                  <span
                    className={`ml-1 font-semibold ${caterer.is_active ? "text-green-600" : "text-red-600"
                      }`}
                  >
                    {caterer.is_active ? "Yes" : "No"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Inactive reason */}
          {!caterer.is_active && caterer.admin_comment && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-lg">
              <strong>Inactive reason:</strong> {caterer.admin_comment}
            </div>
          )}
        </div>

        {/* ---- ACTION BUTTONS ---- */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {/* Staff Settings */}
          <button
            onClick={() => navigate("/caterer-staff-charge")}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-orange-400 text-black font-medium rounded-lg shadow hover:bg-orange-500 transition"
          >
            Staff Settings
          </button>

          {/* Delivery Settings */}
          <button
            onClick={() => navigate("/caterer-delivery-settings")}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-yellow-400 text-black font-medium rounded-lg shadow hover:bg-yellow-500 transition"
          >
            Delivery Settings
          </button>

          {/* View Orders */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => navigate("/caterer-orders")}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg shadow hover:bg-emerald-700 flex items-center justify-center gap-2 transition"
            >
              <span role="img" aria-label="orders">📦</span>
              <span>View Orders</span>
            </button>

            {pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full shadow">
                {pendingCount}
              </span>
            )}
          </div>

          {/* Manage Menu */}
          <button
            onClick={() => navigate("/caterer-menu-manager")}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition"
          >
            Manage Menu
          </button>

          {/* Water Settings */}
          <button
            onClick={() => navigate("/caterer-water-settings")}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-sky-400 text-black font-medium rounded-lg shadow hover:bg-sky-500 transition"
          >
            Water Settings
          </button>

          <button
            onClick={() => navigate("/caterer-radius-settings")}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-purple-600 text-white font-medium rounded-lg shadow hover:bg-purple-700 transition"
          >
            Radius Settings
          </button>

          {/* Refresh */}
          <button
            onClick={async () => {
              try {
                await refreshMenuCounts();
                toast.success("Menu counts refreshed");
              } catch (e) {
                console.error(e);
                toast.error("Failed to refresh menu counts");
              }
            }}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 border border-gray-300 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ---- KPI CARDS ---- */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Completed Orders"
          value={loadingStats ? "…" : stats?.completed_orders ?? completedOrdersList.length ?? "0"}
          hint="Total completed"
          onClick={() => openStatModal("completed_orders")}
        />
        <StatCard
          title="Ongoing Orders"
          value={ordersLoading ? "…" : ongoingCount ?? stats?.ongoing_orders ?? "0"}
          hint="In progress"
          onClick={() => openStatModal("ongoing_orders")}
        />
        <StatCard
          title="Revenue"
          value={loadingStats ? "…" : stats?.revenue != null ? `₹${stats.revenue}` : "—"}
          hint="Lifetime revenue"
          onClick={() => openStatModal("revenue")}
        />
        <StatCard
          title="Avg Rating"
          value={
            loadingStats
              ? "…"
              : (stats?.rating != null
                ? Number(stats.rating).toFixed(1)
                : (reviewsRating != null ? reviewsRating.toFixed(1) : "—"))
          }
          hint={reviewsCount ? `${reviewsCount} public reviews` : "Customer rating"}
          onClick={() => openStatModal("avg_rating")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Customer Cancellations"
          value={loadingStats ? "…" : stats?.customer_cancellations ?? customerCancelledList.length ?? "0"}
          hint="Total Customer Cancellations"
          onClick={() => openStatModal("customer_cancellations")}
        />
        <StatCard title="Caterer Cancellations"
          value={loadingStats ? "…" : stats?.caterer_cancellations ?? catererCancelledList.length ?? "0"}
          hint="Total Caterer Cancellations"
          onClick={() => openStatModal("caterer_cancellations")}
        />
        <StatCard
          title="Active Menu Items"
          value={loadingStats ? "…" : stats?.active_menu_count ?? "0"}
          hint={`Total: ${stats?.menu_count ?? "—"} • Active Packages: ${stats?.active_package_count ?? "0"} / ${stats?.package_count ?? "—"}`}
          onClick={async () => {
            if (refreshingMenus) return; // avoid double clicks
            setRefreshingMenus(true);
            try {
              await refreshMenuCounts();
              setSelectedStat("menus_packages"); // NEW: separate key so modal can show items+packages
              setSelectedStat("menus"); // keep existing behaviour (DO NOT REMOVE)
            } catch (err) {
              console.error("Failed to refresh before opening menus:", err);
              setSelectedStat("menus_packages");
              setSelectedStat("menus");
            } finally {
              setRefreshingMenus(false);
            }
          }}
          disabled={refreshingMenus || loadingStats}
        />
      </div>

      {/* ---- MODALS & ORDERS omitted for brevity in this snippet; rest of your original file continues unchanged ---- */}
      {/* ---- MODALS FOR STATS ---- */}
      {/* ---- MODALS & ORDERS omitted for brevity in this snippet; rest of your original file continues unchanged ---- */}
      {/* Menu modal (existing) */}
      {selectedStat === "menus" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedStat(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Menu Items & Packages</h3>
              <button onClick={() => setSelectedStat(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mt-4 space-y-2">
              <p><strong>Active Items:</strong> {stats?.active_menu_count ?? "0"}</p>
              <p><strong>Total Items:</strong> {stats?.menu_count ?? "0"}</p>
              {/* NEW: Packages section */}
              <p><strong>Active Packages:</strong> {stats?.active_package_count ?? "0"}</p>
              <p><strong>Total Packages:</strong> {stats?.package_count ?? "0"}</p>
              {activeItemsList.length > 0 && (
                <>
                  <div className="mt-3 font-semibold">Active item preview</div>
                  <ul className="mt-2 max-h-40 overflow-auto space-y-1">
                    {activeItemsList.map((it) => (
                      <li key={it.id} className="text-sm text-gray-700">
                        {it.name} — ₹{it.price}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => navigate("/caterer-menu-manager")}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Go to Menu Manager
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Completed Orders modal */}
      {selectedStat === "completed_orders" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedStat(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Completed Orders</h3>
              <button onClick={() => setSelectedStat(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mt-4">
              <p><strong>Total Completed:</strong> {completedOrdersList.length}</p>
              {completedOrdersList.length > 0 ? (
                <ul className="mt-3 max-h-56 overflow-auto space-y-2">
                  {completedOrdersList.map((o) => (
                    <li key={o.id} className="text-sm text-gray-700 flex justify-between">
                      <div>Order #{o.id} — {o.user || "Guest"}</div>
                      <div>₹{o.total}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-500 mt-2">No completed orders.</p>}
            </div>
          </div>
        </div>
      )}
      {/* Ongoing Orders modal */}
      {selectedStat === "ongoing_orders" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedStat(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Ongoing Orders</h3>
              <button onClick={() => setSelectedStat(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mt-4">
              <p><strong>Total Ongoing:</strong> {ongoingOrdersList.length}</p>
              {ongoingOrdersList.length > 0 ? (
                <ul className="mt-3 max-h-56 overflow-auto space-y-2">
                  {ongoingOrdersList.map((o) => (
                    <li key={o.id} className="text-sm text-gray-700 flex justify-between items-center">
                      <div>
                        <div className="font-medium">Order #{o.id} • CustomerID #{o.user || "Guest"}</div>
                        <div className="text-xs text-gray-500">Status: {o.status} • {o.plates} plates</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-500 mt-2">No ongoing orders.</p>}
            </div>
          </div>
        </div>
      )}
      {/* Revenue modal */}
      {selectedStat === "revenue" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedStat(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Revenue</h3>
              <button onClick={() => setSelectedStat(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mt-4">
              <p className="text-sm"><strong>Total Revenue:</strong> ₹{stats?.revenue ?? 0}</p>
              <p className="text-xs text-gray-500 mt-2">Based on completed & delivered orders.</p>
            </div>
          </div>
        </div>
      )}
      {/* Avg rating modal */}
      {selectedStat === "avg_rating" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedStat(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Average Rating</h3>
              <button onClick={() => setSelectedStat(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="mt-4">
              <p className="text-sm">
                <strong>Rating:</strong>{" "}
                {(stats?.rating != null)
                  ? `${Number(stats.rating).toFixed(1)} / 5`
                  : (reviewsRating != null ? `${Number(reviewsRating).toFixed(1)} / 5` : "—")
                }
              </p>

              <p className="text-xs text-gray-500 mt-2">
                {reviewsCount
                  ? `Based on ${reviewsCount} public review${reviewsCount === 1 ? "" : "s"}.`
                  : "Based on customer feedback across completed orders."
                }
              </p>

              {/* optional: show both sources when both available */}
              {stats?.rating != null && reviewsRating != null && (
                <div className="mt-3 text-xs text-gray-500">
                  <div>Owner-reported rating: {Number(stats.rating).toFixed(1)} / 5</div>
                  <div>Public sample rating: {Number(reviewsRating).toFixed(1)} / 5 ({reviewsCount} reviews)</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Customer cancellations */}
      {selectedStat === "customer_cancellations" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedStat(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Customer Cancellations</h3>
              <button onClick={() => setSelectedStat(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mt-4">
              <p><strong>Total:</strong> {customerCancelledList.length}</p>
              {customerCancelledList.length > 0 ? (
                <ul className="mt-3 max-h-56 overflow-auto space-y-2">
                  {customerCancelledList.map((o) => (
                    <li key={o.id} className="text-sm">
                      Order #{o.id} — Reason: {o.cancellation_reason || o.caterer_note || "N/A"} — ₹{o.total}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-500 mt-2">No customer cancellations.</p>}
            </div>
          </div>
        </div>
      )}
      {/* Caterer cancellations */}
      {selectedStat === "caterer_cancellations" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedStat(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Caterer Cancellations</h3>
              <button onClick={() => setSelectedStat(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mt-4">
              <p><strong>Total:</strong> {catererCancelledList.length}</p>
              {catererCancelledList.length > 0 ? (
                <ul className="mt-3 max-h-56 overflow-auto space-y-2">
                  {catererCancelledList.map((o) => (
                    <li key={o.id} className="text-sm">
                      Order #{o.id} — Reason: {o.cancellation_reason || o.caterer_note || "N/A"} — ₹{o.total}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-500 mt-2">No caterer cancellations.</p>}
            </div>
          </div>
        </div>
      )}
      {/* ---- ORDERS MODAL (existing) ---- */}
      {ordersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-12 px-3 sm:px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOrdersModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Customer Orders</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { fetchOrders(); }} className="px-3 py-1 border rounded">Refresh</button>
                <button onClick={() => setOrdersModalOpen(false)} className="px-3 py-1 rounded bg-gray-100">Close</button>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {ordersLoading && <div className="text-sm text-gray-600">Loading orders…</div>}
              {ordersError && <div className="text-sm text-red-600">{ordersError}</div>}
              {/* Ongoing: pending / confirmed / in_progress */}
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Ongoing Orders ({ongoingCount})</h4>
                </div>
                <div className="mt-2 space-y-2 max-h-56 overflow-auto">
                  {orders.filter((o) => ["pending", "confirmed", "in_progress", "preparation_inprogress", "preparation_completed", "delivery_in_progress"].includes(o.status)).length === 0 && (
                    <div className="text-sm text-gray-500">No ongoing orders.</div>
                  )}
                  {orders
                    .filter((o) => ["pending", "confirmed", "in_progress", "preparation_inprogress", "preparation_completed", "delivery_in_progress"].includes(o.status))
                    .map((o) => (
                      <div key={o.id || o.order_ref} className="p-3 border rounded flex justify-between items-start bg-gray-50">
                        <div className="text-sm">
                          <div className="font-medium">Order #{o.id ?? o.order_ref} • {o.user || "Guest"}</div>
                          <div className="text-xs text-gray-600">Status: <span className="font-semibold">{o.status}</span></div>
                          <div className="text-xs text-gray-600">Plates: {o.plates}</div>
                          <div className="text-xs text-gray-600">Total: ₹{o.total}</div>
                          <div className="text-xs text-gray-600">Created: {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}</div>
                          {o.contact && <div className="text-xs text-gray-600">Contact: {o.contact}</div>}
                          {o.location && <div className="text-xs text-gray-600">Location: {o.location}</div>}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {o.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateOrderStatus(o.id, "confirmed")}
                                className="px-3 py-1 bg-emerald-600 text-white rounded text-sm"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => updateOrderStatus(o.id, "cancelled")}
                                className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {o.status === "confirmed" && (
                            <>
                              <button onClick={() => updateOrderStatus(o.id, "in_progress")} className="px-3 py-1 bg-yellow-500 rounded text-sm">
                                Start
                              </button>
                              <button onClick={() => updateOrderStatus(o.id, "cancelled")} className="px-3 py-1 bg-red-500 text-white rounded text-sm">
                                Cancel
                              </button>
                            </>
                          )}
                          {o.status === "in_progress" && (
                            <button onClick={() => updateOrderStatus(o.id, "completed")} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">
                              Mark Complete
                            </button>
                          )}
                          <button onClick={() => notifyCustomer(o)} className="px-3 py-1 border rounded text-xs">Notify</button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              {/* Recent Completed */}
              <div>
                <h4 className="font-semibold">Recent Completed ({recentCompleted.length})</h4>
                <div className="mt-2 space-y-2 max-h-48 overflow-auto">
                  {recentCompleted.length === 0 && <div className="text-sm text-gray-500">No recent completed orders.</div>}
                  {recentCompleted.map((o) => (
                    <div key={o.id || o.order_ref} className="p-3 border rounded flex justify-between items-center">
                      <div className="text-sm">
                        <div className="font-medium">Order #{o.id ?? o.order_ref} • {o.user || "Guest"}</div>
                        <div className="text-xs text-gray-600">Total: ₹{o.total} • Plates: {o.plates}</div>
                        <div className="text-xs text-gray-600">Completed: {o.updated_at ? new Date(o.updated_at).toLocaleString() : "-"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/orders/${o.id}`)} className="px-3 py-1 border rounded text-xs">View</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Past (older completed or cancelled) */}
              <div>
                <h4 className="font-semibold">Past Orders</h4>
                <div className="mt-2 space-y-2 max-h-48 overflow-auto">
                  {pastOrders.length === 0 && <div className="text-sm text-gray-500">No past orders.</div>}
                  {pastOrders.map((o) => (
                    <div key={o.id || o.order_ref} className="p-3 border rounded flex justify-between items-center bg-white">
                      <div className="text-sm">
                        <div className="font-medium">Order #{o.id ?? o.order_ref} • {o.user || "Guest"}</div>
                        <div className="text-xs text-gray-600">Status: {o.status} • Total: ₹{o.total}</div>
                        <div className="text-xs text-gray-600">When: {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/orders/${o.id}`)} className="px-3 py-1 border rounded text-xs">View</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ---- SUMMARY ---- */}
      <div className="mt-6 bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">About</h3>
        <div className="text-sm text-gray-700">
          <p><strong>Owner ID:</strong> {caterer.user || "—"}</p>
          <p><strong>Contact:</strong> {caterer.contact_number || "—"}</p>
          <p className="mt-2"><strong>Description</strong></p>
          <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded mt-1">{caterer.description || "—"}</pre>
        </div>
        {/* Images */}
        <div className="mb-6 border rounded-xl p-5 md:p-6 mt-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Food Photos <span className="text-red-500">*</span>
          </h3>

          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length + imagePreviews.length > 10) {
                setImageError("You can upload a maximum of 10 images.");
                return;
              }
              setImageError(""); // clear error if valid
              handleImageChange(e);
            }}
            className="w-full p-3 border rounded-lg"
          />

          {!!imagePreviews.length && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 mt-3">
              {imagePreviews.map((entry, i) => (
                <div key={i} className="relative w-20 h-20 group">
                  {/* Image */}
                  <img
                    src={entry.src}
                    className="w-full h-full object-cover rounded-lg border"
                    alt={`preview-${i}`}
                  />

                  {/*  Delete button (hover only) */}
                  <button
                    onClick={() => handleDeletePreview(i)}
                    title="Delete image"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100
                     bg-white text-gray-700 rounded-full w-5 h-5
                     flex items-center justify-center text-xs font-bold
                     shadow hover:bg-red-500 hover:text-white transition"
                  >
                    ✕
                  </button>

                  {/* Approval badge */}
                  {entry.existing && (
                    <span
                      className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
              ${entry.approved
                          ? "bg-green-600 text-white"
                          : "bg-yellow-400 text-black"
                        }`}
                    >
                      {entry.approved ? "Approved" : "Pending"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {imagesLoaded && imageTouched && imagePreviews.filter(p => p.existing).length === 0 && (
            <p className="text-xs text-red-600 mt-2">
              At least one image is required.
            </p>
          )}

          {imageError && (
            <p className="text-xs text-red-600 mt-2">
              {imageError}
            </p>
          )}

          {/* Helper text + upload new images CTA */}
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <div>
              Minimum <span className="font-medium text-gray-700">1</span> image required, maximum{" "}
              <span className="font-medium text-gray-700">10</span> images allowed.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={uploadNewImages}
                disabled={newImages.length === 0}
                className={`px-3 py-1 rounded ${newImages.length === 0 ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
              >
                Upload {newImages.length ? `(${newImages.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- ACTIONS ---- */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button onClick={() => navigate("/caterer-menu-manager")} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Manage Menu</button>
        <button onClick={() => navigate("/caterer-reports")} className="px-4 py-2 border rounded-lg">Reports</button>
      </div>
    </div>
  );
};

export default CatererDashboard;