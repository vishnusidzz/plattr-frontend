// src/pages/AdminLocationApprovals.js
import React, { useEffect, useState } from "react";
import axios from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import ForceToggleModal from "../components/ForceToggleModal"; // optional if you need force toggles
import MapViewer from "../components/MapViewer";

const AdminLocationApprovals = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending"); // pending|approved|rejected
  const [expandedId, setExpandedId] = useState(null);
  const [commentById, setCommentById] = useState({}); // admin comments / reject reasons per location
  const [modal, setModal] = useState({ open: false, action: null, location: null });

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/caterer-locations/?status=${statusFilter}`;
      console.debug("fetchLocations -> GET", url);
      const res = await axios.get(url);

      console.debug("fetchLocations response:", res);
      // handle both list and paginated results
      const payload = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setLocations(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error("fetchLocations error:", err);
      // show helpful toast
      const status = err?.response?.status;
      if (status === 404) {
        toast.error("API endpoint not found (404). Ensure backend route /api/admin/caterer-locations/ is registered.");
      } else if (status === 401 || status === 403) {
        toast.error("Unauthorized. Check admin credentials / token.");
      } else {
        toast.error("Failed to fetch locations");
      }
      setLocations([]); // clear to show message in UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    // refresh when approvals happen elsewhere
    const onUpdate = () => fetchLocations();
    window.addEventListener("locationApprovalUpdate", onUpdate);
    return () => {
      window.removeEventListener("locationApprovalUpdate", onUpdate);
    };
    // only re-run when statusFilter changes
  }, [statusFilter]);

  const handleApprove = async (id) => {
    try {
      const payload = { comment: commentById[id] || "" };
      await axios.post(`/api/admin/caterer-locations/${id}/approve/`, payload);
      toast.success("Location approved");
      setCommentById(prev => { const next = { ...prev }; delete next[id]; return next; });
      await fetchLocations();
      window.dispatchEvent(new Event("locationApprovalUpdate"));
    } catch (err) {
      console.error("approve error", err);
      const detail = err?.response?.data?.detail || err?.response?.data || err.message;
      toast.error(detail || "Failed to approve");
    }
  };

  const handleReject = async (id) => {
    try {
      const reason = (commentById[id] || "").trim();
      if (!reason) {
        toast.error("Please provide a reason to reject");
        return;
      }
      await axios.post(`/api/admin/caterer-locations/${id}/reject/`, { comment: reason });
      toast.success("Location rejected");
      setCommentById(prev => { const next = { ...prev }; delete next[id]; return next; });
      await fetchLocations();
      window.dispatchEvent(new Event("locationApprovalUpdate"));
    } catch (err) {
      console.error("reject error", err);
      const detail = err?.response?.data?.detail || err?.response?.data || err.message;
      toast.error(detail || "Failed to reject");
    }
  };

  // Optional: open ForceToggleModal to flip is_active or other admin actions
  const openForceToggleModal = (location, action) => {
    setModal({ open: true, action, location });
  };
  const handleModalDone = async () => {
    setModal({ open: false, action: null, location: null });
    await fetchLocations();
    window.dispatchEvent(new Event("locationApprovalUpdate"));
  };
  const handleModalClose = () => setModal({ open: false, action: null, location: null });

  const fmtDate = (s) => {
    try {
      return s ? new Date(s).toLocaleString() : "—";
    } catch {
      return s;
    }
  };


  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Caterer Location Approvals</h2>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => { setExpandedId(null); setStatusFilter(s); }}
            className={`px-4 py-2 rounded ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800"}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p>Loading…</p>}

      {!loading && locations.length === 0 && (
        <div className="text-gray-600">
          <p>No {statusFilter} locations</p>
          <p className="text-sm text-gray-500 mt-2">
            Tip: if you expected items, open your browser DevTools → Network and inspect the request to <code>/api/admin/caterer-locations/</code>.
            If you see a 404, register the route in your Django router; if 401/403 check auth token/permissions.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {locations.map((loc) => {
          const isOpen = expandedId === loc.id;
          return (
            <div key={loc.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-gray-50"
                onClick={() => setExpandedId(isOpen ? null : loc.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold truncate">{loc.caterer_name || loc.caterer || `Caterer ${loc.caterer}`}</h3>
                    <p className="text-sm text-gray-600">{loc.city} • {loc.pincode || "—"}</p>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 text-xs rounded ${loc.is_approved ? "bg-green-100 text-green-700" : loc.is_rejected ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {loc.is_approved ? "Approved" : loc.is_rejected ? "Rejected" : "Pending"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{fmtDate(loc.created_at)}</div>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="p-4 border-t bg-gray-50">
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-800">
                    <p><strong>Address:</strong> {loc.address || "—"}</p>
                    <p><strong>City:</strong> {loc.city || "—"}</p>
                    <p><strong>Pincode:</strong> {loc.pincode || "—"}</p>
                    {/* coordinates */}
                    <p><strong>Lat / Lng:</strong> {loc.latitude != null && loc.longitude != null ? `${loc.latitude}, ${loc.longitude}` : "—"}</p>

                    {/* Inline map viewer for admin (shows pending / saved coordinates) */}
                    <div className="mt-3"><MapViewer lat={loc.pending_latitude ?? loc.latitude} lng={loc.pending_longitude ?? loc.longitude} height={220} zoom={15} /></div>
                    <p><strong>Uploaded by:</strong> {loc.uploaded_by || "—"}</p>
                    <p><strong>Approved by:</strong> {loc.approved_by || "—"}</p>
                    <p><strong>Created:</strong> {fmtDate(loc.created_at)}</p>
                    <p><strong>Updated:</strong> {fmtDate(loc.updated_at)}</p>
                    {loc.is_rejected && (
                      <p className="text-sm text-red-600"><strong>Rejected reason:</strong> {loc.rejected_reason || "—"}</p>
                    )}
                  </div>

                  {/* Admin comment / reason input (used for approve/reject) */}
                  {statusFilter !== "rejected" && (
                    <textarea
                      placeholder={statusFilter === "pending" ? "Admin comment / reject reason (required for reject)" : "Admin comment (optional)"}
                      value={commentById[loc.id] || ""}
                      onChange={(e) => setCommentById(prev => ({ ...prev, [loc.id]: e.target.value }))}
                      className="w-full mt-3 p-2 border rounded"
                    />
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap mt-3">
                    {statusFilter === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(loc.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(loc.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {statusFilter === "approved" && (
                      <>
                        {/* If you want to toggle active/inactive for location, you can use ForceToggleModal */}
                        <button
                          onClick={() => openForceToggleModal(loc, loc.is_active ? "deactivate" : "activate")}
                          className={`px-3 py-1 rounded ${loc.is_active ? "bg-yellow-600 text-white" : "bg-blue-600 text-white"}`}
                        >
                          {loc.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    )}

                    {statusFilter === "rejected" && (
                      <div className="text-sm text-gray-700">
                        <strong>Admin comment:</strong> {loc.rejected_reason || loc.admin_comment || "—"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Force toggle modal (optional) */}
      {modal.open && (
        <ForceToggleModal
          caterer={modal.location}
          action={modal.action === "activate" ? "activate" : "deactivate"}
          onClose={handleModalClose}
          onDone={handleModalDone}
        />
      )}
    </div>
  );
};

export default AdminLocationApprovals;