// src/pages/PaymentPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "../shared-lib/axiosInstance";
import { CalendarDays, MapPin, Phone, Users } from "lucide-react";
import { PAYMENT_ENABLED, PAYMENT_PROVIDER } from "../payments/config";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function fmtAmt(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "₹0.00";
  return `₹${n.toFixed(2)}`;
}


// MetaCard component — put just above PaymentPage
function MetaCard({ id, icon, label, value, tooltip, previewFn }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  const preview = typeof previewFn === "function" ? previewFn(value) : value;
  const tooltipId = `${id ?? label?.toLowerCase()}-tooltip`;


  return (
    <div
      ref={ref}
      className="relative group inline-block w-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        id={id}
        tabIndex={0}
        role="button"
        aria-describedby={tooltipId}
        className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border hover:shadow-md transition cursor-pointer w-full"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: "rgba(0,0,0,0.03)" }}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            {label}
          </div>

          <div className="text-sm font-medium text-gray-800 truncate">
            {preview ?? "—"}
          </div>
        </div>
      </div>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full mt-2 z-50 w-max max-w-xs rounded-md border bg-white p-3 text-sm text-gray-800 shadow-lg"
          style={{ boxShadow: "0 10px 50px rgba(0,0,0,0.12)" }}
        >
          <div className="break-words">{tooltip ?? value ?? "—"}</div>
        </div>
      )}
    </div>
  );
}

/**
 * PaymentPage
 */

export default function PaymentPage() {
  const q = useQuery();
  const navigate = useNavigate();
  const location = useLocation();
  const rawOrderIdQs =
    q.get("orderId") || q.get("order_id") || q.get("id") || "";
  const payId = q.get("pay_id") || q.get("payment_id") || null;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [fetchingSummary, setFetchingSummary] = useState(false);

  const [packageInfoState, setPackageInfoState] = useState(null);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageLoadError, setPackageLoadError] = useState("");
  const [paying, setPaying] = useState(false);
  const priceCls = "text-right font-semibold tabular-nums break-all max-w-[55%] sm:max-w-none";


  const hasTotal = useCallback((o) => {
    if (!o) return false;
    const val = Number(o.total ?? o.total_amount ?? o.amount ?? 0);
    return !Number.isNaN(val) && val > 0;
  }, []);
  const paymentPolicy = order?.payment_policy || null;
  const paymentOptions = Array.isArray(paymentPolicy?.options)
    ? paymentPolicy.options
    : [];
  const advanceOption = paymentOptions.find(o => o.key === "advance");
  const [paymentMode, setPaymentMode] = useState("min");
  function fmtAmtResponsive(v) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return "₹0";

    if (window.innerWidth < 360) {
      if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
      if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
    }

    return fmtAmt(n);
  }
  const fmtAmtCompact = (v) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return "₹0";
    if (window.innerWidth < 360) {
      if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
      if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
    }
    return fmtAmt(n);
  };

  const parseJsonParam = useCallback((raw) => {
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(String(raw));
      const t = decoded.trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        return JSON.parse(t);
      }
    } catch (e) {
      // ignore
    }
    return null;
  }, []);

  const unwrapOrderPayload = useCallback((payload) => {
    if (!payload) return null;
    if (payload.order && typeof payload.order === "object") return payload.order;
    if (payload.data && typeof payload.data === "object") return payload.data;
    if (payload.result && typeof payload.result === "object") return payload.result;
    if (payload.tax && typeof payload.tax === "object") return payload.tax;
    return payload;
  }, []);

  const fetchSummaryForId = useCallback(
    async (id) => {
      if (!id) return null;
      setFetchingSummary(true);
      try {
        const resp = await axios.get(`/api/orders/${id}/summary/`);
        return unwrapOrderPayload(resp.data) || null;
      } catch (err) {
        try {
          const resp2 = await axios.get(`/api/orders/${id}/`);
          return unwrapOrderPayload(resp2.data) || null;
        } catch (err2) {
          console.error(
            "fetchSummaryForId: both summary and detail failed",
            err,
            err2
          );
          return null;
        } finally {
          setFetchingSummary(false);
        }
      } finally {
        setFetchingSummary(false);
      }
    },
    [unwrapOrderPayload]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setOrder(null);
    setPackageInfoState(null);
    setPackageLoadError("");

    if (!rawOrderIdQs) {
      setError("No order id provided in query params.");
      setLoading(false);
      return;
    }

    const parsed = parseJsonParam(rawOrderIdQs);
    if (parsed) {
      const maybeOrder = parsed.order || parsed;
      setOrder(maybeOrder || null);

      if (maybeOrder && (maybeOrder.id || maybeOrder.order_id)) {
        const oid = maybeOrder.id || maybeOrder.order_id;
        try {
          const summary = await fetchSummaryForId(oid);
          if (summary)
            setOrder((prev) => ({ ...(prev || {}), ...(summary || {}) }));
        } catch (e) {
          console.error("Failed to fetch summary for parsed payload:", e);
        }
      }
      setLoading(false);
      return;
    }

    if (String(rawOrderIdQs).startsWith("mock-")) {
      try {
        const mocks = JSON.parse(localStorage.getItem("mockOrders") || "[]");
        const found = mocks.find((m) => String(m.id) === String(rawOrderIdQs));
        if (found) setOrder(found);
        else setError("No mock order found in localStorage");
      } catch (e) {
        console.error(e);
        setError("Failed to read mock order");
      } finally {
        setLoading(false);
        return;
      }
    }

    try {
      const res = await axios.get(`/api/orders/${rawOrderIdQs}/`);
      const got = unwrapOrderPayload(res.data);
      setOrder(got);

      if (got && (got.id || got.order_id)) {
        const oid = got.id || got.order_id;
        try {
          const summary = await fetchSummaryForId(oid);
          if (summary)
            setOrder((prev) => ({ ...(prev || {}), ...(summary || {}) }));
        } catch (e) {
          console.error("Failed to fetch summary after detail:", e);
        }
      }
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (
        (status === 409 || status === 200) &&
        data &&
        (data.order || data.id || data.order_id)
      ) {
        const existing = unwrapOrderPayload(data);
        setOrder(existing);
        if (existing && (existing.id || existing.order_id)) {
          try {
            const summary = await fetchSummaryForId(
              existing.id || existing.order_id
            );
            if (summary)
              setOrder((prev) => ({ ...(prev || {}), ...(summary || {}) }));
          } catch (e) {
            // ignore
          }
        }
      } else {
        console.error("Failed to fetch order detail:", err);
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Order not found";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [rawOrderIdQs, parseJsonParam, fetchSummaryForId, unwrapOrderPayload]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawOrderIdQs, location.key]);

  useEffect(() => {
    if (!paymentMode && paymentOptions.length > 0) {
      setPaymentMode(paymentOptions[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOptions]);

  useEffect(() => {
    if (!order) return;

    const existingPkg =
      order.selected_package ||
      order.package ||
      (order.selected_package_id ? { id: order.selected_package_id } : null) ||
      (order.package_id ? { id: order.package_id } : null);

    if (
      existingPkg &&
      existingPkg.id &&
      (existingPkg.name || existingPkg.price_per_plate || existingPkg.price)
    ) {
      setPackageInfoState({
        id: existingPkg.id,
        name:
          existingPkg.name ??
          existingPkg.package_name ??
          existingPkg.title ??
          null,
        price_per_plate: existingPkg.price_per_plate ?? existingPkg.price ?? null,
        composition:
          existingPkg.composition ??
          existingPkg.composition_structure ??
          null,
        raw: existingPkg,
        veg_only:
          existingPkg.veg_only ??
          existingPkg.raw?.veg_only ??
          existingPkg.raw?.veg_only,
      });
      return;
    }

    const pkgId =
      (order.selected_package && order.selected_package.id) ||
      order.package_id ||
      order.package ||
      order.selected_package_id ||
      (order?.selected_package && order.selected_package?.id) ||
      null;
    const catererId = order.caterer ?? order.caterer_id ?? null;

    if (!pkgId) {
      return;
    }

    let cancelled = false;
    setPackageLoading(true);
    setPackageLoadError("");

    (async () => {
      const trySetPkg = (p) => {
        if (!p) return false;
        let cs = p.composition_structure ?? p.composition_struct ?? null;
        try {
          if (typeof cs === "string") cs = JSON.parse(cs);
        } catch (e) {
          /* ignore */
        }
        const normalized = {
          id: p.id,
          name: p.name ?? p.title ?? p.package_name ?? null,
          description: p.description ?? null,
          price_per_plate: Number(p.price_per_plate ?? p.price ?? 0),
          composition_structure: cs || null,
          composition: p.composition ?? null,
          raw: p,
          veg_only:
            p.veg_only === true ? true : p.veg_only === false ? false : undefined,
        };
        setPackageInfoState(normalized);
        setOrder((prev) => ({ ...(prev || {}), selected_package: normalized }));
        return true;
      };

      try {
        if (catererId) {
          try {
            const url = `/api/caterers/${catererId}/public-packages/`;
            const resp = await axios.get(url);
            if (cancelled) return;
            const arr = Array.isArray(resp.data)
              ? resp.data
              : resp.data?.results || [];
            const found = arr.find((x) => String(x.id) === String(pkgId));
            if (found && trySetPkg(found)) {
              setPackageLoading(false);
              return;
            }
          } catch (err) {
            // ignore and continue
          }
        }

        if (catererId) {
          try {
            const url = `/api/caterers/${catererId}/packages/${pkgId}/`;
            const resp = await axios.get(url);
            if (cancelled) return;
            if (resp && resp.data && trySetPkg(resp.data)) {
              setPackageLoading(false);
              return;
            }
          } catch (err) {
            // ignore and continue
          }
        }

        try {
          const url = `/api/packages/${pkgId}/`;
          const resp = await axios.get(url);
          if (cancelled) return;
          if (resp && resp.data && trySetPkg(resp.data)) {
            setPackageLoading(false);
            return;
          }
        } catch (err) {
          // ignore
        }

        if (!cancelled) {
          setPackageLoadError("Package details not available from server");
        }
      } catch (e) {
        console.error("Package fetch failed:", e);
        if (!cancelled) setPackageLoadError("Failed to fetch package details");
      } finally {
        if (!cancelled) setPackageLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order]);

  // compute packageInfo early to avoid TDZ
  const packageInfo =
    order?.selected_package ||
    order?.package ||
    packageInfoState ||
    (order?.package_name
      ? { name: order.package_name, id: order.package_id || null }
      : null) ||
    null;

  // derive selectedPackageDisplay
  const selectedPackageDisplay = useMemo(() => {
    if (!order && !packageInfoState) return null;

    const normalizeCandidate = (c) => {
      if (!c) return null;
      if (typeof c === "string") {
        try {
          const parsed = JSON.parse(c.trim());
          return parsed;
        } catch (e) {
          return null;
        }
      }
      return c;
    };

    const candidates = [
      order?.selected_package_display,
      order?.selected_package?.selected_display,
      order?.selected_package_selection,
      order?.selected_package_items,
      order?.selected_package?.selection,
      order?.selected_items,
      packageInfoState?.raw?.selected_display,
      order?.selected_package_display_json,
    ];

    let raw = null;
    for (const c of candidates) {
      if (!c) continue;
      const n = normalizeCandidate(c);
      if (!n) continue;
      raw = n;
      break;
    }
    if (!raw) return null;

    const pkgSections = packageInfo?.composition_structure?.sections ?? {};
    const sectionsArr = [];

    const resolveItem = (sectionKey, it) => {
      if (it == null) return { option: null, idx: null, required: false };

      if (typeof it === "object") {
        if (
          it.option ||
          it.idx != null ||
          it.id != null ||
          it.menu_item_id != null
        ) {
          const opt = it.option ?? it;
          if (
            opt &&
            opt.id == null &&
            opt.menu_item_id == null &&
            pkgSections[sectionKey]?.options
          ) {
            const found = (pkgSections[sectionKey]?.options || []).find(
              (o) => o.name === opt.name || o.title === opt.title
            );
            if (found)
              return {
                option: found,
                idx: (pkgSections[sectionKey]?.options || []).indexOf(found),
                required: !!found.required,
              };
          }
          if (it.idx != null && Array.isArray(pkgSections[sectionKey]?.options)) {
            const idxNum = Number(it.idx);
            const o = pkgSections[sectionKey].options[idxNum] ?? it.option ?? opt;
            return {
              option: o ?? null,
              idx: isFinite(idxNum) ? idxNum : null,
              required: !!o?.required,
            };
          }
          return {
            option: opt ?? null,
            idx: null,
            required: !!opt?.required,
          };
        }
      }

      if (typeof it === "number" || (typeof it === "string" && /^\d+$/.test(it))) {
        const idx = Number(it);
        if (Array.isArray(pkgSections[sectionKey]?.options)) {
          const o = pkgSections[sectionKey].options[idx] ?? null;
          return {
            option: o,
            idx: isFinite(idx) ? idx : null,
            required: !!o?.required,
          };
        }
        return { option: null, idx, required: false };
      }

      if (typeof it === "string") {
        try {
          const parsed = JSON.parse(it);
          return resolveItem(sectionKey, parsed);
        } catch (e) {
          const found = (pkgSections[sectionKey]?.options || []).find(
            (o) => o.name === it || o.title === it
          );
          if (found)
            return {
              option: found,
              idx: (pkgSections[sectionKey]?.options || []).indexOf(found),
              required: !!found.required,
            };
          return { option: { name: it }, idx: null, required: false };
        }
      }

      return { option: null, idx: null, required: false };
    };

    if (raw && typeof raw === "object" && raw.sections && typeof raw.sections === "object") {
      for (const [k, sec] of Object.entries(raw.sections)) {
        const label = sec.title ?? sec.name ?? k;
        const sel = sec.selected ?? sec.items ?? sec.selection ?? [];
        const items = Array.isArray(sel) ? sel.map((it) => resolveItem(k, it)) : [];
        sectionsArr.push({ sectionKey: k, label, items });
      }
    } else if (Array.isArray(raw)) {
      raw.forEach((s, i) => {
        const sectionKey =
          s.sectionKey ??
          s.key ??
          s.section ??
          Object.keys(pkgSections)[i] ??
          `section_${i + 1}`;
        const label =
          s.label ??
          pkgSections[sectionKey]?.title ??
          pkgSections[sectionKey]?.name ??
          sectionKey;
        const rawItems = s.items ?? s.selected ?? s.options ?? [];
        const items = Array.isArray(rawItems)
          ? rawItems.map((it) => resolveItem(sectionKey, it))
          : [];
        sectionsArr.push({ sectionKey, label, items });
      });
    } else if (typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        const sectionKey = k;
        const label =
          pkgSections[sectionKey]?.title ??
          pkgSections[sectionKey]?.name ??
          sectionKey;
        let rawItems = [];
        if (Array.isArray(v)) rawItems = v;
        else if (v && Array.isArray(v.items)) rawItems = v.items;
        else if (v && Array.isArray(v.selected)) rawItems = v.selected;
        const items = rawItems.map((it) => resolveItem(sectionKey, it));
        sectionsArr.push({ sectionKey, label, items });
      }
    }

    try {
      for (const secDefKey of Object.keys(pkgSections || {})) {
        const def = pkgSections[secDefKey];
        const requiredOpts = (def?.options || []).filter((o) => o && o.required);
        if (!requiredOpts || requiredOpts.length === 0) continue;

        let target = sectionsArr.find(
          (s) => String(s.sectionKey) === String(secDefKey)
        );
        if (!target) {
          const items = requiredOpts.map((o) => ({
            option: o,
            idx: (def.options || []).indexOf(o),
            required: true,
          }));
          sectionsArr.push({
            sectionKey: secDefKey,
            label: def.title ?? def.name ?? secDefKey,
            items,
          });
          continue;
        }
        requiredOpts.forEach((req) => {
          const already = target.items.some((it) => {
            if (!it.option) return false;
            const a = it.option;
            return (
              (a.id != null &&
                req.id != null &&
                String(a.id) === String(req.id)) ||
              (a.menu_item_id != null &&
                req.menu_item_id != null &&
                String(a.menu_item_id) === String(req.menu_item_id)) ||
              (a.name && req.name && String(a.name) === String(req.name))
            );
          });
          if (!already) {
            target.items.push({
              option: req,
              idx: (def.options || []).indexOf(req),
              required: true,
            });
          } else {
            target.items = target.items.map((it) => {
              if (!it.option) return it;
              const a = it.option;
              if (
                (a.id != null &&
                  req.id != null &&
                  String(a.id) === String(req.id)) ||
                (a.menu_item_id != null &&
                  req.menu_item_id != null &&
                  String(a.menu_item_id) === String(req.menu_item_id)) ||
                (a.name && req.name && String(a.name) === String(req.name))
              ) {
                return { ...it, required: true };
              }
              return it;
            });
          }
        });
      }
    } catch (e) {
      console.warn("selectedPackageDisplay merge required failed", e);
    }

    const final = sectionsArr.map((s) => ({
      sectionKey: s.sectionKey,
      label: s.label,
      items: Array.isArray(s.items)
        ? s.items.map((it) => ({
          option: it.option ?? null,
          idx: it.idx ?? null,
          required: !!it.required,
        }))
        : [],
    }));

    return final.length > 0 ? final : null;
  }, [order, packageInfoState, packageInfo]);

  // renderPkgSections
  const renderPkgSections = useCallback(() => {
    const pkg = packageInfo;
    const selDisplay = selectedPackageDisplay;

    if (pkg?.composition_structure && pkg.composition_structure.sections) {
      const sectionsDef = pkg.composition_structure.sections;

      if (selDisplay && Array.isArray(selDisplay) && selDisplay.length > 0) {
        return (
          <div className="space-y-3">
            {selDisplay.map((sec, sidx) => {
              const items = Array.isArray(sec.items) ? sec.items : [];
              return (
                <div
                  key={sec.sectionKey ?? sidx}
                  className="p-3 bg-white border rounded-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-800">
                      {sec.label ?? sec.sectionKey ?? `Section ${sidx + 1}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {items.length} selected
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {items.length === 0 ? (
                      <div className="text-xs text-gray-400">
                        No selection recorded for this section.
                      </div>
                    ) : (
                      items.map((it, i) => {
                        const option = it?.option ?? null;
                        const title =
                          option?.name ??
                          option?.title ??
                          option?.label ??
                          `Option ${i + 1}`;

                        const isVeg =
                          option?.is_veg === true ||
                          option?.veg === true ||
                          option?.food_type === "veg" ||
                          option?.type === "veg";

                        const isNonVeg =
                          option?.is_veg === false ||
                          option?.veg === false ||
                          option?.food_type === "non-veg" ||
                          option?.food_type === "nonveg" ||
                          option?.type === "non-veg" ||
                          option?.type === "nonveg";

                        const dotColorClass = isVeg
                          ? "bg-emerald-600"
                          : isNonVeg
                            ? "bg-orange-500"
                            : "bg-emerald-600";

                        return (
                          <div key={i} className="flex items-start gap-3">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${dotColorClass} mt-1`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-700">
                                {title}
                              </div>
                              {option?.description && (
                                <div className="text-xs text-gray-400">
                                  {option.description}
                                </div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">
                                {it.required ? "Required" : "Selected"}
                                {it.idx != null ? ` • option #${it.idx + 1}` : ""}
                              </div>
                            </div>
                            {option && (option.price || option.price_per_unit) ? (
                              <div className="text-sm font-semibold text-gray-800">
                                {fmtAmt(
                                  Number(option.price ?? option.price_per_unit ?? 0)
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      const selectedSections = Object.entries(sectionsDef)
        .map(([key, sec]) => {
          const opts = (sec.options || []).filter((o) => o && o.selected);
          return {
            sectionKey: key,
            label: sec.title ?? sec.name ?? key,
            items: opts.map((o) => ({
              option: o,
              idx: (sec.options || []).indexOf(o),
              required: !!o.required,
            })),
          };
        })
        .filter((s) => s.items && s.items.length > 0);

      if (selectedSections.length > 0) {
        return (
          <div className="space-y-3">
            {selectedSections.map((sec, idx) => (
              <div
                key={sec.sectionKey ?? idx}
                className="p-3 bg-white border rounded-md"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-800">
                    {sec.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {sec.items.length} selected
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {sec.items.map((it, i) => {
                    const option = it.option ?? null;

                    const isVeg =
                      option?.is_veg === true ||
                      option?.veg === true ||
                      option?.food_type === "veg" ||
                      option?.type === "veg";

                    const isNonVeg =
                      option?.is_veg === false ||
                      option?.veg === false ||
                      option?.food_type === "non-veg" ||
                      option?.food_type === "nonveg" ||
                      option?.type === "non-veg" ||
                      option?.type === "nonveg";

                    const dotColorClass = isVeg
                      ? "bg-emerald-600"
                      : isNonVeg
                        ? "bg-orange-500"
                        : "bg-emerald-600";

                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${dotColorClass} mt-1`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-700">
                            {option?.name ?? option?.title ?? `Option ${i + 1}`}
                          </div>
                          {option?.description && (
                            <div className="text-xs text-gray-400">
                              {option.description}
                            </div>
                          )}
                        </div>
                        {option && (option.price || option.price_per_unit) ? (
                          <div className="text-sm font-semibold text-gray-800">
                            {fmtAmt(
                              Number(option.price ?? option.price_per_unit ?? 0)
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      }

      if (pkg?.composition) {
        return (
          <div className="prose prose-sm text-sm text-gray-700">
            {pkg.composition}
          </div>
        );
      }

      return (
        <div className="text-xs text-gray-400">
          Package composition not available.
        </div>
      );
    }

    if (pkg?.composition) {
      return (
        <div className="prose prose-sm text-sm text-gray-700">
          {pkg.composition}
        </div>
      );
    }

    return (
      <div className="text-xs text-gray-400">
        Package composition not available.
      </div>
    );
  }, [packageInfo, selectedPackageDisplay]);

  const handleCancel = async () => {
    if (!order) return;
    if (
      !window.confirm(
        "Cancel this initiated order? This will allow you to create a new order."
      )
    )
      return;
    setProcessing(true);
    try {
      await axios.patch(`/api/orders/${order.id}/status/`, {
        status: "cancelled",
      });
      alert("Order cancelled.");
      navigate(-1);
    } catch (err) {
      console.error("Cancel failed:", err);
      alert(
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Failed to cancel order"
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleProceedToPay = () => {
    if (!order || paying) return;

    const selectedMode = paymentMode; //  freeze at click time
    setPaying(true);

    console.log("PROCEED CLICK → paymentMode =", selectedMode);

    if (!hasTotal(order)) {
      alert("Order total missing");
      setPaying(false);
      return;
    }

    navigate(
      `/pay/razorpay/${order.id}?mode=${selectedMode}`,
      { replace: true }
    );
  };


  // --- Prepare display values ---
  const amountFromOrder = Number(
    order?.total ?? order?.total_amount ?? order?.amount ?? 0
  );
  const utensils = Number(order?.utensils_advance ?? order?.utensils ?? 0);
  const chargeableTotal = Number(
    order?.chargeable_total ?? Math.max(0, amountFromOrder - utensils)
  );
  const plates = order?.plates ?? null;
  const catererName = order?.caterer_name ?? order?.caterer ?? "—";
  const eventDate = order?.event_date ?? null;
  const eventTime = order?.event_time ?? null;
  const locationText = order?.location ?? null;
  const contact = order?.contact ?? null;
  const deliveryCharge = Number(
    order?.delivery_fee ?? order?.delivery_charge ?? 0
  );
  const staffCharge = Number(order?.staff_charge ?? 0);
  const bottlesCharge = Number(order?.bottles_charge ?? 0);
  const taxAmount = Number(
    order?.tax_amount ??
    order?.tax ??
    order?.amount_breakdown?.tax_amount ??
    order?.amount_breakdown?.tax ??
    order?.order?.tax_amount ??
    order?.order?.amount_breakdown?.tax_amount ??
    order?.tax_amount_str ??
    order?.tax_amount_value ??
    0
  );
  const couponDiscount = Number(order?.coupon_discount ?? 0);

  const totalAfterCoupon = chargeableTotal;
  const includeStaff = Boolean(
    order?.staff_requested || order?.include_staff || order?.staff
  );

  const rawItems = Array.isArray(order?.items) ? order.items : [];

  // classify items: complimentary vs addons vs others
  const complimentaryItems = [];
  const defaultItems = [];
  const addonItems = [];

  const addonItemIdSet = new Set(
    (order?.addon_item_ids || []).map((id) => String(id))
  );

  rawItems.forEach((it) => {
    const price = Number(it.price ?? it.unit_price ?? 0);
    const menuItemId = String(it.menu_item ?? it.id ?? "");
    const isComplementary = it.is_complementary === true;

    // Backend rule: is_complementary === false => addon
    const isAddonByFlag = it.is_complementary === false;
    const isAddonById = addonItemIdSet.has(menuItemId);
    const isAddon = isAddonByFlag || isAddonById;

    if (isAddon) {
      addonItems.push(it);
    } else if (isComplementary || (!Number.isNaN(price) && price === 0)) {
      // Complimentary items: explicitly complementary OR free items
      complimentaryItems.push(it);
    } else {
      defaultItems.push(it);
    }
  });

  // compute itemsTotal strictly from line items
  const itemsTotal = rawItems.reduce((sum, it) => {
    try {
      const price = Number(it.price ?? it.unit_price ?? 0);
      const qty = Number(it.quantity ?? 1) || 1;
      if (Number.isNaN(price) || Number.isNaN(qty)) return sum;
      return sum + price * qty;
    } catch (e) {
      return sum;
    }
  }, 0);

  const pkgPricePerPlate = Number(
    packageInfo?.price_per_plate ?? packageInfo?.price ?? 0
  );
  const packageCost =
    pkgPricePerPlate > 0 && Number(plates || 0) > 0
      ? pkgPricePerPlate * Number(plates || 0)
      : 0;

  const breakdown = order?.amount_breakdown || {};
  const fallbackItemsTotal = Number(
    breakdown.subtotal ?? order?.subtotal ?? 0
  );
  const rawItemsNonZero = itemsTotal > 0;
  const itemsComponent = rawItemsNonZero ? itemsTotal : fallbackItemsTotal;
  const finalItemsTotalBeforeCoupon = Number(
    Math.round((packageCost + itemsComponent) * 100) / 100
  );

  const finalItemsTotal = Number(
    Math.round(
      (finalItemsTotalBeforeCoupon - (couponDiscount || 0) + Number.EPSILON) *
      100
    ) / 100
  );

  const computedMeta = order?._computed || {};
  const waterEstimatedRaw =
    computedMeta.estimated_water_price ??
    order?.water_estimated_price ??
    order?.water_charge_server ??
    breakdown.water_charge ??
    null;
  const waterEstimated =
    waterEstimatedRaw != null ? Number(waterEstimatedRaw) : null;
  const waterChoice = order?.water_choice ?? null;
  const waterBottlesQty = order?.water_quantity ?? null;
  const waterCansNeeded = order?.water_cans_needed ?? null;
  const waterCupsNeeded = order?.water_cups_needed ?? null;

  // Water charge for TOTAL formula (bottles vs can)
  let waterChargeForTotal = 0;
  if (waterChoice === "bottles") {
    waterChargeForTotal = bottlesCharge;
  } else if (waterEstimated != null) {
    if (waterChoice && Number(waterCansNeeded ?? 0) === 0) {
      // cans chosen but 0 cans needed => waived
      waterChargeForTotal = 0;
    } else {
      waterChargeForTotal = waterEstimated;
    }
  }

  // TOTAL formula:
  // Prefer backend summary total if present, fall back to local calculation
  const subtotalForTotal = finalItemsTotalBeforeCoupon;

  const totalFromSummary = Number(
    order?.total ?? order?.total_amount ?? order?.amount ?? 0
  );

  const totalPayForUi =
    Number.isFinite(totalFromSummary) && totalFromSummary > 0
      ? totalFromSummary
      : Number(
        Math.round(
          (subtotalForTotal -
            (couponDiscount || 0) +
            staffCharge +
            deliveryCharge +
            waterChargeForTotal +
            taxAmount +
            utensils +
            Number.EPSILON) *
          100
        ) / 100
      );

  //  Amount user will pay NOW based on selected payment mode
  const payableNowAmount = useMemo(() => {
    if (!paymentMode) return totalPayForUi;

    const selected = paymentOptions.find(o => o.key === paymentMode);
    return selected ? Number(selected.amount) : totalPayForUi;
  }, [paymentMode, paymentOptions, totalPayForUi]);

  if (loading) return <div className="p-6">Loading payment details…</div>;
  if (error && !order)
    return (
      <div className="p-6">
        <div className="text-red-600">⚠️ {error}</div>
        <div className="mt-3 text-sm text-gray-600">
          You may have refreshed the page or navigated here directly.
        </div>
      </div>
    );

  // Advance & remaining based on new total
  const vegFlag =
    packageInfo &&
    (packageInfo.veg_only === true || packageInfo.raw?.veg_only === true);
  const mixedFlag =
    packageInfo &&
    (packageInfo.veg_only === false || packageInfo.raw?.veg_only === false);

  const gridGradient = vegFlag
    ? "bg-gradient-to-r from-emerald-50 via-white to-emerald-50"
    : mixedFlag
      ? "bg-gradient-to-r from-rose-50 via-white to-rose-50"
      : "bg-gradient-to-br from-white via-gray-50 to-gray-100";

  // Add-ons total for summary card (addons only + bottle charge)
  const addonsLineTotal = addonItems.reduce((s, it) => {
    const price = Number(it.price ?? it.unit_price ?? 0);
    const qty = Number(it.quantity ?? 1) || 1;
    if (Number.isNaN(price) || Number.isNaN(qty)) return s;
    return s + price * qty;
  }, 0);
  const addonsTotalForCard = addonsLineTotal + bottlesCharge;

  function formatEventDate(dateStr) {
    if (!dateStr) return null;
    const dt = new Date(dateStr);

    if (Number.isNaN(dt.getTime())) {
      const parts = String(dateStr).split("-");
      if (parts.length >= 3) {
        const [y, m, d] = parts;
        const mon = new Date(`${y}-${m}-01`)
          .toLocaleString("en-US", { month: "short" })
          .toUpperCase();
        return `${String(d).padStart(2, "0")}-${mon}-${y}`;
      }
      return dateStr;
    }

    const day = String(dt.getDate()).padStart(2, "0");
    const mon = dt
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase();
    return `${day}-${mon}-${dt.getFullYear()}`;
  }

  function formatEventTime(dateStr, timeStr) {
    if (!timeStr && !dateStr) return null;
    let dt;
    if (dateStr && timeStr) {
      dt = new Date(`${dateStr}T${timeStr}`);
    } else if (timeStr) {
      const today = new Date();
      const [hh, mm] = String(timeStr).split(":").map(Number);
      dt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        hh || 0,
        mm || 0
      );
    } else {
      dt = new Date(dateStr);
    }
    if (Number.isNaN(dt.getTime())) return timeStr || dateStr || null;
    return dt.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div id="payment-page" className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div
        id="payment-header"
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h2
            id="payment-title"
            className="text-2xl font-semibold text-gray-800"
          >
            Payment
          </h2>
          <div id="payment-subtitle" className="text-sm text-gray-500 mt-1">
            Order {order?.id ? `#${order.id}` : ""} ·{" "}
            <span id="payment-caterer-name">{catererName}</span>
          </div>
        </div>
        <div id="header-total" className="text-right">
          <div className="text-xs text-gray-500">Total due</div>
          <div
            id="header-total-amount"
            className="text-lg font-bold text-emerald-700"
          >
            {fmtAmtResponsive(totalPayForUi)}
          </div>
        </div>
      </div>

      <div
        id="payment-card"
        className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-50"
      >
        {/* top grid with meta */}
        <div
          id="payment-meta-grid"
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-5 rounded-2xl shadow-sm border ${gridGradient} place-items-stretch`}
        >
          {/* Plates */}
          <div className="w-full">
            <MetaCard
              id="meta-plates"
              icon={<Users className="w-4 h-5 text-emerald-700" aria-hidden />}
              label="Plates"
              value={plates ?? "—"}
              tooltip={
                <span className="font-semibold text-lg">
                  {plates ?? "—"} plate(s)
                </span>
              }
            />
          </div>
          {/* Event */}
          <div className="w-full">
            <MetaCard
              id="meta-event"
              icon={
                <CalendarDays className="w-4 h-5 text-blue-700" aria-hidden />
              }
              label="Event"
              value={eventDate ? formatEventDate(eventDate) : "—"}
              tooltip={
                <>
                  <div>{eventDate ? formatEventDate(eventDate) : "—"}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {eventTime ? formatEventTime(eventDate, eventTime) : "—"}
                  </div>
                </>
              }
            />
          </div>

          {/* Location */}
          <div className="w-full">
            <MetaCard
              id="meta-location"
              icon={<MapPin className="w-4 h-5 text-rose-700" aria-hidden />}
              label="Location"
              value={locationText ?? "—"}
              previewFn={(val) => {
                if (!val) return "—";
                const s = String(val);
                return s.length > 24 ? `${s.slice(0, 24)}…` : s;
              }}
              tooltip={locationText ?? "—"}
            />
          </div>

          {/* Contact */}
          <div className="w-full">
            <MetaCard
              id="meta-contact"
              icon={
                <Phone className="w-4 h-5 text-yellow-700" aria-hidden />
              }
              label="Contact"
              value={contact ?? "—"}
              tooltip={<span className="font-medium">{contact ?? "—"}</span>}
            />
          </div>
        </div>

        {/* Package card */}
        {packageInfo ? (
          <div
            id="package-card"
            className="mb-6 p-4 rounded-xl bg-white border shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              {/* LEFT : Package info */}
              <div className="min-w-0">
                <div className="text-xs text-gray-500">
                  Selected package
                </div>

                {/* Name + badge */}
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <div
                    id="package-name"
                    className="text-base sm:text-lg font-semibold text-gray-900
                   truncate leading-snug"
                    title={
                      packageInfo.name ??
                      packageInfo.title ??
                      packageInfo.package_name ??
                      "Package"
                    }
                  >
                    {packageInfo.name ??
                      packageInfo.title ??
                      packageInfo.package_name ??
                      "Package"}
                  </div>

                  {(vegFlag || mixedFlag) && (
                    <span
                      id="package-badge"
                      className={`shrink-0 inline-flex items-center
                      text-[11px] sm:text-xs
                      px-2.5 py-1 rounded-full font-medium
                      whitespace-nowrap
                      ${vegFlag
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                        }`}
                    >
                      {vegFlag ? "Veg" : "Veg + Non-Veg"}
                    </span>
                  )}
                </div>

                {/* Description */}
                {packageInfo.description && (
                  <div
                    id="package-description"
                    className="text-xs text-gray-500 mt-1 line-clamp-2"
                  >
                    {packageInfo.description}
                  </div>
                )}

                {/* Total items */}
                {packageInfo.composition_structure?.sections && (
                  <div
                    id="package-total-items"
                    className="mt-2 text-xs text-gray-600"
                  >
                    Total items:&nbsp;
                    <span className="font-medium text-gray-800">
                      {Object.values(
                        packageInfo.composition_structure.sections
                      ).reduce((sum, sec) => sum + (sec.count || 0), 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* RIGHT : Price */}
              <div className="shrink-0 text-right">
                <div className="text-xs text-gray-500">
                  Price / plate
                </div>

                <div
                  id="package-price"
                  className="mt-1 inline-flex items-center
                 px-3 py-1 rounded-full
                 bg-white border shadow-sm"
                >
                  <span className="text-sm font-semibold text-emerald-700 tabular-nums">
                    {fmtAmt(
                      Number(
                        packageInfo.price_per_plate ??
                        packageInfo.price ??
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* per-section cards - render selected items when available */}
            <div
              id="package-sections"
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {renderPkgSections()}
            </div>
          </div>
        ) : packageLoading ? (
          <div id="package-loading" className="mb-6 text-sm text-gray-600">
            Loading selected package…
          </div>
        ) : packageLoadError ? (
          <div id="package-error" className="mb-6 text-sm text-yellow-800">
            Package info: {packageLoadError}
          </div>
        ) : null}

        <hr className="my-4 border-gray-100" />

        {/* Items block */}
        <div id="items-block" className="mb-6">
          <h4 id="items-title" className="font-semibold text-gray-800 mb-3">
            Summary
          </h4>

          {fetchingSummary ? (
            <div id="items-loading" className="text-sm text-gray-600">
              Fetching summary…
            </div>
          ) : rawItems.length === 0 ? (
            <div id="items-empty" className="text-sm text-yellow-800">
              No line items were returned by the server.
              {hasTotal(order)
                ? " You can still proceed to pay using the total below."
                : " Please edit the order to add items."}
            </div>
          ) : (
            <>
              {/* PACKAGE SUMMARY */}
              {packageInfo && typeof packageInfo !== "string" && (
                <div
                  id="summary-package"
                  className="mb-3 p-3 rounded-lg border bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-600">Package</div>
                      <div
                        id="summary-package-name"
                        className="font-medium text-gray-800 truncate"
                      >
                        {packageInfo.name ??
                          packageInfo.title ??
                          packageInfo.package_name ??
                          "Package"}
                      </div>
                      {packageInfo.description && (
                        <div
                          id="summary-package-desc"
                          className="text-xs text-gray-500 mt-0.5"
                        >
                          {packageInfo.description}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-sm">
                      <div className="text-xs text-gray-600">Price / plate</div>
                      <div
                        id="summary-package-price"
                        className="font-semibold text-gray-900"
                      >
                        {fmtAmt(
                          Number(
                            packageInfo.price_per_plate ??
                            packageInfo.price ??
                            0
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
                    <div>Plates</div>
                    <div
                      id="summary-package-plates"
                      className="font-medium"
                    >
                      {plates ?? "—"}
                    </div>
                  </div>

                  <div className="mt-1 grid grid-cols-[1fr_auto] gap-2 text-sm text-gray-700">
                    <div>
                      <div className="text-xs text-gray-600">Package cost</div>
                      <div className="text-xs text-gray-500">
                        {fmtAmt(
                          Number(packageInfo?.price_per_plate ?? packageInfo?.price ?? 0)
                        )}{" "}
                        / plate × {Number(plates || 0)} plates
                      </div>
                    </div>

                    <div
                      id="summary-package-cost"
                      className="text-right font-semibold tabular-nums break-all max-w-[55%]"
                    >
                      {fmtAmt(packageCost)}
                    </div>
                  </div>
                </div>
              )}

              {/* ADD-ONS SUMMARY CARD */}
              {(addonItems.length > 0 || bottlesCharge > 0) && (
                <div
                  id="summary-addons"
                  className="mb-3 p-3 rounded-lg border bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-600">Add-ons</div>
                      <div
                        id="summary-addons-count"
                        className="font-medium text-gray-800"
                      >
                        {addonItems.length > 0
                          ? `${addonItems.length} item${addonItems.length > 1 ? "s" : ""
                          }`
                          : "Extra charges"}
                      </div>
                    </div>

                    <div className="text-right text-sm">
                      <div className="text-xs text-gray-600">Add-ons total</div>
                      <div
                        id="summary-addons-total"
                        className="font-semibold text-gray-900 text-right tabular-nums break-all"
                      >
                        {fmtAmt(addonsTotalForCard)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {addonItems.map((it, i) => {
                      const qty = Number(it.quantity ?? 1);
                      const unit = Number(it.price ?? it.unit_price ?? 0);
                      const lineTotal = unit * qty;

                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm text-gray-700"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 truncate">
                              {it.menu_item_name ??
                                it.name ??
                                `Addon #${i + 1}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              {fmtAmt(unit)} × {qty}
                            </div>
                          </div>
                          <div className="font-semibold text-right tabular-nums break-all max-w-[45%]">
                            {fmtAmt(lineTotal)}
                          </div>
                        </div>
                      );
                    })}

                    {bottlesCharge > 0 && (
                      <div className="flex items-center justify-between text-sm text-gray-700">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800">
                            Water bottles
                          </div>
                          <div className="text-xs text-gray-500">
                            Extra water bottles charge
                          </div>
                        </div>
                        <div className="font-semibold">
                          {fmtAmt(bottlesCharge)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COMPLIMENTARY ITEMS */}
              {complimentaryItems.length > 0 && (
                <div id="complimentary-items" className="mb-4">
                  <div className="text-sm font-medium mb-2 text-gray-700">
                    Complimentary items
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {complimentaryItems.map((it) => (
                      <span
                        key={it.id ?? `${it.menu_item}_${it.quantity}`}
                        className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-200"
                      >
                        {it.menu_item_name ??
                          it.name ??
                          `Item #${it.menu_item ?? ""}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Coupon + Items Total */}
              {couponDiscount > 0 && (
                <div className="mb-2 p-3 rounded-lg bg-white border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">Coupon discount</div>
                    <div className="text-sm font-semibold text-rose-600">
                      - {fmtAmt(couponDiscount)}
                    </div>
                  </div>
                </div>
              )}

              <div
                id="items-total-block"
                className="mt-4 p-4 rounded-lg bg-gradient-to-r from-white to-gray-50 border border-gray-100 shadow-sm"
              >
                <div className="grid grid-cols-[1fr_auto] gap-3 text-lg font-semibold text-gray-800">
                  <div>Items Total</div>
                  <div
                    id="items-total-amount"
                    className="text-indigo-700 font-bold text-right tabular-nums break-all max-w-[55%]"
                  >
                    {fmtAmt(finalItemsTotal)}
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  <div className="grid grid-cols-[1fr_auto] gap-2 mt-1">
                    <div>Before coupon</div>
                    <div className="text-right tabular-nums break-all">
                      {fmtAmt(finalItemsTotalBeforeCoupon)}
                    </div>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between mt-1">
                      <div>Coupon applied</div>
                      <div className="text-rose-600">
                        -{fmtAmt(couponDiscount)}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <div className="font-medium">Net items</div>
                    <div className="font-medium">
                      {fmtAmt(finalItemsTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* totals */}
        <div
          id="totals-block"
          className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm"
        >
          {(() => {
            const safeNumber = (v, fallback = 0) => {
              if (v === null || v === undefined || v === "") return fallback;
              const n = Number(v);
              return Number.isFinite(n) ? n : fallback;
            };

            const computed = order?._computed || {};
            const breakdown = order?.amount_breakdown || {};

            // Use same addon classification logic as above
            const addonItemsTotals = addonItems;

            const deliveryFee =
              computed.delivery_fee ??
              breakdown.delivery_charge ??
              order?.delivery_fee ??
              order?.delivery_charge ??
              null;

            const rawDeliveryOption =
              order?.delivery_option ??
              order?.deliveryType ??
              order?.delivery ??
              null;

            const deliveryOption = rawDeliveryOption ? String(rawDeliveryOption).toLowerCase() : null;

            const isDelivery =
              deliveryOption === "delivery";

            const isSelfPickup =
              deliveryOption === "selfpickup" ||
              deliveryOption === "self_pickup" ||
              deliveryOption === "self";

            const staffChargeVal =
              order?.staff_charge_server ??
              breakdown.staff_charge ??
              order?.staff_charge ??
              null;

            const utensilsAdvance = safeNumber(
              order?.utensils_advance ??
              order?.utensils ??
              breakdown.utensils_advance ??
              0,
              0
            );

            const taxAmountVal =
              computed.tax_amount ??
              breakdown.tax_amount ??
              order?.tax_amount ??
              null;

            const couponDiscountVal =
              computed.coupon_discount ??
              breakdown.coupon_discount ??
              order?.coupon_discount ??
              0;

            const addonsLineTotalTotals =
              addonItemsTotals && addonItemsTotals.length
                ? addonItemsTotals.reduce((s, it) => {
                  const price = safeNumber(
                    it.price ?? it.unit_price ?? 0,
                    0
                  );
                  const qty = Math.max(1, safeNumber(it.quantity, 1));
                  return s + price * qty;
                }, 0)
                : 0;

            const explicitBottles = safeNumber(bottlesCharge ?? 0, 0);
            const explicitBottlesOriginal = explicitBottles;

            const addonsTotal = Math.max(
              0,
              addonsLineTotalTotals + explicitBottles
            );

            const pkgCost =
              safeNumber(packageCost ?? 0, 0) ||
              safeNumber(packageInfo?.price_per_plate ?? 0, 0) *
              safeNumber(plates ?? 0, 0);

            const itemsBeforeCoupon = safeNumber(
              finalItemsTotalBeforeCoupon ?? 0,
              0
            );

            // subtotal for this breakdown
            const subtotalVal = safeNumber(
              breakdown.subtotal ??
              order?.subtotal ??
              itemsBeforeCoupon ??
              0,
              0
            );

            // Water flags for waive logic
            const isWaterCanWaived =
              waterChoice &&
              waterChoice !== "bottles" &&
              safeNumber(waterEstimated, 0) > 0 &&
              Number(waterCansNeeded ?? 0) === 0;

            const isWaterBottleWaived =
              waterChoice === "bottles" &&
              safeNumber(waterEstimated, 0) > 0 &&
              safeNumber(explicitBottlesOriginal, 0) === 0;

            const waterChargeForTotalLocal =
              waterChoice === "bottles"
                ? safeNumber(explicitBottlesOriginal, 0)
                : safeNumber(
                  isWaterCanWaived ? 0 : waterEstimated ?? 0,
                  0
                );

            const roundedDisplayedTotal =
              Math.round(
                (subtotalVal -
                  safeNumber(couponDiscountVal, 0) +
                  safeNumber(staffChargeVal, 0) +
                  safeNumber(deliveryFee, 0) +
                  safeNumber(waterChargeForTotalLocal, 0) +
                  safeNumber(taxAmountVal, 0) +
                  safeNumber(utensilsAdvance, 0) +
                  Number.EPSILON) *
                100
              ) / 100;

            const advanceOption = paymentOptions.find(o => o.key === "advance");

            // advance amount MUST come from backend (not % hardcoded)
            const advancePayableNow = advanceOption
              ? Math.round(Number(advanceOption.amount) * 100) / 100
              : 0;

            // remaining amount after advance
            const remainingAmtLocal = Math.round(
              (roundedDisplayedTotal - advancePayableNow) * 100
            ) / 100;

            const show = (v) => v !== null && v !== undefined;

            return (
              <div className="space-y-2">
                {pkgCost > 0 && (
                  <div
                    id="row-package"
                    className="flex justify-between text-sm text-gray-600"
                  >
                    <div>
                      Package cost
                      <div className="text-xs text-gray-500">
                        ({fmtAmt(Number(packageInfo?.price_per_plate ?? 0))} ×{" "}
                        {plates ?? 0} plates)
                      </div>
                    </div>
                    <div id="package-amount" className={priceCls}>
                      {fmtAmt(pkgCost)}
                    </div>
                  </div>
                )}

                {addonsTotal > 0 && (
                  <div
                    id="row-addons"
                    className="flex flex-col gap-1 text-sm text-gray-600"
                  >
                    <div className="flex justify-between">
                      <div>Add-ons total</div>
                      <div id="addons-amount" className={priceCls}>
                        {fmtAmt(addonsTotal)}
                      </div>
                    </div>

                    <div className="mt-1 text-xs text-gray-500 space-y-1">
                      {explicitBottles > 0 && (
                        <div className="flex justify-between">
                          <div>Water bottles</div>
                          <div>{fmtAmt(explicitBottles)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivery / Self pickup logic */}
                {isDelivery && show(deliveryFee) && (
                  <div
                    id="row-delivery"
                    className="flex flex-col gap-1 text-sm text-gray-600"
                  >
                    <div className="flex justify-between">
                      <div>
                        Delivery
                        <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Recommended
                        </span>
                      </div>
                      <div
                        id="delivery-amount"
                        className="flex items-center gap-1"
                      >
                        {safeNumber(deliveryFee, 0) === 0 ? (
                          <span className="font-semibold text-green-600">
                            Free
                          </span>
                        ) : (
                          <span>{fmtAmt(deliveryFee)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      We handle delivery and timing — relax and enjoy your food without pickup hassle.
                    </div>
                  </div>
                )}

                {isSelfPickup && (
                  <div
                    id="row-delivery"
                    className="flex flex-col gap-1 text-sm text-gray-600"
                  >
                    <div className="flex justify-between">
                      <div>Self pickup</div>
                      <div className="text-xs font-medium text-gray-500">
                        No delivery charge
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Pickup address and timings will be shown once your order status moves to
                      <span className="font-medium"> “Preparation”</span>.
                    </div>
                    <div className="text-xs text-emerald-700 mt-1">
                      Tip: Delivery is usually more convenient if you want on-time food without
                      coordinating pickup.
                    </div>
                  </div>
                )}

                {includeStaff ? (
                  <div
                    id="row-staff"
                    className="flex justify-between text-sm text-gray-600"
                  >
                    <div>Staff charge</div>
                    <div id="staff-amount" className="font-semibold">
                      {safeNumber(staffChargeVal, 0) === 0 ? (
                        <span className="font-semibold text-green-600">
                          Free
                        </span>
                      ) : (
                        fmtAmt(staffChargeVal)
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">Staff not selected</div>
                )}

                {(show(waterEstimated) ||
                  (waterChoice === "bottles" && waterBottlesQty != null) ||
                  waterCansNeeded != null ||
                  waterCupsNeeded != null) && (
                    <div
                      id="row-water"
                      className="flex flex-col gap-1 text-sm text-gray-600"
                    >
                      <div className="flex justify-between">
                        <div>Drinking water</div>
                        <div id="bottles-amount" className="flex items-center gap-1">

                          {(() => {
                            const val = Number(waterEstimated ?? 0);

                            if (val === 0) {
                              return (
                                <span className="font-semibold text-green-600">Free</span>
                              );
                            }

                            return show(waterEstimated) ? (
                              <span>{fmtAmt(val)}</span>
                            ) : (
                              <span>-</span>
                            );
                          })()}

                        </div>
                      </div>

                      {waterChoice === "bottles" && waterBottlesQty != null && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <div>Bottles qty</div>
                          <div>{String(waterBottlesQty)}</div>
                        </div>
                      )}

                      {waterCansNeeded != null && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <div>Water cans needed (20L)</div>
                          <div>{String(waterCansNeeded)}</div>
                        </div>
                      )}

                      {waterCupsNeeded != null && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <div>Water cups needed</div>
                          <div>{String(waterCupsNeeded)}</div>
                        </div>
                      )}
                    </div>
                  )}

                {show(taxAmountVal) && (
                  <div
                    id="row-tax"
                    className="flex justify-between text-sm text-gray-600"
                  >
                    <div>Tax</div>
                    <div id="tax-amount" className={priceCls}>{fmtAmt(taxAmountVal)}</div>
                  </div>
                )}

                {show(utensilsAdvance) && (
                  <div
                    id="row-utensils"
                    className="flex justify-between text-sm text-gray-600"
                  >
                    <div>
                      Utensils (refundable)
                      {order?.include_staff ? (
                        <div className="text-xs text-gray-500">
                          Covered when staff is included
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Collected refundable amount at delivery/pickup
                        </div>
                      )}
                    </div>
                    <div id="utensils-amount">
                      {fmtAmt(order?.include_staff ? 0 : utensilsAdvance)}
                    </div>
                  </div>
                )}

                {show(couponDiscountVal) && Number(couponDiscountVal) > 0 && (
                  <div
                    id="row-coupon"
                    className="flex justify-between text-sm text-gray-600"
                  >
                    <div>Coupon discount</div>
                    <div id="coupon-amount" className="text-rose-600">
                      -{fmtAmt(couponDiscountVal)}
                    </div>
                  </div>
                )}

                <div
                  id="total-pay"
                  className="mt-4 border-t pt-3 flex items-center justify-between"
                >
                  <div className="text-lg font-semibold">Total Pay</div>
                  <div
                    id="total-pay-amount"
                    className="text-lg font-extrabold text-emerald-700 tabular-nums break-all max-w-[60%] text-right"
                  >
                    {fmtAmtResponsive(totalPayForUi)}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {paymentMode === "min" && "Booking amount payable now"}
                  {paymentMode === "advance" && "Advance amount payable now"}
                  {paymentMode === "full" && "Full amount payable now"}
                </div>

                {!PAYMENT_ENABLED && (
                  <div className="mt-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 text-sm text-yellow-800">
                    🚧 <strong>Payments temporarily disabled</strong><br />
                    We’re onboarding vendors and completing compliance.
                    Payments will be enabled soon.
                  </div>
                )}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    id="btn-back"
                    onClick={() => navigate(-1)}
                    aria-label="Back"
                    className="w-full sm:w-auto px-4 py-2 rounded-lg border text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Back
                  </button>

                  {order?.status === "initiated" && (
                    <button
                      id="btn-cancel"
                      onClick={handleCancel}
                      disabled={processing}
                      aria-label="Cancel Order"
                      className="w-full sm:w-auto px-4 py-2 rounded-lg border text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>

                {/* Payment mode section */}
                <div id="payment-mode" className="mt-6 border-t pt-4">
                  <div className="text-sm font-semibold mb-3 text-gray-800">
                    Choose how you want to pay
                  </div>

                  {/* Payment options */}
                  <div className="flex gap-3 flex-col sm:flex-row">
                    {paymentOptions.map((opt) => {
                      const isSelected = paymentMode === opt.key;
                      const isMin = opt.key === "min";
                      const isAdvance = opt.key === "advance";
                      const isFull = opt.key === "full";

                      return (
                        <div
                          key={opt.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => setPaymentMode(opt.key)}
                          className={`relative w-full sm:w-[260px] p-4 rounded-xl border cursor-pointer transition-all
            ${isSelected
                              ? "border-emerald-600 bg-emerald-50 shadow-md"
                              : "border-gray-200 bg-white hover:shadow-sm"
                            }`}
                        >
                          {/* Tags */}
                          {isMin && (
                            <div className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold">
                              MOST POPULAR
                            </div>
                          )}

                          {isAdvance && (
                            <div className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold">
                              PREPARATION GUARANTEED
                            </div>
                          )}

                          {isFull && (
                            <div className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-semibold">
                              BEST EXPERIENCE
                            </div>
                          )}

                          {/* Button-like content */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-800">
                                {opt.label}
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                Pay now
                              </div>
                            </div>

                            <div className="text-lg font-bold text-emerald-700 text-right tabular-nums break-all max-w-[45%]">
                              {fmtAmtCompact(opt.amount)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dynamic helper text */}
                  {paymentMode === "min" && (
                    <div className="mt-3 text-xs text-gray-600">
                      🔒 Secure booking instantly. Pay remaining advance later, balance at delivery.
                    </div>
                  )}

                  {paymentMode === "advance" && (
                    <div className="mt-3 text-xs text-gray-600">
                      🧑‍🍳 Advance confirms preparation closer to the event. Balance paid at delivery.
                    </div>
                  )}

                  {paymentMode === "full" && (
                    <div className="mt-3 text-xs text-gray-600">
                      ⭐ Nothing to pay later. Higher acceptance & priority preparation.
                    </div>
                  )}

                  {/* Proceed buttons */}
                  {paymentMode && (
                    <div className="mt-5 flex gap-3 flex-wrap">
                      <button
                        id="btn-proceed"
                        onClick={handleProceedToPay}
                        disabled={!PAYMENT_ENABLED || paying}
                        className={`px-6 py-2 rounded-lg text-white font-semibold shadow w-full sm:w-auto
    ${PAYMENT_ENABLED && !paying
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600"
                            : "bg-gray-300 cursor-not-allowed"
                          }`}
                      >
                        {paying ? "Processing…" : (
                          <span className="flex items-center justify-center gap-2 flex-wrap">
                            <span>Proceed to Pay</span>
                            <span className="font-bold tabular-nums break-all">
                              {fmtAmt(paymentOptions.find(o => o.key === paymentMode)?.amount)}
                            </span>
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 rounded-lg border bg-white text-gray-700 hover:bg-gray-50 w-full sm:w-auto"
                      >
                        Back
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div
        id="payment-footer-note"
        className="text-[11px] text-gray-500 mt-4 text-center leading-snug"
      >
        By proceeding with the payment, you agree to our{" "}
        <a
          href="/legal/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 hover:underline font-medium"
        >
          Terms & Conditions
        </a>.
      </div>
    </div>
  );
}