// src/pages/TaxPage.jsx
import React, { useEffect, useState } from "react";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

function fmtPercent(p) {
  try {
    const n = Number(p);
    if (Number.isNaN(n)) return "";
    return n.toFixed(2);
  } catch (e) {
    return "";
  }
}

export default function TaxPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // currently active global config (or null)
  const [currentConfig, setCurrentConfig] = useState(null);
  // small history list for visibility (optional)
  const [recentConfigs, setRecentConfigs] = useState([]);

  // form state
  const [percent, setPercent] = useState("");
  const [active, setActive] = useState(true);

  // error
  const [error, setError] = useState("");

  // Load current global config (preferred endpoint) and a short history fallback
  const loadCurrent = async () => {
    setLoading(true);
    setError("");
    try {
      // Primary: /api/admin/tax/current/
      const resp = await axiosInstance.get("/api/admin/tax/current/");
      const cfg = resp?.data ?? null;
      if (cfg) {
        setCurrentConfig(cfg);
        setPercent(fmtPercent(cfg.percent));
        setActive(Boolean(cfg.active));
      } else {
        // fallback to listing if current endpoint returns unexpected shape
        await loadFromListFallback();
      }
    } catch (err) {
      // fallback to list endpoint if current not available
      await loadFromListFallback();
    } finally {
      setLoading(false);
    }
  };

  const loadFromListFallback = async () => {
    try {
      const listResp = await axiosInstance.get("/api/admin/tax-configs/?ordering=-effective_from,-created_at");
      const data = Array.isArray(listResp.data) ? listResp.data : listResp.data?.results || [];
      setRecentConfigs(data);
      // pick first active global config (caterer null) or the first entry
      const globalActive = (data || []).find((c) => (c.caterer === null || c.caterer === undefined) && c.active === true);
      const preferred = globalActive || (data.length > 0 ? data[0] : null);
      if (preferred) {
        setCurrentConfig(preferred);
        setPercent(fmtPercent(preferred.percent));
        setActive(Boolean(preferred.active));
      } else {
        setCurrentConfig(null);
        setPercent("");
        setActive(true);
      }
    } catch (err2) {
      console.error("Failed to load tax configs:", err2);
      setError("Failed to load tax configuration from server");
    }
  };

  useEffect(() => {
    loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePercent = (raw) => {
    if (raw === "" || raw === null) return "Percent is required";
    const n = Number(String(raw).trim());
    if (Number.isNaN(n)) return "Percent must be a number";
    if (n < 0) return "Percent cannot be negative";
    if (n > 1000) return "Percent seems too large";
    return null;
  };

  const handleSave = async (e) => {
    e && e.preventDefault();
    setError("");
    const vErr = validatePercent(percent);
    if (vErr) {
      setError(vErr);
      return;
    }

    const payload = {
      percent: String(Number(percent).toFixed(2)),
      active: Boolean(active),
    };

    setSaving(true);
    try {
      let resp = null;
      if (currentConfig && currentConfig.id) {
        // Update existing config
        resp = await axiosInstance.patch(`/api/admin/tax-configs/${currentConfig.id}/`, payload);
      } else {
        // Create a new global config (do not include caterer field to make it global)
        resp = await axiosInstance.post("/api/admin/tax-configs/", payload);
      }

      if (resp && (resp.status === 200 || resp.status === 201)) {
        toast.success("Tax updated");
        // reload current config to reflect the new active tax (try current endpoint first)
        try {
          const fresh = await axiosInstance.get("/api/admin/tax/current/");
          const cfg = fresh?.data ?? resp.data ?? null;
          if (cfg) {
            setCurrentConfig(cfg);
            setPercent(fmtPercent(cfg.percent));
            setActive(Boolean(cfg.active));
          } else {
            // fallback to list reload
            await loadFromListFallback();
          }
        } catch (err) {
          // fallback to list reload
          await loadFromListFallback();
        }
      } else {
        const msg = (resp && resp.data && (resp.data.error || resp.data.detail)) || "Save returned unexpected status";
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error("Save failed:", err);
      const msg = err?.response?.data?.detail || err?.response?.data?.error || JSON.stringify(err?.response?.data) || "Failed to save";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Display a compact UI: current tax then update form. No "New" button per request.
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Global Tax</h1>
          <p className="text-sm text-gray-600 mt-1">This tax applies globally to orders (base: subtotal + charges; utensils excluded).</p>
        </div>
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1 rounded-lg border bg-white text-sm">Back</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : (
          <>
            <div className="mb-4">
              <div className="text-sm text-gray-500">Current active tax</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">
                {currentConfig ? `${fmtPercent(currentConfig.percent)}%` : "—"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {currentConfig ? `ID: ${currentConfig.id ?? "—"} · Active: ${currentConfig.active ? "Yes" : "No"} · Effective: ${currentConfig.effective_from ?? "—"}` : "No global tax configured"}
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="text-sm text-gray-600">Tax percent (e.g. 5.00)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1000"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    placeholder="Enter tax percent"
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Active</label>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(Boolean(e.target.checked))}
                    className="h-5 w-5"
                  />
                </div>
              </div>

              {error && <div className="text-sm text-rose-600 mt-3">{String(error)}</div>}

              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg text-white ${saving ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {saving ? "Saving…" : "Update Tax"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    // refresh current config
                    loadCurrent();
                  }}
                  className="px-4 py-2 rounded-lg border bg-white"
                >
                  Refresh
                </button>
              </div>
            </form>

            <hr className="my-4" />

            <div>
              <h3 className="text-lg font-medium">Recent global tax configs</h3>
              <div className="mt-3 space-y-2 text-sm">
                {Array.isArray(recentConfigs) && recentConfigs.length > 0 ? (
                  recentConfigs
                    .filter((c) => c.caterer === null || c.caterer === undefined)
                    .slice(0, 10)
                    .map((c) => (
                      <div key={c.id} className="p-3 border rounded-lg flex items-center justify-between">
                        <div>
                          <div><strong>{fmtPercent(c.percent)}%</strong> {c.active ? <span className="text-xs ml-2 text-emerald-700">ACTIVE</span> : null}</div>
                          <div className="text-xs text-gray-500">id: {c.id} · effective_from: {c.effective_from ?? "—"}</div>
                        </div>
                        <div>
                          <button
                            onClick={() => {
                              // select this config for quick edit
                              setCurrentConfig(c);
                              setPercent(fmtPercent(c.percent));
                              setActive(Boolean(c.active));
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-3 py-1 rounded-lg border bg-white text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-sm text-gray-500">No history available.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}