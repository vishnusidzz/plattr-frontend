import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../shared-lib/axiosInstance";

export default function AdminPaymentPolicy() {
  const navigate = useNavigate();

  // ---------------- policy ----------------
  const [advancePct, setAdvancePct] = useState(60);
  const [minCap, setMinCap] = useState("");

  // ---------------- slabs ----------------
  const [slabs, setSlabs] = useState([]);
  const [newSlab, setNewSlab] = useState({
    min_order_value: "",
    max_order_value: "",
    min_payment_percent: "",
    priority: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---------------- helpers ----------------
  const loadSlabs = async () => {
    const res = await axiosInstance.get(
      "/api/admin/payment-policy/min-slabs/"
    );
    setSlabs(res.data || []);
  };

  // ---------------- load data ----------------
  useEffect(() => {
    Promise.all([
      axiosInstance.get("/api/admin/payment-policy/"),
      loadSlabs(),
    ]).then(([policyRes]) => {
      setAdvancePct(policyRes.data.advance_payment_percent ?? 60);
      setMinCap(policyRes.data.min_payment_cap ?? "");
      setLoading(false);
    });
  }, []);

  // ---------------- save policy ----------------
  const savePolicy = async () => {
    if (advancePct <= 0 || advancePct >= 100) {
      alert("Advance payment must be between 1 and 99%");
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.post("/api/admin/payment-policy/", {
        advance_payment_percent: Number(advancePct),
        min_payment_cap: minCap ? Number(minCap) : null,
      });
      alert("Payment policy saved");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- slab CRUD ----------------
  const addSlab = async () => {
    if (!newSlab.min_order_value || !newSlab.min_payment_percent) {
      alert("Min order value and Min % are required");
      return;
    }

    await axiosInstance.post("/api/admin/payment-policy/min-slabs/", {
      min_order_value: Number(newSlab.min_order_value),
      max_order_value: newSlab.max_order_value
        ? Number(newSlab.max_order_value)
        : null,
      min_payment_percent: Number(newSlab.min_payment_percent),
      priority: Number(newSlab.priority || 1),
    });

    await loadSlabs();
    setNewSlab({
      min_order_value: "",
      max_order_value: "",
      min_payment_percent: "",
      priority: "",
    });
  };

  const updateSlab = async (id, field, value) => {
    if (value === "") return;

    await axiosInstance.patch(
      `/api/admin/payment-policy/min-slabs/${id}/`,
      { [field]: Number(value) }
    );

    await loadSlabs();
  };

  const deleteSlab = async (id) => {
    if (!window.confirm("Delete this slab?")) return;

    await axiosInstance.delete(
      `/api/admin/payment-policy/min-slabs/${id}/`
    );
    setSlabs(slabs.filter((s) => s.id !== id));
  };

  if (loading) {
    return <div className="p-6 text-center">Loading…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      {/* BACK */}
      <button
        onClick={() => navigate("/admin")}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to Admin Dashboard
      </button>

      {/* ---------------- GLOBAL POLICY ---------------- */}
      <section>
        <h2 className="text-xl font-bold mb-4">Global Payment Policy</h2>

        <label className="block mb-1">Advance Payment %</label>
        <input
          type="number"
          min="1"
          max="99"
          value={advancePct}
          onChange={(e) => setAdvancePct(e.target.value)}
          className="border p-2 w-full mb-4"
        />

        <label className="block mb-1">
          Minimum Payment Cap (₹ – optional)
        </label>
        <input
          type="number"
          min="0"
          value={minCap}
          onChange={(e) => setMinCap(e.target.value)}
          className="border p-2 w-full mb-4"
        />

        <button
          onClick={savePolicy}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Policy"}
        </button>
      </section>

      {/* ---------------- SLABS ---------------- */}
      <section>
        <h2 className="text-xl font-bold mb-4">Minimum Payment Slabs</h2>

        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Min ₹</th>
              <th className="border p-2">Max ₹</th>
              <th className="border p-2">Min %</th>
              <th className="border p-2">Priority</th>
              <th className="border p-2"></th>
            </tr>
          </thead>
          <tbody>
            {slabs.map((s) => (
              <tr key={s.id}>
                {["min_order_value", "max_order_value", "min_payment_percent", "priority"].map(
                  (field) => (
                    <td key={field} className="border p-1">
                      <input
                        className="w-full border p-1"
                        defaultValue={s[field] ?? ""}
                        onBlur={(e) =>
                          updateSlab(s.id, field, e.target.value)
                        }
                      />
                    </td>
                  )
                )}
                <td className="border p-1 text-center">
                  <button
                    onClick={() => deleteSlab(s.id)}
                    className="text-red-600"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}

            {/* ADD NEW */}
            <tr className="bg-gray-50">
              {["min_order_value", "max_order_value", "min_payment_percent", "priority"].map(
                (field) => (
                  <td key={field} className="border p-1">
                    <input
                      className="w-full border p-1"
                      value={newSlab[field]}
                      onChange={(e) =>
                        setNewSlab({
                          ...newSlab,
                          [field]: e.target.value,
                        })
                      }
                    />
                  </td>
                )
              )}
              <td className="border p-1 text-center">
                <button
                  onClick={addSlab}
                  className="text-green-600 font-bold"
                >
                  ＋
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}