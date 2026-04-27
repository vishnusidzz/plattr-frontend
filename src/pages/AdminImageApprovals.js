// src/pages/AdminImageApprovals.js
import React, { useEffect, useState } from "react";
import axios from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";

const AdminImageApprovals = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/caterer-images/?is_approved=false&is_rejected=false");
      // Defensive: backend might return approved/rejected too, filter client-side to be safe
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      const pending = data.filter((i) => !i.is_approved && !i.is_rejected);
      setImages(pending || []);
    } catch (err) {
      console.error("Failed to fetch images", err);
      toast.error("Failed to load images");
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleAction = async (id, action, reason = "") => {
    try {
      await axios.post(`/api/caterer-images/${id}/${action}/`, { reason });
      toast.success(`Image ${action}d`);
      // remove the image locally for immediate UI feedback (server is authoritative so we also refetch)
      setImages((prev) => prev.filter((img) => img.id !== id));
      // Refetch to ensure consistency (in case other pending images changed)
      fetchImages();
    } catch (err) {
      console.error(`Failed to ${action} image`, err);
      toast.error(`Failed to ${action} image`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Caterer Image Approvals</h2>
      {loading && <p>Loading...</p>}
      {!loading && images.length === 0 && <p>No pending images.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {images.map((img) => {
          // resolve image URL defensively (serializer may use image, url, or file)
          const src = img.image || img.url || img.file || "";
          // resolve caterer name: prefer nested object name, then explicit caterer_name, then fallback
          const catererName =
            (img.caterer && (typeof img.caterer === "object") && (img.caterer.name || img.caterer.title))
              ? (img.caterer.name || img.caterer.title)
              : (img.caterer_name || img.caterer || "Unknown Caterer");

          return (
            <div key={img.id} className="border rounded-lg shadow p-4 bg-white">
              <img
                src={src}
                alt="Caterer upload"
                onError={(e) => {
                  // fallback if URL missing/broken: hide broken image gracefully
                  e.currentTarget.style.display = "none";
                }}
                className="w-full h-48 object-cover rounded"
              />
              <p className="mt-2 text-sm text-gray-700">
                <strong>Caterer:</strong> {catererName}
              </p>
              <p className="text-xs text-gray-500">
                {img.uploaded_at || img.created_at ? new Date(img.uploaded_at || img.created_at).toLocaleString() : ""}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAction(img.id, "approve")}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    const reason = prompt("Reason for rejection:") || "";
                    handleAction(img.id, "reject", reason);
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminImageApprovals;