// src/pages/CatererOrders.jsx
import React, { useEffect, useState, useCallback } from "react";
import axios from "../shared-lib/axiosInstance";
import axiosInstance from '../shared-lib/axiosInstance';
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import generateInvoicePdf from "../utils/invoice";

const STAGE_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  preparation_inprogress: "Preparation — In Progress",
  preparation_completed: "Ready to Deliver",
  delivery_in_progress: "Delivery — In Progress",
  ready_to_pickup: "Ready to Pickup",
  customer_pickedup: "Customer Picked Up",
  collected_utensils: "Collected Utensils",
  delivered: "Delivered",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
// Helper: allow starting preparation only within 8 hours before event time
const canStartPreparation = (order) => {
  const dateStr = order.event_date;
  const timeStr = order.event_time;

  // If missing date or time, don't block (fallback: allow button)
  if (!dateStr || !timeStr) return true;

  try {
    const [year, month, day] = dateStr.split("-").map(Number);

    // event_time might be "12:30" or "12:30:00"
    const timeParts = String(timeStr).split(":");
    const hour = Number(timeParts[0] || 0);
    const minute = Number(timeParts[1] || 0);

    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      Number.isNaN(hour) ||
      Number.isNaN(minute)
    ) {
      return true; // don't block if parsing fails
    }

    const eventDateTime = new Date(year, month - 1, day, hour, minute, 0, 0);
    const now = new Date();

    const diffMs = eventDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Allow only if event is in future AND within next 24 hours
    return diffHours > 0 && diffHours <= 24;
  } catch (e) {
    console.error("Failed to compute canStartPreparation for order", order.id, e);
    return true; // fail-open
  }
};
const nextStageMap = {
  pending: "accepted",
  accepted: "preparation_inprogress",
  preparation_inprogress: "preparation_completed",
  preparation_completed: "delivery_in_progress",
  delivery_in_progress: "delivered",
  delivered: "completed",
};
const normalizeOrder = (o) => ({
  ...o,
  status: (o.status || "pending").toLowerCase(),
});
// Dynamic stage label based on delivery option
const getStageLabel = (status, order) => {
  const base = STAGE_LABELS[status] || status;
  if (!order) return base;

  const opt = (order.delivery_option || order.delivery || "").toLowerCase();

  const isSelfPickup =
    opt === "selfpickup" || opt === "self_pickup" || opt === "pickup";

  if (!isSelfPickup) return base;

  // For self-pickup orders, override labels for later stages
  if (status === "preparation_completed") return "Ready to Pickup";
  if (status === "delivery_in_progress") return "Customer Picked Up";
  if (status === "delivered") return "Returned utensils";

  return base;
};

// ---- helpers to work with summary response ----
const unwrapOrderPayload = (payload) => {
  if (!payload) return null;
  if (payload.order && typeof payload.order === "object") return payload.order;
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.result && typeof payload.result === "object") return payload.result;
  return payload;
};
const isSelfPickupDelivery = (o) => {
  const opt = (o?.delivery_option || o?.delivery || "").toLowerCase();
  return opt === "selfpickup" || opt === "self_pickup" || opt === "pickup";
};
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtAmt = (v) => {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "₹0.00";
  return `₹${n.toFixed(2)}`;
};

const getChargeableTotal = (o) => {
  if (!o) return 0;
  const candidates = [
    o.chargeable_total,
    o.amount_breakdown?.total,
    o.amount_breakdown?.chargeable_total,
    o.total,
    o.total_amount,
    o.amount,
  ];
  for (const c of candidates) {
    if (c !== null && c !== undefined && String(c) !== "") {
      return toNumber(c);
    }
  }
  return 0;
};

const computePaidAndRemainingFromSummary = (o) => {
  if (!o) return { paid: 0, remaining: 0, mode: "-" };

  const chargeable = getChargeableTotal(o);

  const paid = toNumber(
    o.paid_amount ??
    o.amount_paid ??
    o.advance_info?.paid_amount ??
    o.advance_info?.advance_paid ??
    0
  );

  const remaining = toNumber(
    o.remaining_due ??
    o.advance_info?.remaining_due ??
    Math.max(0, chargeable - paid)
  );

  const rawMode = o.payment_mode ?? o.payment_method ?? "";
  let mode = rawMode || (remaining > 0 ? "Partial" : paid > 0 ? "Full" : "Unpaid");

  const lower = String(mode).toLowerCase();
  if (lower === "advance") mode = "Partial";
  if (lower === "full") mode = "Full";

  return { paid, remaining, mode };
};

const isTrue = (v) =>
  v === true || v === "true" || v === 1 || v === "1";

export default function CatererOrders() {
  const [caterer, setCaterer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [pickupConfirm, setPickupConfirm] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [noteInputs, setNoteInputs] = useState({});
  const navigate = useNavigate();

  const updateOrderInLists = (updatedOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
  };

  const fetchOrdersForCaterer = useCallback(async (catererId) => {
    if (!catererId) return [];
    const res = await axios.get(`/api/caterers/${catererId}/orders/`);
    return res.data || [];
  }, []);

  const [otpState, setOtpState] = useState({
    open: false,
    order: null,
    otp: "",
    submitting: false,
  });

  // View one order – prefer /summary/ so we get paid_amount, remaining_due, selected_package etc.
  const handleViewOrder = async (orderId) => {
    try {
      // 1) Try summary first
      try {
        const res = await axios.get(`/api/orders/${orderId}/summary/`);
        const orderDetails = unwrapOrderPayload(res.data);
        setSelectedOrder(orderDetails);
        setShowOrderModal(true);
        return;
      } catch (e) {
        console.warn("Summary fetch failed, falling back to detail:", e);
      }

      // 2) Fallback: normal detail
      const res = await axios.get(`/api/orders/${orderId}/`);
      const orderDetails = unwrapOrderPayload(res.data);
      setSelectedOrder(orderDetails);
      setShowOrderModal(true);
    } catch (err) {
      console.error("Failed to fetch order details:", err);
      toast.error("Failed to fetch order details");
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await axios.get("/api/caterers/me/");
      const data = me.data;

      console.log("RAW /me/ RESPONSE 👇", data);

      const catererObj =
        data?.caterer_serialized ??
        data?.caterer ??
        data ??
        null;

      if (!catererObj?.id) {
        console.error("❌ Caterer object missing ID", catererObj);
        setCaterer(null);
        return;
      }

      setCaterer({
        ...catererObj,
        id: Number(catererObj.id),
      });
    } catch (err) {
      console.error("Failed to load caterer profile", err);
      setCaterer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!caterer?.id) return;

    const loadOrders = async () => {
      try {
        const res = await axios.get(
          `/api/caterers/${caterer.id}/orders/`
        );

        const data = res.data;
        const ordersArray = Array.isArray(data)
          ? data
          : data.orders || data.results || [];

        setOrders(
          ordersArray
            .map(normalizeOrder)
            .sort(
              (a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            )
        );
      } catch (e) {
        console.error("Failed to load orders", e);
        toast.error("Failed to load orders");
      }
    };

    loadOrders(); // FIRST load
    const timer = setInterval(loadOrders, 20000); // polling

    return () => clearInterval(timer);
  }, [caterer?.id]);

  useEffect(() => {
    orders.forEach(o => {
      if (!o.status) {
        console.warn("Order missing status:", o.id, o);
      }
    });
  }, [orders]);

  const refresh = async () => {
    if (!caterer?.id) return load();
    setLoading(true);
    try {
      const res = await axios.get(`/api/caterers/${caterer.id}/orders/`);
      setOrders((res.data || []).map(normalizeOrder));
      toast.success("Orders refreshed");
    } catch (e) {
      console.error(e);
      toast.error("Failed to refresh orders");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderLocally = (updatedOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
  };

  // send PATCH /api/orders/:id/status/ with fallback to take/reject endpoints
  const changeOrderStatus = async (orderId, status, extra = {}) => {
    setActionLoading(orderId);
    try {
      // try PATCH status endpoint first
      try {
        const payload = { status, ...extra };
        const res = await axios.patch(`/api/orders/${orderId}/status/`, payload);
        const updated = res.data?.order || res.data || null;
        if (updated) {
          updateOrderLocally(updated);
          const label = getStageLabel(status, updated);
          toast.success(`Order ${orderId} → ${label}`);
          return updated;
        }
      } catch (err) {
        console.warn(
          "PATCH status failed - will attempt fallbacks",
          err?.response?.status
        );
      }

      // if accepting, try take endpoint
      if (status === "accepted") {
        try {
          const res = await axios.post(`/api/orders/${orderId}/take/`, {
            note: extra.note || "Accepted by caterer",
          });
          const updated = res.data?.order || res.data || null;
          if (updated) {
            updateOrderLocally(updated);
            const label = getStageLabel(status, updated);
            toast.success(`Order ${orderId} → ${label}`);
            return updated;
          }
        } catch (e) {
          console.warn("take endpoint failed", e);
        }
      }

      // if rejecting/cancelling try reject endpoint
      if (["rejected", "cancelled"].includes(status)) {
        try {
          const res = await axios.post(`/api/orders/${orderId}/reject/`, {
            reason: extra.note || "Rejected by caterer",
            refund: !!extra.refund,
          });
          const updated = res.data?.order || res.data || null;
          if (updated) {
            updateOrderLocally(updated);
            const label = getStageLabel(status, updated);
            toast.success(`Order ${orderId} → ${label}`);
            return updated;
          }
        } catch (e) {
          console.warn("reject endpoint failed", e);
        }
      }

      // last resort try PATCH /api/orders/:id/
      try {
        const res = await axios.patch(`/api/orders/${orderId}/`, {
          status,
          ...extra,
        });
        const updated = res.data || null;
        if (updated) {
          updateOrderLocally(updated);
          const label = getStageLabel(status, updated);
          toast.success(`Order ${orderId} → ${label}`);
          return updated;
        }
        throw new Error("No update returned");
      } catch (e) {
        throw e;
      }
    } catch (err) {
      console.error("changeOrderStatus failed entirely:", err);
      toast.error("Failed to update order status. See console.");
      return null;
    } finally {
      setActionLoading(null);
    }
  };

  // Accept
  const handleAccept = async (order) => {
    if (!window.confirm(`Accept order #${order.id}?`)) return;
    await changeOrderStatus(order.id, "accepted", { note: "Accepted by caterer" });
  };

  const handleAddNote = async (orderId) => {
    const text = (noteDrafts[orderId] || "").trim();
    if (!text) return;

    try {
      const res = await axiosInstance.post(`/api/orders/${orderId}/add-note/`, {
        body: text,
      });

      const updatedOrder = res.data?.order;
      if (updatedOrder) {
        updateOrderInLists(updatedOrder);
        // clear draft for that order
        setNoteDrafts((prev) => ({ ...prev, [orderId]: "" }));
      }
    } catch (err) {
      console.error("Add note failed", err);
      alert("Failed to add note");
    }
  };
  const handleAddNoteForOrder = async (order) => {
    const body = (noteInputs[order.id] || "").trim();
    if (!body) return;

    try {
      const res = await axiosInstance.post(`/api/orders/${order.id}/add-note/`, {
        body,
      });

      if (res.data?.order) {
        // refresh order in all lists
        updateOrderInLists(res.data.order);

        // clear input for this order
        setNoteInputs((prev) => ({
          ...prev,
          [order.id]: "",
        }));
      }
    } catch (err) {
      console.error("Failed to add note", err);
      alert("Failed to add note");
    }
  };
  // Reject
  const handleReject = async (order) => {
    // 1) Ask caterer for reason
    const reason = window.prompt(
      "Enter reason for rejection (this will be saved as a note on the order):"
    );

    if (!reason || !reason.trim()) {
      return; // user cancelled or left it blank
    }

    try {
      setActionLoading(order.id);

      // 2) Save reason as a note
      await axiosInstance.post(`/api/orders/${order.id}/add-note/`, {
        body: reason.trim(),
      });

      // 3) Move order to 'rejected' status
      await updateOrderStage(order, "rejected");
    } catch (err) {
      console.error("Failed to reject order:", err);
      alert("Failed to reject order. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel (owner-initiated cancellation)
  const handleCancel = async (order) => {
    const reason = window.prompt(
      "Reason for cancelling the order (required):",
      ""
    );
    if (!reason || !reason.trim()) {
      toast.error("Cancellation cancelled — reason required");
      return;
    }
    await changeOrderStatus(order.id, "cancelled", {
      note: reason.trim(),
      refund: true,
    });
  };

  // Advance to next stage
  const handleAdvance = async (order) => {
    const current = order.status;
    const next = nextStageMap[current];
    if (!next) {
      toast.info("No further automatic stage available.");
      return;
    }

    const label = getStageLabel(next, order);

    if (
      !window.confirm(
        `Move order #${order.id} → "${label}"?`
      )
    ) {
      return;
    }

    await changeOrderStatus(order.id, next, { note: `Moved to ${next}` });
  };

  // Explicit set stage
  const handleSetStage = async (order, stage) => {
    const label = getStageLabel(stage, order);

    if (
      !window.confirm(
        `Set order #${order.id} to "${label}"?`
      )
    ) {
      return;
    }

    await changeOrderStatus(order.id, stage, { note: `Set to ${stage}` });
  };

  const handleDownloadInvoice = async (order) => {
    if (!order) return;
    setGeneratingInvoice(true);
    try {
      await generateInvoicePdf(order, {
        company: {
          name: "FrameMyEvent",
          address: "OPC PRIVATE LIMITED",
          phone: "framemyevent7@gmail.com",
        },
        filenamePrefix: "invoice_order",
        preservedMode: order.payment_mode ?? order.payment_method ?? null,
      });
    } catch (e) {
      console.error("Invoice PDF generation failed:", e);
      toast.error("Failed to generate invoice PDF");
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Partition orders by stage (safe to handle missing/null)
  const byStatus = (status) =>
    orders.filter((o) => o.status === status);

  const pendingOrders = byStatus("pending");
  const acceptedOrders = byStatus("accepted");
  const prepInProgress = byStatus("preparation_inprogress");
  const prepCompleted = byStatus("preparation_completed");
  const deliveryInProgress = byStatus("delivery_in_progress");
  const readyToDeliverOrders = prepCompleted.filter((o) => !isSelfPickupDelivery(o));
  const readyToPickupOrders = prepCompleted.filter((o) => isSelfPickupDelivery(o));
  const delivered = byStatus("delivered");
  const deliveredDelivery = delivered.filter(
    (o) => !isSelfPickupDelivery(o)
  );
  const deliveredPickup = delivered.filter((o) =>
    isSelfPickupDelivery(o)
  );
  const deliveryInProgressDelivery = deliveryInProgress.filter(
    (o) => !isSelfPickupDelivery(o)
  );
  const deliveryInProgressPickup = deliveryInProgress.filter((o) =>
    isSelfPickupDelivery(o)
  );
  const completedOrders = byStatus("completed");
  const cancelledRejected = orders.filter((o) =>
    ["rejected", "cancelled"].includes(o.status)
  );
  const updateOrderStage = async (order, newStatus) => {
    try {
      setActionLoading(order.id);

      const res = await axiosInstance.patch(
        `/api/orders/${order.id}/status/`,
        { status: newStatus }
      );

      console.log("Order stage updated", res.data);
    } catch (err) {
      console.error("Failed to update stage:", err);
      alert("Failed to update order stage");
    } finally {
      setActionLoading(null);
    }
  };
  const openOtpForOrder = async (order) => {
    setOtpState({
      open: true,
      order,
      otp: "",
      customerPhone: order.contact,
      submitting: false,
      otpSent: false,
    });

    try {
      setActionLoading(order.id);

      const response = await axios.post(`/api/orders/${order.id}/send-delivery-otp/`);

      const data = response.data;

      setOtpState((prev) => ({
        ...prev,
        otpSent: true,
        customerPhone: data.phone,
        deliveryOtp: data.delivery_otp,
      }));

      toast.success(`OTP sent to ${data.phone}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send OTP");
    } finally {
      setActionLoading(null);
    }
  };

  const closeOtpModal = () => {
    setOtpState((prev) => ({
      ...prev,
      open: false,
      order: null,
      otp: "",
    }));
  };

  const handleVerifyOtpAndDeliver = async () => {
    const { order, otp } = otpState;
    if (!order) return;

    if (!otp.trim()) {
      toast.error("Please enter the OTP sent to the customer.");
      return;
    }

    try {
      setOtpState((prev) => ({ ...prev, submitting: true }));

      await axios.post(`/api/orders/${order.id}/verify-delivery-otp/`, {
        otp: otp.trim(),
      });

      toast.success("OTP verified. Order marked as delivered.");

      handleSetStage(order, "delivered");

      closeOtpModal();
    } catch (err) {
      console.error("OTP verify failed", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Invalid OTP. Please try again.";
      toast.error(msg);
    } finally {
      setOtpState((prev) => ({ ...prev, submitting: false }));
    }
  };
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Orders — {caterer?.name || ""}</h1>
        <div className="flex gap-2">
          <button onClick={refresh} className="px-3 py-2 rounded border">
            Refresh
          </button>
          <button
            onClick={() => navigate("/caterer-dashboard")}
            className="px-3 py-2 rounded bg-gray-100"
          >
            Back
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading orders…</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Pending */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Pending Orders ({pendingOrders.length})
            </h2>
            {pendingOrders.length === 0 ? (
              <div className="text-sm text-gray-500">No pending orders.</div>
            ) : (
              <ul className="space-y-3">
                {pendingOrders.map((o) => (
                  <li
                    key={o.id}
                    className="border rounded p-3 flex justify-between items-start"
                  >
                    <div>
                      <div className="font-semibold">
                        Order #{o.id} — ₹{o.total}
                      </div>
                      <div className="text-sm text-gray-600">
                        Plates: {o.plates} · Delivery: {o.delivery_option}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Staff: {o.staff_requested ? "Yes" : "No"}
                      </div>
                      <div className="text-sm text-gray-600">
                        Event: {o.event_date || "—"} {o.event_time || ""}
                      </div>
                      <div className="text-sm text-gray-600">
                        Location: {o.location || "—"}
                      </div>

                      {/* Items */}
                      <div className="text-sm text-gray-600 mt-2">Items:</div>
                      <ul className="text-sm ml-4">
                        {o.items && o.items.length ? (
                          o.items.map((it) => (
                            <li key={it.id}>
                              {it.menu_item_name} ×{it.quantity} — ₹{it.price}
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-gray-400">
                            No item details
                          </li>
                        )}
                      </ul>

                      {/* Notes */}
                      {Array.isArray(o.notes) && o.notes.length > 0 && (
                        <div className="mt-3 bg-gray-50 p-2 rounded border">
                          <div className="text-sm font-medium text-gray-700">
                            Notes:
                          </div>
                          <ul className="text-xs text-gray-600 space-y-1 mt-1">
                            {o.notes.map((n) => (
                              <li key={n.id}>
                                <span className="font-semibold">
                                  {n.user_name || "User"}:
                                </span>{" "}
                                {n.body}
                                {n.created_at && (
                                  <span className="text-gray-400 ml-1">
                                    ({new Date(n.created_at).toLocaleString()})
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleAccept(o)}
                        disabled={actionLoading === o.id}
                        className="px-3 py-2 bg-emerald-600 text-white rounded"
                      >
                        {actionLoading === o.id ? "Processing..." : "Accept"}
                      </button>
                      <button
                        onClick={() => handleReject(o)}
                        disabled={actionLoading === o.id}
                        className="px-3 py-2 bg-red-500 text-white rounded"
                      >
                        {actionLoading === o.id ? "Processing..." : "Reject"}
                      </button>
                      <button
                        onClick={() => handleViewOrder(o.id)}
                        className="text-xs underline text-indigo-600"
                      >
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Accepted */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Accepted ({acceptedOrders.length})
            </h2>

            {acceptedOrders.length === 0 ? (
              <div className="text-sm text-gray-500">No accepted orders.</div>
            ) : (
              <ul className="space-y-2">
                {acceptedOrders.map((o) => {
                  const draft = noteDrafts[o.id] || "";
                  const isWithin8Hours = canStartPreparation(o);
                  const startDisabled = actionLoading === o.id || !isWithin8Hours;

                  return (
                    <li
                      key={o.id}
                      className="border rounded p-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">Order #{o.id}</div>
                          <div className="text-sm text-gray-600">
                            Total: ₹{o.total} · Plates: {o.plates}
                          </div>
                          <div className="text-xs text-gray-500">
                            Event: {o.event_date || "—"} {o.event_time || ""}
                          </div>

                          {/* Notes list */}
                          {Array.isArray(o.notes) && o.notes.length > 0 && (
                            <div className="mt-3 bg-gray-50 p-2 rounded border">
                              <div className="text-sm font-medium text-gray-700">
                                Notes:
                              </div>
                              <ul className="text-xs text-gray-600 space-y-1 mt-1">
                                {o.notes.map((n) => (
                                  <li key={n.id}>
                                    <span className="font-semibold">
                                      {n.user_name || "User"}:
                                    </span>{" "}
                                    {n.body}
                                    <span className="text-gray-400 ml-1">
                                      ({new Date(n.created_at).toLocaleString()})
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Add note input */}
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              placeholder="Add note"
                              value={draft}
                              onChange={(e) =>
                                setNoteDrafts((prev) => ({
                                  ...prev,
                                  [o.id]: e.target.value,
                                }))
                              }
                              className="border px-2 py-1 text-xs w-40 rounded"
                            />
                            <button
                              disabled={!draft.trim()}
                              onClick={() => handleAddNote(o.id)}
                              className={`px-2 py-1 text-xs rounded text-white ${draft.trim()
                                ? "bg-indigo-600 hover:bg-indigo-700"
                                : "bg-indigo-300 cursor-not-allowed"
                                }`}
                            >
                              Add
                            </button>
                          </div>

                          {/* Info note */}
                          {!isWithin8Hours && (
                            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                              You can start preparation only within 24 hours before the event time.
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => handleAdvance(o)}
                            disabled={startDisabled}
                            title={
                              !isWithin8Hours
                                ? "You can start preparation only within 10 hours of event time."
                                : ""
                            }
                            className={`px-3 py-1 rounded text-white ${startDisabled
                              ? "bg-yellow-300 cursor-not-allowed"
                              : "bg-yellow-500 hover:bg-yellow-600"
                              }`}
                          >
                            {actionLoading === o.id ? "Processing..." : "Start Preparation"}
                          </button>

                          <button
                            onClick={() => handleViewOrder(o.id)}
                            className="text-xs underline text-indigo-600"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Preparation In Progress */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Preparation — In Progress ({prepInProgress.length})
            </h2>
            {prepInProgress.length === 0 ? (
              <div className="text-sm text-gray-500">
                No orders in preparation.
              </div>
            ) : (
              <ul className="space-y-2">
                {prepInProgress.map((o) => (
                  <li
                    key={o.id}
                    className="border rounded p-3 flex justify-between items-start"
                  >
                    <div className="flex-1">
                      <div className="font-medium">Order #{o.id}</div>
                      <div className="text-sm text-gray-600">
                        Total: ₹{o.total} · Plates: {o.plates}
                      </div>

                      {/* 🔹 Notes (if present) */}
                      <div className="mt-3 border rounded p-2 bg-gray-50">
                        <div className="text-xs font-semibold mb-1">
                          Internal Notes
                        </div>
                        {o.notes && o.notes.length > 0 ? (
                          <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {o.notes.map((note) => (
                              <li
                                key={note.id}
                                className="text-xs border-b last:border-b-0 pb-1"
                              >
                                <div className="font-medium text-gray-800">
                                  {note.user_name || "Staff"}
                                </div>
                                <div className="text-gray-700">{note.body}</div>
                                <div className="text-[10px] text-gray-500">
                                  {note.created_at
                                    ? new Date(note.created_at).toLocaleString()
                                    : ""}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-gray-500">
                            No notes yet for this order.
                          </div>
                        )}

                        {/* ➕ Add Note */}
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={noteInputs[o.id] || ""}
                            onChange={(e) =>
                              setNoteInputs((prev) => ({
                                ...prev,
                                [o.id]: e.target.value,
                              }))
                            }
                            placeholder="Add a note (eg. ‘Extra sweet’, ‘Delay 15 mins’)"
                            className="flex-1 border rounded px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => handleAddNoteForOrder(o)}
                            disabled={!noteInputs[o.id]?.trim()}
                            className="px-2 py-1 rounded bg-slate-700 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleAdvance(o)}
                        disabled={actionLoading === o.id}
                        className="px-3 py-1 bg-yellow-500 rounded text-white text-xs"
                      >
                        {actionLoading === o.id
                          ? "Processing..."
                          : "Preparation Completed"}
                      </button>
                      <button
                        onClick={() => handleViewOrder(o.id)}
                        className="text-xs underline text-indigo-600"
                      >
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Ready to Deliver (delivery orders) */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Ready to Deliver ({readyToDeliverOrders.length})
            </h2>
            {readyToDeliverOrders.length === 0 ? (
              <div className="text-sm text-gray-500">
                No orders ready to deliver.
              </div>
            ) : (
              <ul className="space-y-2">
                {readyToDeliverOrders.map((o) => (
                  <li
                    key={o.id}
                    className="border rounded p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">Order #{o.id}</div>
                      <div className="text-sm text-gray-600">
                        Total: ₹{o.total} · Plates: {o.plates}
                      </div>
                      <div className="text-xs text-gray-500">
                        Delivery: {o.delivery_option || "delivery"}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => updateOrderStage(o, "delivery_in_progress")}
                        disabled={actionLoading === o.id}
                        className="px-3 py-1 bg-indigo-600 rounded text-white"
                      >
                        Start Delivery
                      </button>
                      <button
                        onClick={() => handleViewOrder(o.id)}
                        className="text-xs underline text-indigo-600"
                      >
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Ready to Pickup (selfpickup orders only) */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Ready to Pickup ({readyToPickupOrders.length})
            </h2>

            {readyToPickupOrders.length === 0 ? (
              <div className="text-sm text-gray-500">No orders ready for pickup.</div>
            ) : (
              <ul className="space-y-2">
                {readyToPickupOrders.map((o) => {
                  const isChecked = !!pickupConfirm[o.id];
                  const noteValue = noteInputs[o.id] || "";

                  const handlePickupClick = async () => {
                    if (!isChecked) {
                      alert(
                        "Please confirm you have collected remaining due & utensils."
                      );
                      return;
                    }

                    try {
                      // Move order to delivery_in_progress (or straight to delivered if you prefer)
                      await updateOrderStage(o, "delivery_in_progress");

                      // Then open OTP modal, which will call send-delivery-otp
                      openOtpForOrder({
                        ...o,
                        contact: o.contact,
                      });
                    } catch (err) {
                      console.error("Pickup->OTP start failed", err);
                      alert("Failed to proceed. Try again.");
                    }
                  };

                  return (
                    <li key={o.id} className="border rounded p-3">
                      <div className="flex justify-between items-start gap-3">
                        {/* Left block: details + checkbox + notes */}
                        <div className="flex-1">
                          <div className="font-medium">Order #{o.id}</div>
                          <div className="text-sm text-gray-600">
                            Total: ₹{o.total} · Plates: {o.plates}
                          </div>
                          <div className="text-xs text-gray-500">
                            Pickup: {o.delivery_option || "selfpickup"}
                          </div>

                          {/* Mandatory checkbox */}
                          <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={isChecked}
                              onChange={(e) =>
                                setPickupConfirm((prev) => ({
                                  ...prev,
                                  [o.id]: e.target.checked,
                                }))
                              }
                            />
                            <span>
                              Collected remaining due & utensils amount from customer.
                            </span>
                          </label>

                          {/* Existing notes (if any) */}
                          {Array.isArray(o.notes) && o.notes.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-semibold text-gray-700 mb-1">
                                Notes
                              </div>
                              <ul className="text-xs bg-gray-50 border rounded p-2 space-y-1 max-h-32 overflow-y-auto">
                                {o.notes.map((n) => (
                                  <li key={n.id} className="text-gray-700">
                                    <span className="font-semibold">
                                      {n.user_name || "Staff"}:
                                    </span>{" "}
                                    {n.body}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Add new note */}
                          <div className="mt-2">
                            <textarea
                              rows={2}
                              className="w-full border rounded px-2 py-1 text-xs"
                              placeholder="Add internal note (visible only to caterer/admin)..."
                              value={noteValue}
                              onChange={(e) =>
                                setNoteInputs((prev) => ({
                                  ...prev,
                                  [o.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              onClick={() => handleAddNoteForOrder(o)}
                              disabled={actionLoading === o.id || !noteValue.trim()}
                              className={`mt-1 px-2 py-1 text-xs rounded ${actionLoading === o.id || !noteValue.trim()
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-gray-800 text-white hover:bg-gray-900"
                                }`}
                            >
                              {actionLoading === o.id ? "Saving..." : "Save Note"}
                            </button>
                          </div>
                        </div>

                        {/* Right block: actions */}
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={handlePickupClick}
                            disabled={actionLoading === o.id || !isChecked}
                            className={`px-3 py-1 rounded text-white ${actionLoading === o.id || !isChecked
                              ? "bg-emerald-300 cursor-not-allowed"
                              : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                              }`}
                          >
                            Picked Up
                          </button>
                          <button
                            onClick={() => handleViewOrder(o.id)}
                            className="text-xs underline text-indigo-600"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Delivery — In Progress (delivery orders only) */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Delivery — In Progress ({deliveryInProgressDelivery.length})
            </h2>

            {deliveryInProgressDelivery.length === 0 ? (
              <div className="text-sm text-gray-500">No delivery in progress.</div>
            ) : (
              <ul className="space-y-2">
                {deliveryInProgressDelivery.map((o) => {
                  const isChecked = !!pickupConfirm[o.id];
                  const noteValue = noteInputs[o.id] || "";

                  const handleDeliveredClick = () => {
                    if (!isChecked) {
                      alert("Please confirm you have collected remaining due from customer.");
                      return;
                    }
                    openOtpForOrder({
                      ...o,
                      contact: o.contact,
                    });
                  };

                  return (
                    <li key={o.id} className="border rounded p-3">
                      <div className="flex justify-between items-start gap-3">

                        {/* LEFT SIDE — Order Info + Notes */}
                        <div className="flex-1">
                          <div className="font-medium">Order #{o.id}</div>
                          <div className="text-sm text-gray-600">
                            Total: ₹{o.total} · Plates: {o.plates}
                          </div>
                          <div className="text-xs text-gray-500">
                            Delivery: {o.delivery_option || "delivery"}
                          </div>

                          {/* Mandatory checkbox */}
                          <label
                            className="mt-2 flex items-center gap-2 text-xs text-gray-700"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={isChecked}
                              onChange={(e) =>
                                setPickupConfirm((prev) => ({
                                  ...prev,
                                  [o.id]: e.target.checked,
                                }))
                              }
                            />
                            <span>Collected remaining due from customer.</span>
                          </label>

                          {/* Existing Notes */}
                          {Array.isArray(o.notes) && o.notes.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-semibold text-gray-700 mb-1">
                                Notes
                              </div>
                              <ul className="text-xs bg-gray-50 border rounded p-2 space-y-1 max-h-32 overflow-y-auto">
                                {o.notes.map((n) => (
                                  <li key={n.id}>
                                    <span className="font-semibold">
                                      {n.user_name || "Staff"}:
                                    </span>{" "}
                                    {n.body}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Add New Note */}
                          <div className="mt-2">
                            <textarea
                              rows={2}
                              className="w-full border rounded px-2 py-1 text-xs"
                              placeholder="Add note..."
                              value={noteValue}
                              onChange={(e) =>
                                setNoteInputs((prev) => ({
                                  ...prev,
                                  [o.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              onClick={() => handleAddNoteForOrder(o)}
                              disabled={actionLoading === o.id || !noteValue.trim()}
                              className={`mt-1 px-2 py-1 text-xs rounded ${actionLoading === o.id || !noteValue.trim()
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-gray-800 text-white hover:bg-gray-900"
                                }`}
                            >
                              {actionLoading === o.id ? "Saving..." : "Save Note"}
                            </button>
                          </div>
                        </div>

                        {/* RIGHT SIDE — Action Buttons */}
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={handleDeliveredClick}
                            disabled={actionLoading === o.id || !isChecked}
                            className={`px-3 py-1 rounded text-white ${actionLoading === o.id || !isChecked
                              ? "bg-indigo-300 cursor-not-allowed"
                              : "bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                              }`}
                          >
                            Mark Delivered
                          </button>

                          <button
                            onClick={() => handleViewOrder(o.id)}
                            className="text-xs underline text-indigo-600"
                          >
                            View
                          </button>
                        </div>

                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Customer Picked Up (selfpickup orders only) */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Customer Picked Up ({deliveryInProgressPickup.length})
            </h2>

            {deliveryInProgressPickup.length === 0 ? (
              <div className="text-sm text-gray-500">
                No pickup orders in progress.
              </div>
            ) : (
              <ul className="space-y-2">
                {deliveryInProgressPickup.map((o) => {
                  const isChecked = !!pickupConfirm[o.id];
                  const noteValue = noteInputs[o.id] || "";

                  const handleReturnedClick = () => {
                    if (!isChecked) {
                      alert(
                        "Please confirm utensils amount has been refunded to the customer."
                      );
                      return;
                    }
                    handleSetStage(o, "delivered");
                  };

                  return (
                    <li key={o.id} className="border rounded p-3">
                      <div className="flex justify-between items-start gap-3">
                        {/* LEFT SIDE — Order info + notes */}
                        <div className="flex-1">
                          <div className="font-medium">Order #{o.id}</div>
                          <div className="text-sm text-gray-600">
                            Total: ₹{o.total} · Plates: {o.plates}
                          </div>
                          <div className="text-xs text-gray-500">
                            Pickup: {o.delivery_option || "selfpickup"}
                          </div>

                          {/* Mandatory checkbox */}
                          <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={isChecked}
                              onChange={(e) =>
                                setPickupConfirm((prev) => ({
                                  ...prev,
                                  [o.id]: e.target.checked,
                                }))
                              }
                            />
                            <span>Utensils amount refunded to customer.</span>
                          </label>

                          {/* Existing Notes */}
                          {Array.isArray(o.notes) && o.notes.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-semibold text-gray-700 mb-1">
                                Notes
                              </div>
                              <ul className="text-xs bg-gray-50 border rounded p-2 space-y-1 max-h-32 overflow-y-auto">
                                {o.notes.map((n) => (
                                  <li key={n.id}>
                                    <span className="font-semibold">
                                      {n.user_name || "Staff"}:
                                    </span>{" "}
                                    {n.body}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Add New Note */}
                          <div className="mt-2">
                            <textarea
                              rows={2}
                              className="w-full border rounded px-2 py-1 text-xs"
                              placeholder="Add note..."
                              value={noteValue}
                              onChange={(e) =>
                                setNoteInputs((prev) => ({
                                  ...prev,
                                  [o.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              onClick={() => handleAddNoteForOrder(o)}
                              disabled={actionLoading === o.id || !noteValue.trim()}
                              className={`mt-1 px-2 py-1 text-xs rounded ${actionLoading === o.id || !noteValue.trim()
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-gray-800 text-white hover:bg-gray-900"
                                }`}
                            >
                              {actionLoading === o.id ? "Saving..." : "Save Note"}
                            </button>
                          </div>
                        </div>

                        {/* RIGHT SIDE — Actions */}
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={handleReturnedClick}
                            disabled={actionLoading === o.id || !isChecked}
                            className={`px-3 py-1 rounded text-white ${actionLoading === o.id || !isChecked
                              ? "bg-emerald-300 cursor-not-allowed"
                              : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                              }`}
                          >
                            Returned Utensils
                          </button>

                          <button
                            onClick={() => handleViewOrder(o.id)}
                            className="text-xs underline text-indigo-600"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Delivered — Delivery Orders */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Delivered ({deliveredDelivery.length})
            </h2>
            {deliveredDelivery.length === 0 ? (
              <div className="text-sm text-gray-500">
                No recently delivered orders.
              </div>
            ) : (
              <ul className="space-y-2">
                {deliveredDelivery.map((o) => (
                  <li
                    key={o.id}
                    className="border rounded p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">Order #{o.id}</div>
                      <div className="text-sm text-gray-600">
                        Total: ₹{o.total} · Plates: {o.plates}
                      </div>
                      <div className="text-xs text-gray-500">
                        Delivery: {o.delivery_option || "delivery"}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleSetStage(o, "completed")}
                        disabled={actionLoading === o.id}
                        className="px-3 py-1 bg-emerald-600 rounded text-white"
                      >
                        Mark Completed
                      </button>
                      <button
                        onClick={() => handleViewOrder(o.id)}
                        className="text-xs underline text-indigo-600"
                      >
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ✔ Self Pickup → Collected Utensils */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Collected Utensils ({deliveredPickup.length})
            </h2>
            {deliveredPickup.length === 0 ? (
              <div className="text-sm text-gray-500">
                No pickup orders pending completion.
              </div>
            ) : (
              <ul className="space-y-2">
                {deliveredPickup.map((o) => (
                  <li
                    key={o.id}
                    className="border rounded p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">Order #{o.id}</div>
                      <div className="text-sm text-gray-600">
                        Total: ₹{o.total} · Plates: {o.plates}
                      </div>
                      <div className="text-xs text-gray-500">
                        Pickup: {o.delivery_option}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {/* Same button functionality */}
                      <button
                        onClick={() => handleSetStage(o, "completed")}
                        disabled={actionLoading === o.id}
                        className="px-3 py-1 bg-emerald-600 rounded text-white"
                      >
                        Mark Completed
                      </button>
                      <button
                        onClick={() => handleViewOrder(o.id)}
                        className="text-xs underline text-indigo-600"
                      >
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Completed */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Completed ({completedOrders.length})
            </h2>
            {completedOrders.length === 0 ? (
              <div className="text-sm text-gray-500">
                No completed orders yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {completedOrders.map((o) => (
                  <li
                    key={o.id}
                    className="border rounded p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">
                        Order #{o.id}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total: ₹{o.total} · Plates: {o.plates}
                      </div>
                      <div className="text-xs text-gray-500">
                        Completed at: {o.updated_at || "-"}
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleViewOrder(o.id)}
                        className="text-xs underline text-indigo-600"
                      >
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rejected / Cancelled */}
          <section className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-3">
              Rejected / Cancelled ({cancelledRejected.length})
            </h2>

            {cancelledRejected.length === 0 ? (
              <div className="text-sm text-gray-500">
                No rejected/cancelled orders.
              </div>
            ) : (
              <ul className="space-y-2">
                {cancelledRejected.map((o) => (
                  <li
                    key={o.id}
                    className="border rounded p-3 flex justify-between items-start"
                  >
                    {/* Left: basic info */}
                    <div>
                      <div className="font-medium text-sm">
                        Order #{o.id} —{" "}
                        <span className="capitalize">{o.status}</span>
                      </div>

                      <div className="text-xs text-gray-600 mt-1">
                        Total: ₹{o.total} · Plates: {o.plates}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        Reason:{" "}
                        {o.admin_reason || o.caterer_note || o.note || "-"}
                      </div>

                      <div className="text-xs text-gray-400 mt-1">
                        Updated: {o.updated_at}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleViewOrder(o.id)}
                        className="text-xs underline text-indigo-600"
                      >
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {otpState.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={closeOtpModal}
                aria-hidden="true"
              />
              <div className="relative bg-white rounded-lg shadow-lg p-4 w-full max-w-sm">
                <h3 className="text-lg font-semibold mb-2">Verify Delivery OTP</h3>
                <p className="text-xs text-gray-600 mb-3">
                  OTP has been sent to customer&apos;s mobile:
                  <span className="font-semibold text-black ml-1">
                    {otpState.customerPhone}
                  </span>
                  . Please confirm and enter the OTP below.
                </p>

                <input
                  type="text"
                  value={otpState.otp}
                  onChange={(e) =>
                    setOtpState((prev) => ({ ...prev, otp: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm mb-3"
                  placeholder="Enter OTP"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeOtpModal}
                    className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyOtpAndDeliver}
                    disabled={otpState.submitting}
                    className={`px-3 py-1 text-sm rounded text-white ${otpState.submitting
                      ? "bg-indigo-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                  >
                    {otpState.submitting ? "Verifying..." : "Verify & Mark Delivered"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- MODAL (SUMMARY-BASED) ---------- */}
      {showOrderModal && selectedOrder && (() => {
        const chargeableTotal = getChargeableTotal(selectedOrder);
        const { paid, remaining, mode } =
          computePaidAndRemainingFromSummary(selectedOrder);

        const ab = selectedOrder.amount_breakdown || {};
        const deliveryFee =
          selectedOrder.delivery_fee ??
          ab.delivery_charge ??
          selectedOrder.delivery_charge ??
          0;
        const staffCharge =
          selectedOrder.staff_charge_server ??
          ab.staff_charge ??
          selectedOrder.staff_charge ??
          0;
        const taxAmount =
          ab.tax_amount ?? selectedOrder.tax_amount ?? 0;
        const couponDiscount =
          ab.coupon_discount ?? selectedOrder.coupon_discount ?? 0;
        const utensilsAdvance =
          selectedOrder.utensils_advance ??
          ab.utensils_advance ??
          0;

        const waterChoice = selectedOrder.water_choice;
        const waterQty = selectedOrder.water_quantity;
        const waterCans = selectedOrder.water_cans_needed;
        const waterCups = selectedOrder.water_cups_needed;
        const waterFree = isTrue(selectedOrder.water_free);
        const waterPriceRaw =
          selectedOrder.water_charge_server ??
          ab.water_charge ??
          selectedOrder.water_estimated_price ??
          0;
        const waterPrice = toNumber(waterPriceRaw);

        const pkg = selectedOrder.selected_package || {};
        const pricePerPlate =
          pkg.price_per_plate ?? selectedOrder.price_per_plate ?? 0;
        const platesCount = toNumber(selectedOrder.plates ?? 0);
        const packageCostCalc = platesCount * pricePerPlate;

        const isVegOnly = isTrue(selectedOrder.veg_only);
        const packageItemsCount =
          selectedOrder.package_items_count ??
          selectedOrder._computed?.package_items_count ??
          null;

        const items = Array.isArray(selectedOrder.items)
          ? selectedOrder.items
          : [];

        const complimentaryItems = items.filter((it) =>
          isTrue(it.is_complementary)
        );

        const paidAddonItems = items
          .filter((it) => !isTrue(it.is_complementary))
          .filter(
            (it) =>
              toNumber(
                it.price ?? it.unit_price ?? it.amount ?? 0
              ) > 0
          );

        // ✅ New: total of paid add-on items (used in Subtotal)
        const paidAddonTotal = paidAddonItems.reduce((sum, it) => {
          const qty = it.quantity ?? it.qty ?? 1;
          const unit = toNumber(
            it.price ?? it.unit_price ?? it.amount ?? 0
          );
          return sum + unit * qty;
        }, 0);

        const createdAt = selectedOrder.created_at
          ? new Date(selectedOrder.created_at).toLocaleString()
          : "-";
        const updatedAt = selectedOrder.updated_at
          ? new Date(selectedOrder.updated_at).toLocaleString()
          : "-";

        const paymentMethod =
          selectedOrder.payment_method ??
          selectedOrder.payment?.method ??
          "-";

        const eventLabel =
          selectedOrder.selected_event ??
          selectedOrder.event_type ??
          null;

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  setAmountOpen(false);
                  setSelectedOrder(null);
                }}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-lg"
              >
                ✕
              </button>

              {/* Header row with VEG badge */}
              <div className="flex items-start justify-between mb-2 pr-8">
                <div>
                  <h2 className="text-xl font-semibold">
                    Order #{selectedOrder.id} —{" "}
                    {fmtAmt(chargeableTotal || selectedOrder.total || 0)}
                  </h2>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <div>Created: {createdAt}</div>
                    <div>Updated: {updatedAt}</div>
                  </div>
                </div>

                {isVegOnly && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-emerald-600 text-emerald-700 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>VEG ONLY</span>
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-600 mb-3">
                <span className="mr-3">
                  <strong>Status:</strong>{" "}
                  {getStageLabel(selectedOrder.status, selectedOrder) || "—"}
                </span>
                <span className="mr-3">
                  <strong>Payment Status:</strong>{" "}
                  {selectedOrder.advance_info?.payment_status ||
                    selectedOrder.payment_status ||
                    "Pending"}
                </span>
                <span className="mr-3">
                  <strong>Payment Method:</strong> {paymentMethod}
                </span>
                <span>
                  <strong>Delivery:</strong>{" "}
                  {selectedOrder.delivery_option ||
                    selectedOrder.delivery ||
                    "—"}
                </span>
              </div>

              {/* Contextual Notes */}
              {(() => {
                const status = selectedOrder.status;
                let note = "";
                if (status === "preparation_inprogress") {
                  note =
                    "Your team should begin preparing the food as per order details.";
                } else if (status === "preparation_completed") {
                  note = "Pack and prepare for handover to delivery.";
                } else if (status === "delivery_in_progress") {
                  note = "Order is currently on the way — ensure timely delivery.";
                } else if (status === "delivered") {
                  note = "Order delivered — please confirm customer satisfaction.";
                }
                return note ? (
                  <div className="text-xs bg-amber-50 border border-amber-200 text-amber-700 p-2 rounded mb-3">
                    <strong>Note:</strong> {note}
                  </div>
                ) : null;
              })()}

              {/* Grid Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <strong>Customer Contact:</strong>{" "}
                    {["pending", "accepted"].includes(selectedOrder.status)
                      ? "Hidden until order is confirmed"
                      : selectedOrder.contact || "N/A"}
                  </p>
                  <p>
                    <strong>Event Date & Time:</strong>{" "}
                    {selectedOrder.event_date || "-"}{" "}
                    {selectedOrder.event_time || ""}
                  </p>
                  {eventLabel && (
                    <p>
                      <strong>Selected Event:</strong> {eventLabel}
                    </p>
                  )}
                  <p>
                    <strong>Location:</strong>{" "}
                    {selectedOrder.location || "—"}
                  </p>
                  <p>
                    <strong>Nearby / Landmark:</strong>{" "}
                    {selectedOrder.nearby || "—"}
                  </p>
                  <p>
                    <strong>Plates:</strong>{" "}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                      {platesCount || "—"}
                    </span>
                  </p>
                  <p>
                    <strong>Staff Requested:</strong>{" "}
                    {isTrue(selectedOrder.include_staff) ? "Yes" : "No"}
                  </p>
                  {packageItemsCount !== null && (
                    <p>
                      <strong>Package Items Count:</strong>{" "}
                      {packageItemsCount}
                    </p>
                  )}
                </div>

                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <strong>Caterer Amount:</strong>{" "}
                    <span className="font-semibold text-emerald-700">
                      {fmtAmt(selectedOrder.caterer_amount ?? 0)}
                    </span>
                  </p>
                  <p>
                    <strong>Platform Fee:</strong>{" "}
                    {fmtAmt(selectedOrder.admin_commission_amount ?? 0)}
                  </p>
                  <p>
                    <strong>Chargeable Total:</strong>{" "}
                    {fmtAmt(chargeableTotal)}
                  </p>

                  <div className="mt-1 text-xs space-y-1">
                    <div>
                      <strong>Payment Mode:</strong>{" "}
                      {mode || paymentMethod || "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-700">
                        Paid: {fmtAmt(paid)}
                      </span>
                    </div>
                    <div>
                      <span
                        className={
                          remaining > 0
                            ? "font-semibold text-rose-600"
                            : "font-semibold text-gray-600"
                        }
                      >
                        Remaining: {fmtAmt(remaining)}
                        {remaining > 0 &&
                          " (to be collected at delivery / pickup)"}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Package Cost:</strong>{" "}
                    {fmtAmt(pricePerPlate)} × {platesCount} plates ={" "}
                    {fmtAmt(packageCostCalc)}
                  </p>

                  {toNumber(utensilsAdvance) > 0 && (
                    <p className="text-xs font-semibold text-rose-600">
                      Utensils refundable deposit:{" "}
                      {fmtAmt(utensilsAdvance)} (to be settled after
                      pickup/return)
                    </p>
                  )}
                </div>
              </div>

              {/* Download Invoice */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleDownloadInvoice(selectedOrder)}
                  disabled={generatingInvoice}
                  className={`px-4 py-2 rounded text-sm inline-flex items-center gap-2 ${generatingInvoice
                    ? "bg-gray-300 text-gray-700"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                >
                  {generatingInvoice ? "Generating…" : "Download Invoice (PDF)"}
                </button>
              </div>

              {/* Amount Breakdown Collapsible */}
              <div className="mt-4">
                <button
                  onClick={() => setAmountOpen((s) => !s)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 border rounded-md text-sm"
                >
                  <span className="font-medium">Amount Breakdown</span>
                  <span className="text-xs text-gray-500">
                    {amountOpen ? "Hide" : "Show details"}
                  </span>
                </button>

                {amountOpen && (
                  <div className="mt-3 p-4 border rounded-md bg-white text-sm text-gray-700 space-y-2">
                    {(() => {
                      // ✅ Subtotal = Package cost + Paid Add-ons total
                      const subtotal = packageCostCalc + paidAddonTotal;

                      return (
                        <>
                          <div className="flex justify-between">
                            <div>Subtotal</div>
                            <div>{fmtAmt(subtotal)}</div>
                          </div>
                          <div className="flex justify-between">
                            <div>Delivery</div>
                            <div>
                              {toNumber(deliveryFee) === 0 ? (
                                <span className="text-emerald-600 font-medium text-xs">
                                  Free
                                </span>
                              ) : (
                                fmtAmt(deliveryFee)
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div>Staff</div>
                            <div>
                              {toNumber(staffCharge) === 0 ? (
                                <span className="text-gray-500 text-xs">
                                  {isTrue(selectedOrder.include_staff)
                                    ? "Included"
                                    : "Not selected"}
                                </span>
                              ) : (
                                fmtAmt(staffCharge)
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div>Water</div>
                            <div className="text-right">
                              {waterFree || toNumber(waterPrice) === 0 ? (
                                <div className="text-emerald-600 font-medium text-xs">
                                  Free
                                  {waterQty ? ` (${waterQty} units)` : ""}
                                </div>
                              ) : (
                                fmtAmt(waterPrice)
                              )}
                              {(waterChoice ||
                                waterQty ||
                                waterCans ||
                                waterCups) && (
                                  <div className="text-[11px] text-gray-500">
                                    {waterChoice && `Type: ${waterChoice} · `}
                                    {waterQty && `Qty: ${waterQty} · `}
                                    {waterCans &&
                                      `Cans: ${waterCans} · `}
                                    {waterCups &&
                                      `Cups: ${waterCups}`}
                                  </div>
                                )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div>Tax</div>
                            <div>{fmtAmt(taxAmount)}</div>
                          </div>
                          <div className="flex justify-between">
                            <div>Coupon</div>
                            <div className="text-rose-600">
                              {couponDiscount
                                ? `- ${fmtAmt(
                                  Math.abs(couponDiscount)
                                )}`
                                : fmtAmt(0)}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div>Utensils (refundable)</div>
                            <div
                              className={
                                toNumber(utensilsAdvance) > 0
                                  ? "font-semibold text-rose-600"
                                  : ""
                              }
                            >
                              {toNumber(utensilsAdvance) === 0
                                ? fmtAmt(0)
                                : fmtAmt(utensilsAdvance)}
                            </div>
                          </div>

                          <div className="border-t pt-2 flex justify-between font-semibold">
                            <div>Total Pay</div>
                            <div>{fmtAmt(chargeableTotal)}</div>
                          </div>

                          <div className="text-xs mt-1">
                            <span className="text-emerald-700 font-semibold">
                              Paid: {fmtAmt(paid)}
                            </span>
                            {" · "}
                            <span
                              className={
                                remaining > 0
                                  ? "text-rose-600 font-semibold"
                                  : "text-gray-600 font-semibold"
                              }
                            >
                              Remaining: {fmtAmt(remaining)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Water details box (explicit) */}
              {(waterChoice ||
                waterQty ||
                waterCans ||
                waterCups ||
                waterFree ||
                waterPrice) && (
                  <div className="mt-4 p-3 border rounded-md bg-blue-50 text-xs text-gray-700 space-y-1">
                    <div className="font-semibold text-blue-800">
                      Water details
                    </div>
                    {waterChoice && <div>Choice: {waterChoice}</div>}
                    {waterQty && <div>Quantity: {waterQty}</div>}
                    {waterCans && <div>Cans needed: {waterCans}</div>}
                    {waterCups && <div>Cups needed: {waterCups}</div>}
                    <div>
                      Price:{" "}
                      {waterFree || toNumber(waterPrice) === 0 ? (
                        <span className="text-emerald-600 font-semibold">
                          Free
                        </span>
                      ) : (
                        fmtAmt(waterPrice)
                      )}
                    </div>
                  </div>
                )}

              {/* Package, Composition & Items */}
              <div className="mt-4">
                <h3 className="font-medium mb-2">Ordered Items & Package</h3>

                <div className="mb-3 p-3 border rounded text-sm bg-gray-50 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {pkg.name ??
                        pkg.title ??
                        selectedOrder.package_name ??
                        "Package"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {fmtAmt(pricePerPlate)} / plate × {platesCount} plates ={" "}
                      {fmtAmt(packageCostCalc)}
                    </div>
                  </div>
                </div>

                {/* Package composition from composition_structure.sections with selected: true */}
                <div className="mb-3">
                  <div className="text-sm font-medium">Package composition</div>
                  <div className="text-sm ml-2 mt-1 space-y-2">
                    {(() => {
                      const sections =
                        pkg.composition_structure?.sections || {};
                      const out = [];

                      for (const [secKey, sec] of Object.entries(sections)) {
                        const opts = Array.isArray(sec.options)
                          ? sec.options
                          : [];
                        const selectedOpts = opts.filter((op) =>
                          isTrue(op?.selected)
                        );
                        if (!selectedOpts.length) continue;

                        const label = sec.title || sec.name || secKey;

                        out.push(
                          <div
                            key={secKey}
                            className="p-2 border rounded bg-white"
                          >
                            <div className="font-medium">{label}</div>
                            <ul className="ml-4 text-sm mt-1">
                              {selectedOpts.map((it, i) => (
                                <li key={i}>
                                  {it.name || it.title || "Item"}
                                  {it.required && (
                                    <span className="text-xs text-amber-600 ml-1">
                                      (required)
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }

                      return out.length ? (
                        out
                      ) : (
                        <div className="text-xs text-gray-400">
                          No explicitly selected composition items.
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Complimentary / Free items */}
                <div className="mb-3">
                  <div className="text-sm font-medium">
                    Complimentary / Free Items
                  </div>
                  <ul className="text-sm ml-4 mt-1 space-y-1">
                    {complimentaryItems.length ? (
                      complimentaryItems.map((it) => {
                        const name =
                          it.menu_item_name ??
                          it.name ??
                          it.title ??
                          "Item";
                        return (
                          <li
                            key={it.id}
                            className="flex items-center justify-between"
                          >
                            <span>{name}</span>
                            <span className="text-xs font-semibold text-emerald-600">
                              Free
                            </span>
                          </li>
                        );
                      })
                    ) : selectedOrder.default_menu_items?.length ? (
                      selectedOrder.default_menu_items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center justify-between"
                        >
                          <span>
                            {it.name ?? it.menu_item_name ?? "Item"}
                          </span>
                          <span className="text-xs font-semibold text-emerald-600">
                            Free
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-gray-400">
                        No complimentary items.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Paid Add-on Items */}
                <div className="mb-3">
                  <div className="text-sm font-medium">
                    Paid Add-on Items
                  </div>
                  <ul className="text-sm ml-4 mt-1 space-y-1">
                    {paidAddonItems.length ? (
                      paidAddonItems.map((a) => {
                        const name =
                          a.name ??
                          a.menu_item_name ??
                          a.title ??
                          "Addon";
                        const qty = a.quantity ?? a.qty ?? 1;
                        const unit = toNumber(
                          a.price ?? a.unit_price ?? a.amount ?? 0
                        );
                        const lineTotal = unit * qty;
                        return (
                          <li
                            key={a.id}
                            className="flex items-center justify-between"
                          >
                            <span>
                              {name}{" "}
                              {qty ? (
                                <span className="text-xs text-gray-500">
                                  × {qty}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-xs text-gray-700">
                              {fmtAmt(unit)} / plate ·{" "}
                              <span className="font-semibold">
                                {fmtAmt(lineTotal)}
                              </span>
                            </span>
                          </li>
                        );
                      })
                    ) : selectedOrder.addon_items?.length ? (
                      selectedOrder.addon_items.map((a) => {
                        const name =
                          a.name ??
                          a.menu_item_name ??
                          "Addon";
                        const qty = a.quantity ?? a.qty ?? 1;
                        const unit = toNumber(
                          a.price ?? a.unit_price ?? a.amount ?? 0
                        );
                        const lineTotal = unit * qty;
                        return (
                          <li
                            key={a.id}
                            className="flex items-center justify-between"
                          >
                            <span>
                              {name}{" "}
                              {qty ? (
                                <span className="text-xs text-gray-500">
                                  × {qty}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-xs text-gray-700">
                              {fmtAmt(unit)} / plate ·{" "}
                              <span className="font-semibold">
                                {fmtAmt(lineTotal)}
                              </span>
                            </span>
                          </li>
                        );
                      })
                    ) : (
                      <li className="text-xs text-gray-400">
                        No paid add-ons.
                      </li>
                    )}
                  </ul>
                </div>
                {/* ---------- Notes Section ---------- */}
                <div className="mt-4 border-t pt-3">
                  <h4 className="font-semibold text-sm mb-2">Internal Notes</h4>

                  {selectedOrder?.notes?.length > 0 ? (
                    <ul className="text-xs space-y-2">
                      {selectedOrder.notes.map((note) => (
                        <li key={note.id} className="p-2 rounded bg-gray-50 border">
                          <div className="font-medium">{note.user_name || "Unknown"}</div>
                          <div className="text-gray-700">{note.body}</div>
                          <div className="text-[10px] text-gray-500">
                            {new Date(note.created_at).toLocaleString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-gray-500">No notes added.</div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowOrderModal(false);
                    setSelectedOrder(null);
                    setAmountOpen(false);
                  }}
                  className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}