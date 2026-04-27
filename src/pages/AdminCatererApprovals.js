// src/pages/AdminCatererApprovals.js
import React, { useEffect, useState } from "react";
import axios from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import ForceToggleModal from "../components/ForceToggleModal";
import MapViewer from "../components/MapViewer";

const AdminCatererApprovals = () => {
  const [caterers, setCaterers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState({}); // approve/reject/deactivate reason (optional for activate)
  const [deleteReason, setDeleteReason] = useState({}); // delete-forever reason (Approved tab only)
  const [statusFilter, setStatusFilter] = useState("pending");
  const [expanded, setExpanded] = useState(null);
  const [gallery, setGallery] = useState({ open: false, images: [], index: 0 });

  // modal state for force activate/deactivate
  const [modal, setModal] = useState({ open: false, action: null, caterer: null });

  // --- NEW: image moderation state ---
  const [imagesByCaterer, setImagesByCaterer] = useState({});
  const [imgLoading, setImgLoading] = useState({});
  const [imgRejectReason, setImgRejectReason] = useState({});

  // --- NEW: location comment state per caterer (for approve/reject location) ---
  const [locationComment, setLocationComment] = useState({});
  const [locationActionLoading, setLocationActionLoading] = useState({}); // per-caterer approve/reject loading

  const fetchCaterers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin/caterers/?status=${statusFilter}`);
      // backend might return either an array or a paginated { results: [...] }
      const data = res?.data;
      const items = Array.isArray(data) ? data : (data?.results || []);
      setCaterers(items);
    } catch (err) {
      console.error("fetchCaterers error:", err);
      toast.error("Failed to fetch caterers");
      setCaterers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaterers();
  }, [statusFilter]);

  // ---- Actions ----
  const handleAction = async (id, action) => {
    try {
      // Enforce reason for reject when in pending tab
      if (action === "reject" && statusFilter === "pending") {
        const reason = (comment[id] || "").trim();
        if (!reason) {
          toast.error("Reason required to reject");
          return;
        }
      }
      await axios.post(`/api/admin/caterers/${id}/${action}/`, {
        comment: comment[id] || "",
      });
      toast.success(`Caterer ${action}ed`);
      setComment((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchCaterers();
      if (action === "approve" || action === "reject") {
        window.dispatchEvent(new Event("catererApprovalUpdate"));
      }
    } catch (err) {
      console.error(`handleAction ${action} error:`, err);
      toast.error(err?.response?.data?.detail || `Failed to ${action}`);
    }
  };

  // open modal to force toggle (admin must provide reason)
  const openForceToggleModal = (caterer, action) => {
    setModal({ open: true, action, caterer });
  };

  const handleModalDone = async (result) => {
    setModal({ open: false, action: null, caterer: null });
    await fetchCaterers();
    window.dispatchEvent(new Event("catererApprovalUpdate"));
  };

  const handleModalClose = () => {
    setModal({ open: false, action: null, caterer: null });
  };

  const handleDeleteForever = async (id) => {
    const reason = deleteReason[id] || "";
    if (!reason) {
      toast.error("Reason required for Delete Forever");
      return;
    }
    try {
      await axios.post(`/api/admin/caterers/${id}/delete_forever/`, { comment: reason });
      toast.error("Caterer moved to Rejected");
      setDeleteReason((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setStatusFilter("rejected");
      await fetchCaterers();
      window.dispatchEvent(new Event("catererApprovalUpdate"));
    } catch (err) {
      console.error("delete_forever error:", err);
      toast.error(err?.response?.data?.detail || "Delete failed");
    }
  };

  // ----------------- NEW: Image moderation helpers -----------------

  const fetchImagesForCaterer = async (catererId) => {
    if (!catererId) return;
    setImgLoading((s) => ({ ...s, [catererId]: true }));
    try {
      const res = await axios.get(`/api/caterer-images/?caterer_id=${catererId}`);
      setImagesByCaterer((prev) => ({ ...prev, [catererId]: res.data || [] }));
    } catch (err) {
      console.error("Failed to fetch images for caterer", catererId, err);
      setImagesByCaterer((prev) => ({ ...prev, [catererId]: [] }));
    } finally {
      setImgLoading((s) => ({ ...s, [catererId]: false }));
    }
  };

  const ensureImagesLoaded = (catererId) => {
    if (!imagesByCaterer[catererId]) {
      fetchImagesForCaterer(catererId);
    }
  };

  const handleApproveImage = async (imageId, catererId) => {
    try {
      await axios.post(`/api/caterer-images/${imageId}/approve/`);
      toast.success("Image approved");
      await fetchImagesForCaterer(catererId);
      await fetchCaterers();
      window.dispatchEvent(new Event("catererApprovalUpdate"));
    } catch (err) {
      console.error("approve image error", err);
      toast.error(err?.response?.data?.detail || "Failed to approve image");
    }
  };

  const handleRejectImage = async (imageId, catererId) => {
    const reason = imgRejectReason[imageId] || "";
    try {
      await axios.post(`/api/caterer-images/${imageId}/reject/`, { reason });
      toast.success("Image rejected");
      setImgRejectReason((prev) => {
        const next = { ...prev };
        delete next[imageId];
        return next;
      });
      await fetchImagesForCaterer(catererId);
      await fetchCaterers();
      window.dispatchEvent(new Event("catererApprovalUpdate"));
    } catch (err) {
      console.error("reject image error", err);
      toast.error(err?.response?.data?.detail || "Failed to reject image");
    }
  };

  // ----------------- NEW: Location approval helpers -----------------

  const handleApproveLocation = async (catererId) => {
    // set per-caterer loading
    setLocationActionLoading((s) => ({ ...s, [catererId]: true }));
    try {
      const caterer = caterers.find((x) => x.id === catererId);
      if (!caterer) {
        toast.error("Caterer not found");
        return;
      }

      const latitude = (caterer.pending_latitude != null) ? caterer.pending_latitude : (caterer.latitude != null ? caterer.latitude : null);
      const longitude = (caterer.pending_longitude != null) ? caterer.pending_longitude : (caterer.longitude != null ? caterer.longitude : null);
      const address = (caterer.pending_address != null) ? caterer.pending_address : caterer.address;
      const city = (caterer.pending_city != null) ? caterer.pending_city : caterer.city;
      const pincode = (caterer.pending_pincode != null) ? caterer.pending_pincode : (typeof caterer.pincode === "string" ? caterer.pincode : "");

      const payload = {
        comment: locationComment[catererId] || "",
        ...(latitude != null ? { latitude: String(latitude) } : {}),
        ...(longitude != null ? { longitude: String(longitude) } : {}),
        ...(address != null ? { address } : {}),
        ...(city != null ? { city } : {}),
        ...(pincode ? { pincode } : {}),
      };

      await axios.post(`/api/admin/caterers/${catererId}/approve_location/`, payload);
      toast.success("Location approved");

      setLocationComment((prev) => {
        const next = { ...prev };
        delete next[catererId];
        return next;
      });

      await fetchCaterers();
      window.dispatchEvent(new Event("catererApprovalUpdate"));
    } catch (err) {
      console.error("approve location error", err);
      toast.error(err?.response?.data?.detail || "Failed to approve location");
    } finally {
      setLocationActionLoading((s) => ({ ...s, [catererId]: false }));
    }
  };

  const handleRejectLocation = async (catererId) => {
    // set per-caterer loading
    setLocationActionLoading((s) => ({ ...s, [catererId]: true }));
    try {
      const reason = (locationComment[catererId] || "").trim();
      if (statusFilter === "pending" && !reason) {
        toast.error("Reason required to reject location");
        return;
      }

      const caterer = caterers.find((x) => x.id === catererId) || {};
      const payload = {
        comment: reason || "",
        ...(caterer.pending_latitude != null ? { latitude: String(caterer.pending_latitude) } : {}),
        ...(caterer.pending_longitude != null ? { longitude: String(caterer.pending_longitude) } : {}),
        ...(caterer.pending_address ? { address: caterer.pending_address } : {}),
        ...(caterer.pending_city ? { city: caterer.pending_city } : {}),
        ...(caterer.pending_pincode ? { pincode: caterer.pending_pincode } : {}),
      };

      await axios.post(`/api/admin/caterers/${catererId}/reject_location/`, payload);
      toast.success("Location rejected");

      setLocationComment((prev) => {
        const next = { ...prev };
        delete next[catererId];
        return next;
      });

      await fetchCaterers();
      window.dispatchEvent(new Event("catererApprovalUpdate"));
    } catch (err) {
      console.error("reject location error", err);
      toast.error(err?.response?.data?.detail || "Failed to reject location");
    } finally {
      setLocationActionLoading((s) => ({ ...s, [catererId]: false }));
    }
  };

  // ----------------- END location helpers -----------------

  // Modal gallery helpers
  const prevImage = () =>
    setGallery((g) => ({
      ...g,
      index: (g.index - 1 + g.images.length) % g.images.length,
    }));
  const nextImage = () =>
    setGallery((g) => ({
      ...g,
      index: (g.index + 1) % g.images.length,
    }));

  // ---- Helpers to parse structured details from the description ----
  const pick = (desc = "", regex) => desc.match(regex)?.[1] || "N/A";
  const ownerFrom = (d) => pick(d, /Owner:\s*(.+)/i);
  const pinFrom = (d) => pick(d, /Pincode:\s*(\d{6})/i);
  const aadhaarFrom = (d) => pick(d, /Aadhaar:\s*(\d{12})/i);
  const panFrom = (d) => pick(d, /PAN:\s*([A-Z0-9]{10})/i);
  const fssaiFrom = (d) => pick(d, /FSSAI:\s*(.+)/i);

  // Strip duplicate lines from description to show only extra notes
  const cleanedNotes = (desc = "") => {
    const lines = desc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const dropPrefixes = ["Owner:", "Pincode:", "Aadhaar:", "PAN:", "FSSAI:", "Cuisines:"];
    const filtered = lines.filter(
      (l) => !dropPrefixes.some((p) => l.toLowerCase().startsWith(p.toLowerCase()))
    );
    return filtered.join("\n");
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Caterer Applications</h2>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setExpanded(null);
              setStatusFilter(s);
            }}
            className={`px-4 py-2 rounded ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800"
              }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p>Loading...</p>}
      {!loading && caterers.length === 0 && <p className="text-gray-600">No {statusFilter} caterers</p>}

      {/* Compact independent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {caterers.map((c) => {
          const isOpen = expanded === c.id;
          const notes = cleanedNotes(c.description || "");
          const hasPending = !!(c.has_pending_location || c.pending_address || c.pending_city || c.pending_pincode || (c.pending_latitude != null && c.pending_longitude != null));

          return (
            <div key={c.id} className="flex flex-col border rounded-lg shadow bg-white transition">
              {/* Header toggler */}
              <button
                type="button"
                className="w-full text-left p-4 hover:bg-gray-50 focus:outline-none"
                onClick={() => {
                  setExpanded(isOpen ? null : c.id);
                  if (!isOpen) ensureImagesLoaded(c.id);
                }}
              >
                <h3 className="text-lg font-semibold truncate">{c.name}</h3>
                <p className="text-sm text-gray-600">{c.city}</p>
                <p className="text-sm text-gray-500">{c.contact_number}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${c.status === "approved" ? "bg-green-100 text-green-700" :
                      c.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}
                  >
                    {c.status}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {(c.latest_audit || (c.audit_logs && c.audit_logs.length > 0) || c.admin_comment) && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    <strong>Last action:</strong>{" "}
                    {c.latest_audit?.reason ||
                      (c.audit_logs && c.audit_logs.length > 0 && c.audit_logs[0].reason) ||
                      c.admin_comment ||
                      "—"}
                    {c.latest_audit?.admin_name ? ` — by ${c.latest_audit.admin_name}` : ""}
                  </p>
                )}
              </button>

              {/* Expanded Details */}
              {isOpen && (
                <div className="border-t p-4 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-800">
                    <p><strong>Owner:</strong> {ownerFrom(c.description)}</p>
                    <p className="break-words"><strong>Email:</strong>{" "}
                      <a href={`mailto:${c.email}`} className="underline break-all">{c.email}</a>
                    </p>
                    <p><strong>Phone:</strong> {c.contact_number}</p>
                    <p><strong>City:</strong> {c.city}</p>
                    <p><strong>Pincode:</strong> {pinFrom(c.description)}</p>
                    <p><strong>Aadhaar:</strong> {aadhaarFrom(c.description)}</p>
                    <p><strong>PAN:</strong> {panFrom(c.description)}</p>
                    <p><strong>FSSAI:</strong> {fssaiFrom(c.description)}</p>
                    <p className="sm:col-span-2"><strong>Cuisine:</strong> {c.cuisine_type}</p>
                  </div>

                  {notes && (
                    <div className="mt-3">
                      <p className="font-semibold">Additional Notes:</p>
                      <p className="whitespace-pre-line text-gray-700">{notes}</p>
                    </div>
                  )}

                  {/* ---------------- NEW: Location approval widget ---------------- */}
                  <div className="mt-4">
                    <h4 className="font-semibold">Location</h4>

                    {/* Current saved location */}
                    <div className="mt-2 p-3 bg-white border rounded">
                      <div className="text-sm text-gray-700">
                        <div><strong>Saved address:</strong></div>
                        <div className="ml-2">
                          <div>{c.address || "—"}</div>
                          <div>{c.city ? `${c.city} — ${c.pincode || "—"}` : "—"}</div>
                          <div className="text-xs text-gray-500">
                            {c.latitude != null && c.longitude != null ? `${c.latitude}, ${c.longitude}` : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pending location block (if any) */}
                    {hasPending && (
                      <div className="mt-3 p-3 border rounded bg-yellow-50">
                        <div className="text-sm font-medium">Pending location change</div>
                        <div className="text-sm text-gray-700 mt-2">
                          <div><strong>Proposed address:</strong></div>
                          <div className="ml-2">
                            <div>{typeof c.pending_address !== "undefined" ? (c.pending_address || "—") : "—"}</div>
                            <div>{c.pending_city ? `${c.pending_city} — ${c.pending_pincode || "—"}` : "—"}</div>
                            <div className="text-xs text-gray-500">
                              {(c.pending_latitude != null && c.pending_longitude != null) ? `Lat: ${Number(c.pending_latitude).toFixed(6)}, Lng: ${Number(c.pending_longitude).toFixed(6)}` : "—"}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <MapViewer
                            lat={c.pending_latitude ?? c.latitude}
                            lng={c.pending_longitude ?? c.longitude}
                            height={260}
                            zoom={15}
                          />
                        </div>
                        {/* Admin location-specific comment */}
                        <textarea
                          placeholder="Admin comment for location action (optional, required for reject in pending tab)"
                          className="w-full p-2 border rounded mt-3"
                          value={locationComment[c.id] || ""}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          onChange={(e) => setLocationComment({ ...locationComment, [c.id]: e.target.value })}
                        />

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApproveLocation(c.id); }}
                            className="px-3 py-1 bg-green-600 text-white rounded"
                            disabled={!!locationActionLoading[c.id]}
                          >
                            {locationActionLoading[c.id] ? "Approving…" : "Approve location"}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRejectLocation(c.id); }}
                            className="px-3 py-1 bg-red-600 text-white rounded"
                            disabled={!!locationActionLoading[c.id]}
                          >
                            {locationActionLoading[c.id] ? "Rejecting…" : "Reject location"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* ---------------- end location widget ---------------- */}

                  {/* ---------------- EXISTING: Image moderation widget (unchanged) ---------------- */}
                  <div className="mt-4">
                    <h4 className="font-semibold">Image Moderation</h4>
                    {imgLoading[c.id] ? (
                      <p className="text-sm text-gray-600 mt-2">Loading images…</p>
                    ) : (
                      <>
                        {imagesByCaterer[c.id] && imagesByCaterer[c.id].length === 0 && (
                          <p className="text-sm text-gray-600 mt-2">No uploaded images for review.</p>
                        )}

                        {/* Pending images */}
                        {imagesByCaterer[c.id] && imagesByCaterer[c.id].filter(img => !img.is_approved && !img.is_rejected).length > 0 && (
                          <div className="mt-3">
                            <div className="text-sm font-medium mb-2">Pending images</div>
                            <div className="flex gap-3 flex-wrap">
                              {imagesByCaterer[c.id].filter(img => !img.is_approved && !img.is_rejected).map((img) => (
                                <div key={img.id} className="w-28">
                                  <img src={img.image || img.url} alt={`pending-${img.id}`} className="w-28 h-20 object-cover rounded border mb-1" />
                                  <div className="text-xs text-gray-600 mb-1">{new Date(img.uploaded_at || img.created_at || "").toLocaleString() || ""}</div>
                                  <textarea
                                    placeholder="Reject reason (optional)"
                                    className="w-full p-1 border rounded text-xs mb-1"
                                    value={imgRejectReason[img.id] || ""}
                                    onChange={(e) => setImgRejectReason(prev => ({ ...prev, [img.id]: e.target.value }))}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApproveImage(img.id, c.id)}
                                      className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectImage(img.id, c.id)}
                                      className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Approved images */}
                        {imagesByCaterer[c.id] && imagesByCaterer[c.id].filter(img => img.is_approved).length > 0 && (
                          <div className="mt-3">
                            <div className="text-sm font-medium mb-2">Approved images</div>
                            <div className="flex gap-2 flex-wrap">
                              {imagesByCaterer[c.id].filter(img => img.is_approved).map((img, i) => (
                                <img
                                  key={img.id || i}
                                  src={img.image || img.url}
                                  alt={`approved-${img.id || i}`}
                                  className="w-20 h-20 object-cover rounded border cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const approvedUrls = imagesByCaterer[c.id].filter(x => x.is_approved).map(x => x.image || x.url);
                                    setGallery({ open: true, images: approvedUrls, index: approvedUrls.findIndex(u => u === (img.image || img.url) || 0) });
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {/* ---------------- end image moderation widget ---------------- */}

                  {/* --- Inputs (hide entirely in Rejected tab) --- */}
                  {statusFilter !== "rejected" && (
                    <>
                      <textarea
                        placeholder="Admin comments / reason"
                        className="w-full p-2 border rounded mt-3"
                        value={comment[c.id] || ""}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        onChange={(e) => setComment({ ...comment, [c.id]: e.target.value })}
                      />

                      {statusFilter === "approved" && (
                        <textarea
                          placeholder="Reason for Delete Forever"
                          className="w-full p-2 border rounded mt-3"
                          value={deleteReason[c.id] || ""}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          onChange={(e) => setDeleteReason({ ...deleteReason, [c.id]: e.target.value })}
                        />
                      )}
                    </>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {statusFilter === "pending" && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(c.id, "approve"); }}
                          className="px-3 py-1 bg-green-600 text-white rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(c.id, "reject"); }}
                          className="px-3 py-1 bg-red-600 text-white rounded"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {statusFilter === "approved" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openForceToggleModal(c, c.is_active ? "deactivate" : "activate");
                          }}
                          className={`px-3 py-1 rounded ${c.is_active ? "bg-yellow-600 text-white" : "bg-blue-600 text-white"}`}
                          title={c.is_active ? "Deactivate" : "Activate"}
                        >
                          {c.is_active ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          disabled={c.is_active}
                          onClick={(e) => { e.stopPropagation(); handleDeleteForever(c.id); }}
                          className={`px-3 py-1 rounded ${c.is_active ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-red-700 text-white"}`}
                        >
                          Delete Forever
                        </button>
                      </>
                    )}

                    {statusFilter === "rejected" && (
                      <span className="text-sm text-gray-700">
                        <strong>Admin Comments:</strong> {c.admin_comment || "—"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Gallery */}
      {gallery.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="relative max-w-3xl w-full bg-white rounded-lg shadow-lg">
            <img src={gallery.images[gallery.index]} alt="preview" className="w-full max-h-[80vh] object-contain rounded-t-lg" />
            <div className="flex justify-between items-center p-4 bg-gray-100 rounded-b-lg">
              <button onClick={prevImage} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">◀ Prev</button>
              <span className="text-sm text-gray-600">{gallery.index + 1} / {gallery.images.length}</span>
              <button onClick={nextImage} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Next ▶</button>
            </div>
            <button onClick={() => setGallery({ open: false, images: [], index: 0 })} className="absolute top-2 right-2 bg-black/70 text-white rounded-full px-3 py-1">✕</button>
          </div>
        </div>
      )}

      {/* Force Toggle Modal (admin) */}
      {modal.open && (
        <ForceToggleModal
          caterer={modal.caterer}
          action={modal.action === "activate" ? "activate" : "deactivate"}
          onClose={handleModalClose}
          onDone={handleModalDone}
        />
      )}
    </div>
  );
};

export default AdminCatererApprovals;