// src/components/SlideOverAuth.jsx
import React, { useEffect, useRef, useState } from "react";
import axiosInstance from "../shared-lib/axiosInstance";
import { FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const SlideOverAuth = ({ open, onClose, setRole, setUserProfile, onSuccess }) => {
    const panelRef = useRef(null);
    const firstInputRef = useRef(null);
    const navigate = useNavigate();

    const [step, setStep] = useState("phone"); // 'phone' | 'verify' | 'details' | 'success'
    const [formData, setFormData] = useState({
        phone: "",
        otp: "",
        name: "",
        email: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    // --------- Helpers (copied from Signup semantics) ----------

    const hasCatererIntent = () => localStorage.getItem("catererIntent") === "1";

    const notifyStorageChange = () => {
        try {
            window.dispatchEvent(new Event("storage"));
        } catch (e) {
            /* ignore */
        }
    };

    // Same as Signup.storeUserLocally
    const storeUserLocally = (user = {}) => {
        const profileData = {
            id: user.id ?? null,
            username: user.username ?? "",
            first_name: user.first_name ?? "",
            last_name: user.last_name ?? "",
            email: user.email ?? "",
            role: user.role ?? "user",
            caterer_application_pending: !!user.caterer_application_pending,
        };

        localStorage.setItem("userRole", profileData.role);
        localStorage.setItem("userProfile", JSON.stringify(profileData));

        try {
            if (typeof setRole === "function") setRole(profileData.role);
        } catch (e) {
            /* ignore */
        }
        try {
            if (typeof setUserProfile === "function") setUserProfile(profileData);
        } catch (e) {
            /* ignore */
        }

        notifyStorageChange();

        // extra broadcast for listeners (optional)
        try {
            window.dispatchEvent(
                new CustomEvent("userProfileUpdated", { detail: profileData })
            );
        } catch (e) {
            /* ignore */
        }

        return profileData;
    };

    // Helper: continue pending order (same as Signup)
    const continuePendingOrder = () => {
        try {
            const raw = localStorage.getItem("pendingOrder");
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.catererId) {
                localStorage.removeItem("pendingOrder");
                return false;
            }
            const qs = new URLSearchParams();
            qs.set("caterer", String(parsed.catererId));
            if (Array.isArray(parsed.addons) && parsed.addons.length) {
                qs.set("addons", parsed.addons.join(","));
            }
            localStorage.removeItem("pendingOrder");

            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                navigate(`/order/create?${qs.toString()}`, { replace: true });
            }, 500);

            return true;
        } catch (e) {
            localStorage.removeItem("pendingOrder");
            console.error("Failed to continue pending order:", e);
            return false;
        }
    };

    const routeAfterAuthWithIntent = () => {
        navigate("/become-a-caterer", { replace: true });
    };

    const decodeJwtPayload = (jwt) => {
        try {
            const payload = (jwt || "").split(".")[1] || "";
            const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
            const padded = base64.padEnd(
                base64.length + ((4 - (base64.length % 4)) % 4),
                "="
            );
            const json = atob(padded);
            return JSON.parse(json);
        } catch {
            return {};
        }
    };

    // ----------------- UI lifecycle -----------------

    useEffect(() => {
        if (open) {
            setStep("phone");
            setFormData({ phone: "", otp: "", name: "", email: "" });
            setError("");
            setLoading(false);
            setTimeout(() => firstInputRef.current?.focus(), 150);
        }
    }, [open]);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setInterval(() => setResendTimer((s) => s - 1), 1000);
        return () => clearInterval(t);
    }, [resendTimer]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (open) document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Phone input: keep only digits, max 10
    const handlePhoneInput = (value) => {
        let digits = String(value || "").replace(/\D/g, "");
        if (digits.length > 10) digits = digits.slice(0, 10);
        setFormData((p) => ({ ...p, phone: digits }));
        if (error) setError("");
    };

    const isValidPhone = /^[6-9]\d{9}$/.test(formData.phone);
    const isValidOtp = /^\d{3,6}$/.test(String(formData.otp || ""));

    // ----------------- Send OTP (same behaviour as Signup.handleSendOtp) -----------------
    const handleSendOtp = async () => {
        if (!formData.phone) {
            toast.error("Please enter your phone number");
            return;
        }
        if (!isValidPhone) {
            setError("Enter a valid 10-digit mobile number starting with 6/7/8/9.");
            return;
        }
        setLoading(true);
        setError("");

        try {
            await axiosInstance.post("/api/auth/send-otp/", { phone: formData.phone });
            // toast.info("OTP sent successfully");
            setStep("verify");
            setResendTimer(60);
            setTimeout(
                () =>
                    panelRef.current
                        ?.querySelector("input[name='otp']")
                        ?.focus(),
                150
            );
        } catch (err) {
            const msg = err?.response?.data?.error || "Failed to send OTP";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // ----------------- Verify OTP (copied from Signup.handleVerifyOtp) -----------------
    const handleVerifyOtp = async () => {
        setLoading(true);
        setError("");

        try {
            const res = await axiosInstance.post("/api/auth/verify-otp/", {
                phone: formData.phone,
                otp: formData.otp,
            });

            const data = res.data || {};
            const {
                is_new_user,
                message,
                phone,
                user: apiUser,
                access,
                refresh,
                role: apiRole,
                caterer: apiCaterer,
            } = data;

            // toast.success(message || "OTP verified successfully ✅");

            if (is_new_user) {
                setFormData((prev) => ({ ...prev, phone }));
                setStep("details");
                setLoading(false);
                return;
            }

            // Persist tokens + set axios header immediately
            if (access) {
                localStorage.setItem("accessToken", access);
                axiosInstance.defaults.headers = axiosInstance.defaults.headers || {};
                axiosInstance.defaults.headers.Authorization = `Bearer ${access}`;
            }
            if (refresh) localStorage.setItem("refreshToken", refresh);

            if (apiUser) localStorage.setItem("userProfile", JSON.stringify(apiUser));

            // notify listeners (Navbar) that auth happened
            notifyStorageChange();

            // If there was a pending order, continue it (this will navigate away)
            const continued = continuePendingOrder();
            if (continued) {
                setLoading(false);
                return;
            }

            // derive role/pending from token (prefer token) then fallback
            const claims = access ? decodeJwtPayload(access) : {};
            const roleFromToken = claims?.role;
            const pendingFromToken = !!claims?.caterer_application_pending;

            const role = roleFromToken || apiRole || (apiCaterer ? "caterer" : "user");
            const catererPending =
                pendingFromToken || (apiCaterer && apiCaterer.status === "pending");

            localStorage.setItem("userRole", role);
            if (apiCaterer) {
                localStorage.setItem("userCaterer", JSON.stringify(apiCaterer));
            } else {
                localStorage.removeItem("userCaterer");
            }

            const storedUser = storeUserLocally(apiUser);

            // also notify parent via onSuccess if provided
            if (typeof onSuccess === "function") {
                try {
                    onSuccess(storedUser);
                } catch (e) {
                    /* ignore */
                }
            }

            // ROUTING DECISIONS (same order as Signup, but using hasCatererIntent instead of fromBecomeCaterer)
            // 1) If API returned an approved + active caterer -> dashboard
            if (apiCaterer && apiCaterer.status === "approved" && apiCaterer.is_active) {
                onClose();
                navigate("/caterer-dashboard", { replace: true });
                return;
            }

            // 2) If role token says caterer but API didn't include caterer, probe /api/caterers/me/
            if (role === "caterer" && !apiCaterer) {
                try {
                    const me = await axiosInstance.get("/api/caterers/me/");
                    if (me?.data?.status === "approved" && me?.data?.is_active) {
                        localStorage.setItem("userCaterer", JSON.stringify(me.data));
                        onClose();
                        navigate("/caterer-dashboard", { replace: true });
                        return;
                    } else if (me?.data?.status === "pending") {
                        onClose();
                        navigate("/application-status", { replace: true });
                        return;
                    }
                } catch (err) {
                    if (err.response?.status === 404) {
                        toast.info(
                            "No caterer profile found yet — please wait a moment and try again."
                        );
                        onClose();
                        navigate("/application-status", { replace: true });
                        return;
                    }
                    console.error("Error fetching /api/caterers/me/:", err);
                }
            }

            // 3) If there's a pending application -> application status
            if (catererPending) {
                onClose();
                navigate("/application-status", { replace: true });
                return;
            }

            // 4) If user intended to become a caterer (persisted flag), route into onboarding
            const intentFlag = hasCatererIntent();
            if (intentFlag) {
                onClose();
                routeAfterAuthWithIntent(storedUser);
                return;
            }

            // 5) fallback -> public list
            onClose();
            navigate("/catererlist", { replace: true });
        } catch (err) {
            console.error("OTP verification error:", err);
            const msg = err?.response?.data?.error || "OTP verification failed";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // ----------------- Complete Signup (same as Signup.handleSignup) -----------------
    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await axiosInstance.post("/api/auth/signup/", {
                first_name: formData.name,
                email: formData.email,
                phone: formData.phone,
                is_caterer_signup: hasCatererIntent(),
            });

            const { access, refresh, user } = res.data || {};

            toast.success(`🎉 Welcome ${formData.name}, you’re signed up!`);

            if (access) {
                localStorage.setItem("accessToken", access);
                axiosInstance.defaults.headers = axiosInstance.defaults.headers || {};
                axiosInstance.defaults.headers.Authorization = `Bearer ${access}`;
            }
            if (refresh) localStorage.setItem("refreshToken", refresh);

            if (user) localStorage.setItem("userProfile", JSON.stringify(user));
            localStorage.setItem(
                "userRole",
                localStorage.getItem("userRole") || "user"
            );

            notifyStorageChange();

            const stored = storeUserLocally(user);

            if (typeof onSuccess === "function") {
                try {
                    onSuccess(stored);
                } catch (e) {
                    /* ignore */
                }
            }

            // If there was a pending order, continue it (this will navigate away)
            const continued = continuePendingOrder();
            if (continued) {
                onClose();
                return;
            }

            // If intent was set, continue onboarding
            if (hasCatererIntent()) {
                onClose();
                routeAfterAuthWithIntent(stored);
                return;
            }

            onClose();
            navigate("/catererlist", { replace: true });
        } catch (err) {
            console.error("Signup error:", err);
            const msg = err?.response?.data?.error || "Signup failed";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        try {
            await axiosInstance.post("/api/auth/send-otp/", {
                phone: formData.phone,
                resend: true,
            });
            setResendTimer(60);
            toast.info("OTP resent");
        } catch (err) {
            console.error("resendOtp error:", err);
            toast.error("Unable to resend OTP right now.");
        } finally {
            setLoading(false);
        }
    };

    // ----------------- Render (only UI differs from Signup) -----------------

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Slide-over */}
            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Sign in to FrameMyEvent"
                className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl p-6 overflow-auto"
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-2 left-3 p-1 rounded-full hover:bg-gray-100"
                >
                    <FaTimes className="text-gray-700" />
                </button>

                <div className="mb-4">
                    <h3 className="text-2xl font-semibold text-center">
                        {step === "phone" && "Enter your phone"}
                        {step === "verify" && "Verify OTP"}
                        {step === "details" && "Complete Signup"}
                        {step === "success" && "Signed in"}
                    </h3>
                    <p className="text-sm text-gray-500 text-center">
                        Sign in quickly with your phone number
                    </p>
                </div>

                {loading && step !== "details" && (
                    <p className="text-center text-gray-500">Processing...</p>
                )}

                <div className="space-y-4 mt-2">
                    {step === "phone" && (
                        <>
                            <input
                                ref={firstInputRef}
                                name="phone"
                                type="tel"
                                placeholder="Phone Number"
                                value={formData.phone}
                                onChange={(e) => handlePhoneInput(e.target.value)}
                                className={`w-full px-4 py-3 border rounded-md ${formData.phone && !isValidPhone
                                    ? "border-red-500"
                                    : "border-gray-300"
                                    }`}
                            />

                            {formData.phone && !isValidPhone && (
                                <p className="text-xs text-red-600 mt-1">
                                    Please enter a valid phone number.
                                </p>
                            )}

                            <button
                                onClick={handleSendOtp}
                                disabled={!isValidPhone || loading}
                                className={`w-full px-4 py-3 rounded-md text-white mt-3 ${isValidPhone && !loading
                                    ? "bg-[#204DCB] hover:bg-[#1b3fa8]"
                                    : "bg-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                {loading ? "Sending..." : "Send OTP"}
                            </button>
                        </>
                    )}

                    {step === "verify" && (
                        <>
                            <input
                                name="otp"
                                type="text"
                                placeholder="Enter OTP"
                                value={formData.otp}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, otp: e.target.value }))
                                }
                                className="w-full px-4 py-3 border rounded-md"
                            />

                            <button
                                onClick={handleVerifyOtp}
                                disabled={loading || !isValidOtp}
                                className={`w-full px-4 py-3 rounded-md text-white mt-3 ${isValidOtp && !loading
                                        ? "bg-[#204DCB] hover:bg-[#1b3fa8]"
                                        : "bg-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                {loading ? "Verifying..." : "Verify & Sign in"}
                            </button>

                            <button
                                type="button"
                                onClick={resendOtp}
                                disabled={resendTimer > 0 || loading}
                                className="w-full text-sm text-indigo-600 hover:underline mt-2"
                            >
                                {resendTimer > 0
                                    ? `Resend OTP in ${resendTimer}s`
                                    : "Resend OTP"}
                            </button>
                        </>
                    )}

                    {step === "details" && (
                        <form onSubmit={handleSignup} className="space-y-4">
                            <input
                                name="name"
                                type="text"
                                placeholder="Full Name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, name: e.target.value }))
                                }
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            />
                            <input
                                name="email"
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, email: e.target.value }))
                                }
                                className="w-full border rounded-md p-3 text-gray-900"
                                required
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg"
                            >
                                {loading ? "Processing..." : "Sign Up"}
                            </button>
                        </form>
                    )}

                    {step === "success" && (
                        <div className="p-4 bg-green-50 rounded text-green-800 text-center">
                            Signed in successfully.
                        </div>
                    )}

                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                    <div className="text-xs text-gray-400 mt-4 text-center">
                        By continuing you agree to FrameMyEveny&apos;s Terms &amp; Privacy Policy.
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default SlideOverAuth;