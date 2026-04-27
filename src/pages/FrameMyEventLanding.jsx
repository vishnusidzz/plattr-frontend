// FrameMyEventLanding.jsx
import React, { useEffect } from "react";
import "./framemyevent.css";

function FeatureCard({
  title,
  subtitle,
  badge,
  href,
  featured = false,
  comingSoon = false,
  catering = false,
}) {
  const classes = ["fme-card"];
  if (featured) classes.push("fme-card--featured");
  if (comingSoon) classes.push("fme-card--comingsoon");
  if (catering) classes.push("fme-card--catering");

  return (
    <a className={classes.join(" ")} href={href}>
      <div className="fme-card-text">
        <p className="fme-card-title">{title}</p>
        <p className="fme-card-subtitle">{subtitle}</p>
        {badge && <span className="fme-card-badge">{badge}</span>}
      </div>
      {/* ➜ Decorative catering image */}
      {catering && (
        <img
          src="/catererHat.png"
          alt=""
          aria-hidden="true"
          className="fme-card-decor"
        />
      )}
      <div className="fme-card-arrow">➜</div>
    </a>
  );
}

export default function FrameMyEventLanding() {
  // React 19–safe SEO (NO Helmet)
  useEffect(() => {
    document.title =
      "Frame My Event | Catering Services for All Events";

    let meta = document.querySelector("meta[name='description']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }

    meta.setAttribute(
      "content",
      "Frame My Event is an all-in-one platform offering catering services for all events, including weddings, birthdays, and corporate occasions. Book trusted vendors easily."
    );
  }, []);

  return (
    <div className="fme-page">
      <main className="fme-hero">
        <section className="fme-hero-main">
          <h1 className="fme-hero-title">
            Plan food, halls, photos & decor in one place.
          </h1>
          <p className="fme-hero-subtitle">
            FrameMyEvent helps you book catering, venues, photographers and
            decoration in a few clicks. Start by exploring catering options for
            your event.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs md:text-sm px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur">
              ✅ MSME Registered
            </span>

            <span className="text-xs md:text-sm px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur">
              🔒 Secure Payments
            </span>

            <span className="text-xs md:text-sm px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur">
              ⭐ Trusted Caterers
            </span>
          </div>

          <div className="fme-hero-actions">
            <a href="/catererlist" className="fme-primary-btn">
              Start with catering
            </a>
          </div>
        </section>

        <section className="fme-hero-cards">
          <FeatureCard
            title="CATERING"
            subtitle="Food for every event"
            badge="Powered by Plattr"
            href="/catererlist"
            featured
            catering
          />

          <FeatureCard
            title="VENUES & HALLS"
            subtitle="Banquet & function halls"
            badge="Coming soon"
            href="/venues"
            comingSoon
          />

          <FeatureCard
            title="PHOTOS & VIDEO"
            subtitle="Photographers & videographers"
            badge="Coming soon"
            href="/photos"
            comingSoon
          />
        </section>
      </main>
    </div>
  );
}