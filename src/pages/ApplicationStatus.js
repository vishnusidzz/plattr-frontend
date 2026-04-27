// src/pages/ApplicationStatus.js
import React, { useEffect, useState } from "react";
import axios from "../shared-lib/axiosInstance";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const ApplicationStatus = () => {
  const [status, setStatus] = useState(null);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get("/api/caterer-applications/self/");
        if (!mounted) return;
        setStatus(res.data.status);
        setComments(res.data.admin_comment || "");
      } catch (err) {
        console.error("Error fetching application status:", err);
        if (err.response?.status === 404) {
          setStatus("not_applied");
        } else {
          // keep unknown status visible
          setStatus("unknown");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const goToDashboard = async () => {
    // Before navigating, confirm the backend has a caterer row for this user
    try {
      const res = await axios.get("/api/caterers/me/");
      if (res.status === 200) {
        navigate("/caterer-dashboard");
      } else {
        toast.error("No caterer data available yet. Please try again shortly.");
      }
    } catch (err) {
      if (err.response?.status === 404) {
        toast.info("No caterer profile found yet — please wait or re-open application.");
        // optional: navigate('/become-a-caterer') or stay here
      } else {
        toast.error("Failed to fetch dashboard info. Please try again.");
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        Loading your application status…
      </div>
    );
  }

  if (status === "not_applied") {
    return (
      <div className="max-w-lg mx-auto p-6 mt-10 bg-white shadow rounded-lg text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">No Application Found</h2>
        <p className="text-gray-600 mb-6">You haven’t applied to become a caterer yet.</p>
        <button
          onClick={() => navigate("/become-a-caterer")}
          className="px-5 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
        >
          Apply Now
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 mt-10 bg-white shadow-lg rounded-xl text-center">
      <h2 className="text-2xl font-bold text-indigo-700 mb-4">Application Status</h2>

      {status === "pending" && (
        <>
          <p className="text-yellow-600 text-lg font-semibold">⏳ Pending</p>
          <p className="text-gray-700 mt-2">Your application is under review by our team.</p>
          <p className="text-sm text-gray-500 mt-1">You’ll be notified once it’s approved or rejected.</p>
        </>
      )}

      {status === "approved" && (
        <>
          <p className="text-green-600 text-lg font-semibold">✅ Approved</p>
          <p className="text-gray-700 mt-2">Welcome aboard 🎉 You can now manage your catering business.</p>
          <button
            onClick={goToDashboard}
            className="mt-5 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Go to Dashboard
          </button>
        </>
      )}

      {status === "rejected" && (
        <>
          <p className="text-red-600 text-lg font-semibold">❌ Rejected</p>
          <p className="text-gray-700 mt-2">Unfortunately, your application was rejected. Please Come back as per comments via Partner form. Till now you login as a normal user</p>
          {comments && (
            <div className="bg-red-50 border border-red-200 p-4 mt-3 rounded-lg text-left">
              <p className="text-sm text-red-700 font-medium">Admin Comments:</p>
              <p className="text-sm text-red-600">{comments}</p>
            </div>
          )}
          <button
            onClick={() => navigate("/become-a-caterer")}
            className="mt-5 px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Normal User
          </button>
        </>
      )}

      {!["pending", "approved", "rejected"].includes(status) && (
        <p className="text-gray-600">⚠️ Unknown status: {status}</p>
      )}
    </div>
  );
};

export default ApplicationStatus;