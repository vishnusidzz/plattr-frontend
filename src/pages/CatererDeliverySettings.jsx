// src/pages/CatererDeliverySettings.jsx
import React, { useEffect, useState } from "react";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function CatererDeliverySettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [payload, setPayload] = useState({
        // platform read-only values (from GET)
        platform_delivery_per_km_rate: "",
        platform_delivery_base_fee: "",
        platform_max_delivery_fee: "",
        platform_max_delivery_distance: "",
        platform_free_delivery_threshold: "",

        // caterer overrides (writable)
        delivery_per_km_rate: "",
        max_delivery_distance: "",
        free_delivery_threshold: "",

        // meta
        caterer_id: null,
        updated_at: null,
    });

    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const res = await axiosInstance.get("/api/caterers/me/delivery-settings/");
                const data = res.data || {};
                if (!mounted) return;

                setPayload((p) => ({
                    ...p,
                    platform_delivery_per_km_rate: data.platform_delivery_per_km_rate ?? "",
                    platform_delivery_base_fee: data.platform_delivery_base_fee ?? "",
                    platform_max_delivery_fee: data.platform_max_delivery_fee ?? "",
                    platform_max_delivery_distance: data.platform_max_delivery_distance ?? "",
                    platform_free_delivery_threshold: data.platform_free_delivery_threshold ?? "",

                    delivery_per_km_rate: data.delivery_per_km_rate ?? "",
                    max_delivery_distance: data.max_delivery_distance ?? "",
                    free_delivery_threshold: data.free_delivery_threshold ?? "",

                    caterer_id: data.caterer_id ?? null,
                    updated_at: data.updated_at ?? null,
                }));
            } catch (err) {
                console.error("Failed to load caterer delivery settings", err);
                toast.error("Failed to load delivery settings");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setPayload((s) => ({ ...s, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Build request payload — send only overrides (as strings) per your API example
            const body = {
                delivery_per_km_rate: payload.delivery_per_km_rate === "" ? null : payload.delivery_per_km_rate,
                max_delivery_distance: payload.max_delivery_distance === "" ? null : payload.max_delivery_distance,
                free_delivery_threshold: payload.free_delivery_threshold === "" ? null : payload.free_delivery_threshold,
            };

            // Per your spec we use POST; if backend expects PATCH change to axiosInstance.patch
            const res = await axiosInstance.patch("/api/caterers/me/delivery-settings/", body);
            toast.success("Caterer delivery settings updated");

            // Update UI from response (backend returns combined platform + caterer payload)
            const data = res.data || {};
            setPayload((p) => ({
                ...p,
                platform_delivery_per_km_rate: data.platform_delivery_per_km_rate ?? p.platform_delivery_per_km_rate,
                platform_delivery_base_fee: data.platform_delivery_base_fee ?? p.platform_delivery_base_fee,
                platform_max_delivery_fee: data.platform_max_delivery_fee ?? p.platform_max_delivery_fee,
                platform_max_delivery_distance: data.platform_max_delivery_distance ?? p.platform_max_delivery_distance,
                platform_free_delivery_threshold: data.platform_free_delivery_threshold ?? p.platform_free_delivery_threshold,

                delivery_per_km_rate: data.delivery_per_km_rate ?? null,
                max_delivery_distance: data.max_delivery_distance ?? null,
                free_delivery_threshold: data.free_delivery_threshold ?? null,

                caterer_id: data.caterer_id ?? p.caterer_id,
                updated_at: data.updated_at ?? p.updated_at,
            }));
        } catch (err) {
            console.error("Save error", err);
            const msg = err?.response?.data?.detail || "Failed to save caterer settings";
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    // small helper to display number or placeholder
    const show = (v) => (v === null || v === undefined || v === "" ? "—" : v);

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">Caterer Delivery Settings</h1>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm"
                    >
                        Back
                    </button>
                </div>
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <>
                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded">
                            <div className="text-xs text-gray-500 mb-1">Platform rate (read-only)</div>
                            <div className="text-lg font-medium">{show(payload.platform_delivery_per_km_rate)}</div>
                            <div className="text-xs text-gray-400 mt-1">per km</div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded">
                            <div className="text-xs text-gray-500 mb-1">Platform base fee</div>
                            <div className="text-lg font-medium">{show(payload.platform_delivery_base_fee)}</div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded">
                            <div className="text-xs text-gray-500 mb-1">Platform max fee (cap)</div>
                            <div className="text-lg font-medium">{show(payload.platform_max_delivery_fee)}</div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded">
                            <div className="text-xs text-gray-500 mb-1">Platform max distance (km)</div>
                            <div className="text-lg font-medium">{show(payload.platform_max_delivery_distance)}</div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded col-span-1 sm:col-span-2">
                            <div className="text-xs text-gray-500 mb-1">Platform free delivery threshold</div>
                            <div className="text-lg font-medium">{show(payload.platform_free_delivery_threshold)}</div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Delivery per km rate (override)</label>
                            <input
                                name="delivery_per_km_rate"
                                value={payload.delivery_per_km_rate ?? ""}
                                onChange={handleChange}
                                placeholder={payload.platform_delivery_per_km_rate || "e.g. 6.00"}
                                className="mt-1 block w-full rounded-md border px-3 py-2"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave empty to use platform default ({payload.platform_delivery_per_km_rate || "—"}).
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium">Max delivery distance (km) (override)</label>
                            <input
                                name="max_delivery_distance"
                                value={payload.max_delivery_distance ?? ""}
                                placeholder={payload.platform_max_delivery_distance || "e.g. 25.00"}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium">Free delivery threshold (subtotal) (override)</label>
                            <input
                                name="free_delivery_threshold"
                                value={payload.free_delivery_threshold ?? ""}
                                onChange={handleChange}
                                placeholder={payload.platform_free_delivery_threshold || "e.g. 1000.00"}
                                className="mt-1 block w-full rounded-md border px-3 py-2"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {saving ? "Saving..." : "Save Overrides"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    // reload to discard local changes
                                    setLoading(true);
                                    axiosInstance
                                        .get("/api/caterers/me/delivery-settings/")
                                        .then((res) => {
                                            const d = res.data || {};
                                            setPayload((p) => ({
                                                ...p,
                                                platform_delivery_per_km_rate: d.platform_delivery_per_km_rate ?? p.platform_delivery_per_km_rate,
                                                platform_delivery_base_fee: d.platform_delivery_base_fee ?? p.platform_delivery_base_fee,
                                                platform_max_delivery_fee: d.platform_max_delivery_fee ?? p.platform_max_delivery_fee,
                                                platform_max_delivery_distance: d.platform_max_delivery_distance ?? p.platform_max_delivery_distance,
                                                platform_free_delivery_threshold: d.platform_free_delivery_threshold ?? p.platform_free_delivery_threshold,
                                                delivery_per_km_rate: d.delivery_per_km_rate ?? "",
                                                max_delivery_distance: d.max_delivery_distance ?? "",
                                                free_delivery_threshold: d.free_delivery_threshold ?? "",
                                                caterer_id: d.caterer_id ?? p.caterer_id,
                                                updated_at: d.updated_at ?? p.updated_at,
                                            }));
                                        })
                                        .catch((err) => {
                                            console.error(err);
                                            toast.error("Failed to reload settings");
                                        })
                                        .finally(() => setLoading(false));
                                }}
                                className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
                            >
                                Reset
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-sm text-gray-600">
                        <div>Caterer ID: <strong>{payload.caterer_id ?? "—"}</strong></div>
                        <div>Last updated: <strong>{payload.updated_at ?? "—"}</strong></div>
                    </div>

                    <div className="mt-6">
                        <h3 className="text-base font-semibold mb-3">Example: How your settings affect delivery charges</h3>
                        <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                            Let’s take a simple example so you can understand how these values impact your customer’s delivery cost.
                        </p>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-medium text-gray-800 mb-2">Example Scenario</h4>
                            <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1">
                                <li>You set <strong>₹20.00 per km</strong> as your delivery rate.</li>
                                <li>Your <strong>base fee</strong> (from platform) is ₹50.00 — it’s automatically added.</li>
                                <li>You set <strong>maximum delivery distance</strong> to 20 km.</li>
                                <li>You offer <strong>free delivery</strong> for orders above ₹5000.00.</li>
                            </ul>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="bg-white rounded-md shadow-sm border p-4">
                                <h5 className="text-sm font-medium text-gray-800 mb-2">Case 1 — Short distance</h5>
                                <p className="text-sm text-gray-700">
                                    🏠 <strong>Customer is 3 km away</strong> and their subtotal is ₹1200.
                                    <br />
                                    Delivery fee = ₹50 (base) + (₹20 × 3 km) = <strong>₹110 total</strong>.
                                </p>
                            </div>

                            <div className="bg-white rounded-md shadow-sm border p-4">
                                <h5 className="text-sm font-medium text-gray-800 mb-2">Case 2 — Long distance within limit</h5>
                                <p className="text-sm text-gray-700">
                                    🚗 <strong>Customer is 10 km away</strong> and subtotal is ₹2500.
                                    <br />
                                    Delivery fee = ₹50 + (₹20 × 10) = <strong>₹250 total</strong>.
                                </p>
                            </div>

                            <div className="bg-white rounded-md shadow-sm border p-4">
                                <h5 className="text-sm font-medium text-gray-800 mb-2">Case 3 — Very long distance</h5>
                                <p className="text-sm text-gray-700">
                                    📦 <strong>Customer is 22 km away</strong>.
                                    <br />
                                    ❌ Since your max distance is 20 km, <strong>delivery not available</strong> for that location.
                                </p>
                            </div>

                            <div className="bg-white rounded-md shadow-sm border p-4">
                                <h5 className="text-sm font-medium text-gray-800 mb-2">Case 4 — Free delivery</h5>
                                <p className="text-sm text-gray-700">
                                    🎉 <strong>Customer order total is ₹6000</strong>.
                                    <br />
                                    ✅ Since subtotal exceeds ₹5000, <strong>delivery is free</strong>.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 text-sm text-gray-600 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            💡 <strong>Tip for Caterers:</strong>
                            <br />
                            Set realistic values based on your local area and fuel costs. A slightly higher per-km rate can help cover fuel and time if you deliver far away,
                            while a reasonable free delivery threshold encourages customers to order more.
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}