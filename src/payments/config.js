export const PAYMENT_ENABLED = true

export const PAYMENT_PROVIDER =
  import.meta.env.VITE_PAYMENT_PROVIDER || "razorpay";
// razorpay | cashfree