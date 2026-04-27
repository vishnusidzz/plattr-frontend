import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaUtensils, FaPhoneAlt, FaChartLine, FaListAlt } from "react-icons/fa";
import SlideOverAuth from "../components/SlideOverAuth";

const BecomeCatererPlan = () => {
  const [authOpen, setAuthOpen] = useState(false);

  const features = [
    {
      icon: <FaUtensils className="text-indigo-600 text-2xl" />,
      text: "Get catering orders directly from nearby users",
    },
    {
      icon: <FaListAlt className="text-indigo-600 text-2xl" />,
      text: "Manage your menu anytime, anywhere",
    },
    {
      icon: <FaPhoneAlt className="text-indigo-600 text-2xl" />,
      text: "Quick onboarding with phone OTP",
    },
    {
      icon: <FaChartLine className="text-indigo-600 text-2xl" />,
      text: "Track revenue, ratings & growth in real-time",
    },
  ];

  return (
    <>
      <motion.div
        className="max-w-6xl mx-auto mt-12 px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Hero Section */}
        <motion.div
          className="bg-gradient-to-r from-green-500 to-indigo-600 text-white rounded-2xl shadow-lg p-10 text-center mb-12"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7 }}
        >
          <h1 className="text-4xl font-extrabold mb-4">Become a Partner with FME</h1>
          <p className="text-lg max-w-2xl mx-auto">
            Join India’s next-gen catering platform. Get more orders, grow your
            revenue, and delight customers with your food & service.
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.2 },
            },
          }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-4 p-6 bg-white shadow-md rounded-xl hover:shadow-lg transition"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <div className="flex-shrink-0">{feature.icon}</div>
              <p className="text-gray-700 font-medium">{feature.text}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="flex flex-col md:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <button
            onClick={() => {
              localStorage.setItem("catererIntent", "1");
              setAuthOpen(true); // 🔥 open slide-over auth instead of redirect
            }}
            className="bg-indigo-600 text-white px-8 py-4 rounded-lg shadow-lg hover:bg-indigo-700 transition transform hover:scale-105"
          >
            Get Started
          </button>
          <button
            onClick={() => window.location.href = "/contact"}
            className="bg-white text-indigo-600 border border-indigo-600 px-8 py-4 rounded-lg shadow hover:bg-indigo-50 transition transform hover:scale-105"
          >
            Learn More
          </button>
        </motion.div>
      </motion.div>

      {/* SlideOverAuth injected here */}
      <SlideOverAuth
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={(profile) => {
          console.log("Auth success!", profile);
          setAuthOpen(false);
        }}
      />
    </>
  );
};

export default BecomeCatererPlan;