// src/footerPages/CorporatePage.jsx
import React from "react";

export default function CorporatePage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero Section */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold">FME Corporate</h1>
          <p className="mt-3 text-lg text-gray-200 max-w-2xl">
            Helping vendors, small business owners and busy customers plan 
            events smoothly with reliable catering support — without stress.
          </p>
        </div>
      </section>

      {/* What is FME Corporate */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">What is FME Corporate?</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          FME Corporate is a simple founder-led initiative for{" "}
          <span className="font-semibold">event organizers, vendors and busy individuals</span>{" "}
          who want reliable food service support for their events — without having
          to call multiple caterers or chase coordination.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Our goal is to help you{" "}
          <span className="font-semibold">save time</span>, reduce stress and 
          pull off hassle-free food arrangements — big or small events.
        </p>
      </section>

      {/* Safety & Vendor Verification */}
      <section className="bg-gray-50 py-10 px-6 border-y">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Trusted & Safe Caterers</h2>
          <p className="text-gray-700 mb-4 text-sm">
            We collaborate only with{" "}
            <span className="font-semibold">verified and licensed caterers</span> who
            follow required food safety practices and maintain hygiene standards.
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-2">
            <li>All vendors must comply with local food licensing requirements</li>
            <li>Safety checks for kitchen hygiene & handling procedures</li>
            <li>Encouragement of gloves, hair nets and clean uniforms</li>
            <li>Fresh food preparation — no compromises</li>
            <li>Dedicated support if there’s ever a concern</li>
          </ul>
        </div>
      </section>

      {/* Who can use it */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">Who is this for?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="border rounded-2xl p-5 shadow-sm bg-white">
              <h3 className="font-semibold text-lg mb-2">Small Businesses</h3>
              <p className="text-gray-600 text-sm">
                Shops, schools, gyms, beauty & service businesses 
                that occasionally need event food.
              </p>
            </div>
            <div className="border rounded-2xl p-5 shadow-sm bg-white">
              <h3 className="font-semibold text-lg mb-2">Event Organizers</h3>
              <p className="text-gray-600 text-sm">
                People planning small or local gatherings who want trusted caterers
                quickly without negotiation headaches.
              </p>
            </div>
            <div className="border rounded-2xl p-5 shadow-sm bg-white">
              <h3 className="font-semibold text-lg mb-2">Busy Individuals</h3>
              <p className="text-gray-600 text-sm">
                Birthdays, poojas, farewells or home parties — smoothly organized
                so you can enjoy the moment instead of managing it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why choose */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">Why choose FME Corporate?</h2>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-2 ml-2">
          <li>Save hours of calling and comparing caterers</li>
          <li>Reliable service — verified & licensed vendors</li>
          <li>No negotiation tension — simple communication</li>
          <li>Better menu suggestions for budget and taste</li>
          <li>Smooth coordination → stress-free final event</li>
        </ul>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="border rounded-2xl p-5 shadow-sm bg-white">
              <p className="text-xs font-semibold text-gray-500 mb-1">STEP 1</p>
              <h3 className="font-semibold mb-1">Share your requirement</h3>
              <p className="text-gray-600 text-sm">
                Event type, headcount, location & budget.
              </p>
            </div>
            <div className="border rounded-2xl p-5 shadow-sm bg-white">
              <p className="text-xs font-semibold text-gray-500 mb-1">STEP 2</p>
              <h3 className="font-semibold mb-1">We shortlist caterers</h3>
              <p className="text-gray-600 text-sm">
                Fast suggestions suitable for your event goals.
              </p>
            </div>
            <div className="border rounded-2xl p-5 shadow-sm bg-white">
              <p className="text-xs font-semibold text-gray-500 mb-1">STEP 3</p>
              <h3 className="font-semibold mb-1">Confirm & relax</h3>
              <p className="text-gray-600 text-sm">
                Direct booking or small coordination help from us.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">
            Time-saving, safe and hassle-free events 🚀
          </h2>
          <p className="text-gray-100 mb-4 text-sm">
            Founder-managed. Simple. Practical. Growing with real trust and customer value.
          </p>
          <p className="text-sm mb-6">
            Email us at{" "}
            <a
              href="mailto:corporate@framemyevent.in"
              className="underline font-semibold"
            >
              admin@framemyevent.com
            </a>
          </p>
          <a
            href="mailto:corporate@framemyevent.in?subject=Corporate%20Event%20Support"
            className="inline-flex px-6 py-3 rounded-full bg-white text-[#204dcb] font-semibold text-sm hover:bg-gray-100 transition"
          >
            Contact FME Corporate
          </a>
        </div>
      </section>
    </div>
  );
}