// src/pages/AdminDeliverySettings.jsx
import React, { useState, useEffect, useMemo } from "react";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";

/**
 * AdminDeliverySettings
 * - Loads /api/admin/platform-settings/
 * - PATCHes back only changed values (sends null for empty fields)
 * - Shows example calculations for 2km and 10km
 */
export default function AdminDeliverySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    delivery_per_km_rate: "",
    delivery_base_fee: "",
    max_delivery_fee: "",
    max_delivery_distance: "",
    free_delivery_threshold: "",
  });

  // keep a pristine copy to detect "changed" state
  const [initial, setInitial] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchSettings = async () => {
      try {
        const res = await axiosInstance.get("/api/admin/platform-settings/");
        const data = res.data || {};
        if (!mounted) return;
        const next = {
          delivery_per_km_rate: data.delivery_per_km_rate ?? "",
          delivery_base_fee: data.delivery_base_fee ?? "",
          max_delivery_fee: data.max_delivery_fee ?? "",
          max_delivery_distance: data.max_delivery_distance ?? "",
          free_delivery_threshold: data.free_delivery_threshold ?? "",
        };
        setForm(next);
        setInitial(next);
      } catch (err) {
        console.error("Failed to load platform settings:", err);
        toast.error("Failed to load platform delivery settings");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // keep strings in form; we will format/send on submit
    setForm((s) => ({ ...s, [name]: value }));
  };

  const isDirty = useMemo(() => {
    if (!initial) return true;
    return (
      String((initial.delivery_per_km_rate ?? "") || "") !== String(form.delivery_per_km_rate || "") ||
      String((initial.delivery_base_fee ?? "") || "") !== String(form.delivery_base_fee || "") ||
      String((initial.max_delivery_fee ?? "") || "") !== String(form.max_delivery_fee || "") ||
      String((initial.max_delivery_distance ?? "") || "") !== String(form.max_delivery_distance || "") ||
      String((initial.free_delivery_threshold ?? "") || "") !== String(form.free_delivery_threshold || "")
    );
  }, [form, initial]);

  // Helper to coerce a form field into backend-friendly decimal string or null
  const formatForBackend = (val) => {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s === "") return null;
    // Try to parse as number; if invalid, return the raw trimmed string (backend will validate)
    const n = Number(s);
    if (Number.isFinite(n)) {
      // Keep two decimal places as string (matches backend decimal expectations)
      return n.toFixed(2);
    }
    return s;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isDirty) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        delivery_per_km_rate: formatForBackend(form.delivery_per_km_rate),
        delivery_base_fee: formatForBackend(form.delivery_base_fee),
        max_delivery_fee: formatForBackend(form.max_delivery_fee),
        max_delivery_distance: formatForBackend(form.max_delivery_distance),
        free_delivery_threshold: formatForBackend(form.free_delivery_threshold),
      };

      const res = await axiosInstance.patch("/api/admin/platform-settings/", payload);
      toast.success("Platform delivery settings saved");
      if (res?.data) {
        const updated = {
          delivery_per_km_rate: res.data.delivery_per_km_rate ?? "",
          delivery_base_fee: res.data.delivery_base_fee ?? "",
          max_delivery_fee: res.data.max_delivery_fee ?? "",
          max_delivery_distance: res.data.max_delivery_distance ?? "",
          free_delivery_threshold: res.data.free_delivery_threshold ?? "",
        };
        setForm(updated);
        setInitial(updated);
      }
    } catch (err) {
      console.error("Save error:", err);
      const message =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save settings");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Platform Delivery Settings</h1>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Delivery per km rate</label>
            <input
              name="delivery_per_km_rate"
              value={form.delivery_per_km_rate}
              onChange={handleChange}
              placeholder="e.g. 6.00"
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Delivery base fee</label>
            <input
              name="delivery_base_fee"
              value={form.delivery_base_fee}
              onChange={handleChange}
              placeholder="e.g. 50.00"
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Max delivery fee (cap)</label>
            <input
              name="max_delivery_fee"
              value={form.max_delivery_fee}
              onChange={handleChange}
              placeholder="e.g. 500.00"
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Max delivery distance (km)</label>
            <input
              name="max_delivery_distance"
              value={form.max_delivery_distance}
              onChange={handleChange}
              placeholder="e.g. 25.00"
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Free delivery threshold (subtotal)</label>
            <input
              name="free_delivery_threshold"
              value={form.free_delivery_threshold}
              onChange={handleChange}
              placeholder="e.g. 1000.00"
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !isDirty}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (initial) setForm(initial);
                else window.location.reload();
              }}
              className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              Reset
            </button>
          </div>
        </form>
      )}

      {/* Example calculation preview */}
      {!loading && (
        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">Example Delivery Fee Calculation</h2>
          <p className="text-sm text-gray-600 mb-3">These are approximate fees calculated based on your current settings.</p>

          <ExampleRow label="For 2 km distance (₹500 subtotal)" form={form} distance={2} subtotal={500} />
          <ExampleRow label="For 10 km distance (₹2500 subtotal)" form={form} distance={10} subtotal={2500} />

          {/* Optional: interactive test inputs */}
          <InteractiveTest form={form} />
        </div>
      )}
    </div>
  );
}

/**
 * Small helper component for preview rows
 */
function ExampleRow({ label, form, distance, subtotal }) {
  const fee = computeFeeExample(form, distance, subtotal);
  return (
    <div className="flex justify-between bg-gray-50 rounded-md px-4 py-2 mb-2 text-sm">
      <span>{label}</span>
      <span className="font-medium">{fee === null ? "Not Deliverable" : `₹${fee.toFixed(2)}`}</span>
    </div>
  );
}

/**
 * Simple fee calculation (client-side mirror of backend logic)
 */
function computeFeeExample(form, distance, subtotal) {
  const perKm = parseFloat(form.delivery_per_km_rate) || 0;
  const base = parseFloat(form.delivery_base_fee) || 0;
  const maxFee = isFinite(Number(form.max_delivery_fee)) ? parseFloat(form.max_delivery_fee) : Infinity;
  const maxDist = isFinite(Number(form.max_delivery_distance)) ? parseFloat(form.max_delivery_distance) : Infinity;
  const freeThreshold = isFinite(Number(form.free_delivery_threshold)) ? parseFloat(form.free_delivery_threshold) : Infinity;

  if (distance > maxDist) return null; // Out of delivery range
  if (subtotal >= freeThreshold) return 0; // Free delivery

  const fee = Math.min(base + perKm * distance, maxFee);
  return Number.isFinite(fee) ? fee : 0;
}

/**
 * Optional small interactive test area (admins can input any distance/subtotal)
 */
function InteractiveTest({ form }) {
  const [distance, setDistance] = useState(5);
  const [subtotal, setSubtotal] = useState(1000);

  const fee = computeFeeExample(form, Number(distance), Number(subtotal));

  return (
    <div className="mt-4 p-4 bg-white rounded-md shadow-sm">
      <h3 className="text-sm font-medium mb-2">Test custom distance/subtotal</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600">Distance (km)</label>
          <input
            type="number"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Subtotal (₹)</label>
          <input
            type="number"
            step="0.01"
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <div className="text-sm text-gray-600">Result</div>
          <div className="mt-1 font-medium text-lg">{fee === null ? "Not Deliverable" : `₹${fee.toFixed(2)}`}</div>
        </div>
      </div>
    </div>
  );
}