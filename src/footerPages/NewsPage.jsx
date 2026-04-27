// src/footerPages/NewsPage.jsx
import React from "react";

export default function NewsPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold">Frame My Event News</h1>
          <p className="mt-3 text-lg text-gray-200">
            Updates, small wins and product improvements from a young,
            founder-led company.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="max-w-5xl mx-auto px-6 py-10 space-y-4">
        <h2 className="text-2xl font-semibold">What this page is about</h2>
        <p className="text-gray-700 leading-relaxed">
          This is a simple space where we share important updates about{" "}
          <strong>Frame My Event</strong> — new features, improvements, city
          launches, and changes that matter to our customers and vendors.
        </p>
        <p className="text-gray-700 leading-relaxed">
          We don&apos;t run a full blog yet. Instead, we keep things short,
          honest and to the point.
        </p>
      </section>

      {/* Latest highlights (static placeholders you can update over time) */}
      <section className="bg-gray-50 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">Recent Highlights</h2>
          <div className="space-y-5">
            <article className="bg-white border rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                PRODUCT UPDATE · December 2025
              </p>
              <h3 className="text-lg font-semibold mb-2">
                New Frame My Event landing & footer pages
              </h3>
              <p className="text-gray-700 text-sm">
                We launched a refreshed home experience with clearer cards for
                catering, venues and photos, along with dedicated pages for
                About, Careers, Support, Vendors, Corporate and policies — all
                to make the platform more transparent and easier to understand.
              </p>
            </article>

            <article className="bg-white border rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                PLATFORM · 2025
              </p>
              <h3 className="text-lg font-semibold mb-2">
                Focus on verified & safety-conscious vendors
              </h3>
              <p className="text-gray-700 text-sm">
                We started formalising expectations around food safety, basic
                licensing and hygiene for caterers on the platform, so customers
                can book with more confidence.
              </p>
            </article>

            <article className="bg-white border rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                VISION · Ongoing
              </p>
              <h3 className="text-lg font-semibold mb-2">
                Built slowly, with small businesses in mind
              </h3>
              <p className="text-gray-700 text-sm">
                Frame My Event continues to be a founder-led, one-person
                company for now — prioritising real product value and support
                for small vendors and busy customers, rather than rapid,
                uncontrolled expansion.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Coming soon / how to stay updated */}
      <section className="max-w-5xl mx-auto px-6 py-10 space-y-4">
        <h2 className="text-2xl font-semibold">Upcoming</h2>
        <p className="text-gray-700 text-sm">
          Over time, this page will include:
        </p>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 ml-2">
          <li>New city launches and service expansions</li>
          <li>Important changes to pricing or policies</li>
          <li>Major product upgrades for customers and vendors</li>
          <li>Stories and learnings from events hosted via Frame My Event</li>
        </ul>

        <p className="text-gray-700 text-sm mt-4">
          For now, if you&apos;d like to know what&apos;s changing or share
          feedback on what we should build next, you can always reach out.
        </p>
      </section>

      {/* Contact / feedback */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-3">Feedback & Suggestions</h2>
          <p className="text-gray-700 text-sm mb-4">
            Every improvement on Frame My Event comes from real conversations
            with customers and vendors. If you have ideas, complaints or feature
            requests, we genuinely want to hear them.
          </p>
          <p className="text-gray-700 text-sm">
            Email:{" "}
            <a
              href="mailto:feedback@framemyevent.in"
              className="text-[#204dcb] font-medium underline"
            >
              admin@framemyevent.com
            </a>
          </p>
        </div>
      </section>

      {/* Footer note */}
      <section className="text-center py-6 px-6 text-xs text-gray-500">
        Last updated: December 2025
      </section>
    </div>
  );
}