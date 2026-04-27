// src/pages/OrderSuccess.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ConfettiCelebration from "../components/ConfettiCelebration";
import axios from "../shared-lib/axiosInstance";
import generateInvoicePdf from "../utils/invoice";

/**
 * OrderSuccess
 *
 * Single action: Download Invoice (PDF)
 * Uses shared invoice generator (src/utils/invoice.js)
 */
export default function OrderSuccess() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handlePopState = (event) => {
      event.preventDefault();
      // Always send user to home instead of previous page
      navigate("/", { replace: true });
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  const initialOrder = location?.state?.order || null;
  const initialPayment = location?.state?.payment || null;

  const [order, setOrder] = useState(initialOrder);
  const [payment, setPayment] = useState(initialPayment);
  const [showConfetti, setShowConfetti] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [fetchingLatest, setFetchingLatest] = useState(false);

  // ---------- helpers ----------
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


  // extract latest payment object from order response
  const extractLatestPayment = (o) => {
    if (!o) return null;
    if (o.latest_payment) return o.latest_payment;
    if (o.advance_info && o.advance_info.latest_payment)
      return o.advance_info.latest_payment;
    if (o.payment) return o.payment;
    return null;
  };

  const getChargeableTotal = (o) => {
    const candidates = [
      o?.chargeable_total,
      o?.amount_breakdown?.total,
      o?.amount_breakdown?.chargeable_total,
      o?.total,
      o?.total_amount,
      o?.amount,
    ];
    for (const c of candidates) {
      if (c !== null && c !== undefined && String(c) !== "") {
        return toNumber(c);
      }
    }
    return 0;
  };
  // Determine paid & remaining based on explicit payment_mode / payment_method
  const computePaidAndRemaining = (o, preservedPaymentMode) => {
    const chargeableTotal = getChargeableTotal(o);

    // NOTE: look at payment_mode OR payment_method
    const paymentKindRaw =
      o?.payment_mode ??
      o?.payment_method ??
      preservedPaymentMode ??
      "";
    const paymentKind = String(paymentKindRaw).toLowerCase();

    // Full payment – paid == chargeable total, remaining 0
    if (paymentKind === "full") {
      return {
        paid: chargeableTotal,
        remaining: 0,
        paymentMode: "full",
      };
    }

    // Advance mode – use latest_payment or amount_paid
    if (paymentKind === "advance") {
      const latest = extractLatestPayment(o);
      const paidAmt = latest
        ? toNumber(latest.amount ?? latest?.paid ?? 0)
        : toNumber(o?.amount_paid ?? o?.paid_amount ?? 0);
      const remaining = Math.max(
        0,
        Number((chargeableTotal - paidAmt).toFixed(2))
      );
      return { paid: paidAmt, remaining, paymentMode: "advance" };
    }

    // infer from advance_info.latest_payment / payment_status
    const latest = extractLatestPayment(o);
    if (
      latest &&
      latest.amount &&
      (String(o?.payment_status || "")
        .toLowerCase()
        .includes("part") ||
        String(o?.payment_status || "").toLowerCase() === "created")
    ) {
      const paidAmt = toNumber(latest.amount);
      return {
        paid: paidAmt,
        remaining: Math.max(
          0,
          Number((chargeableTotal - paidAmt).toFixed(2))
        ),
        paymentMode: "inferred-advance",
      };
    }

    // if marked fully paid
    const status = String(o?.payment_status || o?.status || "").toLowerCase();
    if (
      ["paid", "payment_confirmed", "confirmed"].includes(status) ||
      o?.payment_confirmed === true
    ) {
      return {
        paid: chargeableTotal,
        remaining: 0,
        paymentMode: "full-inferred",
      };
    }

    // fallback
    const paidFallback = toNumber(o?.amount_paid ?? o?.paid_amount ?? 0);
    return {
      paid: paidFallback,
      remaining: Math.max(
        0,
        Number((chargeableTotal - paidFallback).toFixed(2))
      ),
      paymentMode: "fallback",
    };
  };

  /**
   * getChargesRows – mirror PaymentPage summary style
   * Uses amount_breakdown + _computed so values match payment page:
   * Items Total, Before coupon, Net items, Package cost, Delivery charge,
   * Staff charge, Drinking water, Tax, Utensils (refundable), Total Pay
   */
  const getChargesRows = (o, plates, pricePerPlate, addonItems = []) => {
    const bd = o?.amount_breakdown || {};
    const computed = o?._computed || {};

    const itemsTotal = toNumber(
      bd.items_total ?? bd.subtotal ?? o?.subtotal ?? 0
    );
    const beforeCoupon = toNumber(
      bd.before_coupon ?? bd.before_coupon_total ?? itemsTotal
    );
    const netItems = toNumber(bd.net_items ?? bd.net_items_total ?? itemsTotal);

    const packageCostFromBreakdown = toNumber(bd.package_cost ?? 0);
    const packageCost =
      packageCostFromBreakdown ||
      (plates && pricePerPlate ? plates * pricePerPlate : 0);

    const delivery = toNumber(
      computed.delivery_fee ??
      bd.delivery_charge ??
      o?.delivery_charge ??
      o?.delivery_fee ??
      0
    );
    const rawDeliveryOption =
      o?.delivery_option ?? o?.deliveryType ?? o?.delivery ?? null;

    const deliveryOption = rawDeliveryOption
      ? String(rawDeliveryOption).toLowerCase()
      : null;

    const isDelivery = deliveryOption === "delivery";

    const isSelfPickup =
      deliveryOption === "selfpickup" ||
      deliveryOption === "self_pickup" ||
      deliveryOption === "self";

    const staff = toNumber(
      o?.staff_charge_server ??
      bd.staff_charge ??
      o?.staff_charge ??
      o?.staff ??
      0
    );

    const water = toNumber(
      computed.estimated_water_price ??
      o?.water_estimated_price ??
      o?.water_charge_server ??
      bd.water_charge ??
      bd.drinking_water ??
      o?.water_charge ??
      o?.bottles_charge ??
      0
    );
    const waterQty = o?.water_quantity;
    const waterChoiceRaw = o?.water_choice;
    let waterNote = null;
    if (waterQty) {
      const unitLabel =
        waterChoiceRaw === "can" || waterChoiceRaw === "cans"
          ? "cans"
          : "bottles";
      waterNote = `${waterQty} ${unitLabel}`;
    }

    const tax = toNumber(
      computed.tax_amount ?? bd.tax_amount ?? o?.tax_amount ?? 0
    );

    const coupon = toNumber(
      computed.coupon_discount ?? bd.coupon_discount ?? o?.coupon_discount ?? 0
    );

    const total = toNumber(
      computed.total ??
      bd.total ??
      o?.total ??
      o?.chargeable_total ??
      0
    );

    // extra plates if present
    const extraPlates =
      bd.extra_plates !== undefined && bd.extra_plates !== null
        ? toNumber(bd.extra_plates)
        : null;

    const utensilsVal = toNumber(
      o?.utensils_advance ?? o?.utensils ?? bd.utensils_advance ?? 0
    );

    const utensilsNote =
      bd.utensils_note ||
      (o?.include_staff
        ? "Covered when staff is included"
        : utensilsVal > 0
          ? "Collected refundable amount at delivery/pickup"
          : null);

    const rows = [];

    // rows.push({
    //   key: "items_total",
    //   label: "Items Total",
    //   value: itemsTotal,
    // });

    // rows.push({
    //   key: "before_coupon",
    //   label: "Before coupon",
    //   value: beforeCoupon,
    // });

    // rows.push({
    //   key: "net_items",
    //   label: "Net items",
    //   value: netItems,
    // });

    rows.push({
      key: "package_cost",
      label: "Package cost",
      note:
        plates && pricePerPlate
          ? `(${fmtAmt(pricePerPlate)} × ${plates} plates)`
          : null,
      value: packageCost,
    });
    const addonsTotal = Array.isArray(addonItems)
      ? addonItems.reduce((sum, it) => {
        const qty = toNumber(it.quantity ?? it.qty ?? 1);
        const unit = toNumber(
          it.price ?? it.unit_price ?? it.amount ?? 0
        );
        return sum + qty * unit;
      }, 0)
      : 0;

    if (addonsTotal > 0) {
      rows.push({
        key: "addons",
        label: "Add-ons",
        value: addonsTotal,
      });
    }

    if (isDelivery) {
      // Delivery selected
      rows.push({
        key: "delivery",
        label: "Delivery",
        note:
          delivery <= 0
            ? "We handle delivery and timing — relax and enjoy your food without pickup hassle."
            : "Enjoy on-time delivery without any pickup hassle.",
        value: delivery,
      });
    } else if (isSelfPickup) {
      // Self pickup selected
      rows.push({
        key: "delivery",
        label: "Self pickup",
        note:
          "Pickup address and timings will be shared once your order status moves to \"Preparation\". For self pickup, you must arrange your own vehicle and take full responsibility for transport. A refundable utensils deposit must be paid directly to the caterer and will be returned after all supplied utensils are safely handed back.",
        value: 0, // show as no delivery charge
      });
    } else {
      // Fallback if option not set
      rows.push({
        key: "delivery",
        label: "Delivery charge",
        value: delivery,
      });
    }

    rows.push({
      key: "staff",
      label: "Staff charge",
      value: staff,
    });

    rows.push({
      key: "bottles",
      label: "Drinking water",
      value: water,
      note: waterNote,
    });

    if (extraPlates !== null) {
      rows.push({
        key: "extraPlates",
        label: "Extra plates",
        value: extraPlates,
      });
    }

    rows.push({
      key: "tax",
      label: "Tax",
      value: tax,
    });

    rows.push({
      key: "utensils",
      label: "Utensils (refundable)",
      note: utensilsNote || null,
      value: utensilsVal,
    });

    if (coupon !== 0) {
      rows.push({
        key: "coupon",
        label: "Coupon",
        value: -Math.abs(coupon),
      });
    }

    rows.push({
      key: "total",
      label: "Total",
      value: total,
      bold: true,
    });

    return rows;
  };

  // ---------- Fetch latest order (prefer summary for selected items & breakdown) ----------
  const fetchLatestOrder = async () => {
    if (!order?.id) return null;
    setFetchingLatest(true);

    try {
      // 1) Try summary endpoint first
      try {
        const resp = await axios.get(`/api/orders/${order.id}/summary/`);
        if (resp && resp.data) {
          const payload = resp.data.order ?? resp.data;

          // keep payment_mode if backend didn't send it
          if (
            (payload.payment_mode === undefined ||
              payload.payment_mode === null ||
              String(payload.payment_mode) === "") &&
            order?.payment_mode
          ) {
            payload.payment_mode = order.payment_mode;
          }

          setPayment(payload.payment ?? payment);
          setOrder((prev) => ({ ...(prev || {}), ...(payload || {}) }));
          return payload;
        }
      } catch (err) {
        console.warn("Summary fetch failed, falling back to detail:", err);
      }

      // 2) Fallback: normal detail
      const respDetail = await axios.get(`/api/orders/${order.id}/`);
      if (respDetail && respDetail.data) {
        const payload = respDetail.data.order ?? respDetail.data;

        if (
          (payload.payment_mode === undefined ||
            payload.payment_mode === null ||
            String(payload.payment_mode) === "") &&
          order?.payment_mode
        ) {
          payload.payment_mode = order.payment_mode;
        }

        setPayment(payload.payment ?? payment);
        setOrder((prev) => ({ ...(prev || {}), ...(payload || {}) }));
        return payload;
      }
    } catch (err) {
      console.error("Failed to fetch latest order", err);
    } finally {
      setFetchingLatest(false);
    }

    return order;
  };

  // ---------- Effects (all BEFORE any early return) ----------

  // Fetch order from backend using URL param (REFRESH SAFE)
  useEffect(() => {
    if (!orderId) return;

    const fetchOrderFromSummary = async () => {
      try {
        const resp = await axios.get(`/api/orders/${orderId}/summary/`);
        const payload = resp.data?.order ?? resp.data;

        setOrder(payload);
        setPayment(payload?.payment ?? null);
      } catch (err) {
        console.error("Failed to fetch order summary:", err);
      }
    };

    // If order not present (direct hit / refresh), fetch it
    if (!order) {
      fetchOrderFromSummary();
    }
  }, [orderId]);

  // Confetti + scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const DUR_MS = 10000;
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), DUR_MS);
    return () => clearTimeout(t);
  }, []);

  // On mount / when order.id changes, refresh from /summary so UI uses latest breakdown
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (order?.id && !fetchingLatest) {
      fetchLatestOrder();
    }
  }, [order?.id]);

  // ---------- Early return AFTER hooks -----a-----
  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            ⚠️ No order data found
          </h2>
          <p className="mb-6 text-gray-600">
            You may have refreshed the page or navigated here directly.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // ---------- PDF generation using shared invoice util ----------
  const generatePdf = async () => {
    if (!order?.id) return;
    setGeneratingPdf(true);

    try {
      // always fetch latest (summary -> detail fallback) before PDF
      const latest = await fetchLatestOrder();
      const finalOrder = latest || order;

      generateInvoicePdf(finalOrder, {
        company: {
          name: "FrameMyEvent",
          address: "by FrameMyEvent OPC PRIVATE LIMITED",
          phone: "contact@framemyevent.com",
        },
        filenamePrefix: "invoice_order",
      });
    } catch (err) {
      console.error("PDF generation failed", err);
      alert("Failed to generate PDF. Try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---------- computed values for display ----------
  const preservedMode = initialOrder?.payment_mode ?? initialOrder?.payment_method ?? null;

  const { paid, remaining, paymentMode } =
    computePaidAndRemaining(order, preservedMode);
  const paidAmountBackend = toNumber(
    order?.paid_amount ?? paid ?? order?.amount_paid ?? 0
  );
  const remainingDueBackend = toNumber(
    order?.remaining_due ?? remaining ?? 0
  );
  const packageObj =
    order.selected_package ??
    order.package ??
    (order.selected_package_id
      ? { id: order.selected_package_id, name: order.package_name }
      : null);

  const plates = Number(order.plates ?? 0);
  const pricePerPlate = toNumber(
    packageObj?.price_per_plate ??
    packageObj?.price ??
    order.price_per_plate ??
    0
  );
  const packageTotalCalc = plates * pricePerPlate;

  const addonItems = (() => {
    // 1) If backend ever sends a ready-made array, use it
    if (Array.isArray(order.addon_items) && order.addon_items.length) {
      return order.addon_items;
    }

    // 2) Preferred: build from addon_item_ids + addon_item_qtys + items (for name/price)
    if (
      Array.isArray(order.addon_item_ids) &&
      order.addon_item_ids.length
    ) {
      const qtyMap = order.addon_item_qtys || {};

      // Index items by menu_item id so we can pull name / price
      const itemsByMenuId =
        Array.isArray(order.items) && order.items.length
          ? order.items.reduce((acc, it) => {
            if (it.menu_item != null) {
              acc[it.menu_item] = it;
            }
            return acc;
          }, {})
          : {};

      return order.addon_item_ids.map((id) => {
        const base = itemsByMenuId[id] || {};
        const rawQty =
          qtyMap[String(id)] ??
          qtyMap[id] ??
          base.quantity ??
          1;

        const qty = Number(rawQty || 1);

        return {
          id,
          menu_item: id,
          menu_item_name:
            base.menu_item_name ??
            base.name ??
            base.title ??
            `Addon #${id}`,
          quantity: qty,
          // will be used in the table row (`unit` & `line`)
          price: base.price ?? base.unit_price ?? base.amount ?? 0,
        };
      });
    }

    // 3) Last fallback: infer from items (non-complementary treated as addons)
    if (Array.isArray(order.items) && order.items.length) {
      return order.items.filter((it) => {
        const isCompl =
          it.is_complementary === true ||
          it.is_complementary === "true" ||
          it.is_complementary === 1 ||
          it.is_complementary === "1";

        // anything not complementary and not part of default_menu_items
        return !isCompl;
      });
    }

    return [];
  })();

  const chargesRows = getChargesRows(order, plates, pricePerPlate, addonItems);

  const packageItemsGrouped = (() => {
    const candidate =
      packageObj?.composition_structure ??
      packageObj?.composition ??
      order?.selected_package?.composition_structure ??
      order?.package?.composition_structure ??
      null;

    if (!candidate) return {};
    const sections = candidate.sections ?? candidate;
    if (!sections || typeof sections !== "object") return {};

    const out = {};

    Object.entries(sections).forEach(([key, sec]) => {
      const title = sec.title ?? key;

      const optsRaw = Array.isArray(sec.options)
        ? sec.options
        : sec.items ?? [];

      if (!optsRaw || optsRaw.length === 0) return;

      const hasSelectedFlag = optsRaw.some(
        (o) =>
          o &&
          Object.prototype.hasOwnProperty.call(o, "selected")
      );

      const filtered = hasSelectedFlag
        ? optsRaw.filter(
          (o) =>
            o &&
            (o.selected === true ||
              o.selected === "true" ||
              o.selected === 1 ||
              o.selected === "1")
        )
        : optsRaw;

      if (!filtered.length) return;

      out[title] = filtered.map(
        (o) => o.name ?? o.title ?? o.item ?? ""
      );
    });

    return out;
  })();

  const packageItemsFlat = Object.values(packageItemsGrouped).flat();

  const complementaryItems = (() => {
    if (
      Array.isArray(order.default_menu_items) &&
      order.default_menu_items.length
    ) {
      return order.default_menu_items.map(
        (it) =>
          it.menu_item_name ??
          it.name ??
          it.title ??
          `Item ${it.id ?? ""}`
      );
    }
    if (Array.isArray(order.items) && order.items.length) {
      return order.items
        .filter(
          (it) => it.is_complementary || it.is_complementary === true
        )
        .map(
          (it) =>
            it.menu_item_name ??
            it.name ??
            it.title ??
            `Item ${it.id ?? ""}`
        );
    }
    return [];
  })();



  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 p-3 sm:p-6">
      {showConfetti && (
        <ConfettiCelebration
          autoBurstCount={140}
          fallDensity={48}
          burstRadius={140}
          colors={[
            "#34D399",
            "#60A5FA",
            "#F59E0B",
            "#F472B6",
            "#A78BFA",
          ]}
          zIndex={60}
        />
      )}

      <div className="w-full max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          {/* LEFT: Title */}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-emerald-600 mb-1 whitespace-nowrap">
              🎉 Order Confirmed!
            </h1>
            <div className="text-sm text-gray-600">
              Thank you — your booking is recorded.
            </div>
          </div>

          {/* RIGHT: Mode + Download */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {/* Mode */}
            <div className="text-xs text-gray-500 whitespace-nowrap">
              Mode:{" "}
              <span className="font-medium">
                {order.payment_mode ??
                  order.payment_method ??
                  preservedMode ??
                  paymentMode ??
                  "-"}
              </span>
            </div>

            {/* Download button */}
            <button
              onClick={generatePdf}
              disabled={generatingPdf || fetchingLatest}
              aria-label="Download invoice as PDF"
              className={`px-3 py-2 rounded inline-flex items-center gap-2 text-sm whitespace-nowrap
        ${generatingPdf || fetchingLatest
                  ? "bg-gray-300 text-gray-700"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              title="Download invoice as PDF"
            >
              {generatingPdf || fetchingLatest ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeOpacity="0.25"
                    />
                    <path
                      d="M22 12a10 10 0 00-10-10"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{generatingPdf ? "Generating…" : "Fetching…"}</span>
                </>
              ) : (
                "Download PDF"
              )}
            </button>
          </div>
        </div>

        {/* Visual invoice layout (for on-screen view only) */}
        <div className="bg-white border rounded-lg shadow-md p-4 sm:p-6">
          {/* header row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <div className="text-xs text-gray-500">Invoice</div>
              <div className="text-lg font-semibold text-gray-900">
                Order #{order.id}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Placed:{" "}
                {order.created_at
                  ? new Date(order.created_at).toLocaleString()
                  : new Date().toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Order status:{" "}
                <span className="font-medium">
                  {order.status ?? order.payment_status ?? "—"}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <div className="text-sm font-medium text-gray-700">
                {order.caterer_name ?? order.caterer ?? "—"}
              </div>
              <div className="text-xs text-gray-500">Caterer</div>

              {/* Location row */}
              <div className="max-w-full sm:max-w-xl">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                  {/* Nearby – LEFT on web */}
                  <div
                    className="text-sm text-gray-700 truncate sm:max-w-[48%] text-left"
                    title={order.nearby ?? ""}
                  >
                    <span className="text-gray-500">Nearby:</span>{" "}
                    {order.nearby ?? "—"}
                  </div>

                  {/* Event Location – RIGHT on web */}
                  <div
                    className="text-sm text-gray-700 truncate sm:max-w-[48%] sm:text-right"
                    title={order.location ?? order.venue ?? order.address ?? ""}
                  >
                    <span className="text-gray-500">Event Location:</span>{" "}
                    {order.location ?? order.venue ?? order.address ?? "—"}
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* top meta row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 uppercase">
                Event Date
              </div>
              <div className="font-medium">
                {order.event_date
                  ? new Date(
                    order.event_date
                  ).toLocaleDateString()
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase">
                Event Time
              </div>
              <div className="font-medium">
                {order.event_time
                  ? new Date(
                    `${order.event_date || ""}T${order.event_time}`
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase">
                Payment
              </div>
              <div className="font-medium">
                {payment?.method ?? order.payment_method ?? "—"}
              </div>

              <div className="text-xs text-gray-500 mt-1">
                Paid:{" "}
                <span className="font-semibold tabular-nums break-all">
                  {fmtAmt(paidAmountBackend)}
                </span>
              </div>

              <div
                className={`text-xs mt-1 ${remainingDueBackend > 0 ? "text-rose-600" : "text-gray-500"
                  }`}
              >
                Remaining:{" "}
                <span className="font-semibold tabular-nums break-all">
                  {fmtAmt(remainingDueBackend)}
                </span>
              </div>

              {remainingDueBackend > 0 && (
                <div className="text-[11px] text-gray-500 mt-1">
                  {order?.payment_mode === "min"
                    ? "Remaining advance required to start preparation. Balance will be collected at delivery / pickup by the caterer."
                    : "Remaining amount will be collected by the caterer at delivery / pickup."}
                </div>
              )}

              <div className="text-xs text-gray-500 mt-1">
                Mode:{" "}
                <span className="font-medium">
                  {order.payment_mode ??
                    order.payment_method ??
                    preservedMode ??
                    paymentMode ??
                    "-"}
                </span>
              </div>
            </div>
          </div>

          {/* package */}
          <div className="border-t pt-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Package
            </h3>

            <div className="mb-2 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {packageObj?.name ??
                    packageObj?.title ??
                    order.package_name ??
                    "Package"}
                </div>
                <div className="tabular-nums break-all text-right">
                  {fmtAmt(pricePerPlate)} / plate
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Plates: {plates ?? "—"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Package cost:{" "}
                <span className="font-medium tabular-nums break-all">
                  {fmtAmt(pricePerPlate)} / plate × {plates} plates ={" "}
                  {fmtAmt(packageTotalCalc)}
                </span>
              </div>
            </div>

            {/* Default items included (from default_menu_items / complementary) */}
            {complementaryItems.length > 0 && (
              <div className="mt-2 text-sm text-gray-700">
                <div className="text-xs text-gray-500 font-medium">
                  Complimentary items:
                </div>
                <ul className="list-disc ml-6 mt-1 text-sm text-gray-700">
                  {complementaryItems.map((it, idx) => (
                    <li key={idx}>{it}</li>
                  ))}
                </ul>
              </div>
            )}

            {packageItemsFlat.length > 0 && (
              <div className="mt-4 mb-3">
                <div className="text-xs text-gray-500">
                  Package items
                </div>

                <div
                  className="grid gap-3 mt-2"
                  style={{
                    gridTemplateColumns:
                      Object.keys(packageItemsGrouped).length <= 2
                        ? "repeat(2, 1fr)"
                        : Object.keys(packageItemsGrouped).length <= 4
                          ? "repeat(3, 1fr)"
                          : "repeat(4, 1fr)",
                  }}
                >
                  {Object.entries(packageItemsGrouped).map(
                    ([section, items]) => (
                      <div key={section}>
                        <div className="text-xs font-medium text-gray-700">
                          {section}
                        </div>
                        <ul className="list-disc ml-4 mt-1 text-sm text-gray-700">
                          {items.map((it, i) => (
                            <li key={i}>{it}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* add-ons table */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Add-ons
            </h3>

            {addonItems.length === 0 ? (
              <div className="text-sm text-gray-500">No add-ons</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-1">Item</th>
                    <th className="pb-1 text-right">Qty</th>
                    <th className="pb-1 text-right">₹ Price / plate</th>
                  </tr>
                </thead>
                <tbody>
                  {addonItems.map((it, i) => {
                    const name =
                      it.name ??
                      it.menu_item_name ??
                      it.title ??
                      `Addon ${it.id ?? i + 1}`;
                    const qty = it.quantity ?? it.qty ?? 1;
                    const unit = toNumber(
                      it.price ?? it.unit_price ?? it.amount ?? 0
                    );

                    return (
                      <tr key={i} className="text-gray-700">
                        <td className="py-1">{name}</td>
                        <td className="py-1 text-right tabular-nums break-all">{qty}</td>
                        <td className="py-1 text-right tabular-nums break-all max-w-[45%]">{fmtAmt(unit)} / plate</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* charges table - tabular format for PDF */}
          <div className="mt-4 border-t pt-4 text-sm text-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Summary
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {chargesRows.map((r) => (
                  <tr
                    key={r.key}
                    className={r.bold ? "font-bold" : ""}
                  >
                    <td style={{ padding: "8px 6px" }}>
                      <div>{r.label}</div>
                      {r.note && (
                        <div className="text-xs text-gray-500">
                          {r.note}
                        </div>
                      )}
                    </td>
                    <td
                      className="text-right"
                      style={{ padding: "8px 6px" }}
                    >
                      {(() => {
                        // 1) Staff charge: utensils collected & no staff → show "Staff not selected"
                        if (
                          r.key === "staff" &&
                          toNumber(order?.utensils_advance ?? order?.utensils ?? 0) > 0 &&
                          !order?.include_staff &&
                          toNumber(r.value) === 0
                        ) {
                          return (
                            <span className="text-[10px] text-gray-500 whitespace-nowrap">
                              Staff not selected
                            </span>
                          );
                        }

                        // 2) Drinking water: amount 0 → show "Free (X bottles/cans)" or just "Free"
                        if (r.key === "bottles" && toNumber(r.value) === 0) {
                          const waterQty = order?.water_quantity;
                          const waterChoiceRaw = order?.water_choice;
                          const unitLabel =
                            waterChoiceRaw === "can" || waterChoiceRaw === "cans"
                              ? "cans"
                              : "bottles";

                          if (waterQty) {
                            return (
                              <span className="text-xs text-emerald-600 font-medium">
                                Free ({waterQty} {unitLabel})
                              </span>
                            );
                          }

                          return (
                            <span className="text-xs text-emerald-600 font-medium">
                              Free
                            </span>
                          );
                        }

                        // default money formatting
                        return r.value < 0
                          ? `-${fmtAmt(Math.abs(r.value))}`
                          : fmtAmt(r.value);
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {remainingDueBackend > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                Paid Advance Amount{" "}
                <span className="font-semibold tabular-nums break-all text-emerald-600">
                  {fmtAmt(paidAmountBackend)}
                </span>{" "}
                and remaining{" "}
                <span className="font-semibold tabular-nums break-all text-rose-600">
                  {fmtAmt(remainingDueBackend)}
                </span>{" "}
                will be collected at delivery / pickup.
              </div>
            )}
          </div>

          {/* terms & conditions + branded footer */}
          <div className="mt-8 pt-6 border-t">
            <div className="max-w-full text-left">
              <div className="text-xs text-gray-500 mb-2 font-medium">
                Terms & Conditions
              </div>
              <div
                className="text-xs text-gray-500 leading-tight"
                style={{ lineHeight: 1.3 }}
              >
                1. This invoice is an electronic record and does not
                require a physical signature. 2. Orders are subject to
                caterer acceptance. 3. Refunds and cancellations are
                governed by our refund policy. 4. Utensils refundable
                amount will be returned as per settlement policy.
              </div>

              <div className="mt-6 text-center">
                <div
                  style={{ letterSpacing: "0.4px" }}
                  className="text-lg font-semibold text-gray-900"
                >
                  Frame My Event
                </div>

                <div className="text-xs uppercase text-gray-500 mt-1">
                  OPC Private Limited
                </div>

                <div className="text-sm text-gray-600 mt-2">
                  Your trusted catering & event partner — clean
                  invoices, quick payments, dependable service.
                </div>

                <div className="mt-3">
                  <a
                    href="mailto:contact@framemyevent.com"
                    className="text-sm font-medium text-indigo-600 underline"
                  >
                    contact@framemyevent.com
                  </a>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  © {new Date().getFullYear()} FrameMyEvent OPC Private
                  Limited. All rights reserved.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* bottom actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Go Home
          </button>
          <button
            onClick={() =>
              navigate("/profile?tab=orders", {
                state: { highlightOrderId: order.id },
              })
            }
            className="px-5 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            View My Orders
          </button>
        </div>
      </div>
    </div>
  );
}