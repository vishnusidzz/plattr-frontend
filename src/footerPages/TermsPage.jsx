// src/footerPages/TermsPage.jsx
import React from "react";

export default function TermsPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero */}
      <section className="bg-[#204dcb] text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold">Terms & Conditions</h1>
          <p className="mt-3 text-lg text-gray-200 max-w-3xl">
            Please read these terms carefully. By using Frame My Event, you agree
            to these Terms & Conditions.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* 1. Intro */}
        <div>
          <h2 className="text-xl font-semibold mb-2">1. About Frame My Event</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Frame My Event OPC Private Limited (&quot;Frame My Event&quot; / &quot;FME&quot; /
            &quot;we&quot; / &quot;us&quot; / &quot;our&quot;) operates a technology platform that connects
            customers with independent caterers and event vendors (&quot;Vendors&quot; /
            &quot;Caterers&quot;). We do not run kitchens, cook food, or directly manage
            serving teams. All food preparation, taste, quality, hygiene,
            delivery, staff behavior and utensils handling are the responsibility
            of the respective Vendors.
          </p>
        </div>

        {/* 2. Eligibility */}
        <div>
          <h2 className="text-xl font-semibold mb-2">2. Eligibility & Acceptance</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            By accessing or using the website / app, you confirm that you are at
            least 18 years old and capable of entering into a legally binding
            agreement under the laws of India. If you do not agree with these
            terms, please do not use the platform.
          </p>
        </div>

        {/* 3. Nature of Platform */}
        <div>
          <h2 className="text-xl font-semibold mb-2">
            3. Platform Role & Service Model
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              Frame My Event operates as a <strong>technology-enabled service platform</strong> that facilitates event-related bookings and order management.
            </li>
            <li>
              Payments made on the platform are collected by Frame My Event as part of
              providing platform services, order coordination, customer support and
              vendor management.
            </li>
            <li>
              Vendors are <strong>independent service providers</strong> responsible for
              food preparation, service execution and compliance.
            </li>
            <li>
              Frame My Event does not operate kitchens or directly provide catering
              services.
            </li>
          </ul>
        </div>

        {/* 4. Orders & Event Date Policy */}
        <div>
          <h2 className="text-xl font-semibold mb-2">4. Orders & Event Date Policy</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              The platform accepts orders only for events with{" "}
              <strong>T+2</strong> event date (i.e., minimum 2 days in advance),
              unless explicitly allowed in special cases.
            </li>
            <li>
              The confirmed invoice will clearly mention item types, counts,
              basic menu and applicable charges as agreed between customer and
              Vendor.
            </li>
            <li>
              Vendor is responsible to serve exactly what is promised in the
              invoice.
            </li>
          </ul>
        </div>

        {/* 5. Payments & Platform Fee */}
        <div>
          <h2 className="text-xl font-semibold mb-2">5. Payments & Platform Fee</h2>
          <p className="text-sm text-gray-700 mb-2">
            The platform uses an advance + settlement model:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              <strong>First payment (advance):</strong> Collected online through
              the platform. FME&apos;s platform fee is deducted from this first
              payment itself.
            </li>
            <li>
              The remaining advance, after platform fee, is passed to the Vendor
              as per the settlement flow.
            </li>
            <li>
              <strong>Remaining amount:</strong> After the event / delivery, the
              Vendor must collect the pending payment directly from the customer.
            </li>
            <li>
              At time of delivery or pickup, the Vendor must initiate{" "}
              <strong>OTP verification</strong> in the app/site to confirm
              successful handover.
            </li>
            <li>
              Any offline cash/UPI/card transactions between customer and Vendor
              (beyond what is collected on the platform) are{" "}
              <strong>entirely between them</strong>. FME is not responsible for
              recovery or disputes over offline amounts.
            </li>
          </ul>
        </div>

        {/* 6. Refunds & Cancellations */}
        <div>
          <h2 className="text-xl font-semibold mb-2">6. Refunds & Cancellations</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              Refunds or cancellations are allowed only while the order status
              is <strong>PENDING</strong>.
            </li>
            <li>
              Once Vendor has started preparation or status is moved beyond
              &quot;Pending&quot; (e.g., &quot;In Progress&quot;, &quot;Prepared&quot;, etc.), cancellations
              may not be allowed or may involve partial deductions.
            </li>
            <li>
              If the <strong>Vendor cancels</strong> the order, customer will be
              eligible for refund of online paid amount (excluding any already
              consumed platform fees, where applicable).
            </li>
            <li>
              Any eligible refund will be processed to the original source
              (payment method) within <strong>48 hours</strong> from confirmation
              of refund.
            </li>
            <li>
              Coupons and promotional offers are managed by the admin/platform.
              Coupon values are not refundable as cash.
            </li>
          </ul>
        </div>

        {/* 7. Utensils & Ancillary Items */}
        <div>
          <h2 className="text-xl font-semibold mb-2">7. Utensils, Water & Ancillary Items</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              Utensils (vessels, serving items, plates if applicable etc.) are{" "}
              <strong>fully between Vendor and customer</strong>.
            </li>
            <li>
              FME is not responsible for utensils delivery, return, loss,
              damage, replacement or any related refund.
            </li>
            <li>
              Vendor is expected to collect utensils advance, especially for
              pickup orders or when no serving staff is selected.
            </li>
            <li>
              Water bottles or water cans are to be arranged by the Vendor,
              unless specifically agreed otherwise. FME may tie up with specific
              water suppliers in select cases, but this is not guaranteed or
              mandatory.
            </li>
            <li>
              Packaging cost, complementary items, water-free charges and other
              small adjustments are between Vendor and customer. Vendor can edit
              such details in their order configuration.
            </li>
          </ul>
        </div>

        {/* 8. Staff Behaviour & Safety */}
        <div>
          <h2 className="text-xl font-semibold mb-2">8. Staff Behaviour & Safety</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              Vendor staff must be polite and respectful to all guests and
              hosts.
            </li>
            <li>
              Vendor should ensure staff follow basic safety and hygiene
              practices, including (where applicable) caps, proper dress code,
              face masks, and hand gloves while serving food.
            </li>
            <li>
              Any serious complaint related to staff behavior may lead to
              Vendor investigation and possible de-listing.
            </li>
          </ul>
        </div>

        {/* 9. Content & Images */}
        <div>
          <h2 className="text-xl font-semibold mb-2">9. Content, Photos & Listings</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              Only <strong>food and business-related images</strong> are allowed
              (food dishes, setups, counters, serving style etc.).
            </li>
            <li>
              Illegal, offensive, misleading or inappropriate images or text are
              strictly prohibited.
            </li>
            <li>
              Vendors must not display personal contact numbers (phone, WhatsApp
              etc.) on uploaded images, menus or banners to bypass the platform.
            </li>
            <li>
              Any attempt to leak or promote direct Vendor contact through
              images or content may result in permanent Vendor disqualification.
            </li>
          </ul>
        </div>

        {/* 10. Pricing, GST & Coupons */}
        <div>
          <h2 className="text-xl font-semibold mb-2">10. Pricing, Taxes & Coupons</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              Vendors are responsible for setting pricing keeping in mind{" "}
              <strong>GST, local taxes, discounts and offers</strong>.
            </li>
            <li>
              FME may provide coupon codes or platform-level promotions. Such
              coupons are controlled by the platform and may be withdrawn or
              changed at any time.
            </li>
            <li>
              Any tax reporting or compliance duty remains with the Vendor for
              their income.
            </li>
          </ul>
        </div>

        {/* 11. Communication & Offline Diversion */}
        <div>
          <h2 className="text-xl font-semibold mb-2">11. Communication & Offline Diversion</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              Customer and Vendor contact information will be shared by the
              platform only at a suitable stage (e.g., after order confirmation
              or during preparation).
            </li>
            <li>
              The &quot;Notes&quot; section and in-app communication should be
              used only for order-related discussions.
            </li>
            <li>
              Abusive, harassing, illegal, or offensive language is strictly
              prohibited. Such behavior may result in permanent account
              suspension and possible legal action.
            </li>
            <li>
              Vendors who repeatedly encourage customers to bypass the platform
              and move entirely offline for future orders may be{" "}
              <strong>permanently disqualified</strong>.
            </li>
          </ul>
        </div>

        {/* 12. Reviews */}
        <div>
          <h2 className="text-xl font-semibold mb-2">12. Ratings & Reviews</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            After an order is marked completed, customers may provide ratings and
            reviews about the Vendor and service. Reviews should be honest and
            fair. FME may moderate or remove reviews that contain abusive,
            defamatory, illegal or unrelated content as per applicable laws in
            India.
          </p>
        </div>

        {/* 13. Location & Data */}
        <div>
          <h2 className="text-xl font-semibold mb-2">13. Location & Data Usage</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-2">
            The platform may ask for access to your location (GPS / approximate
            location) to:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>Identify your city and recommend nearby Vendors</li>
            <li>
              Capture event location latitude/longitude for better routing and
              planning
            </li>
            <li>Improve delivery feasibility and service experience</li>
          </ul>
          <p className="text-sm text-gray-700 mt-2">
            You can control or disable location access through your device
            settings. Please refer to our Privacy Policy for full details.
          </p>
        </div>

        {/* 14. Liability */}
        <div>
          <h2 className="text-xl font-semibold mb-2">14. Liability & Disclaimer</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>
              FME is not responsible for any illness, allergy, or adverse
              reaction caused by food provided by Vendors.
            </li>
            <li>
              FME is not liable for any loss, damage or theft of utensils,
              personal belongings or property at the event.
            </li>
            <li>
              FME is not liable for delays, non-performance or service issues
              caused by Vendor, traffic, weather, strikes, natural disasters or
              other factors beyond reasonable control.
            </li>
            <li>
              FME may assist with dispute resolution but final responsibility of
              service lies with the Vendor.
            </li>
          </ul>
        </div>

        {/* 15. Misuse & Legal Action */}
        <div>
          <h2 className="text-xl font-semibold mb-2">15. Misuse & Legal Action</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Any illegal, fraudulent or highly unprofessional behavior by
            customer or Vendor may result in account suspension, deactivation,
            reporting to concerned authorities, and legal action in accordance
            with applicable laws of India (including relevant provisions of the
            Information Technology Act, Consumer Protection laws and local
            criminal/contract laws).
          </p>
        </div>

        {/* 16. Support */}
        <div>
          <h2 className="text-xl font-semibold mb-2">16. Support & Contact</h2>
          <p className="text-sm text-gray-700 mb-1">
            For customer app or booking related support:
          </p>
          <p className="text-sm text-gray-900 font-medium">
            📧 customer care:{" "}
            <a
              href="mailto:support@framemyevent.in"
              className="text-[#204dcb] underline"
            >
              contact@framemyevent.com
            </a>
          </p>
          <p className="text-sm text-gray-700 mt-3 mb-1">
            For Vendor onboarding, training or platform usage queries:
          </p>
          <p className="text-sm text-gray-900 font-medium">
            📧 vendor support:{" "}
            <a
              href="mailto:vendors@framemyevent.in"
              className="text-[#204dcb] underline"
            >
              support@framemyevent.com
            </a>
          </p>
        </div>

        {/* 17. Governing Law */}
        <div>
          <h2 className="text-xl font-semibold mb-2">17. Governing Law & Jurisdiction</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            These Terms & Conditions shall be governed by and interpreted in
            accordance with the laws of India. Any disputes shall be subject to
            the exclusive jurisdiction of the courts located in the State where
            Frame My Event OPC Private Limited is registered, subject to
            applicable laws.
          </p>
        </div>

        <p className="text-xs text-gray-500 pt-4">
          Last updated: December 2025
        </p>
      </section>

      {/* Closing Banner */}
      <section className="text-center py-12 px-6 bg-[#204dcb] text-white">
        <p className="font-medium text-sm max-w-3xl mx-auto">
          This platform is built with first preference to customer experience,
          while respecting Vendors as independent businesses. By continuing to
          use Frame My Event, you accept these Terms & Conditions. 💙
        </p>
      </section>
    </div>
  );
}