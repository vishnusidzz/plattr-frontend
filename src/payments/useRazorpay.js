import { createRazorpayOrder } from "./createRazorpayOrder";

export function useRazorpayCheckout() {
  const openCheckout = async ({ orderId, onSuccess, onFailure }) => {
    try {
      const rz = await createRazorpayOrder(orderId);

      const options = {
        key: rz.razorpay_key_id,
        amount: rz.amount,
        currency: rz.currency,
        order_id: rz.razorpay_order_id,
        name: "FrameMyEvent",
        description: `Order #${orderId}`,
        handler: async (response) => {
          // 🔐 send to backend verify API
          onSuccess(response);
        },
        modal: {
          ondismiss: () => {
            onFailure?.("Payment cancelled");
          },
        },
        theme: { color: "#059669" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Razorpay init failed", err);
      onFailure?.("Unable to start payment");
    }
  };

  return { openCheckout };
}