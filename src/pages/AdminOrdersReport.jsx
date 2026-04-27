// src/pages/AdminOrdersReport.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import generateInvoice from "../utils/invoice"; // default export from utils/invoice.js

const AdminOrdersReport = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]); // list data for tables
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'caterer'

  // Summary state (detail API /summary/)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // Filters for All Orders
  const [deliveryFilter, setDeliveryFilter] = useState("all"); // all | delivery | self
  const [staffFilter, setStaffFilter] = useState("all"); // all | yes | no
  const [statusFilter, setStatusFilter] = useState("all"); // all | <status>

  // Caterer accordion open/close
  const [expandedCaterers, setExpandedCaterers] = useState({}); // { [catererId]: bool }

  const summaryRef = useRef(null);

  // ---------- Admin guard ----------
  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role !== "admin") {
      toast.error("You are not authorized to view this page.");
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // ---------- Fetch list of orders (/api/admin/orders/) ----------
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/api/admin/orders/");
        const data = res.data;

        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data && Array.isArray(data.results)) {
          list = data.results;
        } else if (data && Array.isArray(data.orders)) {
          list = data.orders;
        } else {
          console.warn("Unexpected orders response shape:", data);
        }

        setOrders(list);
      } catch (err) {
        console.error("Failed to load admin orders:", err);
        toast.error("Failed to load orders.");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const hasOrders = Array.isArray(orders) && orders.length > 0;

  // ---------- Helpers ----------
  const normalizeDeliveryOption = (order) => {
    const raw = (
      order?.delivery_option ||
      order?.delivery_type ||
      order?.delivery ||
      ""
    )
      .toString()
      .toLowerCase();

    if (
      raw === "self" ||
      raw === "selfpickup" ||
      raw === "self_pickup" ||
      raw === "pickup"
    ) {
      return "self";
    }
    if (!raw) return "unknown";
    return "delivery";
  };

  const getChargeableTotalListRow = (order) =>
    order?.chargeable_total ??
    order?.amount_breakdown?.total ??
    order?.total_amount ??
    order?.total ??
    0;

  // Unique order statuses from list API (for filter options)
  const statusOptions = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => {
      if (o.status) set.add(o.status.toString());
    });
    return Array.from(set);
  }, [orders]);

  // ---------- Filters for All Orders ----------
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter((order) => {
      const deliveryType = normalizeDeliveryOption(order);
      const staffRequested = !!order.staff_requested;
      const statusRaw = (order.status || "").toString().toLowerCase();

      if (deliveryFilter === "delivery" && deliveryType !== "delivery") {
        return false;
      }
      if (deliveryFilter === "self" && deliveryType !== "self") {
        return false;
      }

      if (staffFilter === "yes" && !staffRequested) return false;
      if (staffFilter === "no" && staffRequested) return false;

      if (
        statusFilter !== "all" &&
        statusFilter.toLowerCase() !== statusRaw
      ) {
        return false;
      }

      return true;
    });
  }, [orders, deliveryFilter, staffFilter, statusFilter]);

  const hasFilteredOrders =
    Array.isArray(filteredOrders) && filteredOrders.length > 0;

  // ---------- Caterer-wise grouping ----------
  const ordersByCaterer = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const map = {};
    for (const order of orders) {
      const catererId = order?.caterer ?? "unknown"; // from sample: caterer: 1
      const catererName =
        order?.caterer_name || order?.caterer?.name || "Unknown Caterer";

      if (!map[catererId]) {
        map[catererId] = {
          catererId,
          catererName,
          orders: [],
        };
      }
      map[catererId].orders.push(order);
    }
    return Object.values(map);
  }, [orders]);

  const toggleCaterer = (catererId) => {
    setExpandedCaterers((prev) => ({
      ...prev,
      [catererId]: !prev[catererId],
    }));
  };

  // ---------- Summary API (detail) ----------
  // Uses: GET /api/orders/{id}/summary/
  const fetchOrderSummary = async (orderId) => {
    setSummaryError("");
    setSummaryLoading(true);
    try {
      const res = await axiosInstance.get(`/api/orders/${orderId}/summary/`);
      // API returns: { order: {...} }
      const orderObj = res.data?.order || res.data;
      setSelectedOrder(orderObj);

      // scroll to summary section
      setTimeout(() => {
        if (summaryRef.current) {
          summaryRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 50);
    } catch (err) {
      console.error("Failed to load order summary:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to load order summary.";
      setSummaryError(msg);
      toast.error(msg);
      setSelectedOrder(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  // ---------- Invoice download (use same summary API) ----------
  const handleDownloadInvoice = async (order) => {
    try {
      const res = await axiosInstance.get(`/api/orders/${order.id}/summary/`);
      const orderObj = res.data?.order || res.data;
      generateInvoice(orderObj);
    } catch (e) {
      console.error("Invoice download failed:", e);
      toast.error("Failed to download invoice.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">
            Admin – Orders &amp; Caterer Orders
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="px-3 py-2 rounded-md text-sm font-medium text-white bg-gray-700 hover:bg-gray-800"
          >
            Back to Admin Dashboard
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "all"
                ? "border-[#204DCB] text-[#204DCB]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            All Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("caterer")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "caterer"
                ? "border-[#204DCB] text-[#204DCB]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Caterer-wise Orders
          </button>
        </div>

        {loading && <p className="text-gray-500">Loading orders...</p>}

        {!loading && !hasOrders && (
          <p className="text-gray-500">No orders found.</p>
        )}

        {/* ================== All Orders Tab ================== */}
        {!loading && activeTab === "all" && hasOrders && (
          <div className="overflow-x-auto mb-8">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                {/* Header labels */}
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-2">Order ID</th>
                  <th className="px-4 py-2">Caterer</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Event Date/Time</th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Delivery</th>
                  <th className="px-4 py-2">Staff</th>
                  <th className="px-4 py-2">Order Status</th>
                  <th className="px-4 py-2">Chargeable Total</th>
                  <th className="px-4 py-2">Paid</th>
                  <th className="px-4 py-2">Remaining</th>
                  <th className="px-4 py-2">Payment Status</th>
                  <th className="px-4 py-2">Created At</th>
                  <th className="px-4 py-2">Updated At</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
                {/* Header filter row */}
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1">
                    <select
                      value={deliveryFilter}
                      onChange={(e) => setDeliveryFilter(e.target.value)}
                      className="w-full border rounded-md px-2 py-1 text-xs"
                    >
                      <option value="all">All</option>
                      <option value="delivery">Delivery</option>
                      <option value="self">Self pickup</option>
                    </select>
                  </th>
                  <th className="px-4 py-1">
                    <select
                      value={staffFilter}
                      onChange={(e) => setStaffFilter(e.target.value)}
                      className="w-full border rounded-md px-2 py-1 text-xs"
                    >
                      <option value="all">All</option>
                      <option value="yes">Staff requested</option>
                      <option value="no">No staff</option>
                    </select>
                  </th>
                  <th className="px-4 py-1">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full border rounded-md px-2 py-1 text-xs"
                    >
                      <option value="all">All</option>
                      {statusOptions.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                  <th className="px-4 py-1" />
                </tr>
              </thead>
              <tbody>
                {!hasFilteredOrders && (
                  <tr>
                    <td
                      colSpan={15}
                      className="px-4 py-4 text-center text-gray-500"
                    >
                      No orders match the selected filters.
                    </td>
                  </tr>
                )}

                {hasFilteredOrders &&
                  filteredOrders.map((order) => {
                    const adv = order.advance_info || {};
                    const chargeableTotal = getChargeableTotalListRow(order);
                    const deliveryType = normalizeDeliveryOption(order);
                    return (
                      <tr key={order.id} className="border-t">
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => fetchOrderSummary(order.id)}
                            className="text-[#204DCB] hover:underline"
                          >
                            #{order.id}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          {order.caterer_name ||
                            order?.caterer?.name ||
                            "Unknown Caterer"}
                        </td>
                        <td className="px-4 py-2">
                          {order?.customer_name ||
                            order?.user_name ||
                            order?.user?.first_name ||
                            "N/A"}
                        </td>
                        <td className="px-4 py-2">
                          {order.event_date || "-"}{" "}
                          {order.event_time ? `@ ${order.event_time}` : ""}
                        </td>
                        <td className="px-4 py-2">{order.contact || "-"}</td>
                        <td className="px-4 py-2 capitalize">
                          {deliveryType === "self"
                            ? "Self pickup"
                            : order.delivery_option || "Delivery"}
                        </td>
                        <td className="px-4 py-2">
                          {order.staff_requested ? "Yes" : "No"}
                        </td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100">
                            {order.status || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          ₹{Number(chargeableTotal || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          ₹{Number(adv.paid_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          ₹{Number(adv.remaining_due || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 capitalize">
                          {adv.payment_status || order.payment_status || "-"}
                        </td>
                        <td className="px-4 py-2">
                          {order.created_at
                            ? new Date(order.created_at).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          {order.updated_at
                            ? new Date(order.updated_at).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-4 py-2 space-y-1">
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(order)}
                            className="block text-xs text-gray-700 hover:underline"
                          >
                            Download Invoice
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* ================== Caterer-wise Tab ================== */}
        {!loading && activeTab === "caterer" && hasOrders && (
          <div className="space-y-4 mb-8">
            {ordersByCaterer.map((block) => {
              const isOpen = !!expandedCaterers[block.catererId];
              return (
                <div
                  key={block.catererId}
                  className="border rounded-xl overflow-hidden"
                >
                  {/* Card header (accordion trigger) */}
                  <button
                    type="button"
                    onClick={() => toggleCaterer(block.catererId)}
                    className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center"
                  >
                    <div className="text-left">
                      <p className="font-semibold">
                        {block.catererName} (ID: {block.catererId})
                      </p>
                      <p className="text-xs text-gray-500">
                        Total Orders: {block.orders.length}
                      </p>
                    </div>
                    <span className="text-lg text-gray-600">
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-4 py-2">Order ID</th>
                            <th className="px-4 py-2">Customer</th>
                            <th className="px-4 py-2">Chargeable Total</th>
                            <th className="px-4 py-2">Paid</th>
                            <th className="px-4 py-2">Remaining</th>
                            <th className="px-4 py-2">Payment Status</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Created At</th>
                            <th className="px-4 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.orders.map((order) => {
                            const adv = order.advance_info || {};
                            const chargeableTotal =
                              getChargeableTotalListRow(order);
                            return (
                              <tr key={order.id} className="border-t">
                                <td className="px-4 py-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fetchOrderSummary(order.id)
                                    }
                                    className="text-[#204DCB] hover:underline"
                                  >
                                    #{order.id}
                                  </button>
                                </td>
                                <td className="px-4 py-2">
                                  {order?.customer_name ||
                                    order?.user_name ||
                                    order?.user?.first_name ||
                                    "N/A"}
                                </td>
                                <td className="px-4 py-2">
                                  ₹{Number(chargeableTotal || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-2">
                                  ₹{Number(adv.paid_amount || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-2">
                                  ₹{Number(adv.remaining_due || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-2 capitalize">
                                  {adv.payment_status ||
                                    order.payment_status ||
                                    "-"}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100">
                                    {order.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  {order.created_at
                                    ? new Date(
                                        order.created_at
                                      ).toLocaleString()
                                    : "-"}
                                </td>
                                <td className="px-4 py-2 space-y-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDownloadInvoice(order)
                                    }
                                    className="block text-xs text-gray-700 hover:underline"
                                  >
                                    Download Invoice
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ================== Selected Order Summary (from /summary/) ================== */}
        {(selectedOrder || summaryLoading || summaryError) && (
          <div
            ref={summaryRef}
            className="mt-8 border rounded-2xl p-4 bg-gray-50"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                {selectedOrder
                  ? `Order Summary – #${selectedOrder.id}`
                  : "Order Summary"}
              </h2>
              {selectedOrder && (
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Close
                </button>
              )}
            </div>

            {summaryLoading && (
              <p className="text-sm text-gray-500 mb-2">
                Loading order summary...
              </p>
            )}
            {summaryError && (
              <p className="text-sm text-red-600 mb-2">{summaryError}</p>
            )}

            {selectedOrder && (
              <>
                {(() => {
                  // Everything here is from /summary/ → { order: {...} }
                  const o = selectedOrder;
                  const pkg = o.selected_package || null;

                  const chargeableTotal =
                    o.chargeable_total ??
                    o._computed?.total ??
                    o.total ??
                    0;
                  const paidAmount =
                    o.paid_amount ??
                    o.amount_paid ??
                    o.advance_info?.paid_amount ??
                    0;
                  const remainingDue =
                    o.remaining_due ??
                    o.remaining ??
                    o.advance_info?.remaining_due ??
                    0;
                  const paymentStatus =
                    o.payment_status ?? o.advance_info?.payment_status ?? "-";
                  const adminCommissionTotal =
                    o.admin_commission_amount ??
                    o.advance_info?.admin_commission_amount ??
                    0;
                  const adminCommissionPaid =
                    o.admin_commission_paid ??
                    o.advance_info?.admin_commission_paid ??
                    0;
                  const catererAmount =
                    o.caterer_amount ??
                    o.advance_info?.caterer_amount ??
                    0;
                  const catererAmountPaid =
                    o.caterer_amount_paid ??
                    o.advance_info?.caterer_amount_paid ??
                    0;

                  // Created/Updated At – use order.created_at or fallback to selected_package.created_at
                  const createdAt = o.created_at || pkg?.created_at || null;
                  const updatedAt = o.updated_at || pkg?.updated_at || null;

                  const formatDateTime = (value) =>
                    value
                      ? new Date(value).toLocaleString()
                      : "-";

                  // Event & package info
                  const eventType =
                    o.event_type ||
                    o.selected_event ||
                    (Array.isArray(o.event_types) && o.event_types[0]) ||
                    "-";
                  const packageItemsCount =
                    o.package_items_count ?? o._computed?.package_items_count;

                  // Water details
                  const waterChoice = o.water_choice || "-";
                  const waterQuantity =
                    o.water_quantity !== null &&
                    o.water_quantity !== undefined
                      ? o.water_quantity
                      : "-";
                  const waterEstimatedPrice = o.water_estimated_price || 0;
                  const waterFree =
                    o.water_free === true
                      ? "Yes"
                      : o.water_free === false
                      ? "No"
                      : "-";
                  const waterFreeThreshold = o.water_free_threshold || 0;
                  const waterCansNeeded =
                    o.water_cans_needed !== null &&
                    o.water_cans_needed !== undefined
                      ? o.water_cans_needed
                      : "-";
                  const waterCupsNeeded =
                    o.water_cups_needed !== null &&
                    o.water_cups_needed !== undefined
                      ? o.water_cups_needed
                      : "-";

                  const formatMoney = (v) =>
                    `₹${Number(v || 0).toFixed(2)}`;

                  return (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 text-sm">
                        {/* Left column */}
                        <div className="space-y-1">
                          <p>
                            <span className="font-medium">Caterer: </span>
                            {o.caterer_name ||
                              o?.caterer?.name ||
                              "Unknown Caterer"}
                          </p>
                          <p>
                            <span className="font-medium">Customer: </span>
                            {o?.customer_name ||
                              o?.user_name ||
                              o?.user?.first_name ||
                              "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Contact: </span>
                            {o.contact_primary ||
                              o.contact ||
                              o.contact_secondary ||
                              "-"}
                          </p>
                          <p>
                            <span className="font-medium">Location: </span>
                            {o.location || "-"}
                          </p>
                          <p>
                            <span className="font-medium">Nearby: </span>
                            {o.nearby || "-"}
                          </p>
                          <p>
                            <span className="font-medium">Event: </span>
                            {o.event_date || "-"}{" "}
                            {o.event_time ? `@ ${o.event_time}` : ""}
                          </p>
                          <p>
                            <span className="font-medium">Event Type: </span>
                            {eventType}
                          </p>
                          <p>
                            <span className="font-medium">
                              Delivery Option:{" "}
                            </span>
                            {o.delivery_option || "-"}
                          </p>
                          <p>
                            <span className="font-medium">
                              Staff Requested:{" "}
                            </span>
                            {o.include_staff || o.staff_requested
                              ? "Yes"
                              : "No"}
                          </p>
                          <p>
                            <span className="font-medium">Status: </span>
                            {o.status}
                          </p>
                        </div>

                        {/* Right column */}
                        <div className="space-y-1">
                          <p>
                            <span className="font-medium">
                              Chargeable Total:{" "}
                            </span>
                            {formatMoney(chargeableTotal)}
                          </p>
                          <p>
                            <span className="font-medium">Paid Amount: </span>
                            {formatMoney(paidAmount)}
                          </p>
                          <p>
                            <span className="font-medium">Remaining Due: </span>
                            {formatMoney(remainingDue)}
                          </p>
                          <p>
                            <span className="font-medium">
                              Payment Status:{" "}
                            </span>
                            {paymentStatus}
                          </p>
                          <p>
                            <span className="font-medium">
                              Admin Commission Total:{" "}
                            </span>
                            {formatMoney(adminCommissionTotal)}
                          </p>
                          <p>
                            <span className="font-medium">
                              Admin Commission Paid:{" "}
                            </span>
                            {formatMoney(adminCommissionPaid)}
                          </p>
                          <p>
                            <span className="font-medium">
                              Caterer Amount:{" "}
                            </span>
                            {formatMoney(catererAmount)}
                          </p>
                          <p>
                            <span className="font-medium">
                              Caterer Amount Paid:{" "}
                            </span>
                            {formatMoney(catererAmountPaid)}
                          </p>
                          <p>
                            <span className="font-medium">
                              Package Items Count:{" "}
                            </span>
                            {packageItemsCount ?? "-"}
                          </p>
                          <p>
                            <span className="font-medium">Created At: </span>
                            {createdAt ? formatDateTime(createdAt) : "-"}
                          </p>
                          <p>
                            <span className="font-medium">Updated At: </span>
                            {updatedAt ? formatDateTime(updatedAt) : "-"}
                          </p>
                        </div>
                      </div>

                      {/* Package info from selected_package */}
                      {pkg && (
                        <div className="mt-4 text-sm space-y-1">
                          <h3 className="font-semibold text-sm">
                            Package Details
                          </h3>
                          <p>
                            <span className="font-medium">Name: </span>
                            {pkg.name}
                          </p>
                          <p>
                            <span className="font-medium">
                              Price per plate:{" "}
                            </span>
                            {formatMoney(pkg.price_per_plate)}
                          </p>
                          <p>
                            <span className="font-medium">Plates: </span>
                            {o.plates ?? "-"}
                          </p>
                          <p>
                            <span className="font-medium">
                              Package Created At:{" "}
                            </span>
                            {pkg.created_at
                              ? formatDateTime(pkg.created_at)
                              : "-"}
                          </p>
                          <p>
                            <span className="font-medium">
                              Package Updated At:{" "}
                            </span>
                            {pkg.updated_at
                              ? formatDateTime(pkg.updated_at)
                              : "-"}
                          </p>
                        </div>
                      )}

                      {/* Water details from summary */}
                      <div className="mt-4 text-sm space-y-1">
                        <h3 className="font-semibold text-sm">
                          Water Details
                        </h3>
                        <p>
                          <span className="font-medium">Water Choice: </span>
                          {waterChoice}
                        </p>
                        <p>
                          <span className="font-medium">Water Quantity: </span>
                          {waterQuantity}
                        </p>
                        <p>
                          <span className="font-medium">
                            Water Estimated Price:{" "}
                          </span>
                          {formatMoney(waterEstimatedPrice)}
                        </p>
                        <p>
                          <span className="font-medium">
                            Water Free Eligible:{" "}
                          </span>
                          {waterFree}
                        </p>
                        <p>
                          <span className="font-medium">
                            Water Free Threshold:{" "}
                          </span>
                          {waterFreeThreshold
                            ? formatMoney(waterFreeThreshold)
                            : "₹0.00"}
                        </p>
                        <p>
                          <span className="font-medium">
                            Water Cans Needed:{" "}
                          </span>
                          {waterCansNeeded}
                        </p>
                        <p>
                          <span className="font-medium">
                            Water Cups Needed:{" "}
                          </span>
                          {waterCupsNeeded}
                        </p>
                      </div>
                    </>
                  );
                })()}

                {/* Items from summary */}
                <div className="mt-4">
                  <h3 className="font-semibold mb-2 text-sm">
                    Items ({selectedOrder.items?.length || 0})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Price</th>
                          <th className="px-3 py-2">Complementary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2">
                              {item.menu_item_name}
                            </td>
                            <td className="px-3 py-2">{item.quantity}</td>
                            <td className="px-3 py-2">
                              ₹{Number(item.price || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              {item.is_complementary ? "Yes" : "No"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadInvoice(selectedOrder)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[#204DCB] hover:bg-[#1b3fa8]"
                  >
                    Download Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300"
                  >
                    Close Summary
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrdersReport;