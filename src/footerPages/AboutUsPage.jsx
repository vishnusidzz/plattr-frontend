// src/footerPages/AboutUsPage.jsx
import React, { useEffect } from "react";

export default function AboutUsPage() {
  //  React 19–safe SEO + Schema
  useEffect(() => {
    // Page title
    document.title =
      "About Frame My Event | Catering Services for All Events";

    // Meta description
    let meta = document.querySelector("meta[name='description']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Learn about Frame My Event, an all-in-one platform offering catering services for all events. Discover our mission, values, and journey."
    );

    // Organization structured data (JSON-LD)
    const existingSchema = document.getElementById("fme-org-schema");
    if (!existingSchema) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "fme-org-schema";
      script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Frame My Event",
        "url": "https://framemyevent.com",
        "logo": "https://framemyevent.com/fme_logo_white.png",
        "description":
          "Frame My Event is an all-in-one platform offering catering services for all events.",
        "foundingDate": "2024",
        "sameAs": [
          "https://www.instagram.com/framemyevent_official/",
          "https://www.facebook.com/framemyevent",
          "https://www.linkedin.com/company/framemyevent"
        ]
      });
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div className="bg-white text-gray-800">
      {/* Hero Section */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold">About Frame My Event</h1>
          <p className="mt-3 text-lg text-gray-200">
            Discover, plan, and book everything for your event in one place.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
        <p className="text-gray-700 leading-relaxed">
          We aim to simplify event planning by connecting customers with the best
          caterers, venues, photographers, and event service providers across India.
          No more juggling multiple vendors — Frame My Event brings your entire event
          booking experience into one seamless platform.
        </p>
      </section>

      {/* Values */}
      <section className="bg-gray-100 py-12 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-8">What We Believe</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white shadow-sm rounded-2xl p-6 border">
              <h3 className="font-semibold text-lg mb-2">
                Trust & Transparency
              </h3>
              <p className="text-gray-600 text-sm">
                Verified partners, real reviews, and clear pricing — no surprises.
              </p>
            </div>

            <div className="bg-white shadow-sm rounded-2xl p-6 border">
              <h3 className="font-semibold text-lg mb-2">
                Seamless Booking
              </h3>
              <p className="text-gray-600 text-sm">
                Find everything you need with just a few clicks — smooth from start
                to finish.
              </p>
            </div>

            <div className="bg-white shadow-sm rounded-2xl p-6 border">
              <h3 className="font-semibold text-lg mb-2">
                Great Service
              </h3>
              <p className="text-gray-600 text-sm">
                A premium experience for customers and service partners alike.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold mb-4">Our Journey</h2>
        <p className="text-gray-700 leading-relaxed">
          Frame My Event began with a simple belief — event planning should be joyful,
          not stressful. Today, we are growing rapidly with a trusted network of
          caterers and event services, powered by technology that keeps everything
          organised for you.
        </p>
      </section>
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-green-800">
            ✅ MSME Registered Company
          </h3>
          <p className="text-gray-700 mt-2 text-sm">
            Frame My Event is officially MSME registered (UDYAM). This ensures business credibility,
            compliance, and a trusted service experience for customers.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <h2 className="text-2xl font-bold mb-3">Ready to Get Started?</h2>
        <p className="text-gray-100 mb-6">
          Book trusted event services in just a few clicks.
        </p>
        <a
          href="/catererlist"
          className="bg-white text-[#204dcb] px-6 py-3 rounded-full font-semibold hover:bg-gray-100 transition"
        >
          Browse Services
        </a>
      </section>
    </div>
  );
}