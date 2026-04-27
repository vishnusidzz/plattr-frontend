// src/footerPages/TeamPage.jsx
import React from "react";

export default function TeamPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero Section */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold">Meet the Team</h1>
          <p className="mt-3 text-lg text-gray-200">
            A founder-driven company with a mission to simplify event planning.
          </p>
        </div>
      </section>

      {/* Founder Section */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold mb-6">Founder</h2>

        <div className="bg-gray-100 p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-semibold">Founder, Frame My Event</h3>

          <p className="text-gray-700 text-sm mt-3 leading-relaxed">
            Handles product, technology, vendor relationships and customer
            experience end-to-end. The mission is simple —{" "}
            <span className="font-semibold">
              to make event planning (food, venues & halls, decoration,
              photography and more) clear, transparent and stress-free for both
              customers and vendors.
            </span>
          </p>

          <p className="text-gray-700 text-sm mt-3 leading-relaxed">
            Every feature, improvement and decision is crafted with real user
            needs in mind — building a platform that solves practical problems
            instead of adding complexity.
          </p>

          <div className="mt-6 text-sm">
            <p className="text-gray-700">
              📧 Contact:{" "}
              <a
                href="mailto:founder@framemyevent.in"
                className="text-[#204dcb] underline font-medium"
              >
                admin@framemyevent.com
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* How We Grow Section */}
      <section className="bg-gray-50 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Small team, big vision</h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            Frame My Event is operated by a single founder today — but built to
            scale intelligently. Vendors grow their business through visibility
            and digital convenience, while customers enjoy reliable event
            planning without stress.
          </p>
          <p className="text-gray-700 text-sm leading-relaxed mt-3">
            Growth will happen thoughtfully — always keeping{" "}
            <span className="font-semibold">
              trust, transparency and convenience
            </span>{" "}
            as the foundation.
          </p>
        </div>
      </section>

      {/* Trust & Transparency Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold mb-4">Built with integrity</h2>
        <p className="text-gray-700 text-sm leading-relaxed">
          We believe great events happen when{" "}
          <span className="font-semibold">relationships work smoothly</span>.  
          Vendors deliver the experience, customers share their trust — and the
          platform ensures everything stays fair and accountable.
        </p>

        <ul className="list-disc list-inside text-gray-700 text-sm space-y-2 mt-4 ml-2">
          <li>Only verified and trusted vendors onboarded</li>
          <li>Clear and transparent order communication</li>
          <li>High-quality service expectations from every partner</li>
          <li>Technology that supports real-world event needs</li>
        </ul>
      </section>

      {/* Closing Note */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <h2 className="text-2xl font-semibold mb-3">Just getting started 🚀</h2>
        <p className="text-gray-200 text-sm max-w-2xl mx-auto">
          Thank you for supporting a founder-led platform. The best events come
          from passion and purpose — and that’s exactly what Frame My Event
          stands for.
        </p>
      </section>
    </div>
  );
}