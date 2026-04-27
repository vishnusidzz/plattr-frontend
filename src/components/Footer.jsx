// src/components/Footer.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaLinkedin,
  FaInstagram,
  FaFacebook,
  FaPinterest,
  FaTwitter,
} from "react-icons/fa";

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-gray-50 border-t border-gray-200 text-gray-700 text-sm mt-10">
      {/* Top section: logo + columns */}
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,3fr)]">
          {/* Branding / Logo */}
          <div className="space-y-3">
            <div
              className="flex items-center cursor-pointer select-none"
              onClick={() => navigate("/")}
              role="link"
              aria-label="Go to homepage"
            >
              <img
                src={`${process.env.PUBLIC_URL || ""}/FME_footer_logo.png`}
                alt="Frame My Event logo"
                className="w-32 md:w-36 object-contain"
                loading="lazy"
              />
            </div>

            <p className="text-sm font-semibold text-gray-700">
              © 2025 Frame My Event (OPC) Pvt. Ltd.
            </p>
            <p className="text-[10px] leading-4 text-gray-500">
              MSME Registered • UDYAM No:{" "}
              <span className="font-medium text-gray-600">UDYAM-AP-02-0093879</span>
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {/* Company */}
            <div>
              <h4 className="font-semibold mb-2 text-gray-900">Company</h4>
              <ul className="space-y-1">
                <li>
                  <Link to="/about" className="hover:text-gray-900">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/careers" className="hover:text-gray-900">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link to="/team" className="hover:text-gray-900">
                    Team
                  </Link>
                </li>
                <li>
                  <Link to="/corporate" className="hover:text-gray-900">
                    FME Corporate
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-2 text-gray-900">Contact us</h4>
              <ul className="space-y-1 mb-3">
                <li>
                  <Link to="/help" className="hover:text-gray-900">
                    Help &amp; Support
                  </Link>
                </li>
                <li>
                  <Link to="/partner" className="hover:text-gray-900">
                    Partner with Us
                  </Link>
                </li>
                <li>
                  <Link to="/list-business" className="hover:text-gray-900">
                    List your Business
                  </Link>
                </li>
              </ul>
            </div>

            {/* legal */}
            <div>
              <h5 className="font-semibold mb-1 text-gray-900">Legal</h5>
              <ul className="space-y-1">
                <li>
                  <Link to="/legal/terms" className="hover:text-gray-900">
                    Terms &amp; Conditions
                  </Link>
                </li>
                <li>
                  <Link to="/legal/cookies" className="hover:text-gray-900">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link to="/legal/privacy" className="hover:text-gray-900">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Life at FME */}
            <div>
              <h4 className="font-semibold mb-2 text-gray-900">
                Life at FME
              </h4>
              <ul className="space-y-1">
                <li>
                  <Link to="/life/news" className="hover:text-gray-900">
                    FrameMyEvent News
                  </Link>
                </li>
                <li>
                  <Link to="/life/culture" className="hover:text-gray-900">
                    Culture
                  </Link>
                </li>
              </ul>
            </div>

            {/* Available In + Social Links */}
            <div className="space-y-4">

              {/* Started In */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Started in</h4>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Tirupati
                  </li>
                </ul>
              </div>

              {/* Social Links */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Social Links</h4>
                <div className="flex items-center space-x-3 text-gray-600">
                  <a
                    href="#"
                    aria-label="FrameMyEvent on LinkedIn"
                    className="hover:text-blue-700 transition"
                  >
                    <FaLinkedin />
                  </a>
                  <a
                    href="https://www.instagram.com/framemyevent_official/"
                    aria-label="FrameMyEvent on Instagram"
                    className="hover:text-pink-600 transition"
                  >
                    <FaInstagram />
                  </a>
                  <a
                    href="#"
                    aria-label="FrameMyEvent on Facebook"
                    className="hover:text-blue-600 transition"
                  >
                    <FaFacebook />
                  </a>
                  <a
                    href="#"
                    aria-label="FrameMyEvent on Pinterest"
                    className="hover:text-red-600 transition"
                  >
                    <FaPinterest />
                  </a>
                  <a
                    href="#"
                    aria-label="FrameMyEvent on Twitter"
                    className="hover:text-blue-400 transition"
                  >
                    <FaTwitter />
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Bottom strip – like Swiggy “For better experience…” */}
      {/* <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-gray-800 text-center">
            For better experience, download the Plater app now
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <a href="#" className="block">
              <img
                src={`${process.env.PUBLIC_URL}/app-store-badge.png`}
                alt="Download on the App Store"
                className="h-10"
              />
            </a>
            <a href="#" className="block">
              <img
                src={`${process.env.PUBLIC_URL}/google-play-badge.png`}
                alt="Get it on Google Play"
                className="h-10"
              />
            </a>
          </div>
        </div>
      </div> */}

      <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-gray-800 text-center">
            For better experience, we're working on our app. Stay tuned!
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;