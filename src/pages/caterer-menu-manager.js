// client/src/pages/caterer-menu-manager.js
import React, { useEffect, useState } from "react";
import MenuItemModal from "../components/MenuItemModal";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiEdit, FiTrash2, FiEye, FiEyeOff } from "react-icons/fi";
import axios from "../shared-lib/axiosInstance";

/**
 * CatererMenuManager
 * - All original functionality preserved.
 * - Added Drinking Water tab with bottles & cans settings editable via PATCH.
 * - Utensils modal and Packages functionality preserved.
 */

export default function CatererMenuManager() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState([]);
    const [packages, setPackages] = useState([]); // NEW: packages state
    const [caterer, setCaterer] = useState(null);
    const [filter, setFilter] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    // Package modal state
    const [packageModalOpen, setPackageModalOpen] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    const [tab, setTab] = useState("items"); // 'items' | 'packages' | 'drinking'

    // Utensils modal state
    const [utensilsModalOpen, setUtensilsModalOpen] = useState(false);
    const [utensilsType, setUtensilsType] = useState("fixed"); // "fixed" | "percent"
    const [utensilsValue, setUtensilsValue] = useState("");
    const [updatingUtensils, setUpdatingUtensils] = useState(false);

    // Water settings state (Drinking Water tab)
    const [loadingWater, setLoadingWater] = useState(true);
    const [bottlesSettings, setBottlesSettings] = useState(null);
    const [cansSettings, setCansSettings] = useState(null);
    const [showBottlesEdit, setShowBottlesEdit] = useState(false);
    const [showCansEdit, setShowCansEdit] = useState(false);
    const [savingBottles, setSavingBottles] = useState(false);
    const [savingCans, setSavingCans] = useState(false);

    // Helper for auth header (fixed template literal)
    const getAuthHeaders = () => {
        const token = localStorage.getItem("accessToken");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchCaterer = async () => {
        try {
            const res = await axios.get("/api/caterers/me/");
            const data = res.data;

            setCaterer(data);

            const normalized = String(
                data?.cuisine || data?.cuisine_type || "both"
            ).toLowerCase();

            if (normalized === "veg") setFilter("veg");
            else if (normalized.includes("non")) setFilter("nonveg");
            else setFilter("all");
        } catch (err) {
            console.error("fetchCaterer error", err);
        }
    };

    const fetchItems = async () => {
        try {
            setLoading(true);

            const res = await axios.get("/api/caterers/me/menus/");
            setItems(Array.isArray(res.data) ? res.data : []);

        } catch (err) {
            console.error("fetchItems error", err);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    // NEW: fetch packages
    const fetchPackages = async () => {
        try {
            const res = await axios.get("/api/caterers/me/packages/");
            setPackages(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("fetchPackages error:", err);
            setPackages([]);
        }
    };

    // NEW: fetch water settings (bottles + cans)
    const fetchWaterSettings = async () => {
        try {
            setLoadingWater(true);

            const [bRes, cRes] = await Promise.all([
                axios.get("/api/caterers/me/water/bottles/"),
                axios.get("/api/caterers/me/water/cans/"),
            ]);

            setBottlesSettings(bRes.data || null);
            setCansSettings(cRes.data || null);
        } catch (err) {
            console.error("fetchWaterSettings error:", err);
            setBottlesSettings(null);
            setCansSettings(null);
        } finally {
            setLoadingWater(false);
        }
    };

    useEffect(() => {
        fetchCaterer();
        fetchItems();
        fetchPackages(); // NEW
        fetchWaterSettings(); // NEW
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveItem = async (payload, id = null) => {
        try {
            setSaving(true);

            const url = id
                ? `/api/caterers/me/menus/${id}/`
                : "/api/caterers/me/menus/";

            const res = id
                ? await axios.patch(url, payload)
                : await axios.post(url, payload);

            const data = res.data;

            if (id) {
                setItems((prev) => prev.map((it) => (it.id === id ? data : it)));
            } else {
                setItems((prev) => [data, ...prev]);
            }

            setModalOpen(false);
            setEditing(null);
        } catch (err) {
            console.error("saveItem error", err);
            window.alert("Failed to save item");
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async (id) => {
        if (!window.confirm("Delete this item?")) return;

        try {
            await axios.delete(`/api/caterers/me/menus/${id}/`);
            setItems((prev) => prev.filter((it) => it.id !== id));
        } catch (err) {
            console.error("deleteItem error", err);
            window.alert("Delete failed");
        }
    };

    const toggleActive = async (item) => {
        try {
            const res = await axios.patch(
                `/api/caterers/me/menus/${item.id}/`,
                { is_active: !item.is_active }
            );

            const data = res.data;
            setItems((prev) => prev.map((it) => (it.id === data.id ? data : it)));
        } catch (err) {
            console.error("toggleActive error", err);
            window.alert("Failed to toggle");
        }
    };

    // ---- Package CRUD (NEW) ----
    const savePackage = async (payload, id = null) => {
        try {
            setSaving(true);
            const url = id
                ? `/api/caterers/me/packages/${id}/`
                : "/api/caterers/me/packages/";

            const res = id
                ? await axios.patch(url, payload)
                : await axios.post(url, payload);

            const data = res.data;

            setPackages((prev) =>
                id ? prev.map((p) => (p.id === id ? data : p)) : [data, ...prev]
            );

            setPackageModalOpen(false);
            setEditingPackage(null);
        } catch (err) {
            console.error("savePackage error", err);
            window.alert("Failed to save package");
        } finally {
            setSaving(false);
        }
    };

    const deletePackage = async (id) => {
        if (!window.confirm("Delete this package?")) return;

        try {
            await axios.delete(`/api/caterers/me/packages/${id}/`);
            setPackages((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            console.error("deletePackage error", err);
            window.alert("Delete failed");
        }
    };

    const togglePackageActive = async (pkg) => {
        try {
            const res = await axios.patch(
                `/api/caterers/me/packages/${pkg.id}/`,
                { is_active: !pkg.is_active }
            );

            const data = res.data;
            setPackages((prev) => prev.map((p) => (p.id === data.id ? data : p)));
        } catch (err) {
            console.error("togglePackageActive error", err);
            window.alert("Failed to toggle");
        }
    };

    // ---- Water settings save handlers ----
    const saveBottles = async (payload) => {
        try {
            setSavingBottles(true);
            const res = await axios.patch(
                "/api/caterers/me/water/bottles/",
                payload
            );
            setBottlesSettings(res.data);
            setShowBottlesEdit(false);
        } catch (err) {
            console.error("saveBottles error", err);
            window.alert("Failed to save bottles");
        } finally {
            setSavingBottles(false);
        }
    };

    const saveCans = async (payload) => {
        try {
            setSavingCans(true);
            const res = await axios.patch(
                "/api/caterers/me/water/cans/",
                payload
            );
            setCansSettings(res.data);
            setShowCansEdit(false);
        } catch (err) {
            console.error("saveCans error", err);
            window.alert("Failed to save cans");
        } finally {
            setSavingCans(false);
        }
    };


    // Filtered items (existing logic preserved)
    const filteredItems = items.filter((it) => {
        const backendCuisine = String(caterer?.cuisine || caterer?.cuisine_type || "both").toLowerCase();
        const itemCuisine = String(it.cuisine || "").toLowerCase();

        // If caterer is Veg → only veg items
        if (backendCuisine === "veg") {
            return itemCuisine === "veg";
        }

        // If caterer is Non-Veg → allow both veg and nonveg
        if (backendCuisine === "nonveg") {
            return itemCuisine === "veg" || itemCuisine.includes("non");
        }

        // If caterer is Both → apply UI filter
        if (backendCuisine === "both") {
            if (filter === "veg") return itemCuisine === "veg";
            if (filter === "nonveg") return itemCuisine.includes("non");
            return true; // 'all'
        }

        // fallback → show all
        return true;
    });

    // Helper to render plate-range for package
    const renderPlateRange = (p) => {
        const min = p.min_plates ?? "—";
        const max = p.max_plates ?? 0;
        if (!max || max === 0) return `${min}+ plates`;
        return `${min} - ${max} plates`;
    };

    // Helper to render composition counts
    const renderCompositionCounts = (p) => {
        const parts = [];
        if (p.starters_count) parts.push(`${p.starters_count} starters`);
        if (p.mains_count) parts.push(`${p.mains_count} mains`);
        if (p.rice_count) parts.push(`${p.rice_count} rice`);
        if (p.bread_count) parts.push(`${p.bread_count} bread`);
        if (p.dessert_count) parts.push(`${p.dessert_count} dessert`);
        if (p.beverage_count) parts.push(`${p.beverage_count} beverage`);
        return parts.join(" • ");
    };

    // Tiny helper to show part of structured composition
    const shortCompositionPreview = (pkg) => {
        if (!pkg?.composition_structure) return pkg.composition || "";
        try {
            const cs =
                typeof pkg.composition_structure === "string"
                    ? JSON.parse(pkg.composition_structure)
                    : pkg.composition_structure;
            const sections = cs.sections || {};
            const entries = Object.entries(sections)
                .slice(0, 3)
                .map(([k, v]) => {
                    const displayName = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    const options = (v.options || [])
                        .slice(0, 2)
                        .map((o) => `${o.name}${o.required ? " ✓" : ""}`)
                        .join(", ");
                    return `${displayName}: ${v.count}${options ? ` (${options})` : ""}`;
                });
            return entries.join(" • ");
        } catch {
            return pkg.composition || "";
        }
    };

    // ---- Utensils update handler ----
    const openUtensilsModal = () => {
        if (!caterer) {
            window.alert("Caterer info not loaded yet.");
            return;
        }
        // prefill from caterer object if available
        const t = caterer.utensils_fee_type || caterer.utensils_fee_type === "percent" ? caterer.utensils_fee_type : (caterer.utensils_fee_type ?? "fixed");
        const v = caterer.utensils_fee_value ?? "";
        setUtensilsType(t || "fixed");
        setUtensilsValue(v ? String(v) : "");
        setUtensilsModalOpen(true);
    };

    const submitUtensilsUpdate = async () => {
        // validation
        const parsed = Number(utensilsValue);
        if (Number.isNaN(parsed) || parsed < 0) {
            window.alert("Please enter a valid non-negative number for utensils value.");
            return;
        }

        setUpdatingUtensils(true);
        try {
            const url = (`/api/caterers/update-utensils-fee/`);
            const body = {
                type: utensilsType === "percent" ? "percent" : "fixed",
                value: parsed,
            };
            const res = await fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                console.error("update utensils failed:", res.status, txt);
                const msg = txt || "Failed to update utensils fee";
                window.alert(msg);
                return;
            }
            // success → refresh caterer
            await fetchCaterer();
            setUtensilsModalOpen(false);
        } catch (err) {
            console.error("submitUtensilsUpdate error:", err);
            window.alert("Failed to update utensils fee");
        } finally {
            setUpdatingUtensils(false);
        }
    };

    // derive utensils display from caterer
    const utensilsDisplay = () => {
        if (!caterer) return "—";
        const type = caterer.utensils_fee_type ?? caterer.utensils_fee_type;
        const val = caterer.utensils_fee_value ?? caterer.utensils_fee_value;
        if (!type || val == null || val === "") return "Not set";
        if (String(type).toLowerCase() === "percent") return `${val}%`;
        return `₹${val}`;
    };

    //
    // Small form components for Bottles & Cans (inline, minimal)
    //
    function BottlesForm({ initial = {}, onCancel, onSave, saving }) {
        const [enabled, setEnabled] = useState(Boolean(initial?.enabled));
        const [bottlePrice, setBottlePrice] = useState(initial?.bottle_price ?? "");
        const [defaultMultiplier, setDefaultMultiplier] = useState(initial?.default_multiplier ?? "1.70");
        const [freeThreshold, setFreeThreshold] = useState(initial?.free_threshold ?? "");

        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <label className="text-sm">Enabled</label>
                    <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                </div>
                <div>
                    <label className="text-xs text-gray-600">Bottle price</label>
                    <input value={bottlePrice} onChange={(e) => setBottlePrice(e.target.value.replace(/[^0-9.]/g, ""))} className="w-40 border rounded px-2 py-1" />
                </div>
                <div>
                    <label className="text-xs text-gray-600">Default multiplier</label>
                    <input value={defaultMultiplier} onChange={(e) => setDefaultMultiplier(e.target.value)} className="w-40 border rounded px-2 py-1" />
                </div>
                <div>
                    <label className="text-xs text-gray-600">Free threshold (order total)</label>
                    <input value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value.replace(/[^0-9.]/g, ""))} className="w-40 border rounded px-2 py-1" />
                </div>

                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="px-3 py-1 rounded border">Cancel</button>
                    <button
                        onClick={() => onSave({
                            enabled,
                            bottle_price: bottlePrice === "" ? null : String(bottlePrice),
                            default_multiplier: defaultMultiplier === "" ? null : String(defaultMultiplier),
                            free_threshold: freeThreshold === "" ? null : String(freeThreshold),
                        })}
                        className="px-3 py-1 rounded bg-indigo-600 text-white"
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        );
    }

    function CansForm({ initial = {}, onCancel, onSave, saving }) {
        const [enabled, setEnabled] = useState(Boolean(initial?.enabled));
        const [canVolumeL, setCanVolumeL] = useState(initial?.can_volume_l ?? 20);
        const [avgCupMl, setAvgCupMl] = useState(initial?.avg_cup_ml ?? 200);
        const [cupPackSize, setCupPackSize] = useState(initial?.cup_pack_size ?? 50);
        const [canPrice, setCanPrice] = useState(initial?.can_price ?? "");
        const [cupPackPrice, setCupPackPrice] = useState(initial?.cup_pack_price ?? "");
        const [minPrice, setMinPrice] = useState(initial?.min_price ?? "");
        const [freeThreshold, setFreeThreshold] = useState(initial?.free_threshold ?? "");

        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <label className="text-sm">Enabled</label>
                    <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-gray-600">Can volume (L)</label>
                        <input value={canVolumeL} onChange={(e) => setCanVolumeL(Number(e.target.value || 0))} className="w-full border rounded px-2 py-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Avg cup ml</label>
                        <input value={avgCupMl} onChange={(e) => setAvgCupMl(Number(e.target.value || 0))} className="w-full border rounded px-2 py-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Cup pack size</label>
                        <input value={cupPackSize} onChange={(e) => setCupPackSize(Number(e.target.value || 0))} className="w-full border rounded px-2 py-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Can price</label>
                        <input value={canPrice} onChange={(e) => setCanPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full border rounded px-2 py-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Cup pack price</label>
                        <input value={cupPackPrice} onChange={(e) => setCupPackPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full border rounded px-2 py-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Min price</label>
                        <input value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full border rounded px-2 py-1" />
                    </div>
                </div>

                <div>
                    <label className="text-xs text-gray-600">Free threshold</label>
                    <input value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value.replace(/[^0-9.]/g, ""))} className="w-40 border rounded px-2 py-1" />
                </div>

                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="px-3 py-1 rounded border">Cancel</button>
                    <button
                        onClick={() => onSave({
                            enabled,
                            can_volume_l: Number(canVolumeL),
                            avg_cup_ml: Number(avgCupMl),
                            cup_pack_size: Number(cupPackSize),
                            can_price: canPrice === "" ? null : String(canPrice),
                            cup_pack_price: cupPackPrice === "" ? null : String(cupPackPrice),
                            min_price: minPrice === "" ? null : String(minPrice),
                            free_threshold: freeThreshold === "" ? null : String(freeThreshold),
                        })}
                        className="px-3 py-1 rounded bg-amber-600 text-white"
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        );
    }

    // Filtered items and packages rendering are preserved. We'll render drinking tab separately.

    return (
        <div className="min-h-screen bg-gray-50">
            {/* header */}
            <header className="bg-white border-b">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    {/* Top row: Back + Actions (mobile), full layout (desktop) */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        {/* Left: Back */}
                        <div className="flex items-center">
                            <button
                                onClick={() => navigate("/caterer-dashboard")}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                                ← Dashboard
                            </button>
                        </div>

                        {/* Center: Title */}
                        <div className="text-center sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">
                                Menu Manager
                            </h1>
                            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                                Manage menu items, pricing & packages
                            </p>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {/* Utensils Card */}
                            <div
                                className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2 shadow-sm w-full sm:w-auto"
                                role="group"
                                aria-label="Utensils fee"
                            >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-50 border border-emerald-100">
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="text-emerald-600"
                                    >
                                        <path d="M6 3c.6 0 1 .4 1 1v16c0 .6-.4 1-1 1s-1-.4-1-1V4c0-.6.4-1 1-1zM12 3c.6 0 1 .4 1 1v16c0 .6-.4 1-1 1s-1-.4-1-1V4c0-.6.4-1 1-1zM18 3c.6 0 1 .4 1 1v16c0 .6-.4 1-1 1s-1-.4-1-1V4c0-.6.4-1 1-1z" />
                                    </svg>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-gray-500">Utensils</div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-semibold text-gray-900 truncate">
                                            {utensilsDisplay()}
                                        </div>
                                        {!caterer?.utensils_fee_type && (
                                            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                Not set
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={openUtensilsModal}
                                    className="px-3 py-1.5 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Update
                                </button>
                            </div>

                            {/* Primary action */}
                            {tab === "items" ? (
                                <button
                                    onClick={() => {
                                        setEditing(null);
                                        setModalOpen(true);
                                    }}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Add Item
                                </button>
                            ) : tab === "packages" ? (
                                <button
                                    onClick={() => {
                                        setEditingPackage(null);
                                        setPackageModalOpen(true);
                                    }}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Add Package
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowBottlesEdit(true)}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                                >
                                    <FiEdit className="w-4 h-4" />
                                    Edit Water
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* content */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Tabs: Items / Packages / Drinking Water */}
                <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex gap-2 justify-center sm:justify-start overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setTab("items")}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${tab === "items"
                                    ? "bg-indigo-600 text-white shadow"
                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                }`}
                        >
                            Items
                        </button>

                        <button
                            onClick={() => setTab("packages")}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${tab === "packages"
                                    ? "bg-amber-600 text-white shadow"
                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                }`}
                        >
                            Packages
                        </button>

                        <button
                            onClick={() => setTab("drinking")}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition
        ${tab === "drinking"
                                    ? "bg-emerald-600 text-white shadow"
                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                }`}
                        >
                            Drinking Water
                        </button>
                    </div>
                </div>

                {/* filters (only for items) */}
                {tab === "items" && String(caterer?.cuisine || caterer?.cuisine_type || "both")
                    .toLowerCase()
                    .includes("both") && (
                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilter("all")}
                                    className={`px-3 py-1.5 rounded-full border ${filter === "all" ? "bg-indigo-600 text-white" : "bg-white text-gray-700"}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilter("veg")}
                                    className={`px-3 py-1.5 rounded-full border ${filter === "veg" ? "bg-green-600 text-white" : "bg-white text-green-700"}`}
                                >
                                    Veg
                                </button>
                                <button
                                    onClick={() => setFilter("nonveg")}
                                    className={`px-3 py-1.5 rounded-full border ${filter === "nonveg" ? "bg-red-600 text-white" : "bg-white text-red-700"}`}
                                >
                                    Nonveg
                                </button>
                            </div>

                            <div className="ml-auto text-sm text-gray-500">
                                Showing <span className="font-semibold text-gray-900">{filteredItems.length}</span> items
                            </div>
                        </div>
                    )}

                {/* body */}
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>
                ) : tab === "items" ? (
                    // Items grid (existing)
                    filteredItems.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">No menu items yet — click <strong>Add Item</strong> to create one.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-xl shadow-sm border overflow-hidden"
                                >
                                    {/* BODY */}
                                    <div className="p-4 space-y-3">
                                        {/* Top row: Name + Price */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-gray-900 truncate">
                                                    {item.name}
                                                </div>
                                                <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                                    {item.description || "—"}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <div className="text-lg font-extrabold text-gray-900 leading-tight">
                                                    ₹{item.price}
                                                </div>
                                                <div className="mt-1">
                                                    {item.is_active ? (
                                                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                                                            Open
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                                                            Closed
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${String(item.cuisine || "")
                                                    .toLowerCase()
                                                    .includes("non")
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-green-100 text-green-700"
                                                    }`}
                                            >
                                                {item.cuisine || "Veg"}
                                            </span>

                                            {item.is_addon && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                                    Addon
                                                </span>
                                            )}

                                            {item.per_plate_enabled && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                    Per plate ₹{item.per_plate_price ?? "—"}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* FOOTER */}
                                    <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
                                        <div className="text-xs text-gray-500">
                                            Last updated:{" "}
                                            {item.updated_at
                                                ? new Date(item.updated_at).toLocaleDateString()
                                                : "—"}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => toggleActive(item)}
                                                className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border px-3 py-2 rounded-md text-sm bg-white hover:bg-gray-100"
                                            >
                                                {item.is_active ? <FiEyeOff /> : <FiEye />}
                                                {item.is_active ? "Close" : "Open"}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setEditing(item);
                                                    setModalOpen(true);
                                                }}
                                                className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border px-3 py-2 rounded-md text-sm bg-white hover:bg-gray-100"
                                            >
                                                <FiEdit /> Edit
                                            </button>

                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border px-3 py-2 rounded-md text-sm text-red-600 bg-white hover:bg-red-50"
                                            >
                                                <FiTrash2 /> Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : tab === "packages" ? (
                    // Packages grid (NEW)
                    <>
                        {packages.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">No packages yet — click <strong>Add Package</strong> to create one.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {packages.map((p) => (
                                    <div
                                        key={p.id}
                                        className="bg-white rounded-xl shadow-sm border overflow-hidden"
                                    >
                                        {/* BODY */}
                                        <div className="p-4 space-y-3">
                                            {/* Title + Price */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-gray-900 truncate">
                                                        {p.name}
                                                    </div>
                                                    <div className="text-sm text-gray-500 mt-0.5 line-clamp-3">
                                                        {p.description || p.composition || "—"}
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <div className="text-lg font-extrabold text-gray-900 leading-tight">
                                                        {p.price_per_plate ? `₹${p.price_per_plate}` : "—"}
                                                    </div>
                                                    <div className="text-xs text-gray-500">per plate</div>

                                                    <div className="mt-1">
                                                        {p.is_active ? (
                                                            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tags */}
                                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                                <span
                                                    className={`px-2 py-0.5 rounded ${p.veg_only
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-rose-100 text-rose-700"
                                                        }`}
                                                >
                                                    {p.veg_only ? "Pure Veg" : "Veg & Non-Veg"}
                                                </span>

                                                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                                    {renderPlateRange(p)}
                                                </span>
                                            </div>

                                            {/* Included counts */}
                                            {(p.starters_count ||
                                                p.mains_count ||
                                                p.rice_count ||
                                                p.bread_count ||
                                                p.dessert_count ||
                                                p.beverage_count) && (
                                                    <div className="text-sm text-gray-600">
                                                        <strong>Includes:</strong> {renderCompositionCounts(p)}
                                                    </div>
                                                )}

                                            {/* Short composition preview */}
                                            {(p.composition_structure || p.composition) && (
                                                <div className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">
                                                    {shortCompositionPreview(p)}
                                                </div>
                                            )}
                                        </div>

                                        {/* FOOTER */}
                                        <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
                                            <div className="text-xs text-gray-500">
                                                Last updated:{" "}
                                                {p.updated_at
                                                    ? new Date(p.updated_at).toLocaleDateString()
                                                    : "—"}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => togglePackageActive(p)}
                                                    className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border px-3 py-2 rounded-md text-sm bg-white hover:bg-gray-100"
                                                >
                                                    {p.is_active ? <FiEyeOff /> : <FiEye />}
                                                    {p.is_active ? "Deactivate" : "Activate"}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setEditingPackage(p);
                                                        setPackageModalOpen(true);
                                                    }}
                                                    className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border px-3 py-2 rounded-md text-sm bg-white hover:bg-gray-100"
                                                >
                                                    <FiEdit /> Edit
                                                </button>

                                                <button
                                                    onClick={() => deletePackage(p.id)}
                                                    className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border px-3 py-2 rounded-md text-sm text-red-600 bg-white hover:bg-red-50"
                                                >
                                                    <FiTrash2 /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : tab === "drinking" ? (
                    // Drinking Water tab
                    <>
                        {loadingWater ? (
                            <div className="text-center py-20 text-gray-500">Loading drinking water settings…</div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                {/* ---------------- Bottles Card ---------------- */}
                                <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5 space-y-4">
                                    {/* Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-gray-900">Water Bottles</h3>
                                                <span
                                                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${bottlesSettings?.enabled
                                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                        : "bg-gray-100 text-gray-600 border-gray-200"
                                                        }`}
                                                >
                                                    {bottlesSettings?.enabled ? "Enabled" : "Disabled"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Per-bottle pricing & multiplier
                                            </p>
                                        </div>

                                        <div className="text-xs text-gray-500 sm:text-right">
                                            Last updated:
                                            <br className="hidden sm:block" />
                                            {bottlesSettings?.updated_at
                                                ? new Date(bottlesSettings.updated_at).toLocaleString()
                                                : "—"}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                                        <div><strong>Bottle price:</strong> {bottlesSettings?.bottle_price ?? "—"}</div>
                                        <div><strong>Multiplier:</strong> {bottlesSettings?.default_multiplier ?? "1.70"}</div>
                                        <div className="sm:col-span-2">
                                            <strong>Free threshold:</strong> {bottlesSettings?.free_threshold ?? "—"}
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setShowBottlesEdit((s) => !s)}
                                            className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg border bg-white hover:bg-gray-100"
                                        >
                                            {showBottlesEdit ? "Close" : "Edit"}
                                        </button>
                                    </div>

                                    {/* Edit Form */}
                                    {showBottlesEdit && (
                                        <div className="pt-4 border-t">
                                            <BottlesForm
                                                initial={bottlesSettings || {}}
                                                onCancel={() => setShowBottlesEdit(false)}
                                                onSave={saveBottles}
                                                saving={savingBottles}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* ---------------- Cans Card ---------------- */}
                                <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5 space-y-4">
                                    {/* Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-gray-900">Water Cans + Cups</h3>
                                                <span
                                                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${cansSettings?.enabled
                                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                        : "bg-gray-100 text-gray-600 border-gray-200"
                                                        }`}
                                                >
                                                    {cansSettings?.enabled ? "Enabled" : "Disabled"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Cans, cup packs & minimum pricing
                                            </p>
                                        </div>

                                        <div className="text-xs text-gray-500 sm:text-right">
                                            Last updated:
                                            <br className="hidden sm:block" />
                                            {cansSettings?.updated_at
                                                ? new Date(cansSettings.updated_at).toLocaleString()
                                                : "—"}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                                        <div><strong>Can volume:</strong> {cansSettings?.can_volume_l ?? "20"} L</div>
                                        <div><strong>Avg cup:</strong> {cansSettings?.avg_cup_ml ?? "200"} ml</div>
                                        <div><strong>Cup pack:</strong> {cansSettings?.cup_pack_size ?? "50"}</div>
                                        <div><strong>Can price:</strong> {cansSettings?.can_price ?? "—"}</div>
                                        <div><strong>Cup pack price:</strong> {cansSettings?.cup_pack_price ?? "—"}</div>
                                        <div><strong>Min price:</strong> {cansSettings?.min_price ?? "—"}</div>
                                        <div className="sm:col-span-2">
                                            <strong>Free threshold:</strong> {cansSettings?.free_threshold ?? "—"}
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setShowCansEdit((s) => !s)}
                                            className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg border bg-white hover:bg-gray-100"
                                        >
                                            {showCansEdit ? "Close" : "Edit"}
                                        </button>
                                    </div>

                                    {/* Edit Form */}
                                    {showCansEdit && (
                                        <div className="pt-4 border-t">
                                            <CansForm
                                                initial={cansSettings || {}}
                                                onCancel={() => setShowCansEdit(false)}
                                                onSave={saveCans}
                                                saving={savingCans}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </main>

            <MenuItemModal
                visible={modalOpen}
                item={editing}
                saving={saving}
                catererCuisine={(caterer?.cuisine || caterer?.cuisine_type || "both").toLowerCase()}
                onClose={() => {
                    setModalOpen(false);
                    setEditing(null);
                }}
                onSave={saveItem}
            />

            {/* Package Modal (inline) */}
            {packageModalOpen && (
                <PackageModal
                    visible={packageModalOpen}
                    pkg={editingPackage}
                    saving={saving}
                    items={items} /* <-- pass items so modal can use eligible items */
                    onClose={() => {
                        setPackageModalOpen(false);
                        setEditingPackage(null);
                    }}
                    onSave={savePackage}
                    getAuthHeaders={getAuthHeaders}
                />
            )}

            {/* Utensils Modal */}
            {utensilsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">Update Utensils Fee</h3>
                            <button onClick={() => setUtensilsModalOpen(false)} className="text-gray-500">✕</button>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Type</label>
                                <div className="flex gap-3">
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="ut-type"
                                            value="fixed"
                                            checked={utensilsType === "fixed"}
                                            onChange={() => {
                                                setUtensilsType("fixed");
                                                // normalize value when switching to fixed: drop decimals
                                                const n = Number(utensilsValue || 0);
                                                setUtensilsValue(String(Math.round(n || 0)));
                                            }}
                                        />
                                        Fixed amount
                                    </label>

                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="ut-type"
                                            value="percent"
                                            checked={utensilsType === "percent"}
                                            onChange={() => {
                                                setUtensilsType("percent");
                                                // normalize value when switching to percent: keep 2 decimals
                                                const n = Number(utensilsValue || 0);
                                                setUtensilsValue(isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "");
                                            }}
                                        />
                                        Percent of subtotal
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-600 mb-1">
                                    {utensilsType === "percent" ? "Percent (%)" : "Amount (₹)"}
                                </label>

                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={utensilsValue}
                                    onChange={(e) => {
                                        const raw = e.target.value;

                                        // allow only digits, optional dot for percent, optional negative blocked
                                        if (utensilsType === "fixed") {
                                            // accept only integers — strip non-digits
                                            const digits = raw.replace(/\D+/g, "");
                                            // limit to max 4 digits
                                            const limited = digits.slice(0, 4);
                                            setUtensilsValue(limited);
                                        } else {
                                            // percent: allow digits and at most one dot and up to 2 decimals
                                            // remove invalid chars
                                            let cleaned = raw.replace(/[^0-9.]/g, "");
                                            const parts = cleaned.split(".");
                                            if (parts.length > 2) {
                                                // keep first dot only
                                                cleaned = parts[0] + "." + parts.slice(1).join("");
                                            }
                                            // enforce two decimals maximum
                                            const [intPart, decPart = ""] = cleaned.split(".");
                                            const decLimited = decPart.slice(0, 2);
                                            // limit integer portion to 2 digits (i.e., max 99)
                                            const intLimited = intPart.slice(0, 2);
                                            const composed = decLimited.length > 0 ? `${intLimited}.${decLimited}` : intLimited;
                                            setUtensilsValue(composed);
                                        }
                                    }}
                                    onBlur={() => {
                                        // Format on blur
                                        const n = Number(utensilsValue || 0);
                                        if (utensilsType === "fixed") {
                                            // ensure integer format
                                            if (!Number.isFinite(n) || n <= 0) {
                                                setUtensilsValue("");
                                            } else {
                                                setUtensilsValue(String(Math.round(n)));
                                            }
                                        } else {
                                            // percent: ensure two decimals
                                            if (!Number.isFinite(n) || n < 0) {
                                                setUtensilsValue("");
                                            } else {
                                                const capped = Math.min(99.99, Math.max(0, Math.round(n * 100) / 100));
                                                setUtensilsValue(capped.toFixed(2));
                                            }
                                        }
                                    }}
                                    placeholder={utensilsType === "percent" ? "e.g. 8.00" : "e.g. 150"}
                                    className="w-full border rounded px-2 py-1"
                                    aria-label={utensilsType === "percent" ? "Utensils percent" : "Utensils fixed amount"}
                                />
                            </div>

                            {/* Validation text */}
                            <div className="text-xs">
                                {utensilsType === "fixed" ? (
                                    <div className="text-gray-500">
                                        Enter a whole amount between <span className="font-medium">₹100</span> and <span className="font-medium">₹9999</span>.
                                    </div>
                                ) : (
                                    <div className="text-gray-500">
                                        Enter percentage (0.00 – 99.99). Value will be formatted to two decimals.
                                    </div>
                                )}
                            </div>

                            {/* Inline error message */}
                            <div className="text-xs mt-1">
                                {(() => {
                                    if (!utensilsValue) return <div className="text-rose-600">Value is required</div>;
                                    const n = Number(utensilsValue);
                                    if (!Number.isFinite(n)) return <div className="text-rose-600">Invalid number</div>;

                                    if (utensilsType === "fixed") {
                                        const intVal = Math.round(n);
                                        if (intVal < 100) return <div className="text-rose-600">Minimum fixed amount is ₹100</div>;
                                        if (intVal > 9999) return <div className="text-rose-600">Maximum fixed amount is ₹9999</div>;
                                        return <div className="text-green-600">Looks good: ₹{intVal}</div>;
                                    } else {
                                        // percent
                                        // ensure <= 99.99 and >= 0
                                        const pct = Math.round(n * 100) / 100;
                                        if (pct < 0 || pct > 10.00) return <div className="text-rose-600">Percent must be between 0.00 and 10.00</div>;
                                        // ensure two-decimal representation OK
                                        return <div className="text-green-600">Looks good: {pct.toFixed(2)}%</div>;
                                    }
                                })()}
                            </div>

                            <div className="text-xs text-gray-500">
                                Note: This amount should be fully refundable ones customer resubmits all utensils.
                            </div>

                            <div className="flex gap-2 justify-end mt-3">
                                <button onClick={() => setUtensilsModalOpen(false)} className="px-3 py-1 rounded border">Cancel</button>
                                <button
                                    onClick={submitUtensilsUpdate}
                                    disabled={
                                        updatingUtensils ||
                                        (() => {
                                            // disable if invalid
                                            if (!utensilsValue) return true;
                                            const n = Number(utensilsValue);
                                            if (!Number.isFinite(n)) return true;
                                            if (utensilsType === "fixed") {
                                                const intVal = Math.round(n);
                                                return intVal < 100 || intVal > 9999;
                                            } else {
                                                const pct = Math.round(n * 100) / 100;
                                                return pct < 0 || pct > 99.99;
                                            }
                                        })()
                                    }
                                    className={`px-3 py-1 rounded text-white ${updatingUtensils ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
                                >
                                    {updatingUtensils ? "Updating..." : "Update"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * PackageModal
 *
 * The existing PackageModal component code is preserved below (from your original file).
 * Note: It expects onSave(payload, id) to be provided by the parent.
 *
 * (Paste the original PackageModal implementation here.)
 *
 * -- For brevity in this answer, I include the PackageModal implementation unchanged
 *    as it was in your provided file above. If you moved it around earlier, ensure it's
 *    present in this file exactly as before.
 */

// (The original PackageModal implementation is already included above in your file — keep it as is.)

function PackageModal({ visible, pkg = null, saving, onClose, onSave, items = [], getAuthHeaders }) {
    const EVENT_TYPES = [
        "Weddings",
        "Parties",
        "Festivals",
        "Rituals",
        "Corporate Events",
        "Gatherings",
        "All"
    ];
    const sectionKeys = [
        { key: "starters", label: "Starters" },
        { key: "main_course", label: "Main Course" },
        { key: "rice", label: "Rice" },
        { key: "bread", label: "Bread" },
        { key: "dessert", label: "Dessert" },
        { key: "live_counter", label: "Live Counter" },
        { key: "drinks", label: "Drinks" },
    ];

    // map structured section -> legacy numeric field names (if present)
    const legacyMap = {
        starters: "starters_count",
        main_course: "mains_count",
        rice: "rice_count",
        bread: "bread_count",
        dessert: "dessert_count",
        drinks: "beverage_count",
        // live_counter: no legacy field
    };

    const [eligibleItems, setEligibleItems] = useState([]);
    const [showStructured, setShowStructured] = useState(false);
    const [eventTypesInvalid, setEventTypesInvalid] = useState(false);
    const [priceInvalid, setPriceInvalid] = useState(false);
    const [legacyCountsInvalid, setLegacyCountsInvalid] = useState(false);

    const [form, setForm] = useState({
        name: "",
        description: "",
        event_types: [],
        min_plates: 30,
        max_plates: 0, // 0 => no upper limit
        veg_only: false,
        price_per_plate: "",
        composition: "",
        is_active: true,
        // legacy explicit counts kept for backward compatibility (optional)
        starters_count: 0,
        mains_count: 0,
        rice_count: 0,
        bread_count: 0,
        dessert_count: 0,
        beverage_count: 0,
        // structured composition
        composition_structure: { sections: {} },
    });
    const toggleEventType = (type) => {
        setForm((prev) => {
            const set = new Set(prev.event_types || []);
            if (set.has(type)) set.delete(type);
            else set.add(type);
            return { ...prev, event_types: Array.from(set) };
        });
    };
    // Initialize form when modal opens or pkg changes
    useEffect(() => {
        if (!visible) return;

        if (pkg) {
            // If backend returned composition_structure as string, try to parse
            let cs = pkg.composition_structure ?? pkg.composition_struct ?? null;
            if (typeof cs === "string") {
                try {
                    cs = JSON.parse(cs);
                } catch {
                    cs = null;
                }
            }
            // Build default sections if not present
            const sections = cs?.sections ? { ...cs.sections } : {};
            // ensure sections exist for known keys
            sectionKeys.forEach(({ key }) => {
                if (!sections[key]) sections[key] = { count: 0, options: [] };
            });

            // Ensure structured section counts reflect legacy counts if present
            Object.entries(legacyMap).forEach(([sKey, legacyField]) => {
                const legacyVal = pkg[legacyField] ?? 0;
                if (legacyVal && sections[sKey]) {
                    sections[sKey].count = Number(legacyVal);
                }
            });

            setForm({
                name: pkg.name || "",
                description: pkg.description || "",
                event_types: pkg.event_types || [],
                min_plates: pkg.min_plates ?? 30,
                max_plates: pkg.max_plates ?? 0,
                veg_only: !!pkg.veg_only,
                price_per_plate: pkg.price_per_plate ?? "",
                composition: pkg.composition ?? "",
                is_active: pkg.is_active ?? true,
                starters_count: pkg.starters_count ?? 0,
                mains_count: pkg.mains_count ?? 0,
                rice_count: pkg.rice_count ?? 0,
                bread_count: pkg.bread_count ?? 0,
                dessert_count: pkg.dessert_count ?? 0,
                beverage_count: pkg.beverage_count ?? 0,
                composition_structure: { sections },
            });
        } else {
            // default empty structure with our sections
            const sections = {};
            sectionKeys.forEach(({ key }) => {
                sections[key] = { count: 0, options: [] };
            });
            setForm({
                name: "",
                description: "",
                event_types: [],
                min_plates: 30,
                max_plates: 0,
                veg_only: false,
                price_per_plate: "",
                composition: "",
                is_active: true,
                starters_count: 0,
                mains_count: 0,
                rice_count: 0,
                bread_count: 0,
                dessert_count: 0,
                beverage_count: 0,
                composition_structure: { sections },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, pkg]);

    // derive eligible items from parent-provided items prop (fallback fetch)
    useEffect(() => {
        if (!visible) return;

        // if items were passed in via prop, use them; else try to fetch
        if (Array.isArray(items) && items.length > 0) {
            const el = items.filter(i => i.add_to_package);
            setEligibleItems(el);
            return;
        }

        const fetchEligibleItems = async () => {
            try {
                const res = await axios.get("/api/caterers/me/menus/", {
                    params: { add_to_package: true },
                });

                setEligibleItems(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error("Error fetching eligible items", err);
            }
        };

        fetchEligibleItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, items]);

    const handleChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    // Section helpers
    const setSectionCount = (sectionKey, count) => {
        setForm((p) => {
            const newSections = {
                ...p.composition_structure,
                sections: {
                    ...p.composition_structure.sections,
                    [sectionKey]: {
                        ...(p.composition_structure.sections[sectionKey] || { options: [] }),
                        count: Number(count || 0),
                    },
                },
            };

            // Also keep legacy numeric field in sync if applicable
            const legacyField = legacyMap[sectionKey];
            const newState = { ...p, composition_structure: newSections };
            if (legacyField) {
                newState[legacyField] = Number(count || 0);
            }
            return newState;
        });
    };

    const addSectionOption = (sectionKey) => {
        setForm((p) => {
            const sec = p.composition_structure.sections[sectionKey] || { count: 0, options: [] };
            const currentOptions = sec.options || [];

            // no hard cap on options; only prevent duplicates
            const newOption = { name: "", required: false };
            return {
                ...p,
                composition_structure: {
                    ...p.composition_structure,
                    sections: {
                        ...p.composition_structure.sections,
                        [sectionKey]: { ...sec, options: [...currentOptions, newOption] },
                    },
                },
            };
        });
    };

    const updateSectionOption = (sectionKey, idx, key, value) => {
        setForm((p) => {
            const sec = p.composition_structure.sections[sectionKey] || { count: 0, options: [] };
            const options = sec.options || [];

            // enforce duplicate prevention on name change
            if (key === "name") {
                const normalized = String(value || "").trim().toLowerCase();
                if (normalized) {
                    const duplicate = options.some((o, i) => i !== idx && String(o.name || "").trim().toLowerCase() === normalized);
                    if (duplicate) {
                        window.alert("An option with the same name already exists in this section.");
                        return p;
                    }
                }
            }

            if (key === "required") {
                // Determine allowed mandatory limit:
                // If legacy count > 0 => allowed = legacy count
                // else if sec.count > 0 => allowed = sec.count
                // else allowed = Infinity
                const legacyField = legacyMap[sectionKey];
                const legacyVal = legacyField ? (p[legacyField] || 0) : 0;
                const allowedMandatory = legacyVal > 0 ? legacyVal : (sec.count && sec.count > 0 ? sec.count : Infinity);

                // compute new mandatory count after this change
                const newMandatory = options.reduce((acc, o, i) => {
                    if (i === idx) return acc + (value ? 1 : 0);
                    return acc + (o.required ? 1 : 0);
                }, 0);

                if (newMandatory > allowedMandatory) {
                    window.alert(`You can mark at most ${allowedMandatory} option(s) as mandatory for ${sectionKey.replace(/_/g, " ")}.`);
                    return p;
                }
            }

            const newOptions = options.map((opt, i) => (i === idx ? { ...opt, [key]: value } : opt));
            return {
                ...p,
                composition_structure: {
                    ...p.composition_structure,
                    sections: {
                        ...p.composition_structure.sections,
                        [sectionKey]: { ...sec, options: newOptions },
                    },
                },
            };
        });
    };

    const removeSectionOption = (sectionKey, idx) => {
        setForm((p) => {
            const sec = p.composition_structure.sections[sectionKey] || { count: 0, options: [] };
            const newOptions = (sec.options || []).filter((_, i) => i !== idx);
            return {
                ...p,
                composition_structure: {
                    ...p.composition_structure,
                    sections: {
                        ...p.composition_structure.sections,
                        [sectionKey]: { ...sec, options: newOptions },
                    },
                },
            };
        });
    };

    // estimated total helper
    const estimateTotalText = () => {
        const price = Number(form.price_per_plate || 0);
        const min = Number(form.min_plates || 0);
        const max = Number(form.max_plates || 0);
        if (!price || !min) return "";
        const minTotal = price * min;
        if (!max || max === 0) return `Estimate: ₹${minTotal} (for ${min}+ plates)`;
        const maxTotal = price * max;
        if (min === max) return `Estimate: ₹${minTotal} (for ${min} plates)`;
        return `Estimate: ₹${minTotal} - ₹${maxTotal} (${min} - ${max} plates)`;
    };

    const submit = async (e) => {
        e.preventDefault();
        setEventTypesInvalid(false);
        if (!form.event_types || form.event_types.length === 0) {
            setEventTypesInvalid(true);
            alert("Please select at least one event type.");
            try {
                const el = document.querySelector("[data-package-event-types]");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch { }
            return; // stop form submission
        }
        if (!form.price_per_plate || Number(form.price_per_plate) <= 0) {
            setPriceInvalid(true);
            alert("Please enter a valid 'Amount per plate' greater than 0.");
            try {
                const el = document.querySelector("[data-package-price]");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch { }
            return;
        }
        // Basic validation
        if (!form.name.trim()) return alert("Package name required");
        if (!form.min_plates || form.min_plates < 1) return alert("Min plates must be >= 1");
        if (form.max_plates && form.max_plates < form.min_plates) return alert("Max plates must be >= min plates or 0 for no limit");

        // New validation: ensure legacy counts are satisfied by number of options (if legacy > 0)
        const sections = form.composition_structure?.sections || {};
        for (const { key, label } of sectionKeys) {
            const sec = sections[key] || { count: 0, options: [] };
            const opts = sec.options || [];
            const legacyField = legacyMap[key];
            const legacyVal = legacyField ? Number(form[legacyField] || 0) : 0;

            // mandatory count must be <= legacyVal (if legacyVal > 0) else <= sec.count (if sec.count > 0)
            const mandatoryCount = opts.filter(o => o.required).length;
            if (legacyVal > 0) {
                if (mandatoryCount > legacyVal) {
                    return alert(`${label}: mandatory options (${mandatoryCount}) exceed legacy count (${legacyVal}).`);
                }
                // Also ensure there are at least legacyVal total options (user wants that many items to choose)
                if (opts.length < legacyVal) {
                    return alert(`${label}: must have at least ${legacyVal} option(s) to match the legacy ${legacyField}. Please add ${legacyVal - opts.length} more option(s).`);
                }
            } else if (sec.count && sec.count > 0) {
                if (mandatoryCount > sec.count) {
                    return alert(`${label}: mandatory options (${mandatoryCount}) exceed section count (${sec.count}).`);
                }
                // no minimum options required when legacyVal == 0 and sec.count > 0, we just enforce mandatory limit
            }
            // duplication checks already prevented at update time
        }
        // enforce at least one legacy count > 0
        const totalLegacyCount =
            Number(form.starters_count || 0) +
            Number(form.mains_count || 0) +
            Number(form.rice_count || 0) +
            Number(form.bread_count || 0) +
            Number(form.dessert_count || 0) +
            Number(form.beverage_count || 0);

        if (totalLegacyCount <= 0) {
            setLegacyCountsInvalid(true);
            alert("Please enter at least one legacy item count (e.g., Starters, Mains, etc.)");
            try {
                const el = document.querySelector("[data-legacy-section]");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch { }
            return;
        }
        // Prepare payload (convert empty strings to nulls)
        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            min_plates: Number(form.min_plates),
            max_plates: form.max_plates ? Number(form.max_plates) : 0,
            veg_only: !!form.veg_only,
            price_per_plate: form.price_per_plate ? Number(form.price_per_plate) : null,
            composition: form.composition.trim() || null,
            is_active: !!form.is_active,
            // legacy explicit counts
            starters_count: Number(form.starters_count) || 0,
            mains_count: Number(form.mains_count) || 0,
            rice_count: Number(form.rice_count) || 0,
            bread_count: Number(form.bread_count) || 0,
            dessert_count: Number(form.dessert_count) || 0,
            beverage_count: Number(form.beverage_count) || 0,
            // structured composition
            composition_structure: form.composition_structure,
            event_types: form.event_types,
        };

        try {
            await onSave(payload, pkg?.id ?? null);
        } catch (err) {
            console.error("PackageModal save error:", err);
        }
    };

    // derive eligible items by section from eligibleItems list
    const eligibleBySection = {};
    sectionKeys.forEach(({ key }) => {
        eligibleBySection[key] = (eligibleItems || []).filter(
            (it) => it.add_to_package && String(it.composition_type || "").toLowerCase() === String(key).toLowerCase()
        );
    });

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b">
                    <h3 className="text-base font-semibold">{pkg ? "Edit Package" : "Create Package"}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-lg">✕</button>
                </div>

                {/* Scrollable body */}
                <div className="px-4 py-3 overflow-y-auto flex-1 text-sm">
                    <form id="package-form" onSubmit={submit} className="space-y-3">
                        <div>
                            <label className="text-xs font-medium">Package name</label>
                            <input value={form.name} onChange={(e) => handleChange("name", e.target.value)} className="w-full border rounded-md p-1.5 text-sm" />
                        </div>

                        <div>
                            <label className="text-xs font-medium mb-1 block">
                                Event types <span className="text-red-600">*</span>
                            </label>

                            <div
                                className={`flex items-center gap-2 overflow-x-auto py-1 px-1 rounded-md border transition ${eventTypesInvalid ? "border-red-500 bg-red-50" : "border-gray-200"
                                    }`}
                            >
                                {EVENT_TYPES.map((t) => {
                                    const selected = (form.event_types || []).includes(t);
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => {
                                                toggleEventType(t);
                                                setEventTypesInvalid(false); // clear error once user selects something
                                            }}
                                            className={
                                                "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition " +
                                                (selected
                                                    ? "bg-indigo-600 text-white border-indigo-600"
                                                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
                                            }
                                            title={t}
                                        >
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>

                            {(form.event_types || []).length === 0 && eventTypesInvalid && (
                                <div className="text-xs text-red-600 mt-1">
                                    Please select at least one event type.
                                </div>
                            )}

                            <div className="mt-2 text-2xs text-gray-400">
                                Selected: {(form.event_types || []).join(", ") || "None"}
                            </div>
                        </div>

                        {/* Plates range */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium">Min plates</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.min_plates}
                                    onChange={(e) => handleChange("min_plates", Number(e.target.value))}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium">Max plates (0 = no limit)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.max_plates}
                                    onChange={(e) => handleChange("max_plates", Number(e.target.value))}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="grid grid-cols-2 gap-1"></div>
                        <div>
                            <label className="text-xs font-medium">Amount per plate</label>
                            <input
                                data-package-price
                                type="number"
                                min="0"
                                value={form.price_per_plate}
                                onChange={(e) => {
                                    handleChange("price_per_plate", e.target.value);
                                    setPriceInvalid(false); // clear error once user types
                                }}
                                className={`w-full border rounded-md p-1.5 text-sm ${priceInvalid ? "border-red-500 bg-red-50" : ""
                                    }`}
                            />
                            {/* Real-time estimate */}
                            <div className="text-xs text-gray-600 mt-1">{estimateTotalText()}</div>

                            {priceInvalid && (
                                <div className="text-xs text-red-600 mt-1">
                                    Please enter a valid amount per plate.
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-medium">Veg only?</label>
                            <div className="mt-1">
                                <label className="inline-flex items-center gap-2 mr-4">
                                    <input type="radio" name="veg_only" checked={form.veg_only === true} onChange={() => handleChange("veg_only", true)} />
                                    Pure Veg
                                </label>
                                <label className="inline-flex items-center gap-2">
                                    <input type="radio" name="veg_only" checked={form.veg_only === false} onChange={() => handleChange("veg_only", false)} />
                                    Veg & Non-Veg
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium">Composition (free text)</label>
                            <textarea value={form.composition} onChange={(e) => handleChange("composition", e.target.value)} className="w-full border rounded-md p-1.5 text-sm" rows={2} />
                        </div>

                        {/* NEW explicit counts (kept for backward compatibility) */}
                        <div
                            data-legacy-section
                            className={`grid grid-cols-3 gap-3 p-2 rounded-md border transition ${legacyCountsInvalid ? "border-red-500 bg-red-50" : "border-gray-200"
                                }`}
                        >
                            <div>
                                <label className="text-xs font-medium">Starters (legacy)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.starters_count}
                                    onChange={(e) => {
                                        handleChange("starters_count", Number(e.target.value));
                                        setLegacyCountsInvalid(false);
                                    }}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium">Mains (legacy)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.mains_count}
                                    onChange={(e) => {
                                        handleChange("mains_count", Number(e.target.value));
                                        setLegacyCountsInvalid(false);
                                    }}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium">Rice (legacy)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.rice_count}
                                    onChange={(e) => {
                                        handleChange("rice_count", Number(e.target.value));
                                        setLegacyCountsInvalid(false);
                                    }}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium">Bread (legacy)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.bread_count}
                                    onChange={(e) => {
                                        handleChange("bread_count", Number(e.target.value));
                                        setLegacyCountsInvalid(false);
                                    }}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium">Dessert (legacy)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.dessert_count}
                                    onChange={(e) => {
                                        handleChange("dessert_count", Number(e.target.value));
                                        setLegacyCountsInvalid(false);
                                    }}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium">Beverage (legacy)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.beverage_count}
                                    onChange={(e) => {
                                        handleChange("beverage_count", Number(e.target.value));
                                        setLegacyCountsInvalid(false);
                                    }}
                                    className="w-full border rounded-md p-1.5 text-sm"
                                />
                            </div>
                        </div>

                        {legacyCountsInvalid && (
                            <div className="text-xs text-red-600 mt-1">
                                Please enter at least one legacy item count.
                            </div>
                        )}

                        {/* Structured composition toggle */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowStructured(s => !s)}
                                className="text-xs text-indigo-600 hover:underline"
                            >
                                {showStructured ? "Hide Structured Composition" : "Edit Structured Composition"}
                            </button>
                        </div>

                        {/* === Structured composition UI (only shown when toggled) === */}
                        {showStructured && (
                            <div>
                                <h4 className="font-medium text-sm">Structured Composition</h4>
                                <p className="text-xs text-gray-500 mb-1">Define sections and options. Mark mandatory items. Options are unlimited; mandatory options are limited by legacy/section counts.</p>

                                <div className="space-y-3">
                                    {sectionKeys.map(({ key, label }) => {
                                        const sec = form.composition_structure.sections[key] || { count: 0, options: [] };

                                        // legacy mapped count if present
                                        const legacyField = legacyMap[key];
                                        const legacyVal = legacyField ? (form[legacyField] || 0) : 0;

                                        // displayed count: if legacyVal >0, show that (read-only), else show sec.count
                                        const displayCount = legacyVal > 0 ? legacyVal : (sec.count || 0);
                                        const readOnlyCount = legacyVal > 0;

                                        // calculate effective allowed mandatory
                                        const allowedMandatory = legacyVal > 0 ? legacyVal : (sec.count && sec.count > 0 ? sec.count : Infinity);
                                        const currentOptions = sec.options || [];
                                        const mandatoryCount = currentOptions.filter(o => o.required).length;

                                        return (
                                            <div key={key} className="border rounded-md p-2 bg-gray-50 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold">{label}</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={displayCount}
                                                        onChange={(e) => {
                                                            if (readOnlyCount) return;
                                                            const newCount = Number(e.target.value || 0);
                                                            setSectionCount(key, newCount);
                                                        }}
                                                        className={`w-16 border rounded-md p-1 text-sm ${readOnlyCount ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                                        readOnly={readOnlyCount}
                                                    />
                                                </div>

                                                <div className="mt-2 space-y-2">
                                                    {(currentOptions || []).map((opt, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Option (e.g. White Rice)"
                                                                value={opt.name}
                                                                onChange={(e) => updateSectionOption(key, idx, "name", e.target.value)}
                                                                className="flex-1 border rounded-md p-1 text-sm"
                                                            />
                                                            <label className="inline-flex items-center gap-1 text-xs">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!opt.required}
                                                                    onChange={(e) => updateSectionOption(key, idx, "required", e.target.checked)}
                                                                />
                                                                Mandatory
                                                            </label>
                                                            <button type="button" onClick={() => removeSectionOption(key, idx)} className="text-red-600 text-xs">Remove</button>
                                                        </div>
                                                    ))}

                                                    {/* Add from eligible items (only those matching composition_type) */}
                                                    {(eligibleBySection[key] || []).length > 0 && (
                                                        <div>
                                                            <div className="text-xs text-gray-600 mb-1">Add from menu:</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(eligibleBySection[key] || []).map((it) => {
                                                                    const already = currentOptions.some(o => String(o.name || "").trim().toLowerCase() === String(it.name || "").trim().toLowerCase());
                                                                    const disabled = already;
                                                                    return (
                                                                        <button
                                                                            key={it.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (already) return;
                                                                                // add item as option
                                                                                setForm((p) => {
                                                                                    const prevSec = p.composition_structure.sections[key] || { count: 0, options: [] };
                                                                                    return {
                                                                                        ...p,
                                                                                        composition_structure: {
                                                                                            ...p.composition_structure,
                                                                                            sections: {
                                                                                                ...p.composition_structure.sections,
                                                                                                [key]: {
                                                                                                    ...prevSec,
                                                                                                    options: [...(prevSec.options || []), { name: it.name, required: false }],
                                                                                                },
                                                                                            },
                                                                                        },
                                                                                    };
                                                                                });
                                                                            }}
                                                                            disabled={disabled}
                                                                            className={
                                                                                "text-xs px-2 py-1 rounded border " +
                                                                                (disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white hover:bg-indigo-50")
                                                                            }
                                                                        >
                                                                            {already ? `Added: ${it.name}` : `+ ${it.name}`}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                // duplication check and mandatory-limit enforced when marking required, not at add-time
                                                                addSectionOption(key);
                                                            }}
                                                            className="text-xs text-indigo-600 hover:underline"
                                                        >
                                                            + Add option
                                                        </button>
                                                        <div className="text-xs text-gray-400">
                                                            {`Options: ${(currentOptions || []).length}${legacyVal > 0 ? ` • legacy required: ${legacyVal}` : (sec.count ? ` • section count: ${sec.count}` : "")} • Mandatory: ${mandatoryCount}/${(allowedMandatory === Infinity ? "∞" : allowedMandatory)}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* end form fields - footer buttons are below */}
                    </form>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => handleChange("is_active", e.target.checked)} />
                        Active
                    </label>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="px-2 py-1 rounded border text-xs">Cancel</button>
                        <button type="submit" form="package-form" disabled={saving} className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs">
                            {saving ? "Saving..." : (pkg ? "Save Package" : "Create Package")}
                        </button>
                    </div>
                </div>
            </div >
        </div >
    );
}