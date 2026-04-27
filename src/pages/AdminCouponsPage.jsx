// src/pages/AdminCouponsPage.jsx
import React, { useEffect, useState } from "react";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: "",
    type: "percentage",      // "percentage" | "flat"
    value: 10,
    max_discount: "",
    min_order_value: "",
    caterer_id: "",          // optional; blank => global coupon
    starts_at: "",
    expires_at: "",
    usage_limit: "",
    per_user_limit: "",
    active: true,
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/admin/coupons/");
      const data = res.data;
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];
      setCoupons(list);
    } catch (err) {
      console.error("Failed to fetch coupons", err);
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        type: form.type,
        value: Number(form.value) || 0,
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
        caterer_id: form.caterer_id || null,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        per_user_limit: form.per_user_limit ? Number(form.per_user_limit) : null,
        active: !!form.active,
      };

      const res = await axiosInstance.post("/api/admin/coupons/", payload);
      toast.success("Coupon created");
      // if API returns the new coupon object
      setCoupons((prev) => (res.data ? [res.data, ...prev] : prev));
      // reset some fields
      setForm((prev) => ({
        ...prev,
        code: "",
        value: 10,
        max_discount: "",
        min_order_value: "",
        caterer_id: "",
        starts_at: "",
        expires_at: "",
        usage_limit: "",
        per_user_limit: "",
        active: true,
      }));
    } catch (err) {
      console.error("Failed to create coupon", err);
      toast.error("Failed to create coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this coupon?")) return;
    try {
      await axiosInstance.delete(`/api/admin/coupons/${id}/`);
      toast.info("Coupon deleted");
      setCoupons((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete coupon", err);
      toast.error("Failed to delete coupon");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-semibold mb-4">Coupons</h1>

      {/* Create / edit form */}
      <form
        onSubmit={handleCreate}
        className="mb-6 p-4 border rounded-xl bg-white shadow-sm space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input
              name="code"
              value={form.code}
              onChange={handleChange}
              required
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="SAVE10"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
            >
              <option value="percentage">Percentage</option>
              <option value="flat">Flat</option>
            </select>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {form.type === "percentage" ? "Value (%)" : "Value (₹)"}
            </label>
            <input
              type="number"
              name="value"
              value={form.value}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
            />
          </div>

          {/* Max discount */}
          <div>
            <label className="block text-sm font-medium mb-1">Max discount (₹)</label>
            <input
              type="number"
              name="max_discount"
              value={form.max_discount}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="Optional"
            />
          </div>

          {/* Min order */}
          <div>
            <label className="block text-sm font-medium mb-1">Min order value (₹)</label>
            <input
              type="number"
              name="min_order_value"
              value={form.min_order_value}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="Optional"
            />
          </div>

          {/* Caterer ID */}
          <div>
            <label className="block text-sm font-medium mb-1">Caterer ID</label>
            <input
              name="caterer_id"
              value={form.caterer_id}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="Blank = global coupon"
            />
          </div>

          {/* Starts at */}
          <div>
            <label className="block text-sm font-medium mb-1">Starts at (ISO)</label>
            <input
              name="starts_at"
              value={form.starts_at}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="2025-01-01T00:00:00Z"
            />
          </div>

          {/* Expires at */}
          <div>
            <label className="block text-sm font-medium mb-1">Expires at (ISO)</label>
            <input
              name="expires_at"
              value={form.expires_at}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="2025-12-31T23:59:59Z"
            />
          </div>

          {/* Usage limit */}
          <div>
            <label className="block text-sm font-medium mb-1">Usage limit</label>
            <input
              type="number"
              name="usage_limit"
              value={form.usage_limit}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="Optional"
            />
          </div>

          {/* Per-user limit */}
          <div>
            <label className="block text-sm font-medium mb-1">Per-user limit</label>
            <input
              type="number"
              name="per_user_limit"
              value={form.per_user_limit}
              onChange={handleChange}
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="Optional"
            />
          </div>

          {/* Active */}
          <div className="flex items-center gap-2 mt-5">
            <input
              id="coupon-active"
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={handleChange}
            />
            <label htmlFor="coupon-active" className="text-sm">
              Active
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Create coupon"}
        </button>
      </form>

      {/* Coupon list */}
      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="text-lg font-medium">Existing Coupons</h2>
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
        </div>

        {coupons.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No coupons yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Value</th>
                  <th className="px-3 py-2 text-right">Max Discount</th>
                  <th className="px-3 py-2 text-right">Min Order</th>
                  <th className="px-3 py-2 text-left">Caterer</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{c.code}</td>
                    <td className="px-3 py-2">{c.type}</td>
                    <td className="px-3 py-2 text-right">{c.value}</td>
                    <td className="px-3 py-2 text-right">{c.max_discount ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{c.min_order_value ?? "-"}</td>
                    <td className="px-3 py-2">{c.caterer_id ?? c.caterer ?? "-"}</td>
                    <td className="px-3 py-2">{c.active ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="px-2 py-1 rounded-md bg-red-500 text-white text-xs hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}