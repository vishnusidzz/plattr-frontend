// src/footerPages/ListBusinessPage.jsx
import React from "react";

export default function ListBusinessPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero Section */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold">List Your Business</h1>
          <p className="mt-3 text-lg text-gray-200 max-w-2xl">
            Join Frame My Event as a trusted vendor and reach more customers
            looking for catering and event services in your city.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">
          Grow your business with Frame My Event
        </h2>
        <p className="text-gray-700 leading-relaxed">
          If you provide food, event or related services, Frame My Event can
          help you connect with genuine customers who are actively planning
          functions, home events, poojas, celebrations and get-togethers.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          Right now, we are focusing mainly on{" "}
          <span className="font-semibold">caterers and food providers</span>, with
          plans to gradually onboard other vendors like decorators, photographers,
          halls and more.
        </p>
      </section>

      {/* Who can list */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">
            Who can list on Frame My Event?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Caterers</h3>
              <p className="text-gray-600 text-sm">
                Home cooks, professional caterers, cloud kitchens and food
                businesses offering bulk/event food.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Sweet & Snacks</h3>
              <p className="text-gray-600 text-sm">
                Sweet shops, tiffin centres, snack providers for small functions
                and office gatherings.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Coming Soon</h3>
              <p className="text-gray-600 text-sm">
                Decorators, photographers, videographers, halls and more
                event partners (planned for future phases).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">
          Why list your business with us?
        </h2>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-2 ml-2">
          <li>Reach customers searching for event food in your area</li>
          <li>Showcase your menu, photos, price range and specialties</li>
          <li>Get enquiries and confirmed bookings in an organised way</li>
          <li>Build trust through reviews and repeat customers</li>
          <li>Support from a founder-led platform that cares about small vendors</li>
        </ul>
      </section>

      {/* Safety & Requirements */}
      <section className="bg-gray-50 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Basic requirements</h2>
          <p className="text-gray-700 text-sm mb-3">
            To maintain safety and trust for customers, we expect all listed
            vendors to:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-2 ml-2">
            <li>Hold relevant food licences as required by local regulations</li>
            <li>Maintain clean kitchen and hygienic food handling practices</li>
            <li>Provide accurate information about menu, pricing and capacity</li>
            <li>Communicate clearly about availability and timings</li>
          </ul>
        </div>
      </section>

      {/* How to list */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">
          How to list your business
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-2xl p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-500 mb-1">STEP 1</p>
            <h3 className="font-semibold mb-1">Create an account</h3>
            <p className="text-gray-600 text-sm">
              Sign up on Frame My Event and choose the option to become a partner.
            </p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-500 mb-1">STEP 2</p>
            <h3 className="font-semibold mb-1">Complete your profile</h3>
            <p className="text-gray-600 text-sm">
              Add business details, service areas, sample menus, photos and pricing.
            </p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-500 mb-1">STEP 3</p>
            <h3 className="font-semibold mb-1">Get verified & go live</h3>
            <p className="text-gray-600 text-sm">
              After a basic review, your profile can appear to customers searching
              for services in your city.
            </p>
          </div>
        </div>
      </section>

      {/* Direct contact CTA */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-3">Need help listing?</h2>
          <p className="text-gray-700 text-sm mb-4">
            If you&apos;re not sure how to start or need help with menu and pricing
            setup, we can guide you personally.
          </p>
          <p className="text-gray-700 text-sm">
            Email us at{" "}
            <a
              href="mailto:vendors@framemyevent.in"
              className="text-[#204dcb] font-medium underline"
            >
              support@framemyevent.com
            </a>
          </p>
        </div>
      </section>

      {/* Closing strip */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Grow with Frame My Event</h2>
          <p className="text-gray-100 mb-4 text-sm">
            Whether you&apos;re just starting or already established, we want to
            make it easier for genuine vendors to succeed through better visibility,
            trust and repeat customers.
          </p>
          <a
            href="/become-a-caterer-plan"
            className="inline-flex px-6 py-3 rounded-full bg-white text-[#204dcb] font-semibold text-sm hover:bg-gray-100 transition"
          >
            Start Listing Your Business
          </a>
        </div>
      </section>
    </div>
  );
}