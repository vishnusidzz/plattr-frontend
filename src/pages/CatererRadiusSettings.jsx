import React, { useEffect, useState } from "react";
import axios from "../shared-lib/axiosInstance";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const CatererRadiusSettings = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [locationId, setLocationId] = useState(null);

    const [radius, setRadius] = useState("");
    const [saving, setSaving] = useState(false);
    const [currentRadius, setCurrentRadius] = useState(null);

    // ✅ Load my caterer locations (pick first approved/pending as your active)
    useEffect(() => {
        const fetchMyLocations = async () => {
            setLoading(true);
            try {
                const res = await axios.get("/api/caterer-locations/");
                const locations = Array.isArray(res.data) ? res.data : [];

                if (!locations.length) {
                    toast.error("No location found. Please add location first.");
                    setLoading(false);
                    return;
                }

                // ✅ Take first location as active
                const approved = locations.find(l => l.is_approved === true);
                const loc = approved || locations[0];
                setLocationId(loc.id);
                const saved = loc.service_radius_km ?? null;
                setCurrentRadius(saved);
                setRadius(saved !== null ? String(saved) : "");
            } catch (err) {
                console.error(err);
                toast.error("Failed to load caterer locations");
            } finally {
                setLoading(false);
            }
        };

        fetchMyLocations();
    }, []);

    const handleSave = async () => {
        if (!locationId) {
            toast.error("Location not found");
            return;
        }

        if (!radius || Number(radius) <= 0) {
            toast.error("Radius must be greater than 0");
            return;
        }

        setSaving(true);
        try {
            const res = await axios.patch(
                `/api/caterer-locations/${locationId}/update-radius/`,
                { service_radius_km: radius }
            );

            toast.success(`✅ Radius updated: ${res.data.service_radius_km} KM`);
            navigate("/caterer-dashboard"); // ✅ go back after save
        } catch (err) {
            console.error(err);
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.detail ||
                "Failed to update radius";
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-6">Loading radius settings...</div>;
    }

    return (
        <div className="max-w-xl mx-auto p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">📍 Service Radius Settings</h2>

                <button
                    onClick={() => navigate("/caterer-dashboard")}
                    className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                >
                    Back
                </button>
            </div>

            <div className="bg-white shadow rounded-xl p-5 border">

                {/*  Show recent/current radius */}
                <div className="mb-4 p-3 rounded-lg bg-gray-50 border">
                    <p className="text-sm text-gray-700">
                        <span className="font-semibold">Current Service Radius:</span>{" "}
                        {currentRadius !== null ? `${currentRadius} KM` : "Not set"}
                    </p>
                </div>

                <label className="text-sm font-semibold text-gray-700">
                    Update service radius (KM)
                </label>

                <input
                    type="number"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    placeholder="Example: 10"
                    className="w-full border rounded-lg p-3 mt-2 outline-none focus:ring-2 focus:ring-indigo-400"
                />

                <p className="text-xs text-gray-500 mt-2">
                    Customers will see your card only if their event location is inside this radius.
                </p>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`w-full mt-5 py-3 rounded-lg font-semibold text-white ${saving ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                >
                    {saving ? "Saving..." : "Save Radius"}
                </button>
            </div>
        </div>
    );
};

export default CatererRadiusSettings;