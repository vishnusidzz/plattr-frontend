// src/footerPages/CookiePolicyPage.jsx
import React from "react";

export default function CookiePolicyPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold">Cookie & Tracking Policy</h1>
          <p className="mt-3 text-lg text-gray-200">
            Transparency in how we store and use data on your device.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <p className="text-gray-700">
          This policy explains how <strong>Frame My Event OPC Private Limited</strong> uses
          cookies, local storage, and similar technologies across our
          platforms — web, mobile browser and the upcoming mobile app.
        </p>

        {/* What are cookies */}
        <div>
          <h2 className="text-xl font-semibold mb-2">What Technologies We Use</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li><strong>Cookies</strong> — Small files stored in your browser</li>
            <li><strong>Local Storage</strong> — Stores authentication data (tokens, role)</li>
            <li>
              <strong>Device identifiers</strong> — For security & fraud prevention
            </li>
          </ul>
        </div>

        {/* What we store */}
        <div>
          <h2 className="text-xl font-semibold mb-2">What Information We Store</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Login session tokens — to keep you signed in</li>
            <li>User role (guest/user/caterer/admin)</li>
            <li>User profile details required for features (e.g., phone)</li>
            <li>Preferred city or location for event services</li>
            <li>Caching of options and recent selections for faster experience</li>
          </ul>
          <p className="text-xs mt-2 text-gray-500">
            Stored in <strong>cookies or localStorage</strong> depending on use-case
          </p>
        </div>

        {/* Why */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Why We Use This Data</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>To support secure sign-in and account access</li>
            <li>To provide relevant catering options in your city</li>
            <li>To remember your preferences and reduce repeated selections</li>
            <li>To measure performance and improve platform stability</li>
          </ul>
        </div>

        {/* Analytics */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Analytics & Third Parties</h2>
          <p className="text-gray-700">
            We currently do not use external analytics cookies by default.
            However, future integrations such as Google Analytics, Meta Pixel
            or Crash tracking may use additional cookies or SDK-based tracking.
            Any such additions will be updated in this policy antes roll-out.
          </p>
        </div>

        {/* Location */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Location-Based Data</h2>
          <p className="text-gray-700">
            We may request your location to show city-specific caterers and
            services. Your location is only stored locally and not shared with
            any third-party without your consent.
          </p>
        </div>

        {/* Control */}
        <div>
          <h2 className="text-xl font-semibold mb-2">How You Can Control Cookies</h2>
          <p className="text-gray-700">
            You can disable cookies fully or partially through your browser
            settings. If disabled, sign-in and personalised features may not
            work properly.
          </p>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Questions?</h2>
          <p className="text-gray-700">
            You can reach out to us at:
            <br />
            <a href="mailto:legal@framemyevent.in"
              className="text-[#204dcb] font-medium underline">
              contact@framemyevent.com
            </a>
          </p>
        </div>

        <p className="text-xs text-gray-500 pt-4">
          Last updated: December 2025
        </p>
      </section>
    </div>
  );
}