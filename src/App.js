// src/App.js
import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import FrameMyEventLanding from './pages/FrameMyEventLanding';
import CatererList from './components/CatererList';
import Signup from './pages/Signup';
import CatererDetails from './components/CatererDetails';
import UserProfile from './components/UserProfile';
import axios from './shared-lib/axiosInstance';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import BecomeCaterer from './pages/BecomeCaterer';
import BecomeCatererPlan from './pages/BecomeCatererPlan';
import AdminCatererApprovals from "./pages/AdminCatererApprovals";
import ApplicationStatus from "./pages/ApplicationStatus";
import CatererDashboard from './pages/CatererDashboard';
import CatererMenuManager from './pages/caterer-menu-manager';
import OrderCreate from './pages/OrderCreate';
import PaymentPage from "./pages/PaymentPage";
import PaymentMock from "./pages/PaymentMock";
import OrderSuccess from "./pages/OrderSuccess";
import CatererOrders from "./pages/CatererOrders";
import Layout from './components/Layout';
import AdminImageApprovals from "./pages/AdminImageApprovals";
import AdminLocationApprovals from "./pages/AdminLocationApprovals";
import CommissionConfigPage from "./pages/CommissionConfigPage";
import TaxPage from "./pages/TaxPage";
import AdminDeliverySettings from "./pages/AdminDeliverySettings";
import CatererDeliverySettings from "./pages/CatererDeliverySettings";
import StaffSettings from "./pages/StaffSettings";
import AdminCouponsPage from "./pages/AdminCouponsPage";
import CatererWaterSettings from "./pages/CatererWaterSettings";
import AdminOrdersReport from "./pages/AdminOrdersReport";
import AdminPaymentPolicy from "./pages/AdminPaymentPolicy";
import OrderEdit from "./pages/OrderEdit";
import CatererRadiusSettings from "./pages/CatererRadiusSettings";
import AdminCatererOverviewPage from "./pages/AdminCatererOverviewPage";

// Footer imports
import AboutUsPage from './footerPages/AboutUsPage';
import CareersPage from './footerPages/CareersPage';
import TeamPage from './footerPages/TeamPage';
import CorporatePage from './footerPages/CorporatePage';
import HelpSupportPage from './footerPages/HelpSupportPage';
import PartnerWithUsPage from './footerPages/PartnerWithUsPage';
import ListBusinessPage from './footerPages/ListBusinessPage';
import TermsPage from './footerPages/TermsPage';
import CookiePolicyPage from './footerPages/CookiePolicyPage';
import PrivacyPolicyPage from './footerPages/PrivacyPolicyPage';
import NewsPage from './footerPages/NewsPage';
import CulturePage from './footerPages/CulturePage';
import AdminDashboard from "./pages/AdminDashboard";
import ScrollToTop from "./components/ScrollToTop";
import RazorpayPayment from "./pages/RazorpayPayment";
import axiosInstance from "./shared-lib/axiosInstance";
import DeleteAccount from "./pages/DeleteAccount";

const App = () => {
  const [role, setRoleState] = useState(() => localStorage.getItem('userRole') || 'guest');
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('userProfile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const safeRole = role || 'guest';

  const setRoleWrapper = useCallback((newRole) => {
    const roleToStore = newRole || 'guest';
    localStorage.setItem('userRole', roleToStore);
    setRoleState(roleToStore);
  }, []);

  const setUserProfileWrapper = useCallback((profile) => {
    if (profile === null) {
      localStorage.removeItem('userProfile');
    } else {
      localStorage.setItem('userProfile', JSON.stringify(profile));
    }
    setUserProfile(profile);
  }, []);

  // fetch user profile...
  useEffect(() => {
    const fetchProfile = async () => {
      if (!role || role === 'guest') return;
      setLoadingProfile(true);
      try {
        const res = await axiosInstance.get('/api/profile/');
        if (res?.data) setUserProfileWrapper(res.data);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          setRoleWrapper('guest');
          setUserProfileWrapper(null);
        }
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [role, setRoleWrapper, setUserProfileWrapper]);

  // delete caterer
  const handleDeleteCaterer = async (id, name) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${name}"?`);
    if (!confirmed) return;
    try {
      await axios.delete(`/api/caterers/${id}/`);
      toast.success(`"${name}" deleted successfully!`);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(`Failed to delete "${name}"`);
    }
  };

  return (
    <Router>
      <Layout userRole={role} setRole={setRoleWrapper} setUserProfile={setUserProfileWrapper}>
        {loadingProfile && (
          <div className="fixed inset-0 flex items-center justify-center bg-white/70 z-50">
            <div className="loader border-t-4 border-indigo-500 w-12 h-12 rounded-full animate-spin"></div>
          </div>
        )}
        <ScrollToTop />
        <Routes>
          <Route
            path="/"
            element={
              <FrameMyEventLanding key={safeRole} refreshKey={refreshKey} userRole={safeRole} handleDelete={handleDeleteCaterer} userProfile={userProfile} />
            }
          />
          <Route
            path="/catererlist"
            element={
              <CatererList
                refreshKey={refreshKey}
                userRole={safeRole}
                handleDelete={handleDeleteCaterer}
                userProfile={userProfile}
              />
            }
          />
          <Route path="/caterer/:id" element={<CatererDetails />} />
          <Route path="/profile" element={<UserProfile userProfile={userProfile} setRole={setRoleWrapper} />} />
          <Route path="/signup" element={<Signup setRole={setRoleWrapper} setUserProfile={setUserProfileWrapper} />} />
          <Route path="/become-a-caterer-plan" element={<BecomeCatererPlan />} />
          <Route path="/become-a-caterer" element={<BecomeCaterer userProfile={userProfile} setUserProfile={setUserProfileWrapper} setRole={setRoleWrapper} />} />
          <Route path="/application-status" element={<ApplicationStatus />} />
          <Route path="/admin/caterers" element={role === 'admin' ? <AdminCatererApprovals /> : <Navigate to="/" replace />} />
          <Route path="/admin/location-approvals" element={role === 'admin' ? <AdminLocationApprovals /> : <Navigate to="/" replace />} />
          <Route path="/caterer-dashboard" element={<CatererDashboard />} />
          <Route path="/caterer-menu-manager" element={<CatererMenuManager />} />
          <Route path="/order/create" element={<OrderCreate />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment/mock" element={<PaymentMock />} />
          <Route path="/order/success/:orderId" element={<OrderSuccess />} />
          <Route path="/caterer-orders" element={<CatererOrders />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/admin/image-approvals" element={<AdminImageApprovals />} />
          <Route path="/admin/commissions" element={<CommissionConfigPage />} />
          <Route path="/admin/tax" element={<TaxPage />} />
          <Route path="/admin/platform-settings" element={<AdminDeliverySettings />} />
          <Route path="/caterer-delivery-settings" element={<CatererDeliverySettings />} />
          <Route path="/caterer-staff-charge" element={<StaffSettings />} />
          <Route path="/admin/coupons" element={<AdminCouponsPage />} />
          <Route path="/caterer-water-settings" element={<CatererWaterSettings />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders-report" element={<AdminOrdersReport />} />
          <Route path="/admin/payment-policy" element={<AdminPaymentPolicy />}/>
          <Route path="/pay/razorpay/:orderId" element={<RazorpayPayment />} />

          {/* Footer Routes */}
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/corporate" element={<CorporatePage />} />

          <Route path="/help" element={<HelpSupportPage />} />
          <Route path="/partner" element={<PartnerWithUsPage />} />
          <Route path="/list-business" element={<ListBusinessPage />} />
\
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/cookies" element={<CookiePolicyPage />} />
          <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />

          <Route path="/life/news" element={<NewsPage />} />
          <Route path="/life/culture" element={<CulturePage />} />

          <Route path="/order/edit/:orderId" element={<OrderCreate />} />
          <Route path="/caterer-radius-settings" element={<CatererRadiusSettings />} />
          <Route path="/admin/caterer-overview" element={<AdminCatererOverviewPage />}/>
            {/* Google Play store mandate */}
          <Route path="/delete-account" element={<DeleteAccount />} />
        </Routes>
      </Layout>

      <ToastContainer />
    </Router>
  );
};

export default App;