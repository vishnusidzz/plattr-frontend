// src/pages/CommissionConfigPage.jsx
import React, { useEffect, useState } from "react";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";

/**
 * CommissionConfigPage
 *
 * - apiBase: POST/GET base for creating commission configs (default "/api/admin/commissions/")
 * - applyApi: GET for summary and POST to apply/recalc (default "/api/admin/apply-commission/")
 *
 * NOTE: Backend must already provide:
 *  - POST /api/admin/commissions/  (create config; accepts { percent, caterer, active, effective_from?, recalc?, recalc_scope? })
 *  - GET  /api/admin/apply-commission/ (returns summary like { previous: { percent, effective_from }, current: { percent, effective_from } })
 *  - POST /api/admin/apply-commission/ (optional; used when recalc requested directly)
 */
const CommissionConfigPage = ({
    apiBase = "/api/admin/commissions/",
    applyApi = "/api/admin/apply-commission/",
}) => {
    const [loading, setLoading] = useState(false);
    const [configs, setConfigs] = useState([]);
    const [globalPercent, setGlobalPercent] = useState("");
    const [catererOverrides, setCatererOverrides] = useState([]);
    const [saving, setSaving] = useState(false);
    const [recalcNow, setRecalcNow] = useState(false);
    const [recalcScope, setRecalcScope] = useState("non_final"); // "non_final" or "all"
    const [editingCatererId, setEditingCatererId] = useState(null);
    const [editingPercent, setEditingPercent] = useState("");
    const [summary, setSummary] = useState(null); // { previous: {...}, current: {...} }

    useEffect(() => {
        fetchConfigs();
        fetchSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // load list of configs (for history + overrides)
    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(apiBase);
            const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
            setConfigs(data || []);

            // determine active global (caterer === null)
            const activeGlobal = (data || []).find((c) => c.caterer === null && c.active);
            setGlobalPercent(activeGlobal ? String(activeGlobal.percent) : "");

            // caterer-specific overrides
            const overrides = (data || []).filter((c) => c.caterer !== null);
            setCatererOverrides(overrides);
        } catch (err) {
            console.error("Failed to load commission configs", err);
            toast.error("Failed to load commission configs");
        } finally {
            setLoading(false);
        }
    };

    // fetch summary (previous/current) from applyApi GET
    const fetchSummary = async () => {
        try {
            const res = await axiosInstance.get(applyApi);
            // expected: { previous: {...}, current: {...} } or similar
            setSummary(res.data);
        } catch (err) {
            // it's okay if summary endpoint isn't implemented; show a non-fatal message
            console.warn("Failed to fetch commission summary", err);
            setSummary(null);
        }
    };

    const formatToIST = (isoString) => {
        if (!isoString) return "Immediate";
        try {
            const d = new Date(isoString);
            // format in India timezone
            return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        } catch (e) {
            return isoString;
        }
    };

    const handleSaveGlobal = async () => {
        if (globalPercent === "" || Number.isNaN(Number(globalPercent))) {
            toast.warn("Enter a valid percent");
            return;
        }
        setSaving(true);
        try {
            const body = {
                percent: String(globalPercent),
                caterer: null,
                active: true,
            };
            // include recalc fields if requested
            if (recalcNow) {
                body.recalc = true;
                body.recalc_scope = recalcScope;
            }

            await axiosInstance.post(apiBase, body);
            toast.success("Global commission saved.");

            // if backend doesn't handle recalc inside POST, call applyApi POST as fallback
            if (recalcNow) {
                try {
                    await axiosInstance.post(applyApi, { percent: String(globalPercent), caterer: null });
                } catch (e) {
                    // ignore — we already tried to request recalc via POST to commissions
                }
            }

            await fetchConfigs();
            await fetchSummary();
            window.dispatchEvent(new CustomEvent("commissionApplied", { detail: { caterer: null, percent: String(globalPercent) } }));
        } catch (err) {
            console.error("Save global config failed", err);
            const msg = (err && err.response && err.response.data && (err.response.data.detail || JSON.stringify(err.response.data))) || err.message;
            toast.error("Save failed: " + msg);
        } finally {
            setSaving(false);
        }
    };

    const handleEditOverride = (override) => {
        setEditingCatererId(override.caterer);
        setEditingPercent(String(override.percent));
    };

    const handleSaveOverride = async () => {
        if (editingPercent === "" || Number.isNaN(Number(editingPercent))) {
            toast.warn("Enter a valid percent");
            return;
        }
        setSaving(true);
        try {
            const body = {
                percent: String(editingPercent),
                caterer: editingCatererId,
                active: true,
            };
            if (recalcNow) {
                body.recalc = true;
                body.recalc_scope = recalcScope;
            }

            await axiosInstance.post(apiBase, body);
            toast.success("Caterer override saved.");

            if (recalcNow) {
                try {
                    await axiosInstance.post(applyApi, { percent: String(editingPercent), caterer: editingCatererId });
                } catch (e) { /* noop */ }
            }

            await fetchConfigs();
            await fetchSummary();
            window.dispatchEvent(new CustomEvent("commissionApplied", { detail: { caterer: editingCatererId, percent: String(editingPercent) } }));

            // clear editing
            setEditingCatererId(null);
            setEditingPercent("");
        } catch (err) {
            console.error("Save override failed", err);
            const msg = (err && err.response && err.response.data && (err.response.data.detail || JSON.stringify(err.response.data))) || err.message;
            toast.error("Save failed: " + msg);
        } finally {
            setSaving(false);
        }
    };

    const doApplyNow = async ({ percent, caterer }) => {
        // call applyApi POST to recalc (if backend requires separate call)
        try {
            const payload = {
                percent: percent,
                caterer: caterer || undefined,
                recalc: true,
                recalc_scope: recalcScope,
            };
            const res = await axiosInstance.post(applyApi, payload);
            const applied = res.data && res.data.applied;
            toast.success(`Recalc requested. Applied to ${Array.isArray(applied) ? applied.length : (applied ? 1 : 0)} order(s).`);
            await fetchSummary();
            return res.data;
        } catch (err) {
            console.error("Apply commission API failed", err);
            const msg = (err && err.response && err.response.data && (err.response.data.detail || JSON.stringify(err.response.data))) || err.message;
            toast.error("Recalc failed: " + msg);
            throw err;
        }
    };

    const prettyList = (arr) =>
        arr && arr.length ? (
            <ul className="list-disc pl-5 space-y-1">
                {arr.map((it) => (
                    <li key={it.id || Math.random()}>
                        {it.caterer ? `Caterer ${String(it.caterer)}: ${it.percent}% (${it.active ? "active" : "inactive"})` : `GLOBAL: ${it.percent}% (${it.active ? "active" : "inactive"})`}
                    </li>
                ))}
            </ul>
        ) : (
            <div className="text-sm text-gray-500">No configs</div>
        );

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-4">Commission Configuration</h1>

            {/* Summary card (previous/current) */}
            <div className="bg-white rounded shadow p-5 mb-6">
                <h2 className="text-lg font-medium mb-2">Summary</h2>
                {summary ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <div className="text-sm text-gray-500">Previous Percent</div>
                            <div className="text-lg font-semibold">{summary.previous ? String(summary.previous.percent) + "%" : "—"}</div>
                        </div>

                        <div>
                            <div className="text-sm text-gray-500">Current Percent</div>
                            <div className="text-lg font-semibold">{summary.current ? String(summary.current.percent) + "%" : "—"}</div>
                        </div>

                        <div>
                            <div className="text-sm text-gray-500">Effective From (IST)</div>
                            <div className="text-lg font-semibold">
                                {summary.current && summary.current.effective_from
                                    ? formatToIST(summary.current.effective_from)
                                    : "Immediate"}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-600">No summary available. You can edit global commission below.</div>
                )}
            </div>

            {/* Global config card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="inline-block w-2 h-6 bg-blue-500 rounded"></span>
                    Active Global Commission
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-end gap-5">
                    {/* Percent input */}
                    <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1">Percent (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={globalPercent}
                            onChange={(e) => setGlobalPercent(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="e.g. 10.00"
                        />
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-4">
                        {recalcNow && (
                            <div>
                                <label className="sr-only">Recalculate Scope</label>
                                <select
                                    value={recalcScope}
                                    onChange={(e) => setRecalcScope(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                >
                                    <option value="non_final">Non-final orders only</option>
                                    <option value="all">All orders</option>
                                </select>
                            </div>
                        )}

                        {/* Apply Now Button */}
                        {summary && (
                            <button
                                onClick={async () => {
                                    if (!globalPercent) {
                                        toast.warn("Enter a percent first");
                                        return;
                                    }
                                    try {
                                        setSaving(true);
                                        await doApplyNow({ percent: String(globalPercent), caterer: null });
                                    } catch (e) {
                                        /* noop */
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-md shadow hover:from-blue-700 hover:to-blue-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                Apply Now
                            </button>
                        )}
                    </div>
                </div>

                {/* Divider line */}
                <div className="my-5 border-t border-gray-200"></div>

                {/* Config list */}
                <div className="text-sm text-gray-600">
                    <p className="font-medium mb-2">Active & Previous Configs:</p>
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                        {prettyList(configs)}
                    </div>
                </div>
            </div>

            {/* Caterer overrides */}
            <div className="bg-white rounded shadow p-5">
                <h2 className="text-lg font-medium mb-3">Caterer Overrides</h2>

                <div className="space-y-3">
                    {catererOverrides.length === 0 ? (
                        <div className="text-sm text-gray-500">No caterer-specific overrides found.</div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-left text-xs text-gray-600 border-b">
                                    <th className="py-2">Caterer</th>
                                    <th className="py-2">Percent</th>
                                    <th className="py-2">Active</th>
                                    <th className="py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catererOverrides.map((ov) => (
                                    <tr key={`${ov.caterer}-${ov.id}`} className="border-b">
                                        <td className="py-2">{ov.caterer_name || `#${ov.caterer}`}</td>
                                        <td className="py-2">{String(ov.percent)}</td>
                                        <td className="py-2">{ov.active ? "Yes" : "No"}</td>
                                        <td className="py-2">
                                            <button
                                                onClick={() => handleEditOverride(ov)}
                                                className="px-3 py-1 bg-yellow-400 rounded text-sm mr-2"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        setSaving(true);
                                                        await axiosInstance.post(apiBase, { percent: ov.percent, caterer: ov.caterer, active: true });
                                                        toast.success("Override refreshed.");
                                                        if (recalcNow) await doApplyNow({ percent: ov.percent, caterer: ov.caterer });
                                                        await fetchConfigs();
                                                        await fetchSummary();
                                                    } catch (err) {
                                                        console.error(err);
                                                        toast.error("Failed to refresh override");
                                                    } finally {
                                                        setSaving(false);
                                                    }
                                                }}
                                                className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                                            >
                                                Activate
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Edit override form */}
                {editingCatererId && (
                    <div className="mt-4 p-3 border rounded bg-gray-50">
                        <h3 className="font-medium mb-2">Edit Override for Caterer #{editingCatererId}</h3>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                step="0.01"
                                value={editingPercent}
                                onChange={(e) => setEditingPercent(e.target.value)}
                                className="px-3 py-2 border rounded w-36"
                            />
                            <button onClick={handleSaveOverride} disabled={saving} className="px-3 py-2 bg-green-600 text-white rounded">
                                {saving ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => { setEditingCatererId(null); setEditingPercent(""); }} className="px-3 py-2 bg-gray-200 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommissionConfigPage;