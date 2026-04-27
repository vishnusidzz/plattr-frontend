import React from "react";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <p className="text-sm text-gray-600 mb-6">
        Quick controls for approvals, commissions, delivery settings, coupons, tax, and images.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Caterer Approvals */}
        <button
          onClick={() => navigate("/admin/caterers")}
          className="p-4 rounded-lg bg-indigo-50 border border-indigo-100 text-left shadow-sm hover:shadow-md hover:border-indigo-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-indigo-900 mb-1">
            Caterer Approvals
          </div>
          <div className="text-xs text-indigo-700/80">
            Review and approve new caterer registrations.
          </div>
        </button>

        {/* Location Approvals */}
        <button
          onClick={() => navigate("/admin/location-approvals")}
          className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 text-left shadow-sm hover:shadow-md hover:border-emerald-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-emerald-900 mb-1">
            Location Approvals
          </div>
          <div className="text-xs text-emerald-700/80">
            Approve address / service area updates.
          </div>
        </button>

        {/* Commission */}
        <button
          onClick={() => navigate("/admin/commissions")}
          className="p-4 rounded-lg bg-orange-50 border border-orange-100 text-left shadow-sm hover:shadow-md hover:border-orange-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-orange-900 mb-1">
            Commission
          </div>
          <div className="text-xs text-orange-700/80">
            Configure global commission / payout rules.
          </div>
        </button>

        {/* Payment Policy */}
        <button
          onClick={() => navigate("/admin/payment-policy")}
          className="p-4 rounded-lg bg-violet-50 border border-violet-100 text-left shadow-sm hover:shadow-md hover:border-violet-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-violet-900 mb-1">
            Payment Policy
          </div>
          <div className="text-xs text-violet-700/80">
            Configure booking (MIN), advance %, and payment rules.
          </div>
        </button>

        {/* Delivery Settings */}
        <button
          onClick={() => navigate("/admin/platform-settings")}
          className="p-4 rounded-lg bg-sky-50 border border-sky-100 text-left shadow-sm hover:shadow-md hover:border-sky-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-sky-900 mb-1">
            Delivery Settings
          </div>
          <div className="text-xs text-sky-700/80">
            Set platform-wide delivery charges and limits.
          </div>
        </button>

        {/* Coupons */}
        <button
          onClick={() => navigate("/admin/coupons")}
          className="p-4 rounded-lg bg-amber-50 border border-amber-100 text-left shadow-sm hover:shadow-md hover:border-amber-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-amber-900 mb-1">
            Coupons
          </div>
          <div className="text-xs text-amber-700/80">
            Manage discount codes and offers.
          </div>
        </button>

        {/* Tax */}
        <button
          onClick={() => navigate("/admin/tax")}
          className="p-4 rounded-lg bg-rose-50 border border-rose-100 text-left shadow-sm hover:shadow-md hover:border-rose-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-rose-900 mb-1">
            Tax
          </div>
          <div className="text-xs text-rose-700/80">
            Configure GST / tax settings.
          </div>
        </button>

        {/* Image Approvals */}
        <button
          onClick={() => navigate("/admin/image-approvals")}
          className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left shadow-sm hover:shadow-md hover:border-slate-400 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-slate-900 mb-1">
            Image Approvals
          </div>
          <div className="text-xs text-slate-700/80">
            Approve/decline caterer menu & banner images.
          </div>
        </button>

        {/* Caterer Overview */}
        <button
          onClick={() => navigate("/admin/caterer-overview")}
          className="p-4 rounded-lg bg-blue-50 border border-blue-100 text-left shadow-sm hover:shadow-md hover:border-blue-300 transition transform hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold text-blue-900 mb-1">
            Caterer Overview
          </div>
          <div className="text-xs text-blue-700/80">
            View caterer orders, revenue, bank details & audits.
          </div>
        </button>

        {/* Orders & Caterer Orders */}
        <button
          type="button"
          onClick={() => navigate("/admin/orders-report")}
          className="p-4 rounded-lg bg-[#204DCB] border border-[#1b3fa8] text-left shadow-sm hover:shadow-md hover:bg-[#1b3fa8] hover:border-[#16338a] transition transform hover:-translate-y-0.5 text-white col-span-1 sm:col-span-2 lg:col-span-3"
        >
          <div className="text-lg font-semibold mb-1">
            View Orders & Caterer Orders
          </div>
          <div className="text-xs text-blue-100">
            See all orders and caterer-wise breakdown with invoices.
          </div>
        </button>
      </div>
    </div>
  );
}