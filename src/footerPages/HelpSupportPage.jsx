// src/footerPages/HelpSupportPage.jsx
import React from "react";

export default function HelpSupportPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold">Help & Support</h1>
          <p className="mt-3 text-lg text-gray-200">
            We're here to help you plan a smooth, stress-free event experience.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* How we support */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">How can we help?</h2>
          <p className="text-gray-700 leading-relaxed">
            Whether you're a customer trying to book the right caterer or a local
            vendor looking to reach more people, our goal is to simplify the process
            and ensure everything runs smoothly.
          </p>
          <p className="text-gray-700 mt-3">
            Since we are currently a{" "}
            <strong>founder-led one-person company</strong>, you will always be
            talking directly with the person building the product — no bots, no
            call transfers, no waiting for days.
          </p>
        </div>

        {/* Support options */}
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border">
            <h3 className="text-xl font-semibold mb-2 text-[#204dcb]">Customer Support</h3>
            <p className="text-gray-700 text-sm mb-3">
              Questions before booking? Concerns during service?
              We’re just a message away.
            </p>
            <p className="text-gray-700 text-sm">
              Email:{" "}
              <a
                href="mailto:support@framemyevent.in"
                className="text-[#204dcb] font-medium underline"
              >
                contact@framemyevent.com
              </a>
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border">
            <h3 className="text-xl font-semibold mb-2 text-[#204dcb]">Vendor Support</h3>
            <p className="text-gray-700 text-sm mb-3">
              From onboarding to menu & pricing setup — we help caterers succeed
              and grow online.
            </p>
            <p className="text-gray-700 text-sm">
              Email:{" "}
              <a
                href="mailto:vendors@framemyevent.in"
                className="text-[#204dcb] font-medium underline"
              >
                support@framemyevent.com
              </a>
            </p>
          </div>
        </div>

        {/* Common Topics */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Common questions</h2>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-2">
            <li>How do I select the right caterer for my event?</li>
            <li>What happens if the caterer cancels last minute?</li>
            <li>How do payments, refunds and advance bookings work?</li>
            <li>How does vendor verification and safety check happen?</li>
          </ul>
          <p className="text-gray-600 text-xs mt-3">
            We are working on a proper Help Center where answers to these
            questions will be available soon.
          </p>
        </div>

        {/* Escalations */}
        <div className="bg-gray-100 rounded-xl p-6 border">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            If something goes wrong
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            Mistakes can happen. If a vendor fails to deliver quality or timing,
            we step in to support you with fast resolution, refunds when eligible,
            and corrective actions for future bookings.
          </p>
        </div>

        {/* Response time */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Response Time</h2>
          <p className="text-gray-700 text-sm">
            Our current response time may vary from same-day to 48 hours depending
            on workload — but every message gets a response, personally.
          </p>
        </div>

        {/* Closing */}
        <div className="text-center mt-8">
          <h2 className="text-xl font-semibold">Thank you for your trust 💙</h2>
          <p className="text-gray-600 text-sm mt-1">
            Your support helps us continue building a better event experience,
            one step at a time.
          </p>
        </div>

        <p className="text-xs text-gray-500 text-center pt-6">
          Last updated: December 2025
        </p>
      </section>
    </div>
  );
}