// pages/BecomeCaterer.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../shared-lib/axiosInstance';
import MapPicker from "../components/MapPicker"; // adjust path if you placed it somewhere else

const cuisineOptions = [
  'South Indian',
  'North Indian',
  'Andhra Style',
  'Religious / Cultural',
  'Chinese',
  'Continental',
];

// This select maps to Caterer.cuisine_type enum in backend
const serviceTypes = ['Veg', 'Non-Veg', 'Both'];


const BecomeCaterer = () => {
  const navigate = useNavigate();

  // Guard: if not logged in, send to signup with intent
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      localStorage.setItem('catererIntent', '1');
      navigate('/signup', { state: { fromBecomeCaterer: true }, replace: true });
    }
  }, [navigate]);
  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role === 'caterer') {
      // they already have an application or an approved caterer
      navigate('/application-status', { replace: true });
    }
  }, [navigate]);

  // Load profile from localStorage (fast), then optionally refresh from API
  const storedProfile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('userProfile') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [loading, setLoading] = useState(false);

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReusePhoneModal, setShowReusePhoneModal] = useState(false);
  const [reuseDecisionMade, setReuseDecisionMade] = useState(false);

  const [showMapPicker, setShowMapPicker] = useState(false);

  const handleMapPick = ({ lat, lng, address }) => {
    setForm((prev) => ({
      ...prev,
      latitude: lat != null ? Number(lat) : prev.latitude,
      longitude: lng != null ? Number(lng) : prev.longitude,
      // optionally fill address & city if you like:
      address: prev.address || address || prev.address,
    }));
    setShowMapPicker(false);
  };

  // Prefill
  const [form, setForm] = useState({
    businessName: '',
    ownerName: storedProfile.first_name
      ? `${storedProfile.first_name}${storedProfile.last_name ? ' ' + storedProfile.last_name : ''}`
      : '',
    email: storedProfile.email || '',
    phone: storedProfile.username || '', // username is phone in your backend
    city: '',
    address: '',
    pincode: '',
    serviceType: 'Both', // maps to backend cuisine_type
    cuisines: [],
    aadhaar: '',
    pan: '',
    fssaiRegistered: false,
    fssaiNumber: '',
    description: '',
    latitude: null,
    longitude: null,
  });


  // Optional: refresh server profile to ensure phone/email are fresh
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get('/api/profile/');
        if (!mounted || !res?.data) return;
        const u = res.data;

        setForm((prev) => ({
          ...prev,
          ownerName: u.first_name
            ? `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`
            : prev.ownerName,
          email: u.email || prev.email,
          phone: u.username || prev.phone,
        }));

        // If the user clicked "Become a Partner" and is a normal user,
        // ask whether to reuse the same phone for business.
        const intent = localStorage.getItem('catererIntent') === '1';
        if (intent && u?.role === 'user' && !reuseDecisionMade) {
          setShowReusePhoneModal(true);
        }

        // If already a caterer, you could redirect to a dashboard here
        if (u?.role === 'caterer') navigate('/caterer-dashboard');
      } catch {
        // ignore – we still have localStorage values
      }
    })();
    return () => {
      mounted = false;
    };
  }, [reuseDecisionMade, navigate]);
  // toggle cuisine in form.cuisines
  const handleCuisineToggle = (c) => {
    setForm((prev) => ({
      ...prev,
      cuisines: prev.cuisines.includes(c)
        ? prev.cuisines.filter((x) => x !== c)
        : [...prev.cuisines, c],
    }));
  };

  const isValidEmail = (v) => /^\S+@\S+\.\S+$/.test(v);
  const isValidAadhaar = (v) => /^\d{12}$/.test(v);
  const isValidPAN = (v) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
  const isValidPincode = (v) => /^\d{6}$/.test(v);

  const validateForm = () => {
    return (
      form.businessName.trim() &&
      form.ownerName.trim() &&
      isValidEmail(form.email) &&
      (form.phone || '').trim() &&
      form.city.trim() &&
      form.address.trim() &&
      isValidPincode(form.pincode) &&
      form.serviceType && // Veg | Non-Veg | Both
      isValidAadhaar(form.aadhaar) &&
      isValidPAN(form.pan) &&
      (!form.fssaiRegistered || (form.fssaiRegistered && form.fssaiNumber.trim()))
    );
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) {
      alert('Please fill all required fields correctly.');
      return;
    }

    // Build a rich description so we don't lose unsupported fields
    const extraDetails = [
      `Owner: ${form.ownerName}`,
      `Pincode: ${form.pincode}`,
      `Aadhaar: ${form.aadhaar}`,
      `PAN: ${form.pan}`,
      `FSSAI: ${form.fssaiRegistered ? form.fssaiNumber || 'Registered' : 'Not Registered'}`,
      `Cuisines: ${form.cuisines.length ? form.cuisines.join(', ') : 'N/A'}`,
      form.description ? `Notes: ${form.description}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const fd = new FormData();
    fd.append('name', form.businessName);
    fd.append('email', form.email);
    fd.append('contact_number', form.phone);
    fd.append('city', form.city);
    fd.append('address', form.address);
    fd.append('description', extraDetails);
    fd.append('cuisine_type', form.serviceType); // must be Veg | Non-Veg | Both

    // Multiple images – backend reads request.FILES.getlist('images')
    if (form.latitude) fd.append('latitude', String(form.latitude));
    if (form.longitude) fd.append('longitude', String(form.longitude));

    try {
      setLoading(true);
      await axios.post('/api/caterers/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Clear intent now that application is created
      localStorage.removeItem('catererIntent');

      alert('Application submitted! Our team will review it shortly. You’ll be notified after approval.');
      // Route to list or a pending screen
      navigate('/application-status', { replace: true });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = () => {
    localStorage.removeItem('catererIntent');
    setShowCancelModal(false);
    navigate('/catererlist', { replace: true });
  };

  const handleReuseSamePhone = () => {
    setReuseDecisionMade(true);
    setShowReusePhoneModal(false);
    // Continue with prefilled form
  };

  const handleUseDifferentPhone = () => {
    setReuseDecisionMade(true);
    setShowReusePhoneModal(false);
    navigate('/signup', { state: { fromBecomeCaterer: true, forceNewPhone: true } });
  };
  // call this from a button or on mount (with user permission) — keeps everything local
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const fetchLocationFromGPS = async (options = { enableHighAccuracy: true, timeout: 10000 }) => {

    setGeoError('');
    setLoadingLocation(true);

    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser.');
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          // save coordinates locally
          setForm((prev) => ({ ...prev, latitude, longitude }));

          // reverse-geocode using Nominatim (open). Light usage only.
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;
          const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
          if (!res.ok) throw new Error('Reverse geocode failed');
          const data = await res.json();
          const addr = data.address || {};

          // Compose street-like address
          const streetParts = [
            addr.house_number,
            addr.road,
            addr.neighbourhood,
            addr.suburb,
            addr.city || addr.town || addr.village,
            addr.state
          ].filter(Boolean);
          const street = streetParts.join(', ');

          const city = addr.city || addr.town || addr.village || addr.county || '';
          const postcode = (addr.postcode || '').toString().trim().slice(0, 6);

          // Only overwrite empty fields so we don't clobber user edits
          setForm((prev) => ({
            ...prev,
            city: prev.city || city,
            pincode: prev.pincode || postcode,
            address: prev.address || street,
            latitude,
            longitude,
          }));

          setAutoFilled(true);
        } catch (err) {
          console.error('Reverse geocode error:', err);
          setGeoError('Unable to auto-resolve city/pincode from GPS. Please enter manually.');
        } finally {
          setLoadingLocation(false);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        if (err.code === 1) setGeoError('Location permission denied — please allow to auto-fill city/pincode.');
        else if (err.code === 2) setGeoError('Position unavailable. Try again.');
        else if (err.code === 3) setGeoError('Location request timed out. Try again.');
        else setGeoError('Failed to get location. Enter details manually.');
        setLoadingLocation(false);
      },
      options
    );
  };
  useEffect(() => {
    const t = setTimeout(() => {
      // only attempt if city/pincode/address not already filled
      if (!form.city && !form.pincode && !form.address) {
        fetchLocationFromGPS();
      }
    }, 700);
    return () => clearTimeout(t);
  }, [form.city, form.pincode, form.address]);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 bg-white shadow-xl rounded-2xl mt-10 relative">
      {/* Top-right Cancel */}
      <div className="absolute right-6 top-6">
        <button
          onClick={() => setShowCancelModal(true)}
          className="px-3 py-2 rounded-md border text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h2 className="text-3xl font-extrabold text-indigo-700">Become a Caterer</h2>
        <p className="text-gray-600 mt-1">
          Tell us about your business. We’ll review and get you set up on Frame My Event.
        </p>
      </div>

      {/* Business Section */}
      <div className="mb-6 border rounded-xl p-5 md:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Business Details</h3>

        <label className="block text-sm font-medium mb-1">
          Business Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g., Sri Lakshmi Caterers"
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
        />

        <label className="block text-sm font-medium mb-1">
          Owner Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g., Ramesh Kumar"
          value={form.ownerName}
          onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="e.g., hello@yourcatering.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {form.email && !isValidEmail(form.email) && (
              <p className="text-xs text-red-600 mt-1">Enter a valid email.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              placeholder="Registered phone"
              value={form.phone}
              readOnly
              className="w-full p-3 border rounded-lg bg-gray-100 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Location Section */}
      <div className="mb-6 border rounded-xl p-5 md:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Location</h3>
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <p className="text-sm text-gray-600 flex-1">
            We can auto-detect your city, pincode & street using GPS. Please confirm and add a detailed address (house number/street/landmark) — required.
          </p>
          {form.latitude != null && form.longitude != null && (
            <p className="text-xs text-gray-600 mt-2">
              📍 Detected: {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)} {autoFilled && <span className="ml-2 text-xs text-green-600">Auto-filled</span>}
            </p>
          )}
          <div className="mt-3 sm:mt-0 flex gap-2">
            <button
              type="button"
              onClick={() => fetchLocationFromGPS()}
              disabled={loadingLocation}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-600 text-white text-sm hover:bg-green-700 transition"
            >
              {loadingLocation ? 'Detecting...' : 'Use my location'}
            </button>

            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
            >
              Pick on map
            </button>
          </div>
        </div>

        {geoError && <p className="text-xs text-red-600 mb-3">{geoError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Hyderabad"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Pincode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="6-digit pincode"
              value={form.pincode}
              onChange={(e) =>
                setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })
              }
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {form.pincode && !isValidPincode(form.pincode) && (
              <p className="text-xs text-red-600 mt-1">Pincode must be 6 digits.</p>
            )}
          </div>
        </div>

        <label className="block text-sm font-medium mb-1 mt-4">
          Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Street, area, landmark"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Service Type & Cuisines */}
      <div className="mb-6 border rounded-xl p-5 md:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Service & Cuisine</h3>

        <label className="block text-sm font-medium">
          Service Type <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2 mt-2">
          {serviceTypes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm((p) => ({ ...p, serviceType: s }))}
              className={`px-4 py-2 rounded-full border ${form.serviceType === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-gray-100 text-gray-800 border-gray-200'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="text-sm font-medium mt-4">Cuisine Specialities (optional)</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {cuisineOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleCuisineToggle(c)}
              className={`px-3 py-1 rounded-full border ${form.cuisines.includes(c)
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-800'
                }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Images */}
      <div className="mb-6 border rounded-xl p-5 md:p-6 bg-indigo-50">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Food Photos
        </h3>
        <p className="text-sm text-gray-600">
          📸 You can upload food & catering photos <strong>after approval</strong> from your Caterer Dashboard.
        </p>
      </div>

      {/* Compliance / IDs */}
      <div className="mb-6 border rounded-xl p-5 md:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Compliance</h3>

        {/* Aadhaar */}
        <label className="block text-sm font-medium mb-1">
          Aadhaar Number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Enter 12-digit Aadhaar Number"
          value={form.aadhaar}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 12);
            setForm({ ...form, aadhaar: value });
          }}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {form.aadhaar && !isValidAadhaar(form.aadhaar) && (
          <p className="text-xs text-red-600 mt-1">Aadhaar number must be exactly 12 digits.</p>
        )}

        {/* PAN */}
        <label className="block text-sm font-medium mb-1 mt-4">
          PAN Card Number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Enter 10-character PAN (e.g., ABCDE1234F)"
          value={form.pan}
          onChange={(e) => {
            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
            setForm({ ...form, pan: value });
          }}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {form.pan && !isValidPAN(form.pan) && (
          <p className="text-xs text-red-600 mt-1">PAN must be 10 alphanumeric characters.</p>
        )}

        {/* FSSAI */}
        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.fssaiRegistered}
              onChange={(e) => setForm({ ...form, fssaiRegistered: e.target.checked, fssaiNumber: '' })}
            />
            <span className="text-sm font-medium">FSSAI Registered</span>
          </label>
          {form.fssaiRegistered && (
            <input
              type="text"
              placeholder="FSSAI Number"
              value={form.fssaiNumber}
              onChange={(e) => setForm({ ...form, fssaiNumber: e.target.value })}
              className="w-full p-3 border rounded-lg mt-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          )}
        </div>
      </div>

      {/* Extra Notes */}
      <div className="mb-6 border rounded-xl p-5 md:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Notes (optional)</h3>
        <textarea
          placeholder="Anything else you'd like us to know?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setShowCancelModal(true)}
          className="px-5 py-3 rounded-lg font-semibold border text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleFormSubmit}
          className={`px-5 py-3 rounded-lg font-semibold text-white shadow ${validateForm() && !loading ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          disabled={!validateForm() || loading}
        >
          {loading ? 'Submitting…' : 'Submit Application'}
        </button>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-2">Cancel application?</h4>
            <p className="text-gray-600 mb-5">
              If you cancel now, you’ll return to Frame My Event as a normal user. You can apply again anytime.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-md border hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reuse Phone Modal */}
      {showReusePhoneModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h4 className="text-lg font-semibold mb-3">Use your existing phone for business?</h4>
            <p className="text-gray-700">
              Would you like to use the <span className="font-semibold">same phone</span> for your catering business?
              If not, you can register a <span className="font-semibold">different phone</span> for your business.
            </p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleReuseSamePhone}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Yes, use this phone
              </button>
              <button
                onClick={handleUseDifferentPhone}
                className="px-4 py-2 rounded-md border hover:bg-gray-50"
              >
                Use different phone
              </button>
            </div>
          </div>
        </div>
      )}
      {showMapPicker && (
        <MapPicker
          apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
          initial={{
            lat: form.latitude != null ? Number(form.latitude) : 13.618770,
            lng: form.longitude != null ? Number(form.longitude) : 79.421793,
          }}
          onPick={handleMapPick}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};

export default BecomeCaterer;