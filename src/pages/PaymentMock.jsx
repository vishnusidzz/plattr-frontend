// client/src/pages/PaymentMock.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../shared-lib/axiosInstance";

/**
 * PaymentMock
 *
 * - Expects order data either in location.state.order or query params (minimal).
 * - If provided order.id and your backend supports a payment endpoint (e.g. POST /api/orders/:id/pay/),
 *   it will attempt to call it. If not, it will mock success locally.
 *
 * Usage:
 *  - navigate("/payment", { state: { order } })
 *  - or visit /payment?caterer=12&total=500&plates=2
 *
 * Replace backend endpoints where needed.
 */

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function PaymentMock() {
  const location = useLocation();
  const navigate = useNavigate();
  const q = useQuery();

  // Try to read an order from location.state first (preferred).
  // Order shape we expect (flexible):
  // { id, caterer_id, plates, total_amount, addon_item_ids, default_item_ids, customer: { name, phone }, ... }
  const initialOrder = location?.state?.order || null;

  // Minimal fallback using query params
  const fallbackOrder = useMemo(() => {
    const caterer = q.get("caterer");
    const total = q.get("total");
    const plates = q.get("plates");
    if (!caterer && !total) return null;
    return {
      id: q.get("order_id") || null,
      caterer_id: caterer ? Number(caterer) : null,
      plates: plates ? Number(plates) : 1,
      total_amount: total ? Number(total) : 0,
      addon_item_ids: (q.get("addons") || "")
        .split(",")
        .filter(Boolean)
        .map((x) => Number(x)),
    };
  }, [location.search]);

  const [order] = useState(initialOrder || fallbackOrder);
  const [method, setMethod] = useState("cod"); // cod | card | upi
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successPayload, setSuccessPayload] = useState(null);

  useEffect(() => {
    // If there's no order data, we still allow creating an "ad-hoc" payment
    // but we inform the user.
    if (!order) {
      setError("");
    }
  }, [order]);

  // Simulate a server-side call to create an order if none present.
  const createOrderIfMissing = async () => {
    if (order && order.id) return order; // already created
    // If your backend exposes POST /api/orders/ you can uncomment and use that.
    // Otherwise we return a mocked order object.
    try {
      // Example: send minimal payload (adjust to your API)
      // const payload = {
      //   caterer_id: order?.caterer_id,
      //   plates: order?.plates || 1,
      //   default_item_ids: order?.default_item_ids || [],
      //   addon_item_ids: order?.addon_item_ids || [],
      //   total_amount: order?.total_amount || 0,
      // };
      // const res = await axiosInstance.post("/api/orders/", payload);
      // return res.data;

      // Fallback mock:
      return {
        id: Math.floor(Math.random() * 900000) + 100000,
        ...order,
        status: "created",
        created_at: new Date().toISOString(),
      };
    } catch (e) {
      console.error("createOrderIfMissing error", e);
      throw e;
    }
  };

  // Simulate calling backend payment endpoint if exists, otherwise mock success
  const callPaymentEndpoint = async (orderId, methodName) => {
    try {
      // Example backend path (adjust if you have one):
      // POST /api/orders/:id/pay/ { method: 'card'|'upi'|'cod', payload: {...} }
      // const res = await axiosInstance.post(`/api/orders/${orderId}/pay/`, { method: methodName });
      // return res.data;

      // Mock delay & response:
      await new Promise((r) => setTimeout(r, 1200));
      return { success: true, payment_id: `MOCK-${Date.now()}`, paid: methodName !== "cod" };
    } catch (e) {
      console.error("callPaymentEndpoint error", e);
      throw e;
    }
  };

  const onPay = async () => {
    setError("");
    setProcessing(true);

    try {
      // Ensure we have an order (create if necessary)
      const activeOrder = await createOrderIfMissing();

      // Simulate payment flow
      if (method === "cod") {
        // COD — no real payment, just mark as placed
        // Optionally: call backend to mark order as 'placed' with payment_method cod
        const res = await callPaymentEndpoint(activeOrder.id, "cod");
        setSuccessPayload({
          order: activeOrder,
          payment: { method: "COD", detail: res },
        });
        // navigate to success page with state
        navigate("/order/success", { state: { order: activeOrder, payment: { method: "COD", detail: res } } });
        return;
      }

      if (method === "card") {
        // Mock card modal: open small prompt
        // In production you'd integrate Razorpay/Stripe here.
        const cardOk = window.confirm("Simulate card payment? Click OK to succeed, Cancel to fail.");
        if (!cardOk) throw new Error("Card payment cancelled by user");

        const res = await callPaymentEndpoint(activeOrder.id, "card");
        setSuccessPayload({
          order: activeOrder,
          payment: { method: "Card", detail: res },
        });
        navigate("/order/success", { state: { order: activeOrder, payment: { method: "Card", detail: res } } });
        return;
      }

      if (method === "upi") {
        // Mock UPI flow
        const upiOk = window.confirm("Simulate UPI payment? Click OK to succeed, Cancel to fail.");
        if (!upiOk) throw new Error("UPI payment cancelled by user");

        const res = await callPaymentEndpoint(activeOrder.id, "upi");
        setSuccessPayload({
          order: activeOrder,
          payment: { method: "UPI", detail: res },
        });
        navigate("/order/success", { state: { order: activeOrder, payment: { method: "UPI", detail: res } } });
        return;
      }

      throw new Error("Unknown payment method");
    } catch (e) {
      console.error("Payment error", e);
      setError(e?.message || "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  // Friendly display helpers
  const displayTotal = () => {
    if (order?.total_amount != null) return Number(order.total_amount).toFixed(2);
    // Try to compute from order items if present
    const defaultSum = (order?.default_items || []).reduce((s, i) => s + (i.price || 0), 0);
    const addonsSum = (order?.addons || []).reduce((s, i) => s + (i.price || 0), 0);
    const plates = order?.plates || 1;
    return Number((defaultSum + addonsSum) * plates).toFixed(2);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Payment</h1>
        <div />
      </div>

      {!order && (
        <div className="p-4 bg-yellow-50 border rounded text-sm text-yellow-800 mb-4">
          No order data provided. This screen can simulate a payment — you will create a mock order on Pay.
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-500">Order</div>
          <div className="text-sm text-gray-500">Plates: {order?.plates ?? "—"}</div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="text-sm text-gray-700">{order?.default_items?.length ?? "Default items"}</div>
            <div className="font-semibold text-indigo-600">₹{displayTotal()}</div>
          </div>

          {order?.addon_item_ids && order.addon_item_ids.length > 0 && (
            <div className="text-xs text-gray-500">Addons: {order.addon_item_ids.join(", ")}</div>
          )}

          <div className="text-xs text-gray-400">Order id: {order?.id ?? "will be created"}</div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="mb-2 text-sm font-semibold">Choose Payment Method</div>

        <div className="grid grid-cols-1 gap-3">
          <label className={`p-3 rounded border flex items-center justify-between cursor-pointer ${method === "cod" ? "bg-gray-50 border-indigo-500" : ""}`}>
            <div>
              <div className="font-medium">Cash on Delivery</div>
              <div className="text-xs text-gray-500">Pay when you receive the order</div>
            </div>
            <input type="radio" name="method" checked={method === "cod"} onChange={() => setMethod("cod")} />
          </label>

          <label className={`p-3 rounded border flex items-center justify-between cursor-pointer ${method === "card" ? "bg-gray-50 border-indigo-500" : ""}`}>
            <div>
              <div className="font-medium">Card (Mock)</div>
              <div className="text-xs text-gray-500">Simulated card payment (good for testing)</div>
            </div>
            <input type="radio" name="method" checked={method === "card"} onChange={() => setMethod("card")} />
          </label>

          <label className={`p-3 rounded border flex items-center justify-between cursor-pointer ${method === "upi" ? "bg-gray-50 border-indigo-500" : ""}`}>
            <div>
              <div className="font-medium">UPI (Mock)</div>
              <div className="text-xs text-gray-500">Simulated UPI flow</div>
            </div>
            <input type="radio" name="method" checked={method === "upi"} onChange={() => setMethod("upi")} />
          </label>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          onClick={onPay}
          disabled={processing}
          className="px-5 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {processing ? "Processing…" : `Pay ₹${displayTotal()}`}
        </button>

        <button
          onClick={() => {
            // fallback: copy order summary to clipboard for testing
            navigator.clipboard?.writeText(JSON.stringify({ order })).then(() => {
              alert("Order copied to clipboard (for debugging).");
            });
          }}
          className="px-4 py-2 rounded border"
        >
          Copy order (debug)
        </button>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        This is a mock payment screen. Replace this with a real gateway (Razorpay / Stripe) when you're ready.
      </div>
    </div>
  );
}