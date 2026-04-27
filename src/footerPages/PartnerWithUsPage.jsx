// src/footerPages/PartnerWithUsPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function PartnerWithUsPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-white text-gray-800">
      {/* Hero */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold">Partner with Frame My Event</h1>
          <p className="mt-3 text-lg text-gray-200 max-w-2xl">
            Work with us as a trusted catering or event service partner and
            reach customers who are actively planning functions, poojas,
            celebrations and small events.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">
          Build your business, not just another listing
        </h2>
        <p className="text-gray-700 leading-relaxed">
          Frame My Event is a{" "}
          <span className="font-semibold">founder-led platform</span> focused on
          helping genuine vendors grow with the right kind of customers — people
          who value good food, reliability and clear communication.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          If you provide event-related services, especially{" "}
          <span className="font-semibold">catering, sweets, snacks or bulk food</span>,
          you can partner with us and get more visibility, structured enquiries
          and repeat bookings.
        </p>
      </section>

      {/* Who can partner */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">Who can partner with us?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Caterers & Home Cooks</h3>
              <p className="text-gray-600 text-sm">
                From full-service caterers to home-based food businesses
                offering bulk orders for events.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Sweet & Snack Vendors</h3>
              <p className="text-gray-600 text-sm">
                Sweet shops, tiffin centers, snack providers and speciality items
                for functions and gatherings.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">Future Event Partners</h3>
              <p className="text-gray-600 text-sm">
                Decorators, photographers, videographers, halls and other event
                vendors (to be onboarded in future phases).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why partner */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">
          Why partner with Frame My Event?
        </h2>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-2 ml-2">
          <li>Reach customers specifically searching for event food & services</li>
          <li>Showcase your menu, photos, price range and specialties</li>
          <li>Get organised enquiries instead of random calls</li>
          <li>Guidance on pricing, menu structure and presentation</li>
          <li>Respectful, long-term vendor relationships — not just transactions</li>
        </ul>
      </section>

      {/* Safety & trust */}
      <section className="bg-gray-50 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Safety, licences & trust</h2>
          <p className="text-gray-700 text-sm mb-3">
            To protect customers and build long-term trust, we expect all partners to:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-2 ml-2">
            <li>Maintain required food licences as per local law</li>
            <li>Follow basic hygiene and food safety practices</li>
            <li>Be transparent about pricing, capacity and limits</li>
            <li>Communicate honestly if there is any delay or issue</li>
          </ul>
        </div>
      </section>

      {/* How to get started */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-4">How to get started</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-2xl p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-500 mb-1">STEP 1</p>
            <h3 className="font-semibold mb-1">Explore plans</h3>
            <p className="text-gray-600 text-sm">
              Review our partner options and choose a suitable plan.
            </p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-500 mb-1">STEP 2</p>
            <h3 className="font-semibold mb-1">Submit details</h3>
            <p className="text-gray-600 text-sm">
              Share your business, menu, location and licensing details.
            </p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-5 shadow-sm border">
            <p className="text-xs font-semibold text-gray-500 mb-1">STEP 3</p>
            <h3 className="font-semibold mb-1">Get onboarded</h3>
            <p className="text-gray-600 text-sm">
              After review, you&apos;ll appear to customers searching in your city.
            </p>
          </div>
        </div>

        {/* Buttons: use your existing flows */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/become-a-caterer-plan")}
            className="px-5 py-2.5 rounded-full bg-[#204dcb] text-white text-sm font-semibold hover:bg-[#193899] transition"
          >
            View Partner Plans
          </button>
          <button
            type="button"
            onClick={() => navigate("/become-a-caterer")}
            className="px-5 py-2.5 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200 transition"
          >
            Start Partner Application
          </button>
        </div>
      </section>

      {/* Direct contact */}
      <section className="bg-gray-100 py-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-3">Need help or have questions?</h2>
          <p className="text-gray-700 text-sm mb-4">
            If you&apos;re not sure whether Frame My Event is right for your business
            or need help setting things up, we&apos;re happy to guide you.
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
      </section>

      {/* Closing */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Let&apos;s grow together</h2>
          <p className="text-gray-100 mb-4 text-sm">
            We want to be a long-term partner for genuine vendors — not just
            another app. If you care about good service and happy customers,
            we&apos;d love to work with you.
          </p>
          <button
            type="button"
            onClick={() => navigate("/become-a-caterer-plan")}
            className="inline-flex px-6 py-3 rounded-full bg-white text-[#204dcb] font-semibold text-sm hover:bg-gray-100 transition"
          >
            Partner with Frame My Event
          </button>
        </div>
      </section>
    </div>
  );
}