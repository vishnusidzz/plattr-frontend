// src/pages/StaffSettings.jsx
import React, { useState, useEffect } from "react";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function StaffSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    staff_charge_to_serve: "",
    staff_available: false,
    staff_charge_free_above: "", // NEW: waive staff charge when order total >= this
  });
  const [meta, setMeta] = useState({
    updated_at: null,
  });

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await axiosInstance.get("/api/caterers/me/staff-charge/");
        const data = res.data || {};
        if (!mounted) return;

        // ✅ Define hasStaffCharge before using it
        const hasStaffCharge =
          data.staff_charge_to_serve !== null &&
          data.staff_charge_to_serve !== "" &&
          data.staff_charge_to_serve !== undefined;

        setForm({
          staff_charge_to_serve: data.staff_charge_to_serve ?? "",
          // Only allow staff_available true if valid charge exists
          staff_available: Boolean(data.staff_available) && hasStaffCharge,
          staff_charge_free_above: data.staff_charge_free_above ?? "",
        });
        setMeta({
          updated_at: data.updated_at ?? null,
        });
      } catch (err) {
        console.error("Failed to load staff settings:", err);
        toast.error("Failed to load staff settings");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetch();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setForm((s) => ({ ...s, [name]: checked }));
    } else {
      let val = value;

      // ✅ Restrict numeric input for money fields
      if (name === "staff_charge_to_serve" || name === "staff_charge_free_above") {
        // Allow only digits and one decimal point
        val = val.replace(/[^0-9.]/g, "");

        // Prevent multiple dots (e.g., "12.3.4" → "12.34")
        const parts = val.split(".");
        if (parts.length > 2) {
          val = parts[0] + "." + parts.slice(1).join("");
        }

        // Optionally: prevent leading zeros like "0005" → "5"
        if (val.startsWith("00")) {
          val = val.replace(/^0+/, "0");
        }
      }

      setForm((s) => ({ ...s, [name]: val }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // server expects decimals as strings; allow null if empty
      const payload = {
        staff_charge_to_serve:
          form.staff_charge_to_serve === "" ? null : String(form.staff_charge_to_serve),
        // ensure we don't send true if there's no staff charge
        staff_available: !!form.staff_available && form.staff_charge_to_serve !== "" && form.staff_charge_to_serve !== null,
        staff_charge_free_above:
          form.staff_charge_free_above === "" ? null : String(form.staff_charge_free_above),
      };

      const res = await axiosInstance.patch("/api/caterers/me/staff-charge/", payload);
      toast.success("Staff settings saved");
      if (res.data) {
        setForm({
          staff_charge_to_serve: res.data.staff_charge_to_serve ?? "",
          staff_available: Boolean(res.data.staff_available),
          staff_charge_free_above: res.data.staff_charge_free_above ?? "",
        });
        setMeta({
          updated_at: res.data.updated_at ?? meta.updated_at,
        });
      }
    } catch (err) {
      console.error("Save error:", err);
      const message = err?.response?.data?.detail || "Failed to save staff settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Staff Settings</h1>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-fit px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm"
        >
          ← Back
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white rounded-xl shadow-sm border p-4 sm:p-6"
        >
          {/* Staff charge */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Staff charge (flat per order)
            </label>
            <input
              name="staff_charge_to_serve"
              value={form.staff_charge_to_serve}
              onChange={handleChange}
              placeholder="e.g. 300.00"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              inputMode="decimal"
            />
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              One-time <strong>flat fee per order</strong> for staff service.
              Not charged per plate.
            </p>
          </div>

          {/* Waiver */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Waive staff charge above order total (optional)
            </label>
            <input
              name="staff_charge_free_above"
              value={form.staff_charge_free_above}
              onChange={handleChange}
              placeholder="e.g. 5000.00"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              inputMode="decimal"
            />
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              Orders with total <strong>≥ this amount</strong> will not be charged
              the staff fee. Leave empty to disable.
            </p>
          </div>

          {/* Toggle + meta */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t pt-4">
            {/* Toggle */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="staff_available"
                  name="staff_available"
                  type="checkbox"
                  checked={form.staff_available}
                  onChange={handleChange}
                  className="sr-only"
                  disabled={!form.staff_charge_to_serve}
                />
                <div
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${form.staff_available ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${form.staff_available ? "translate-x-6" : "translate-x-0"
                      }`}
                  />
                </div>
              </label>

              <div className="text-sm">
                <div className="font-medium text-gray-800">
                  {form.staff_available ? "Staff available" : "Staff not available"}
                </div>
                {!form.staff_charge_to_serve && (
                  <div className="text-xs text-red-500">
                    Enter staff charge to enable
                  </div>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="text-xs text-gray-600">
              <div className="font-medium">Last updated</div>
              <div>
                {meta.updated_at
                  ? new Date(meta.updated_at).toLocaleString()
                  : "Not yet configured"}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              Reset
            </button>
          </div>

          {/* Explanation */}
          <div className="mt-6 space-y-3 text-sm text-gray-700">
            <p className="font-semibold">How customers see this</p>

            <p className="text-gray-600">
              When staff is enabled, customers can choose staff during checkout.
              The amount is charged as a <strong>single flat fee per order</strong>.
            </p>

            <p className="text-gray-600">
              <strong>Example:</strong> Staff ₹300 + Delivery ₹50 →
              <strong> Additional fees ₹350</strong>
            </p>

            <p className="text-gray-600">
              <strong>Waiver example:</strong> If waiver is set at ₹5,000 and order
              total is ₹5,200, staff charge is <strong>automatically waived</strong>.
            </p>

            <p className="text-xs text-gray-500">
              Staff and delivery charges are always shown separately to customers
              during checkout.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}