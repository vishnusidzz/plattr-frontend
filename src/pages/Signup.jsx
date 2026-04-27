// src/pages/Signup.jsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from '../shared-lib/axiosInstance';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Signup = ({ setRole, setUserProfile }) => {
  const [step, setStep] = useState('phone'); // 'phone' | 'verify' | 'details'
  const [formData, setFormData] = useState({
    phone: '',
    otp: '',
    name: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // came from Become-a-Caterer page?
  const fromBecomeCaterer = location.state?.fromBecomeCaterer || false;

  // persist intent so refresh or new session still knows user wanted caterer flow
  useEffect(() => {
    if (fromBecomeCaterer) {
      localStorage.setItem('catererIntent', '1');
    }
  }, [fromBecomeCaterer]);

  const hasCatererIntent = () => localStorage.getItem('catererIntent') === '1';

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const notifyStorageChange = () => {
    // dispatch storage event so both same-window and other tabs get notified
    window.dispatchEvent(new Event('storage'));
  };

  // central place to store user + role + pending flag in localStorage and call parent setters
  const storeUserLocally = (user = {}) => {
    const profileData = {
      id: user.id ?? null,
      username: user.username ?? '',
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      role: user.role ?? 'user',
      caterer_application_pending: !!user.caterer_application_pending,
    };
    localStorage.setItem('userRole', profileData.role);
    localStorage.setItem('userProfile', JSON.stringify(profileData));
    try {
      if (typeof setRole === 'function') setRole(profileData.role);
    } catch (e) {
      /* ignore */
    }
    try {
      if (typeof setUserProfile === 'function') setUserProfile(profileData);
    } catch (e) {
      /* ignore */
    }
    // notify other components
    notifyStorageChange();
    return profileData;
  };

  // Helper: if a pending order exists in localStorage, continue it now.
  // pendingOrder format expected: { catererId: <id>, addons: [id,...] } (stringified)
  const continuePendingOrder = () => {
    try {
      const raw = localStorage.getItem('pendingOrder');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.catererId) {
        localStorage.removeItem('pendingOrder');
        return false;
      }
      const qs = new URLSearchParams();
      qs.set('caterer', String(parsed.catererId));
      if (Array.isArray(parsed.addons) && parsed.addons.length) {
        qs.set('addons', parsed.addons.join(','));
      }
      // clear it so we don't loop
      localStorage.removeItem('pendingOrder');

      // small loading so Navbar can update from storage events before we navigate
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        navigate(`/order/create?${qs.toString()}`, { replace: true });
      }, 500);

      return true;
    } catch (e) {
      localStorage.removeItem('pendingOrder');
      console.error('Failed to continue pending order:', e);
      return false;
    }
  };

  // where to go after auth if intent is set
  // We want the BecomeCaterer flow if the intent flag is present.
  const routeAfterAuthWithIntent = (userProfileObj) => {
    navigate('/become-a-caterer', { replace: true });
  };

  // ----------------- Send OTP -----------------
  const handleSendOtp = async () => {
    if (!formData.phone) {
      toast.error('Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post('/api/auth/send-otp/', { phone: formData.phone });
      toast.info('OTP sent successfully');
      setStep('verify');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to send OTP');
      toast.error(err?.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ----------------- Verify OTP -----------------
  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');

    const decodeJwtPayload = (jwt) => {
      try {
        const payload = (jwt || '').split('.')[1] || '';
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
        const json = atob(padded);
        return JSON.parse(json);
      } catch {
        return {};
      }
    };

    try {
      const res = await axiosInstance.post('/api/auth/verify-otp/', {
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

      toast.success(message || 'OTP verified successfully ✅');

      if (is_new_user) {
        setFormData((prev) => ({ ...prev, phone }));
        setStep('details');
        setLoading(false);
        return;
      }

      // Persist tokens + set axios header immediately
      if (access) {
        localStorage.setItem('accessToken', access);
        axiosInstance.defaults.headers = axiosInstance.defaults.headers || {};
        axiosInstance.defaults.headers.Authorization = `Bearer ${access}`;
      }
      if (refresh) localStorage.setItem('refreshToken', refresh);

      // store profile returned by API (if any) before notifying
      if (apiUser) localStorage.setItem('userProfile', JSON.stringify(apiUser));

      // notify listeners (Navbar) that auth happened
      notifyStorageChange();

      // If there was a pending order, continue it (this will navigate away)
      const continued = continuePendingOrder();
      if (continued) {
        return;
      }

      // derive role/pending from token (prefer token) then fallback
      const claims = access ? decodeJwtPayload(access) : {};
      const roleFromToken = claims?.role;
      const pendingFromToken = !!claims?.caterer_application_pending;

      const role = roleFromToken || apiRole || (apiCaterer ? 'caterer' : 'user');
      const catererPending = pendingFromToken || (apiCaterer && apiCaterer.status === 'pending');

      localStorage.setItem('userRole', role);
      if (apiCaterer) {
        localStorage.setItem('userCaterer', JSON.stringify(apiCaterer));
      } else {
        localStorage.removeItem('userCaterer');
      }

      const storedUser = storeUserLocally(apiUser);

      // ROUTING DECISIONS (safe order)
      // 1) If API returned an approved + active caterer -> dashboard
      if (apiCaterer && apiCaterer.status === 'approved' && apiCaterer.is_active) {
        navigate('/caterer-dashboard', { replace: true });
        return;
      }

      // 2) If role token says caterer but API didn't include caterer, probe /api/caterers/me/
      if (role === 'caterer' && !apiCaterer) {
        try {
          const me = await axiosInstance.get('/api/caterers/me/');
          if (me?.data?.status === 'approved' && me?.data?.is_active) {
            localStorage.setItem('userCaterer', JSON.stringify(me.data));
            navigate('/caterer-dashboard', { replace: true });
            return;
          } else if (me?.data?.status === 'pending') {
            navigate('/application-status', { replace: true });
            return;
          }
        } catch (err) {
          if (err.response?.status === 404) {
            toast.info('No caterer profile found yet — please wait a moment and try again.');
            navigate('/application-status', { replace: true });
            return;
          }
          console.error('Error fetching /api/caterers/me/:', err);
        }
      }

      // 3) If there's a pending application -> application status
      if (catererPending) {
        navigate('/application-status', { replace: true });
        return;
      }

      // 4) If user intended to become a caterer (either via nav state or persisted flag), route into onboarding
      const intentFlag = fromBecomeCaterer || localStorage.getItem('catererIntent') === '1';
      if (intentFlag) {
        routeAfterAuthWithIntent(storedUser);
        return;
      }

      // 5) fallback -> public list
      navigate('/catererlist', { replace: true });
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err?.response?.data?.error || 'OTP verification failed');
      toast.error(err?.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ----------------- Complete Signup -----------------
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axiosInstance.post('/api/auth/signup/', {
        first_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        // tell backend this signup started from caterer flow if intent is set
        is_caterer_signup: hasCatererIntent(),
      });

      const { access, refresh, user } = res.data;

      toast.success(`🎉 Welcome ${formData.name}, you’re signed up!`);

      // persist tokens + set axios header BEFORE routing
      if (access) {
        localStorage.setItem('accessToken', access);
        axiosInstance.defaults.headers = axiosInstance.defaults.headers || {};
        axiosInstance.defaults.headers.Authorization = `Bearer ${access}`;
      }
      if (refresh) localStorage.setItem('refreshToken', refresh);

      // store profile & role
      if (user) localStorage.setItem('userProfile', JSON.stringify(user));
      localStorage.setItem('userRole', localStorage.getItem('userRole') || 'user');

      // notify other components (Navbar) that storage changed
      notifyStorageChange();

      // store user in app state
      const stored = storeUserLocally(user);

      // If there was a pending order, continue it (this will navigate away)
      const continued = continuePendingOrder();
      if (continued) return;

      // If intent was set (either via navigation state or localStorage), continue onboarding
      const intentFlag = fromBecomeCaterer || localStorage.getItem('catererIntent') === '1';
      if (intentFlag) {
        routeAfterAuthWithIntent(stored);
        return;
      }

      // default fallback
      navigate('/catererlist', { replace: true });
    } catch (err) {
      console.error('Signup error:', err);
      setError(err?.response?.data?.error || 'Signup failed');
      toast.error(err?.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h2 className="text-3xl font-bold text-center text-red-500">
          {step === 'phone' && 'Enter your phone'}
          {step === 'verify' && 'Verify OTP'}
          {step === 'details' && 'Complete Signup'}
        </h2>

        {loading && <p className="text-center text-gray-500">Processing...</p>}

        {step === 'phone' && (
          <>
            <input
              name="phone"
              type="tel"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={(e) => {
                let value = e.target.value.replace(/\D/g, ''); // keep only digits
                if (value.length > 10) value = value.slice(0, 10); // max 10 digits
                setFormData({ ...formData, phone: value });
              }}
              className={`w-full px-4 py-2 border rounded-lg ${formData.phone &&
                (!/^[6-9]\d{9}$/.test(formData.phone) ? 'border-red-500' : 'border-gray-300')
                }`}
            />
            {/* Validation message */}
            {formData.phone && !/^[6-9]\d{9}$/.test(formData.phone) && (
              <p className="text-xs text-red-600 mt-1">Please enter a valid phone number.</p>
            )}

            <button
              onClick={handleSendOtp}
              disabled={!/^[6-9]\d{9}$/.test(formData.phone)} // disable until valid
              className={`w-full py-2 px-4 rounded-lg text-white ${/^[6-9]\d{9}$/.test(formData.phone)
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gray-400 cursor-not-allowed'
                }`}
            >
              Send OTP
            </button>
          </>
        )}

        {step === 'verify' && (
          <>
            <input
              name="otp"
              type="text"
              placeholder="Enter OTP"
              value={formData.otp}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg"
            />
            <button
              onClick={handleVerifyOtp}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg"
            >
              Verify OTP
            </button>
          </>
        )}

        {step === 'details' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <input
              name="name"
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg"
            >
              Sign Up
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );
};

export default Signup;