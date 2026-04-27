import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../shared-lib/axiosInstance';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const OtpVerify = () => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [resendEnabled, setResendEnabled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const phone = location.state?.phone || localStorage.getItem('phone');
  const intervalRef = useRef(null);
  

  // Countdown timer
  useEffect(() => {
    if (timer > 0) {
      intervalRef.current = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else {
      setResendEnabled(true);
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [timer]);

  // ----------------- OTP verification -----------------
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axiosInstance.post('/api/auth/verify-otp/', { phone, otp });
      const { access, refresh, user, is_new_user } = res.data;

      // Store tokens for both cases
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);

      if (is_new_user) {
        // Only store phone for new user signup
        localStorage.setItem('phone', res.data.phone);
        toast.info('OTP verified! Please complete signup.');
        navigate('/signup-details', { state: { phone: res.data.phone } });
      } else {
        // Existing user → store full info
        if (user) {
          localStorage.setItem('userRole', user.role || 'user');
          localStorage.setItem('firstName', user.first_name || '');
          localStorage.setItem('lastName', user.last_name || '');
          localStorage.setItem('username', user.username || '');
          localStorage.setItem('phone', user.phone || '');
          localStorage.setItem('email', user.email || '');
        }
        toast.success(`Welcome back, ${user?.first_name || ''}!`);
        navigate('/catererlist');
      }

      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'OTP verification failed');
    }
  };

  // ----------------- Resend OTP -----------------
  const handleResend = async () => {
    try {
      await axiosInstance.post('/api/auth/send-otp/', { phone });
      toast.info('OTP resent successfully!');
      setTimer(60);
      setResendEnabled(false);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to resend OTP');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleVerify} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-center text-red-500">
          Verify OTP for {phone}
        </h2>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter 6-digit OTP"
          required
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
        />

        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-semibold"
        >
          Verify OTP
        </button>

        <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
          {resendEnabled ? (
            <button
              type="button"
              onClick={handleResend}
              className="text-blue-500 hover:underline font-medium"
            >
              Resend OTP
            </button>
          ) : (
            <span>Resend available in {timer}s</span>
          )}
        </div>
      </form>
    </div>
  );
};

export default OtpVerify;