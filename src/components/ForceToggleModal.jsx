// src/components/ForceToggleModal.jsx
import React, { useState } from "react";
import axios from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";

const ForceToggleModal = ({ caterer, action = "deactivate", onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!caterer) return null;

  const isActivate = action === "activate";
  const verb = isActivate ? "Activate" : "Deactivate";

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = `/api/admin/caterers/${caterer.id}/${isActivate ? "force_activate" : "force_deactivate"}/`;
      const payload = { comment: reason };

      const res = await axios.post(endpoint, payload);
      toast.success(res.data?.message || `Caterer ${verb.toLowerCase()}d`);

      // call parent callback (refresh list etc)
      if (typeof onDone === "function") {
        try {
          await onDone({ success: true, response: res.data });
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      // try to show backend-provided message
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (err?.message || "Failed to change status");
      console.error("Force toggle error:", err);
      toast.error(msg);
      if (typeof onDone === "function") {
        try {
          await onDone({ success: false, error: err });
        } catch (e) {}
      }
    } finally {
      setLoading(false);
      if (typeof onClose === "function") onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium mb-2">
          {isActivate ? "Force Activate" : "Force Deactivate"} Caterer
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          You're about to <strong>{isActivate ? "activate" : "deactivate"}</strong>{" "}
          <span className="font-semibold">{caterer.name}</span>. This action will override the
          caterer's current open/close state. Please provide a reason for audit & notification.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            className="w-full border p-2 rounded mb-3"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason (required)"
            required
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof onClose === "function") onClose();
              }}
              disabled={loading}
              className="px-4 py-2 rounded border bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded text-white ${isActivate ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {loading ? `${verb}…` : verb}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForceToggleModal;