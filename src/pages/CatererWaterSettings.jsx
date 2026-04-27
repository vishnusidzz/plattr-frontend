// src/pages/CatererWaterSettings.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";

const numberOrEmpty = (v) => {
  if (v === null || v === undefined) return "";
  return String(v);
};

export default function CatererWaterSettings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [savingBottles, setSavingBottles] = useState(false);
  const [savingCans, setSavingCans] = useState(false);
  const [error, setError] = useState("");

  const [bottles, setBottles] = useState({
    enabled: false,
    bottle_price: "",
    default_multiplier: "",
    free_threshold: "",
  });

  const [cans, setCans] = useState({
    enabled: false,
    can_volume_l: "",
    avg_cup_ml: "",
    cup_pack_size: "",
    can_price: "",
    cup_pack_price: "",
    min_price: "",
    free_threshold: "",
  });

  // ---- Load current config ----
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [bottlesRes, cansRes] = await Promise.all([
          axios.get("/api/caterers/me/water/bottles/"),
          axios.get("/api/caterers/me/water/cans/"),
        ]);

        if (cancelled) return;

        const b = bottlesRes.data || {};
        const c = cansRes.data || {};

        setBottles({
          enabled: !!b.enabled,
          bottle_price: numberOrEmpty(b.bottle_price),
          default_multiplier: numberOrEmpty(b.default_multiplier),
          free_threshold: numberOrEmpty(b.free_threshold),
        });

        setCans({
          enabled: !!c.enabled,
          can_volume_l: numberOrEmpty(c.can_volume_l),
          avg_cup_ml: numberOrEmpty(c.avg_cup_ml),
          cup_pack_size: numberOrEmpty(c.cup_pack_size),
          can_price: numberOrEmpty(c.can_price),
          cup_pack_price: numberOrEmpty(c.cup_pack_price),
          min_price: numberOrEmpty(c.min_price),
          free_threshold: numberOrEmpty(c.free_threshold),
        });
      } catch (err) {
        console.error("Failed to load water settings:", err);
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to load water settings.";
        setError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Save handlers ----
  const saveBottles = async () => {
    setSavingBottles(true);
    try {
      const payload = {
        enabled: !!bottles.enabled,
        bottle_price: bottles.bottle_price || "0.00",
        default_multiplier: bottles.default_multiplier || "1.00",
        free_threshold: bottles.free_threshold || "0.00",
      };

      const res = await axios.patch("/api/caterers/me/water/bottles/", payload);
      toast.success("Bottle settings saved.");

      // normalize state from response
      const b = res.data || payload;
      setBottles({
        enabled: !!b.enabled,
        bottle_price: numberOrEmpty(b.bottle_price),
        default_multiplier: numberOrEmpty(b.default_multiplier),
        free_threshold: numberOrEmpty(b.free_threshold),
      });
    } catch (err) {
      console.error("Failed to save bottle settings:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to save bottle settings.";
      toast.error(msg);
    } finally {
      setSavingBottles(false);
    }
  };

  const saveCans = async () => {
    setSavingCans(true);
    try {
      const payload = {
        enabled: !!cans.enabled,
        can_volume_l: cans.can_volume_l ? Number(cans.can_volume_l) : 20,
        avg_cup_ml: cans.avg_cup_ml ? Number(cans.avg_cup_ml) : 200,
        cup_pack_size: cans.cup_pack_size ? Number(cans.cup_pack_size) : 50,
        can_price: cans.can_price || "0.00",
        cup_pack_price: cans.cup_pack_price || "0.00",
        min_price: cans.min_price || "0.00",
        free_threshold: cans.free_threshold || "0.00",
      };

      const res = await axios.patch("/api/caterers/me/water/cans/", payload);
      toast.success("Can settings saved.");

      const c = res.data || payload;
      setCans({
        enabled: !!c.enabled,
        can_volume_l: numberOrEmpty(c.can_volume_l),
        avg_cup_ml: numberOrEmpty(c.avg_cup_ml),
        cup_pack_size: numberOrEmpty(c.cup_pack_size),
        can_price: numberOrEmpty(c.can_price),
        cup_pack_price: numberOrEmpty(c.cup_pack_price),
        min_price: numberOrEmpty(c.min_price),
        free_threshold: numberOrEmpty(c.free_threshold),
      });
    } catch (err) {
      console.error("Failed to save can settings:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to save can settings.";
      toast.error(msg);
    } finally {
      setSavingCans(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div>Loading water settings…</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Water Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure bottled water & 20L can charges for automatic water estimation.
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg border text-gray-700 bg-white hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded p-3">
          {error}
        </div>
      )}

      {/* Bottled water card */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Bottled Water
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Used when caterer selects <span className="font-medium">“bottles”</span>
              {" "}in the order water calculator.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={bottles.enabled}
              onChange={(e) =>
                setBottles((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />
            <span className="text-gray-700">Enable</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Price per bottle (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={bottles.bottle_price}
              onChange={(e) =>
                setBottles((prev) => ({ ...prev, bottle_price: e.target.value }))
              }
              placeholder="20.00"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Default multiplier
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={bottles.default_multiplier}
              onChange={(e) =>
                setBottles((prev) => ({
                  ...prev,
                  default_multiplier: e.target.value,
                }))
              }
              placeholder="1.70"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              e.g. 1.70 × estimated bottles based on plates.
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Free above order amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={bottles.free_threshold}
              onChange={(e) =>
                setBottles((prev) => ({
                  ...prev,
                  free_threshold: e.target.value,
                }))
              }
              placeholder="15000.00"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              If chargeable total ≥ this, bottled water is free.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={saveBottles}
            disabled={savingBottles}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
              savingBottles
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {savingBottles ? "Saving…" : "Save Bottled Water Settings"}
          </button>
        </div>
      </div>

      {/* 20L Can card */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              20L Water Cans + Cups
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Used when caterer selects <span className="font-medium">“cans”</span>{" "}
              in the order water calculator.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={cans.enabled}
              onChange={(e) =>
                setCans((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />
            <span className="text-gray-700">Enable</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Can volume (litres)
            </label>
            <input
              type="number"
              min="1"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={cans.can_volume_l}
              onChange={(e) =>
                setCans((prev) => ({ ...prev, can_volume_l: e.target.value }))
              }
              placeholder="20"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Avg cup size (ml)
            </label>
            <input
              type="number"
              min="50"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={cans.avg_cup_ml}
              onChange={(e) =>
                setCans((prev) => ({ ...prev, avg_cup_ml: e.target.value }))
              }
              placeholder="200"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Cups per pack
            </label>
            <input
              type="number"
              min="1"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={cans.cup_pack_size}
              onChange={(e) =>
                setCans((prev) => ({
                  ...prev,
                  cup_pack_size: e.target.value,
                }))
              }
              placeholder="50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Can price (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={cans.can_price}
              onChange={(e) =>
                setCans((prev) => ({ ...prev, can_price: e.target.value }))
              }
              placeholder="20.00"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Cup pack price (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={cans.cup_pack_price}
              onChange={(e) =>
                setCans((prev) => ({
                  ...prev,
                  cup_pack_price: e.target.value,
                }))
              }
              placeholder="50.00"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Minimum charge (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={cans.min_price}
              onChange={(e) =>
                setCans((prev) => ({ ...prev, min_price: e.target.value }))
              }
              placeholder="300.00"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              If computed total is below this, minimum will be applied.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Free above order amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={cans.free_threshold}
              onChange={(e) =>
                setCans((prev) => ({
                  ...prev,
                  free_threshold: e.target.value,
                }))
              }
              placeholder="15000.00"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              If chargeable total ≥ this, water can+cup charge can be waived.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={saveCans}
            disabled={savingCans}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
              savingCans
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {savingCans ? "Saving…" : "Save Can Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}