import axios from "../shared-lib/axiosInstance";

export async function createRazorpayOrder(orderId) {
  const res = await axios.post(
    "/api/payments/razorpay/create-order/",
    { order_id: orderId }
  );

  return res.data; // { razorpay_key_id, razorpay_order_id, amount, currency }
}