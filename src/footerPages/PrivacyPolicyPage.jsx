// src/footerPages/PrivacyPolicyPage.jsx
import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-3 text-lg text-gray-200">
            Transparency about how we collect, use and protect your data.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Intro */}
        <div>
          <p className="text-gray-700 leading-relaxed">
            This Privacy Policy describes how{" "}
            <strong>Frame My Event OPC Private Limited</strong> (“FME”, “we”,
            “us”, “our”) collects, uses and safeguards your personal
            information when you access our website or mobile app (currently in
            development).
          </p>
        </div>

        {/* What We Collect */}
        <div>
          <h2 className="text-xl font-bold mb-2">Information We Collect</h2>
          <p className="text-sm text-gray-700 mb-2">
            We collect information to provide a better and more personalised
            event planning experience:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li><strong>Account details:</strong> Name, phone number, email</li>
            <li><strong>Event location:</strong> City / live location (if given permission)</li>
            <li><strong>Booking details:</strong> Caterer selection, event type, order preferences</li>
            <li><strong>Device info:</strong> IP address, browser type, OS</li>
            <li><strong>Vendor information:</strong> Menu, pricing, documentation (e.g., licences)</li>
          </ul>
        </div>

        {/* Cookies & Analytics */}
        <div>
          <h2 className="text-xl font-bold mb-2">
            Cookies, Analytics & Tracking
          </h2>
          <p className="text-sm text-gray-700">
            We use cookies for:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-1">
            <li>Remembering your selected city</li>
            <li>Keeping you logged in securely</li>
            <li>Understanding usage to improve performance</li>
          </ul>
          <p className="text-sm text-gray-700 mt-2">
            We may use analytics tools like Google Analytics for insights.
          </p>
        </div>

        {/* Location */}
        <div>
          <h2 className="text-xl font-bold mb-2">Location Access</h2>
          <p className="text-sm text-gray-700">
            Your approximate location may be used (with consent) to show
            relevant vendors. You may disable location access anytime through
            browser or device settings.
          </p>
        </div>

        {/* Payments */}
        <div>
          <h2 className="text-xl font-bold mb-2">Payments & Security</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            We do <strong>not</strong> store card or banking details. Payments
            are processed securely through trusted third-party partners (like
            Razorpay, Cashfree, etc.), who operate under their own security
            and compliance policies.
          </p>
        </div>

        {/* Why Use */}
        <div>
          <h2 className="text-xl font-bold mb-2">How We Use Your Information</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-1">
            <li>Provide event booking features</li>
            <li>Connect customers with verified vendors</li>
            <li>Improve product features and responsibilities</li>
            <li>Communicate booking confirmations and updates</li>
            <li>Secure the platform against fraud or misuse</li>
          </ul>
        </div>

        {/* Sharing */}
        <div>
          <h2 className="text-xl font-bold mb-2">Sharing of Information</h2>
          <p className="text-sm text-gray-700">
            We may share your details only with:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-1">
            <li>Caterers / vendors you place enquiries or orders with</li>
            <li>Official authorities if legally required</li>
            <li>Payment, analytics and SMS service providers</li>
          </ul>
          <p className="text-sm text-gray-700 mt-2">
            We never sell your information to third parties.
          </p>
        </div>

        {/* Your Rights */}
        <div>
          <h2 className="text-xl font-bold mb-2">Your Rights & Controls</h2>
          <p className="text-sm text-gray-700">You can request to:</p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-1">
            <li>Edit or update your information</li>
            <li>Download your stored details</li>
            <li>Delete your account permanently</li>
          </ul>
          <p className="text-sm text-gray-700 mt-2">
            For any request:{" "}
            <a
              className="text-[#204dcb] underline font-medium"
              href="mailto:privacy@framemyevent.in"
            >
              contact@framemyevent.com
            </a>
          </p>
        </div>

        {/* Children */}
        <div>
          <h2 className="text-xl font-bold mb-2">Children’s Privacy</h2>
          <p className="text-sm text-gray-700">
            FME is not intended for individuals under 18 years of age unless
            supervised by a parent or legal guardian.
          </p>
        </div>

        {/* Policy Updates */}
        <div>
          <h2 className="text-xl font-bold mb-2">Policy Updates</h2>
          <p className="text-sm text-gray-700">
            If this policy changes, we will update the date below and notify
            users where applicable.
          </p>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-xl font-bold mb-2">Contact Us</h2>
          <p className="text-sm text-gray-700">
            If you have any questions regarding privacy, reach us at:
          </p>
          <p className="text-sm text-gray-900 font-medium mt-1">
            📧 contact@framemyevent.com
          </p>
        </div>

        <p className="text-xs text-gray-500 pt-4">
          Last updated: December 2025
        </p>
      </section>
    </div>
  );
}