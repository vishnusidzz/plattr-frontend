// src/footerPages/CulturePage.jsx
import React from "react";

export default function CulturePage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero Section */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold">Life at Frame My Event</h1>
          <p className="mt-3 text-lg text-gray-200">
            A young, founder-led company focused on real customers, real vendors
            and honest, practical execution.
          </p>
        </div>
      </section>

      {/* Who we are */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">How we see ourselves</h2>
        <p className="text-gray-700 leading-relaxed">
          Frame My Event is currently a{" "}
          <span className="font-semibold">one-person, founder-driven company</span>.
          Everything from product decisions to vendor calls and customer messages
          is handled with direct attention and care.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          Instead of chasing hype or vanity metrics, the focus is simple:
          <span className="font-semibold"> does this truly help people plan better events?</span>
        </p>
      </section>

      {/* Core values */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            What guides our decisions
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Honesty over marketing</h3>
              <p className="text-gray-600 text-sm">
                No over-promises. No fake discounts. No false urgency.
                Clear information, real pricing and transparent communication.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Care for small players</h3>
              <p className="text-gray-600 text-sm">
                We want small caterers, vendors and local businesses to grow,
                not get lost behind big brands. Respect on both sides matters.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Customer peace of mind</h3>
              <p className="text-gray-600 text-sm">
                Events are emotional: family, memories, people. Our job is to
                reduce stress, not increase it, through clarity and support.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Learn, improve, repeat</h3>
              <p className="text-gray-600 text-sm">
                We accept that things won&apos;t be perfect on day one.
                Feedback is not an insult, it&apos;s a direction to improve.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Safety & trust first</h3>
              <p className="text-gray-600 text-sm">
                We respect food safety, licensed vendors and hygiene standards.
                Long-term trust is more important than short-term gain.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Simple, not complicated</h3>
              <p className="text-gray-600 text-sm">
                Fewer clicks. Clear steps. Practical features.
                Technology should make life easier, not harder.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How we work day to day */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">How work actually happens</h2>
        <p className="text-gray-700 text-sm mb-3">
          Since the company is currently founder-led and small, work is:
        </p>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-2 ml-2">
          <li>Direct — no layers of approval or politics.</li>
          <li>Hands-on — building, testing and talking to users are daily tasks.</li>
          <li>Flexible — adjusting quickly based on real feedback.</li>
          <li>Grounded — ideas are judged by usefulness, not buzzwords.</li>
        </ul>
      </section>

      {/* Relationship with vendors & customers */}
      <section className="bg-gray-50 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Working with vendors & customers</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold mb-2">For Vendors & Caterers</h3>
              <p className="text-gray-600 text-sm">
                We aim for fair, respectful partnerships. Clear terms, realistic
                expectations and support to help you serve better and grow.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold mb-2">For Customers</h3>
              <p className="text-gray-600 text-sm">
                We want you to feel confident: licensed vendors, safety-focused,
                transparent pricing and support if something goes wrong.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Future of culture */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">As we grow in the future</h2>
        <p className="text-gray-700 leading-relaxed">
          One day, if Frame My Event grows into a larger team, the culture we
          want is still the same:{" "}
          <span className="font-semibold">
            humble, responsible, user-focused and transparent
          </span>
          . People who join later will be expected to carry the same mindset —
          respect for users, vendors and each other.
        </p>
      </section>

      {/* Closing */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Culture in one line</h2>
          <p className="text-gray-100 mb-4 text-sm">
            Build slowly. Stay honest. Respect people. Ship things that actually help.
          </p>
          <p className="text-xs text-gray-200">
            If this way of working resonates with you—as a customer, vendor or
            future collaborator—you&apos;re already part of our culture. 💙
          </p>
        </div>
      </section>
    </div>
  );
}