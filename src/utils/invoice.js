// src/utils/invoice.js
import jsPDF from "jspdf";

/**
 * generateInvoicePdf(order, opts)
 * - order: object (same shape as OrderSuccess `order`)
 * - opts: {
 *     company?: { name, address, phone },
 *     filenamePrefix?: string,
 *     preservedMode?: string | null, // optional: like OrderSuccess preservedMode
 *   }
 */
export default function generateInvoicePdf(order = {}, opts = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const P = {
    PAGE_MARGIN: 36,
    LINE_HEIGHT: 16,
    SMALL: 9,
    NORMAL: 11,
    TITLE: 14,
  };

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const rightX = W - P.PAGE_MARGIN;
  const CONTENT_RIGHT = rightX - 10; // keep a bit inside border
  const CONTENT_LEFT = P.PAGE_MARGIN + 10;
  const CONTENT_BOTTOM = H - P.PAGE_MARGIN - 20;

  let y = P.PAGE_MARGIN + 10; // small padding inside border

  const company =
    opts.company || {
      name: "FrameMyEvent",
      address: "OPC PRIVATE LIMITED",
      phone: "contact@framemyevent.com",
    };

  const filename = `${opts.filenamePrefix || "invoice"}-${order.id || "order"
    }.pdf`;

  // ---------- helpers ----------
  const safe = (v) =>
    v === null || v === undefined || v === "" ? "—" : String(v);

  const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const STATUS_LABELS = {
    pending: "Pending",
    accepted: "Accepted",
    preparation_inprogress: "Preparation — In Progress",
    preparation_completed: "Ready to Deliver",
    delivery_in_progress: "Delivery — In Progress",
    delivered: "Delivered",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled",
    approved: "Approved",
    initiated: "Initiated",
  };

  const isSelfPickupDelivery = (o) => {
    const opt = (
      o?.delivery_option ||
      o?.delivery_type ||
      o?.delivery ||
      ""
    ).toString().toLowerCase();

    return (
      opt === "self" ||
      opt === "selfpickup" ||
      opt === "self_pickup" ||
      opt === "pickup"
    );
  };

  const getDisplayStatus = (o) => {
    if (!o) return "—";

    const rawStatus = (o.status ?? o.payment_status ?? "—").toString();
    const key = rawStatus.toLowerCase();

    const base = STATUS_LABELS[key] || rawStatus;

    // For normal delivery, just return base
    if (!isSelfPickupDelivery(o)) return base;

    // For self pickup, override a few stages
    if (key === "preparation_completed") return "Ready to Pickup";
    if (key === "delivery_in_progress") return "Customer Picked Up";
    if (key === "delivered") return "Returned utensils"; // or "Returned utensils"

    return base;
  };
  const fmtAmt = (v) => {
    const n = Number(v ?? 0);
    if (Number.isNaN(n)) return "Rs. 0.00";
    return `Rs. ${n.toFixed(2)}`;
  };

  const drawPageFrame = () => {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    // light grey border around content
    doc.setDrawColor(200);
    doc.rect(
      P.PAGE_MARGIN - 6,
      P.PAGE_MARGIN - 6,
      w - (P.PAGE_MARGIN - 6) * 2,
      h - (P.PAGE_MARGIN - 6) * 2
    );
  };

  const addPageIfNeeded = (heightNeeded = 0) => {
    if (y + heightNeeded > CONTENT_BOTTOM) {
      doc.addPage();
      drawPageFrame();
      y = P.PAGE_MARGIN + 10;
    }
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

  const extractLatestPayment = (o) => {
    if (!o) return null;
    if (o.latest_payment) return o.latest_payment;
    if (o.advance_info && o.advance_info.latest_payment) {
      return o.advance_info.latest_payment;
    }
    if (o.payment) return o.payment;
    return null;
  };

  const computePaidAndRemaining = (o, preservedPaymentMode) => {
    const chargeableTotal = getChargeableTotal(o);

    // ✅ 1) Prefer summary / backend fields when present
    const backendPaidRaw =
      o?.paid_amount ??
      o?.amount_paid ??
      null;

    const backendRemainingRaw =
      o?.remaining_due ??
      o?.remaining ??
      o?.due_amount ??
      null;

    const backendPaid = toNumber(backendPaidRaw);
    const backendRemaining = toNumber(backendRemainingRaw);

    const hasBackendPaid =
      backendPaidRaw !== null &&
      backendPaidRaw !== undefined &&
      String(backendPaidRaw) !== "";

    const hasBackendRemaining =
      backendRemainingRaw !== null &&
      backendRemainingRaw !== undefined &&
      String(backendRemainingRaw) !== "";

    if (hasBackendPaid || hasBackendRemaining) {
      const paidVal = hasBackendPaid
        ? backendPaid
        : Math.max(0, chargeableTotal - backendRemaining);

      const remainingVal = hasBackendRemaining
        ? backendRemaining
        : Math.max(
          0,
          Number((chargeableTotal - paidVal).toFixed(2))
        );

      return {
        paid: paidVal,
        remaining: remainingVal,
        paymentMode:
          o?.payment_mode ??
          o?.payment_method ??
          preservedPaymentMode ??
          "summary",
      };
    }

    // ✅ 2) Fallback to existing inference logic when summary fields not present

    const paymentKindRaw =
      o?.payment_mode ?? o?.payment_method ?? preservedPaymentMode ?? "";
    const paymentKind = String(paymentKindRaw).toLowerCase();

    // full
    if (paymentKind === "full") {
      return {
        paid: chargeableTotal,
        remaining: 0,
        paymentMode: "full",
      };
    }

    // advance
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

    // inferred advance
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

    // inferred full
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

  const getChargesRows = (o, plates, pricePerPlate) => {
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
    const deliveryOptionRaw = (
      o?.delivery_option ||
      o?.delivery_type ||
      o?.delivery ||
      ""
    )
      .toString()
      .toLowerCase();

    // Defaults: normal delivery
    let deliveryLabel = "Delivery charge";
    let deliveryValue = delivery;
    let deliveryNote = null;

    // 🔹 Self pickup case: no delivery charge, show info text
    if (
      deliveryOptionRaw === "self" ||
      deliveryOptionRaw === "selfpickup" ||
      deliveryOptionRaw === "self_pickup" ||
      deliveryOptionRaw === "pickup"
    ) {
      // change label + show text instead of 0 => Free
      deliveryLabel = "Delivery / Pickup";
      deliveryValue = "Self pickup selected";
    }


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

    const tax = toNumber(
      computed.tax_amount ?? bd.tax_amount ?? o?.tax_amount ?? 0
    );

    const coupon = toNumber(
      computed.coupon_discount ?? bd.coupon_discount ?? o?.coupon_discount ?? 0
    );

    const total = toNumber(
      computed.total ?? bd.total ?? o?.total ?? o?.chargeable_total ?? 0
    );

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

    // Only the rows you kept in OrderSuccess Summary
    rows.push({
      key: "package_cost",
      label: "Package cost",
      note:
        plates && pricePerPlate
          ? `(${fmtAmt(pricePerPlate)} × ${plates} plates)`
          : null,
      value: packageCost,
    });

    rows.push({
      key: "delivery",
      label: deliveryLabel,
      value: deliveryValue,
      note: deliveryNote,
    });

    rows.push({
      key: "staff",
      label: "Staff charge",
      value: staff,
    });

    rows.push({
      key: "bottles",
      label: "Drinking water",
      value: water,
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
      label: "Total Pay",
      value: total,
      bold: true,
    });

    return rows;
  };

  const getPackageObj = (o) => {
    if (o.selected_package) return o.selected_package;
    if (o.package && typeof o.package === "object") return o.package;
    if (o.selected_package_id) {
      return { id: o.selected_package_id, name: o.package_name };
    }
    return null;
  };

  const getPackageItemsGrouped = (o, packageObj) => {
    const candidate =
      packageObj?.composition_structure ??
      packageObj?.composition ??
      o?.selected_package?.composition_structure ??
      o?.package?.composition_structure ??
      null;

    if (!candidate) return {};
    const sections = candidate.sections ?? candidate;
    if (!sections || typeof sections !== "object") return {};

    const out = {};

    Object.entries(sections).forEach(([key, sec]) => {
      const title = sec.title ?? key;
      const optsRaw = Array.isArray(sec.options) ? sec.options : sec.items ?? [];

      if (!optsRaw || optsRaw.length === 0) return;

      const hasSelectedFlag = optsRaw.some(
        (opt) =>
          opt &&
          Object.prototype.hasOwnProperty.call(opt, "selected")
      );

      const filtered = hasSelectedFlag
        ? optsRaw.filter(
          (opt) =>
            opt &&
            (opt.selected === true ||
              opt.selected === "true" ||
              opt.selected === 1 ||
              opt.selected === "1")
        )
        : optsRaw;

      if (!filtered.length) return;

      out[title] = filtered.map(
        (opt) => opt.name ?? opt.title ?? opt.item ?? ""
      );
    });

    return out;
  };

  // Complimentary / free items (is_complementary: true)
  const getComplementaryItems = (o) => {
    const result = [];

    if (Array.isArray(o.default_menu_items) && o.default_menu_items.length) {
      o.default_menu_items.forEach((it) => {
        result.push(
          it.menu_item_name ??
          it.name ??
          it.title ??
          `Item ${it.id ?? ""}`
        );
      });
    }

    if (Array.isArray(o.items) && o.items.length) {
      o.items.forEach((it) => {
        const flag = it.is_complementary;
        const isTrue =
          flag === true ||
          flag === "true" ||
          flag === 1 ||
          flag === "1";
        if (isTrue) {
          result.push(
            it.menu_item_name ??
            it.name ??
            it.title ??
            `Item ${it.id ?? ""}`
          );
        }
      });
    }

    return result;
  };

  // Add-ons: items.is_complementary === false (paid)
  const getAddonItems = (o) => {
    if (Array.isArray(o.items) && o.items.length) {
      const hasComplementaryFlag = o.items.some((it) =>
        Object.prototype.hasOwnProperty.call(it, "is_complementary")
      );
      if (hasComplementaryFlag) {
        return o.items.filter((it) => {
          const flag = it.is_complementary;
          const isFalse =
            flag === false ||
            flag === "false" ||
            flag === 0 ||
            flag === "0" ||
            flag === undefined ||
            flag === null;
          // treat as add-on when not complimentary and price > 0
          const unit = toNumber(
            it.price ?? it.unit_price ?? it.amount ?? 0
          );
          return isFalse && unit > 0;
        });
      }
    }

    // Fallback to other structures if present
    if (Array.isArray(o.addons) && o.addons.length) return o.addons;
    if (Array.isArray(o.addon_items) && o.addon_items.length)
      return o.addon_items;
    if (Array.isArray(o.addon_item_ids) && o.addon_item_ids.length) {
      return o.addon_item_ids.map((id) => ({
        id,
        name: `Addon #${id}`,
      }));
    }
    return [];
  };

  // ---------- computed values (same as OrderSuccess) ----------
  const preservedMode = opts.preservedMode ?? null;
  const chargeableTotal = getChargeableTotal(order);
  const { paid, remaining, paymentMode } = computePaidAndRemaining(
    order,
    preservedMode
  );

  const packageObj = getPackageObj(order);
  const plates = Number(order.plates ?? 0);
  const pricePerPlate = toNumber(
    packageObj?.price_per_plate ??
    packageObj?.price ??
    order.price_per_plate ??
    0
  );
  const packageTotalCalc = plates * pricePerPlate;
  const chargesRows = getChargesRows(order, plates, pricePerPlate);
  const packageItemsGrouped = getPackageItemsGrouped(order, packageObj);
  const packageItemsFlat = Object.values(packageItemsGrouped).flat();
  const complementaryItems = getComplementaryItems(order);
  const addonItems = getAddonItems(order);

  const paymentMethod =
    (order.payment && order.payment.method) || order.payment_method || "—";

  const modeLabel =
    order.payment_mode ??
    order.payment_method ??
    preservedMode ??
    paymentMode ??
    "-";

  // ---------- first page frame ----------
  drawPageFrame();

  // ---------- Header (with location & nearby on left) ----------
  doc.setFontSize(P.TITLE);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice ID: ${order.invoice_id || "—"}`, CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  doc.setFontSize(P.NORMAL);
  doc.setFont("helvetica", "normal");
  y += P.LINE_HEIGHT;
  doc.text(`Order #${order.id || ""}`, CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  const placedAt = order.created_at
    ? new Date(order.created_at).toLocaleString()
    : new Date().toLocaleString();
  doc.text(`Placed: ${placedAt}`, CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  const statusText = safe(getDisplayStatus(order));
  doc.text(`Order status: ${statusText}`, CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  // 🔹 NEW: Conditional contact details (hide for initiated, pending, approved)
  const rawStatusKey = (order.status ?? "").toString().toLowerCase();
  const shouldShowContactDetails = !["initiated", "pending", "approved"].includes(
    rawStatusKey
  );

  const contactName =
    order.customer_name ??
    order.user_name ??
    (order.user &&
      (order.user.full_name || order.user.first_name || order.user.name)) ??
    null;

  const contactPhone =
    order.contact_primary ??
    order.contact ??
    order.contact_secondary ??
    null;

  if (shouldShowContactDetails && (contactName || contactPhone)) {
    const pieces = [];
    if (contactName) pieces.push(`Customer: ${safe(contactName)}`);
    if (contactPhone) pieces.push(`Contact: ${safe(contactPhone)}`);
    const contactStr = pieces.join(" | ");

    const contactLines = doc.splitTextToSize(
      contactStr,
      W - P.PAGE_MARGIN * 2 - 80
    );
    contactLines.forEach((line) => {
      doc.text(line, CONTENT_LEFT, y);
      y += P.LINE_HEIGHT;
    });
  }

  // Location (below order status / contact, left block)
  const locStr = `Event Location: ${safe(
    order.location ?? order.venue ?? order.address ?? "—"
  )}`;
  const locLines = doc.splitTextToSize(
    locStr,
    W - P.PAGE_MARGIN * 2 - 80
  );
  locLines.forEach((line) => {
    doc.text(line, CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;
  });

  // Nearby (below location, left block)
  const nearbyStr = `Nearby: ${safe(order.nearby ?? "")}`;
  const nearbyLines = doc.splitTextToSize(
    nearbyStr,
    W - P.PAGE_MARGIN * 2 - 80
  );
  nearbyLines.forEach((line) => {
    doc.text(line, CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;
  });

  // right block — Caterer name + label only (no contact)
  const catererName =
    order.caterer_name ?? order.caterer ?? company.name ?? "Caterer";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(P.NORMAL);
  doc.text(catererName, CONTENT_RIGHT, P.PAGE_MARGIN + 10, {
    align: "right",
  });

  doc.setFontSize(P.SMALL);
  doc.setFont("helvetica", "normal");
  doc.text("Caterer", CONTENT_RIGHT, P.PAGE_MARGIN + 10 + P.LINE_HEIGHT, {
    align: "right",
  });

  // vertical gap after header
  y += 8;

  // horizontal rule
  doc.setDrawColor(220);
  doc.line(
    P.PAGE_MARGIN,
    y,
    W - P.PAGE_MARGIN,
    y
  );
  y += 12;

  // ---------- Meta row: Event Date / Event Time / Payment ----------
  addPageIfNeeded(80);
  const colW = (W - P.PAGE_MARGIN * 2 - 20) / 3; // inside frame
  const col1X = CONTENT_LEFT;
  const col2X = CONTENT_LEFT + colW;
  const col3X = CONTENT_LEFT + colW * 2;

  doc.setFontSize(P.SMALL);
  doc.setFont("helvetica", "bold");
  doc.text("EVENT DATE", col1X, y);
  doc.text("EVENT TIME", col2X, y);
  doc.text("PAYMENT", col3X, y);
  y += P.LINE_HEIGHT;

  doc.setFontSize(P.NORMAL);
  doc.setFont("helvetica", "normal");

  const evDate = order.event_date
    ? new Date(order.event_date).toLocaleDateString()
    : "—";
  doc.text(evDate, col1X, y);

  const evTime = order.event_time
    ? new Date(`${order.event_date || ""}T${order.event_time}`).toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    )
    : "—";
  doc.text(evTime, col2X, y);

  const startPayY = y;
  doc.text(paymentMethod, col3X, y);
  y += P.LINE_HEIGHT;
  doc.setFontSize(P.SMALL);
  doc.text(`Paid: ${fmtAmt(paid)}`, col3X, y);
  y += P.LINE_HEIGHT;

  doc.setTextColor(196, 30, 59);
  doc.text(`Remaining: ${fmtAmt(remaining)}`, col3X, y);
  doc.setTextColor(0, 0, 0);
  y += P.LINE_HEIGHT;

  doc.text(`Mode: ${safe(modeLabel)}`, col3X, y);
  y = Math.max(y, startPayY + P.LINE_HEIGHT * 3) + 8;

  // rule
  doc.setDrawColor(220);
  doc.line(
    P.PAGE_MARGIN,
    y,
    W - P.PAGE_MARGIN,
    y
  );
  y += 14;

  // ---------- Package section ----------
  addPageIfNeeded(80);
  doc.setFontSize(P.NORMAL);
  doc.setFont("helvetica", "bold");
  doc.text("Package", CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  doc.setFont("helvetica", "normal");
  const packageName =
    packageObj?.name ??
    packageObj?.title ??
    order.package_name ??
    "Package";
  doc.text(packageName, CONTENT_LEFT, y);
  doc.text(
    `${fmtAmt(pricePerPlate)} / plate`,
    CONTENT_RIGHT,
    y,
    { align: "right" }
  );
  y += P.LINE_HEIGHT;

  doc.setFontSize(P.SMALL);
  doc.text(`Plates: ${plates || "—"}`, CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  // event_type & package_items_count
  if (order.event_type) {
    doc.text(`Event type: ${safe(order.event_type)}`, CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;
  }
  const pkgItemsCount =
    order.package_items_count ?? order._computed?.package_items_count ?? null;
  if (pkgItemsCount !== null && pkgItemsCount !== undefined) {
    doc.text(
      `Package items count: ${pkgItemsCount}`,
      CONTENT_LEFT,
      y
    );
    y += P.LINE_HEIGHT;
  }

  const pkgCostLine = `Package cost: ${fmtAmt(
    pricePerPlate
  )} / plate × ${plates} plates = ${fmtAmt(packageTotalCalc)}`;
  const pkgLines = doc.splitTextToSize(
    pkgCostLine,
    W - P.PAGE_MARGIN * 2 - 20
  );
  pkgLines.forEach((line) => {
    doc.text(line, CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;
  });

  // Default items included
  if (complementaryItems.length > 0) {
    addPageIfNeeded(24 + complementaryItems.length * P.LINE_HEIGHT);
    doc.setFontSize(P.SMALL);
    doc.setFont("helvetica", "bold");
    doc.text("Complimentory Items", CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;
    doc.setFont("helvetica", "normal");
    complementaryItems.forEach((item) => {
      addPageIfNeeded(P.LINE_HEIGHT);
      doc.text(`• ${item}`, CONTENT_LEFT + 10, y);
      y += P.LINE_HEIGHT;
    });
  }

  // Package items (grouped)
  if (packageItemsFlat.length > 0) {
    addPageIfNeeded(24 + packageItemsFlat.length * P.LINE_HEIGHT);
    doc.setFontSize(P.SMALL);
    doc.setFont("helvetica", "bold");
    y += 6;
    doc.text("Package items", CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;

    const sections = Object.entries(packageItemsGrouped);
    doc.setFont("helvetica", "normal");

    sections.forEach(([section, items]) => {
      addPageIfNeeded(P.LINE_HEIGHT * (items.length + 2));
      doc.setFont("helvetica", "bold");
      doc.text(section, CONTENT_LEFT, y);
      y += P.LINE_HEIGHT;
      doc.setFont("helvetica", "normal");
      items.forEach((itm) => {
        addPageIfNeeded(P.LINE_HEIGHT);
        doc.text(`• ${itm}`, CONTENT_LEFT + 10, y);
        y += P.LINE_HEIGHT;
      });
      y += 4;
    });
  }

  // ---------- Add-ons ----------
  addPageIfNeeded(40);
  doc.setFontSize(P.NORMAL);
  doc.setFont("helvetica", "bold");
  y += P.LINE_HEIGHT / 2;
  doc.text("Add-ons", CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(P.SMALL);

  if (addonItems.length === 0) {
    doc.text("No add-ons", CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;
  } else {
    const qtyColX = CONTENT_RIGHT - 80;
    const priceColX = CONTENT_RIGHT;

    doc.text("Item", CONTENT_LEFT, y);
    doc.text("Qty", qtyColX, y, { align: "right" });
    doc.text("Price", priceColX, y, { align: "right" });
    y += P.LINE_HEIGHT;

    addonItems.forEach((it) => {
      addPageIfNeeded(P.LINE_HEIGHT);
      const name =
        it.name ??
        it.menu_item_name ??
        it.title ??
        `Addon ${it.id ?? ""}`;
      const qty = it.quantity ?? it.qty ?? 1;
      const unit = toNumber(
        it.price ?? it.unit_price ?? it.amount ?? 0
      );
      const lineAmt = unit * qty;

      doc.text(String(name), CONTENT_LEFT, y);
      doc.text(String(qty), qtyColX, y, { align: "right" });
      doc.text(fmtAmt(lineAmt), priceColX, y, {
        align: "right",
      });
      y += P.LINE_HEIGHT;
    });
  }

  // ---------- Water details block ----------
  const hasWaterDetails =
    order.water_choice ||
    order.water_quantity ||
    order.water_estimated_price ||
    order.water_cans_needed ||
    order.water_cups_needed;

  if (hasWaterDetails) {
    addPageIfNeeded(80);
    y += 8;
    doc.setFontSize(P.NORMAL);
    doc.setFont("helvetica", "bold");
    doc.text("Water details", CONTENT_LEFT, y);
    y += P.LINE_HEIGHT;

    doc.setFontSize(P.SMALL);
    doc.setFont("helvetica", "normal");

    if (order.water_choice) {
      doc.text(
        `Choice: ${safe(order.water_choice)}`,
        CONTENT_LEFT,
        y
      );
      y += P.LINE_HEIGHT;
    }
    if (order.water_quantity) {
      doc.text(
        `Quantity: ${safe(order.water_quantity)}`,
        CONTENT_LEFT,
        y
      );
      y += P.LINE_HEIGHT;
    }
    const waterEst =
      order.water_estimated_price ??
      order._computed?.estimated_water_price ??
      null;
    if (waterEst) {
      doc.text(
        `Estimated price: ${fmtAmt(waterEst)}`,
        CONTENT_LEFT,
        y
      );
      y += P.LINE_HEIGHT;
    }
    if (order.water_cans_needed) {
      doc.text(
        `Water cans: ${safe(order.water_cans_needed)}`,
        CONTENT_LEFT,
        y
      );
      y += P.LINE_HEIGHT;
    }
    if (order.water_cups_needed) {
      doc.text(
        `Water cups: ${safe(order.water_cups_needed)}`,
        CONTENT_LEFT,
        y
      );
      y += P.LINE_HEIGHT;
    }
  }

  // ---------- Summary (Charges) ----------
  addPageIfNeeded(40);
  doc.setFontSize(P.NORMAL);
  doc.setFont("helvetica", "bold");
  y += 8;
  doc.text("Summary", CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  doc.setFontSize(P.SMALL);
  doc.setFont("helvetica", "normal");

  const utensilsAdvanceNum = toNumber(
    order?.utensils_advance ??
    order?.utensils ??
    order?.amount_breakdown?.utensils_advance ??
    0
  );

  chargesRows.forEach((row) => {
    addPageIfNeeded(P.LINE_HEIGHT * 2);
    if (row.bold) {
      doc.setFont("helvetica", "bold");
    } else {
      doc.setFont("helvetica", "normal");
    }

    const labelLines = [row.label];
    if (row.note) {
      labelLines.push(`(${row.note})`);
    }

    labelLines.forEach((line, idx) => {
      const yy = y + idx * P.LINE_HEIGHT;
      doc.text(line, CONTENT_LEFT, yy);
    });
    if (row.key === "delivery" && typeof row.value === "string") {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(row.value, CONTENT_RIGHT, y, { align: "right" });
      y += P.LINE_HEIGHT * labelLines.length;
      return;
    }
    // ⚠ Special case: staff row when utensils deposit exists but staff not included
    const staffNotSelected =
      row.key === "staff" &&
      utensilsAdvanceNum > 0 &&
      !order?.include_staff &&
      toNumber(row.value) === 0;

    if (staffNotSelected) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120); // grey
      doc.text("Staff not selected", CONTENT_RIGHT, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += P.LINE_HEIGHT * labelLines.length;
      return;
    }

    const isZero = Number(row.value) === 0;
    const isFreeRow =
      (row.key === "delivery" ||
        row.key === "staff" ||
        row.key === "bottles") && isZero;

    // 🔴 Utensils refundable highlight red
    const isUtensilsRefundableRow =
      row.key === "utensils" && toNumber(row.value) > 0;

    let valueStr;
    if (isFreeRow) {
      doc.setTextColor(22, 163, 74); // green
      valueStr = "Free";
    } else {
      if (isUtensilsRefundableRow) {
        doc.setTextColor(220, 38, 38); // red amount
      }
      valueStr =
        row.value < 0
          ? `-${fmtAmt(Math.abs(row.value))}`
          : fmtAmt(row.value);
    }

    doc.text(valueStr, CONTENT_RIGHT, y, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y += P.LINE_HEIGHT * labelLines.length;
  });
  const remainingRowSpace = P.LINE_HEIGHT * 2;
  addPageIfNeeded(remainingRowSpace);

  const paidStr = `Paid: ${fmtAmt(paid)}`;
  const remainingStr = `Remaining: ${fmtAmt(remaining)}`;

  // ✔ Paid: Green color
  doc.setFontSize(P.SMALL);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74); // green
  doc.text(paidStr, CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  // ✔ Remaining: Red color IF > 0
  if (remaining > 0) {
    doc.setTextColor(220, 38, 38); // red
    doc.text(
      `${remainingStr} (Pay at delivery / pickup)`,
      CONTENT_LEFT,
      y
    );
    y += P.LINE_HEIGHT;
  }

  // reset default color
  doc.setTextColor(0, 0, 0);

  // ---------- Terms & Conditions + branded footer ----------
  addPageIfNeeded(100);
  y += 10;
  doc.setFontSize(P.SMALL);
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions", CONTENT_LEFT, y);
  y += P.LINE_HEIGHT;

  doc.setFont("helvetica", "normal");

  const deliveryOptionRaw = (
    order?.delivery_option ||
    order?.delivery_type ||
    order?.delivery ||
    ""
  )
    .toString()
    .toLowerCase();
  // Each term as a separate numbered row, wrapped by width
  const terms = [
    "This invoice is an electronic record and does not require a physical signature.",
    "Orders are subject to caterer acceptance.",
    "Refunds and cancellations are governed by our refund policy.",
    "Utensils refundable amount will be returned as per settlement policy."
  ];
  if (
    deliveryOptionRaw === "self" ||
    deliveryOptionRaw === "selfpickup" ||
    deliveryOptionRaw === "self_pickup" ||
    deliveryOptionRaw === "pickup"
  ) {
    terms.push(
      'Pickup address and timings will be shared once your order status moves to "Preparation". For self pickup, you must arrange your own vehicle and take full responsibility for transport. A refundable utensils deposit must be paid directly to the caterer and will be returned after all supplied utensils are safely handed back.'
    );
  }
  terms.forEach((t, index) => {
    addPageIfNeeded(P.LINE_HEIGHT * 2);
    const fullLine = `${index + 1}. ${t}`;
    const wrapped = doc.splitTextToSize(
      fullLine,
      W - P.PAGE_MARGIN * 2 - 20
    );
    wrapped.forEach((line) => {
      doc.text(line, CONTENT_LEFT, y);
      y += P.LINE_HEIGHT;
    });
    y += 2; // small gap between terms
  });

  const footerCenterX = W / 2;
  y += P.LINE_HEIGHT + 4;
  doc.setFontSize(P.NORMAL);
  doc.setFont("helvetica", "bold");
  doc.text("FrameMyEvent", footerCenterX, y, { align: "center" });

  y += P.LINE_HEIGHT;
  doc.setFontSize(P.SMALL);
  doc.setFont("helvetica", "normal");
  doc.text(
    "by FrameMyEvent OPC Private Limited",
    footerCenterX,
    y,
    { align: "center" }
  );

  y += P.LINE_HEIGHT;
  const tagline =
    "Your trusted catering & event partner — clean invoices, quick payments, dependable service.";
  const taglineLines = doc.splitTextToSize(tagline, 320);
  taglineLines.forEach((line) => {
    y += P.LINE_HEIGHT;
    addPageIfNeeded(P.LINE_HEIGHT);
    doc.text(line, footerCenterX, y, { align: "center" });
  });

  y += P.LINE_HEIGHT;
  doc.text(
    company.phone || "contact@framemyevent.com",
    footerCenterX,
    y,
    { align: "center" }
  );

  y += P.LINE_HEIGHT;
  const copyLine = `© ${new Date().getFullYear()} FrameMyEvent OPC Private Limited. All rights reserved.`;
  doc.text(copyLine, footerCenterX, y, { align: "center" });

  // ---------- Save ----------
  doc.save(filename);
}