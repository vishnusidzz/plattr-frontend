import React, { useState } from 'react';
import axiosInstance from '../shared-lib/axiosInstance';
import { toast } from 'react-toastify';

const AuthModal = ({ isOpen, onClose, setRole, setUserProfile }) => {
    const [step, setStep] = useState('phone'); // phone | verify | details
    const [formData, setFormData] = useState({ phone: '', otp: '', name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // ----------------- Send OTP -----------------
    const handleSendOtp = async () => {
        setLoading(true);
        try {
            await axiosInstance.post('/api/auth/send-otp/', { phone: formData.phone });
            toast.info('OTP sent successfully.');
            setStep('verify');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    // ----------------- Verify OTP -----------------
    // Replace your current handleVerifyOtp with this
const handleVerifyOtp = async () => {
  setLoading(true);
  setError('');

  // tiny helper: safe base64url JWT payload decode
  const decodeJwtPayload = (jwt) => {
    try {
      const payload = jwt.split('.')[1] || '';
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '='));
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

    const { is_new_user, message, phone, user, access, refresh, caterer } = res.data;
    toast.success(message || 'OTP verified successfully ✅');

    if (is_new_user) {
      // New user → collect details next
      setFormData((prev) => ({ ...prev, phone }));
      setStep('details');
      return;
    }

    // Store tokens + profile
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    if (user) localStorage.setItem('userProfile', JSON.stringify(user));

    // Parse claims from access token (fallback)
    const claims = decodeJwtPayload(access);
    const role = claims?.role || 'user';
    const catererPending = !!claims?.caterer_application_pending;
    localStorage.setItem('userRole', role);

    // store user locally if helper exists
    const storedUser = typeof storeUserLocally === 'function' ? storeUserLocally(user) : user;

    // ---------- Caterer first-login logic ----------
    // If backend returned 'caterer' object (expected), use that. Otherwise rely on token claims.
    // caterer should be { id, status, is_active } when present.
    const catererObj = caterer || null;
    if (role === 'caterer' || (catererObj && catererObj.status === 'approved')) {
      const cid = catererObj?.id || claims?.caterer_id || null;
      const status = (catererObj && catererObj.status) || (claims?.caterer_status) || 'approved';

      if (cid) {
        const seenKey = `caterer_seen_${cid}`;
        const hasSeen = !!localStorage.getItem(seenKey);

        if (!hasSeen) {
          // First time login for this approved caterer: mark seen and send to application-status
          // (user can still click "Go to Dashboard" on that page)
          localStorage.setItem(seenKey, '1');
          localStorage.setItem('accessToken', access);
          navigate('/application-status', { replace: true });
          return;
        } else {
          // Already saw the application-status previously -> go to dashboard
          navigate('/caterer-dashboard', { replace: true });
          return;
        }
      }

      // If we don't have a caterer id but role/claims indicate caterer: fallback to caterer-dashboard
      if (!cid) {
        // If pending flag is set, prefer application-status
        if (catererPending) {
          navigate('/application-status', { replace: true });
          return;
        }
        navigate('/caterer-dashboard', { replace: true });
        return;
      }
    }

    // ---------- Non-caterer flows ----------
    if (catererPending) {
      // normal user who has applied and is pending
      navigate('/application-status', { replace: true });
      return;
    }

    // If they clicked "Become a Partner" earlier -> caterer flow
    const intentFlag =
      (typeof hasCatererIntent === 'function' && hasCatererIntent()) ||
      localStorage.getItem('catererIntent') === '1';

    if (intentFlag) {
      if (typeof routeAfterAuthWithIntent === 'function') {
        routeAfterAuthWithIntent(storedUser);
      } else {
        navigate('/become-a-caterer', { replace: true });
      }
      return;
    }

    // Default
    navigate('/catererlist', { replace: true });
  } catch (err) {
    console.error('OTP verification error:', err);
    setError(err.response?.data?.error || 'OTP verification failed');
  } finally {
    setLoading(false);
  }
};

    // ----------------- Complete Signup -----------------
    const handleSignup = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  // clear any old tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');

  try {
    const res = await axiosInstance.post('/api/auth/signup/', {
      first_name: formData.name,
      email: formData.email,
      phone: formData.phone,
    });

    const { access, refresh, user } = res.data;

    // save new tokens
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);

    const role = user.role || 'user';
    localStorage.setItem('userRole', role);
    setRole(role);

    const profile = {
      name: user.first_name || formData.name,
      phone: user.phone || formData.phone,
      email: user.email || formData.email,
    };
    localStorage.setItem('userProfile', JSON.stringify(profile));
    setUserProfile(profile);

    toast.success(`Welcome ${profile.name}`);
    // after signup → go to catererlist
    navigate('/catererlist', { replace: true });
  } catch (err) {
    console.error('Signup error:', err);
    setError(err.response?.data?.error || 'Signup failed');
  } finally {
    setLoading(false);
  }
};

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md space-y-6 relative">
                <button className="absolute top-3 right-3 text-gray-600" onClick={onClose}>✖</button>
                <h2 className="text-2xl font-bold text-center">
                    {step === 'phone' && 'Enter Phone'}
                    {step === 'verify' && 'Verify OTP'}
                    {step === 'details' && 'Complete Signup'}
                </h2>

                {loading && <p className="text-center text-gray-500">Processing...</p>}

                {step === 'phone' && (
                    <>
                        <input name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" />
                        <button onClick={handleSendOtp} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg mt-2">Send OTP</button>
                    </>
                )}

                {step === 'verify' && (
                    <>
                        <input name="otp" type="text" placeholder="Enter OTP" value={formData.otp} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" />
                        <button onClick={handleVerifyOtp} className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg mt-2">Verify OTP</button>
                    </>
                )}

                {step === 'details' && (
                    <form onSubmit={handleSignup} className="space-y-4">
                        <input name="name" type="text" placeholder="Full Name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" />
                        <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" />
                        <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" />
                        <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg">Sign Up</button>
                    </form>
                )}

                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            </div>
        </div>
    );
};

export default AuthModal;