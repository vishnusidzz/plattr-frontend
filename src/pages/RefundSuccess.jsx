import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import generateInvoicePdf from "../utils/invoice";

/**
 * RefundSuccess Page
 *
 * Expected navigation state OR API response:
 * {
 *   order: {...},          // full order object
 *   refund: {
 *     id,
 *     amount,
 *     reason,
 *     status,
 *     updated_at
 *   }
 * }
 */

export default function RefundSuccess() {
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState(null);
  const [refund, setRefund] = useState(null);

  // -----------------------------
  // Load data (state or fallback)
  // -----------------------------
  useEffect(() => {
    if (location.state?.order && location.state?.refund) {
      setOrder(location.state.order);
      setRefund(location.state.refund);
    } else {
      // 🔒 Safety fallback — redirect user
      navigate("/", { replace: true });
    }
  }, [location.state, navigate]);

  if (!order || !refund) {
    return null;
  }

  // -----------------------------
  // Build refund-shaped order
  // -----------------------------
  const refundOrder = {
    ...order,

    // Invoice identity
    invoice_id: `RFD-FME-${order.id}-${refund.id}`,

    // Override payment values
    paid_amount: refund.amount,
    remaining_due: 0,

    payment_status: "refunded",
    payment_mode: "refund",
    status: "refunded",

    refund: {
      id: refund.id,
      amount: refund.amount,
      reason: refund.reason,
      processed_at: refund.updated_at,
    },
  };

  // -----------------------------
  // Download Refund Invoice
  // -----------------------------
  const handleDownloadInvoice = () => {
    generateInvoicePdf(refundOrder, {
      filenamePrefix: "refund-invoice",
      preservedMode: "refund",
      company: {
        name: "FrameMyEvent",
        address: "Refund Invoice",
        phone: "contact@framemyevent.com",
      },
    });
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white shadow-md rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-3">
          Refund Successful
        </h1>

        <p className="text-gray-700 mb-4">
          Your refund has been processed successfully.
        </p>

        <div className="text-left text-sm bg-gray-100 rounded p-4 mb-4">
          <p>
            <strong>Order ID:</strong> #{order.id}
          </p>
          <p>
            <strong>Refund ID:</strong> {refund.id}
          </p>
          <p>
            <strong>Amount:</strong> ₹{Number(refund.amount).toFixed(2)}
          </p>
          {refund.reason && (
            <p>
              <strong>Reason:</strong> {refund.reason}
            </p>
          )}
        </div>

        <button
          onClick={handleDownloadInvoice}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition mb-3"
        >
          Download Refund Invoice
        </button>

        <button
          onClick={() => navigate(`/order/${order.id}`)}
          className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 transition"
        >
          Back to Order
        </button>
      </div>
    </div>
  );
}