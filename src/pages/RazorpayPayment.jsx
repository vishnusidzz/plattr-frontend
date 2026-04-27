// src/pages/RazorpayPayment.jsx
import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../shared-lib/axiosInstance";

export default function RazorpayPayment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const q = new URLSearchParams(location.search);
  const mode = q.get("mode") || "full"; // min | advance | full
  const orderSource = "web";

  const [processing, setProcessing] = useState(false); //  FIX

  const goBackToPaymentPage = () => {
    navigate(`/payment?orderId=${orderId}`, {
      replace: true,
      state: { refresh: true },
    });
  };

  useEffect(() => {
    if (!orderId) return;

    const openRazorpay = async () => {
      try {
        // 1 Create Razorpay order (backend)
        const res = await axiosInstance.post(
          "/api/payments/razorpay/create-order/",
          {
            order_id: orderId,
            payment_mode: mode,
            order_source: orderSource,
          }
        );

        const {
          razorpay_key_id,
          razorpay_order_id,
          amount,
          currency,
        } = res.data;

        // 2 Load Razorpay SDK if needed
        if (!window.Razorpay) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          document.body.appendChild(script);
          await new Promise((resolve) => (script.onload = resolve));
        }

        // 3Razorpay options
        const options = {
          key: razorpay_key_id,
          amount,
          currency,
          name: "Frame My Event",
          description: `Order #${orderId}`,
          order_id: razorpay_order_id,

          // PAYMENT SUCCESS → VERIFY → THEN NAVIGATE
          handler: async (response) => {
            try {
              setProcessing(true);

              await axiosInstance.post(
                "/api/payments/razorpay/verify/",
                {
                  order_id: orderId,
                  razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }
              );

              // Backend verified → go to success
              navigate(`/order/success/${orderId}`, {replace: true,});
            } catch (err) {
              console.error("Payment verification failed:", err);

              alert(
                err?.response?.data?.error ||
                  "Payment verification failed. If amount was deducted, it will be reconciled automatically."
              );

              navigate(`/order/${orderId}`);
            } finally {
              setProcessing(false);
            }
          },

          //  USER CLOSED MODAL
          modal: {
            ondismiss: goBackToPaymentPage,
          },

          theme: { color: "#0033A9" },
        };

        const rzp = new window.Razorpay(options);

        //  PAYMENT FAILED EVENT
        rzp.on("payment.failed", () => {
          goBackToPaymentPage();
        });

        rzp.open();
      } catch (err) {
        console.error(err);
        alert(err?.response?.data?.error || "Unable to start payment");
        goBackToPaymentPage();
      }
    };

    openRazorpay();
  }, [orderId, mode, navigate, location.key]); //  exhaustive-deps FIX

  return (
    <div className="p-6 text-center">
      <h2 className="text-lg font-semibold">
        {processing ? "Verifying payment…" : "Redirecting to payment…"}
      </h2>
      <p className="text-sm text-gray-500 mt-2">
        Please wait, do not refresh or close this page.
      </p>
    </div>
  );
}