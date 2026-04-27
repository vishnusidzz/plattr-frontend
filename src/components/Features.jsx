import React from 'react';

const Features = () => (
  <section id="features" className="bg-gray-100 py-12">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <h3 className="text-2xl font-semibold mb-6">Why FrameMyEvent?</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h4 className="font-bold text-lg mb-2">AI-Based Recommendations</h4>
          <p>Get tailored menus based on event type, season, and preferences.</p>
        </div>
        <div>
          <h4 className="font-bold text-lg mb-2">Customizable Menus</h4>
          <p>Choose from veg, non-veg, or both — with full add-on control.</p>
        </div>
        <div>
          <h4 className="font-bold text-lg mb-2">Instant Quotes & Booking</h4>
          <p>Transparent pricing with quick confirmation and delivery options.</p>
        </div>
      </div>
    </div>
  </section>
);

export default Features;