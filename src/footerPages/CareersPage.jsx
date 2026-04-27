// src/footerPages/CareersPage.jsx
import React from "react";

export default function CareersPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero Section */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold">Careers at Frame My Event</h1>
          <p className="mt-3 text-lg text-gray-200">
            A young, founder-led company building the future of event planning.
          </p>
        </div>
      </section>

      {/* Current Status */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">Where we are now</h2>
        <p className="text-gray-700 leading-relaxed">
          Frame My Event is currently run as a{" "}
          <span className="font-semibold">single-founder, one-person company</span>.
          The focus right now is on building a stable, reliable product for
          customers and partners — not on hiring a large team.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          As we grow in usage and revenue, we may explore collaborations,
          freelancers and eventually full-time roles. Until then, this page is
          here to share our philosophy and future direction.
        </p>
      </section>

      {/* Philosophy */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">How we think about people & work</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Start small, build strong</h3>
              <p className="text-gray-600 text-sm">
                The focus is on product quality and real customer value before scaling a team.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Product over headcount</h3>
              <p className="text-gray-600 text-sm">
                Every feature is designed, built and shipped with care by the founder — ensuring focus and efficiency.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Future-friendly</h3>
              <p className="text-gray-600 text-sm">
                When hiring does happen, it will be thoughtful and mission-driven, not rushed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Future Opportunities */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">Future opportunities</h2>

        <p className="text-gray-700 text-sm mb-3">
          There are <span className="font-semibold">no active openings</span> at the moment.
        </p>

        <p className="text-gray-700 leading-relaxed mb-4">
          In the future, there may be scope for:
        </p>

        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 ml-2">
          <li>Freelance or part-time engineering support</li>
          <li>Marketing & online brand promotion support</li>
          <li>Content creation (social media, blogs, product videos)</li>
          <li>Design help for UI/UX and visual assets</li>
          <li>City-based onboarding support for caterers & venues</li>
        </ul>

        <p className="text-gray-600 text-sm mt-4">
          If this mission excites you and you’d like to be considered for{" "}
          <span className="font-medium">future collaboration</span>, feel free
          to send your profile with a short note about how you’d like to
          contribute.
        </p>
      </section>

      {/* Keep In Touch */}
      <section className="bg-gray-50 py-10 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-3">Stay in touch</h2>
          <p className="text-gray-700 text-sm mb-4">
            Even though we aren’t hiring right now, it’s always great to connect
            with people passionate about events, food and product building.
          </p>
          <p className="text-gray-700 text-sm">
            Email us at:{" "}
            <a
              href="mailto:careers@framemyevent.in"
              className="text-[#204dcb] font-medium underline"
            >
              careers@framemyevent.com
            </a>
          </p>
        </div>
      </section>

      {/* Closing */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <h2 className="text-2xl font-bold mb-3">Building step by step</h2>
        <p className="text-gray-100 mb-4 text-sm">
          Right now, Frame My Event is focused on building a strong foundation.
          When it’s time to grow the team, this page will be the first place to know.
        </p>
        <p className="text-xs text-gray-200">
          Thank you for your interest in the journey 💙
        </p>
      </section>
    </div>
  );
}