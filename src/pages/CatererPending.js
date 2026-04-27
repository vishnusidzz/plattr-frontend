// pages/CatererPending.js
import React from "react";
import { useNavigate } from "react-router-dom";

const CatererPending = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-indigo-700 mb-4">
          Application Submitted 🎉
        </h2>
        <p className="text-gray-600 mb-6">
          Thank you for applying to become a partner with <span className="font-semibold">Frame My Event</span>.  
          Your application is currently under review by our team.
        </p>
        <p className="text-gray-600 mb-6">
          We’ll notify you once your account is approved.  
          Meanwhile, you can continue exploring Frame My Event as a customer.
        </p>

        <button
          onClick={() => navigate("/")}
          className="px-5 py-3 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
};

export default CatererPending;