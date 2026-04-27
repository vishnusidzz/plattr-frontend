// src/components/Navbar.jsx
import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaUserCircle, FaBars, FaTimes } from "react-icons/fa";
import axiosInstance from "../shared-lib/axiosInstance";
import { toast } from "react-toastify";
import SlideOverAuth from "./SlideOverAuth"; // your slide-over auth
import { getAccessToken, clearToken } from "../shared-lib/tokenManager";// adjust path

const CommissionButton = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/admin/commissions")}
      className="px-3 py-1 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black text-sm"
      title="Open global delivery settings"
    >
      Configure Commission
    </button>
  );
};
CommissionButton.propTypes = { target: PropTypes.string };

const DeliveryButton = ({ target = "/admin/platform-settings" }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(target)}
      className="px-3 py-1 rounded-lg bg-blue-400 hover:bg-blue-500 text-black text-sm"
      title="Open platform delivery settings"
    >
      Delivery Settings
    </button>
  );
};
DeliveryButton.propTypes = { target: PropTypes.string };

const CouponButton = ({ target = "/admin/coupons" }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(target)}
      className="px-3 py-1 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm shadow-sm"
      title="Manage discount coupons"
    >
      Coupons
    </button>
  );
};
CouponButton.propTypes = { target: PropTypes.string };

export default function Navbar({ userRole, setRole, setUserProfile }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [userProfile, setUserProfileState] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingLocationCount, setPendingLocationCount] = useState(0);
  const [showAuthSlide, setShowAuthSlide] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false); // mobile menu
  const isAuthenticated = Boolean(getAccessToken());

  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  // 🔑 ROLE DERIVATION
  let storedRole = null;
  try {
    storedRole = localStorage.getItem("userRole");
  } catch (e) {
    storedRole = null;
  }

  // Prefer prop (if not guest), otherwise stored, otherwise guest
  const effectiveRole =
    userRole && userRole !== "guest" ? userRole : storedRole || "guest";

  const isLoggedIn = effectiveRole !== "guest";
  const isAdmin = effectiveRole === "admin";

  // Caterer if role says so OR profile has caterers
  const isCaterer =
    effectiveRole === "caterer" ||
    (userProfile &&
      Array.isArray(userProfile.caterers) &&
      userProfile.caterers.length > 0);

  // guest-mode top bar (FME Corporate / Partner / Get App / Sign in)
  const showLandingTopBar = !isLoggedIn;

  const applyProfile = (profile) => {
    setUserProfileState(profile);
    if (typeof setUserProfile === "function") setUserProfile(profile);
  };

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("userProfile") || "null");
      if (stored) applyProfile(stored);
    } catch (e) { }
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isLoggedIn) return;
      try {
        const res = await axiosInstance.get("/api/profile/");
        const data = res.data || {};
        applyProfile(data);
        localStorage.setItem("userProfile", JSON.stringify(data));
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    };

    fetchProfile();
  }, [isLoggedIn]);

  useEffect(() => {
    const onUpdated = (e) => {
      const data = e?.detail || null;
      if (data) applyProfile(data);
      else {
        try {
          const stored = JSON.parse(
            localStorage.getItem("userProfile") || "null"
          );
          if (stored) applyProfile(stored);
        } catch (err) { }
      }
    };
    window.addEventListener("userProfileUpdated", onUpdated);
    return () => window.removeEventListener("userProfileUpdated", onUpdated);
  }, []);

  // admin pending caterers
  useEffect(() => {
    if (!isAuthenticated || isAdmin !== true) return; 
    const fetchPendingCount = async () => {
      try {
        const res = await axiosInstance.get(
          "/api/admin/caterers/?status=pending"
        );
        setPendingCount(Array.isArray(res.data) ? res.data.length : 0);
      } catch (err) {
        console.error("Failed to fetch pending caterers:", err);
      }
    };
    fetchPendingCount();
    const handleUpdate = () => fetchPendingCount();
    window.addEventListener("catererApprovalUpdate", handleUpdate);
    const interval = setInterval(fetchPendingCount, 60000);
    return () => {
      window.removeEventListener("catererApprovalUpdate", handleUpdate);
      clearInterval(interval);
    };
  }, [isAuthenticated, isAdmin]);

  // admin pending location updates
  useEffect(() => {
    if (!isAuthenticated || isAdmin !== true) return; 
    const fetchPendingLocationCount = async () => {
      try {
        const res = await axiosInstance.get(
          "/api/admin/caterers/?has_pending_location=1"
        );
        setPendingLocationCount(Array.isArray(res.data) ? res.data.length : 0);
      } catch (err) {
        console.error("Failed to fetch pending locations:", err);
      }
    };
    fetchPendingLocationCount();
    const handleUpdate = () => fetchPendingLocationCount();
    window.addEventListener("catererApprovalUpdate", handleUpdate);
    const interval = setInterval(fetchPendingLocationCount, 60000);
    return () => {
      window.removeEventListener("catererApprovalUpdate", handleUpdate);
      clearInterval(interval);
    };
  }, [isAuthenticated, isAdmin]);

  const handleProfileClick = () => {
    setShowDropdown(false);
    navigate("/profile");
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        await axiosInstance.post(
          "/api/auth/logout/",
          { refresh: refreshToken },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          }
        );
      }
    } catch (err) {
      console.error("Logout API error:", err);
    } finally {
      setRole && setRole("guest");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userProfile");
      clearToken();
      toast.info("Logged out");
      navigate("/");
    }
  };

  // close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change (listen to navigation)
  useEffect(() => {
    return navigate.listen ? navigate.listen(() => setMobileOpen(false)) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🌈 NAV COLOR LOGIC
  const isHome = location.pathname === "/";
  const isCatererSection = location.pathname.startsWith("/caterer");

  // - On "/" (home): ALWAYS blue (#204DCB), regardless of login state
  // - On any "/caterer..." route: gradient green
  // - On other routes: guest = blue, logged-in = gradient
  const navStyle = isHome
    ? {
      backgroundColor: "#204DCB",
      WebkitTextSizeAdjust: "100%",
    }
    : isCatererSection
      ? {
        background:
          "linear-gradient(to top right,#c4e721,#63ac20,#095104,#143409)",
        WebkitTextSizeAdjust: "100%",
      }
      : !isLoggedIn
        ? {
          backgroundColor: "#204DCB",
          WebkitTextSizeAdjust: "100%",
        }
        : {
          background:
            "linear-gradient(to top right,#c4e721,#63ac20,#095104,#143409)",
          WebkitTextSizeAdjust: "100%",
        };

  return (
    <>
      <nav
        className="relative shadow-lg px-4 sm:px-6 py-3 flex items-center justify-between"
        style={navStyle}
        aria-label="Main navigation"
      >
        {/* Left: Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => {
            navigate("/");
            setMobileOpen(false);
          }}
          role="link"
          aria-label="Go to homepage"
          >
          <img
            src="/FME_title_logo.png"
            alt="Frame My Event Logo"
            className="h-12 md:h-14 lg:h-16 w-auto object-contain"
            loading="lazy"
          />
        </div>

        {/* Desktop actions (md+) */}
        {showLandingTopBar ? (
          /* Guest navbar – on all pages when not logged in */
          <div className="hidden md:flex items-center gap-6 text-white">
            <button
              type="button"
              onClick={() => navigate("/corporate")}
              className="text-sm hover:underline"
            >
              FME Corporate
            </button>

            <button
              type="button"
              onClick={() => navigate("/become-a-caterer-plan")}
              className="text-sm hover:underline"
            >
              Partner with us
            </button>

            <button
              type="button"
              onClick={() => navigate("/get-the-app")}
              className="px-4 py-2 rounded-full bg-white text-[#204DCB] text-sm font-semibold hover:bg-gray-100"
            >
              Get the App
            </button>

            <button
              type="button"
              onClick={() => setShowAuthSlide(true)}
              className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold hover:bg-gray-900"
            >
              Sign in
            </button>
          </div>
        ) : (
          /* Logged-in navbar (admin / caterer / user) */
          <div className="hidden md:flex items-center gap-3 md:gap-4">
            {isAdmin && (
              <Link
                to="/admin"
                className="px-4 py-2 bg-white/90 text-gray-700 rounded-lg hover:text-indigo-600 hover:bg-white transition-colors duration-200"
              >
                Admin
              </Link>
            )}

            {isCaterer && (
              <>
                <Link
                  to="/caterer-dashboard"
                  className="px-3 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm"
                >
                  Dashboard
                </Link>
              </>
            )}

            {/* Profile / auth (desktop) */}
            {isLoggedIn && (
              <div className="relative" ref={dropdownRef}>
                <FaUserCircle
                  className="text-3xl text-white cursor-pointer hover:text-gray-100"
                  onClick={() => setShowDropdown(!showDropdown)}
                />
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-72 bg-white shadow-xl rounded-xl p-5 z-50">
                    <p className="font-semibold text-gray-800 text-lg">
                      👤 {userProfile?.first_name || "N/A"}{" "}
                      {userProfile?.last_name || ""}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      📞 {userProfile?.username || "N/A"}
                    </p>
                    <p className="text-sm text-gray-600 break-words">
                      📧{" "}
                      <span className="break-all">
                        {userProfile?.email || "N/A"}
                      </span>
                    </p>
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={handleProfileClick}
                        className="w-full text-sm bg-indigo-500 text-white px-3 py-2 rounded-lg hover:bg-indigo-600"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-sm bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile: hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((s) => !s)}
            className="p-2 rounded-md bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            {mobileOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      <div
        className={`md:hidden transition-all duration-200 ease-out overflow-hidden bg-white/90 shadow-lg ${mobileOpen ? "max-h-[100vh] py-4" : "max-h-0"
          }`}
      >
        <div className="px-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className="col-span-2 px-3 py-2 rounded-lg bg-white text-gray-800 shadow-sm text-sm"
              >
                Admin
              </Link>
            )}

            {isCaterer && (
              <>
                <Link
                  to="/caterer-dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="col-span-2 px-3 py-2 rounded-lg bg-white text-gray-800 shadow-sm text-sm"
                >
                  Dashboard
                </Link>
              </>
            )}

            {!isLoggedIn && (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/become-a-caterer-plan");
                }}
                className="col-span-2 px-3 py-2 rounded-lg bg-[#228B22] text-white text-sm"
              >
                Become a Partner
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-gray-200">
            {isLoggedIn ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-700">
                  Signed in as{" "}
                  <strong>
                    {userProfile?.first_name ||
                      userProfile?.username ||
                      "You"}
                  </strong>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleProfileClick();
                      setMobileOpen(false);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileOpen(false);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-sm"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-gray-700">Not signed in</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAuthSlide(true);
                      setMobileOpen(false);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      navigate("/");
                      setMobileOpen(false);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm"
                  >
                    Home
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SlideOverAuth */}
      <SlideOverAuth
        open={showAuthSlide}
        onClose={() => setShowAuthSlide(false)}
        onSuccess={(profile) => {
          if (profile) {
            localStorage.setItem("userProfile", JSON.stringify(profile));
            setUserProfile && setUserProfile(profile);

            let nextRole =
              profile.role ||
              localStorage.getItem("userRole") ||
              "user";

            // Only auto-upgrade to caterer if NOT admin
            if (
              nextRole !== "admin" &&
              (!nextRole || nextRole === "user") &&
              Array.isArray(profile.caterers) &&
              profile.caterers.length > 0
            ) {
              nextRole = "caterer";
            }

            localStorage.setItem("userRole", nextRole);
            setRole && setRole(nextRole);
          }

          setShowAuthSlide(false);
        }}
      />
    </>
  );
}

Navbar.propTypes = {
  userRole: PropTypes.string,
  setRole: PropTypes.func,
  setUserProfile: PropTypes.func,
};