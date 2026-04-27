// src/pages/OrderEdit.jsx
import React, { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

export default function OrderEdit() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const catererId = searchParams.get("caterer");

  useEffect(() => {
    console.log("OrderEdit mounted", { orderId, catererId });
  }, [orderId, catererId]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold">Edit Order</h1>

      <div className="mt-4 text-sm text-gray-700">
        <div><strong>Order ID:</strong> {orderId}</div>
        <div><strong>Caterer ID:</strong> {catererId || "—"}</div>
      </div>
    </div>
  );
}