import React, { useEffect, useState } from "react";
import axios from "../shared-lib/axiosInstance";

export default function AdminCatererOverviewPage() {
    const [caterers, setCaterers] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);

    /* ---------------- Fetch All Caterers ---------------- */
    const fetchCaterers = async () => {
        try {
            const res = await axios.get("/api/admin/caterers/");
            setCaterers(res.data || []);
            if (res.data?.length) setSelectedId(res.data[0].id);
        } catch {
            alert("Failed to load caterers");
        }
    };

    /* ---------------- Fetch Caterer Overview ---------------- */
    const fetchOverview = async (id) => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/admin/caterers/${id}/overview/`);
            setData(res.data);
        } catch {
            alert("Failed to load overview");
        } finally {
            setLoading(false);
        }
    };

    /* ---------------- Verify Bank ---------------- */
    const verifyBank = async (bankId) => {
        if (!window.confirm("Approve this bank account?")) return;

        try {
            setVerifying(true);
            await axios.patch(
                `/api/admin/caterer-bank-accounts/${bankId}/verify/`,
                { is_verified: true }
            );
            fetchOverview(selectedId); // refresh overview
        } catch {
            alert("Bank verification failed");
        } finally {
            setVerifying(false);
        }
    };

    useEffect(() => {
        fetchCaterers();
    }, []);

    useEffect(() => {
        if (selectedId) fetchOverview(selectedId);
    }, [selectedId]);

    return (
        <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* LEFT: Caterer List */}
            <div className="border rounded-lg bg-white">
                <h3 className="p-4 font-semibold border-b">All Caterers</h3>
                <ul className="divide-y">
                    {caterers.map((c) => (
                        <li
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            className={`p-3 cursor-pointer hover:bg-indigo-50 ${selectedId === c.id ? "bg-indigo-100" : ""
                                }`}
                        >
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-gray-500">
                                {c.city} • {c.status}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>

            {/* RIGHT: Overview */}
            <div className="md:col-span-3">
                {loading && <p>Loading overview…</p>}
                {!loading && data && (
                    <CatererOverview
                        data={data}
                        onVerifyBank={verifyBank}
                        verifying={verifying}
                    />
                )}
            </div>
        </div>
    );
}

/* ================= Child UI ================= */

const CatererOverview = ({ data, onVerifyBank, verifying }) => {
    const {
        caterer,
        orders,
        revenue,
        audit_logs,
        bank_account,
    } = data;

    return (
        <div className="space-y-6">
            <div className="flex justify-between">
                <h1 className="text-2xl font-bold">{caterer.name}</h1>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">
                    {caterer.status}
                </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Info label="Total Orders" value={orders.stats.total} />
                <Info label="Active" value={orders.stats.active} />
                <Info label="Completed" value={orders.stats.completed} />
                <Info label="Cancelled" value={orders.stats.cancelled} />
                <Info label="Rejected" value={orders.stats.rejected} />
                <Info label="Pending Payout" value={`₹${revenue.pending_payout}`} />
            </div>

            {/* Bank Account */}
            <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Bank Account</h3>

                {!bank_account && (
                    <p className="text-sm text-red-600">No bank details submitted</p>
                )}

                {bank_account && (
                    <div className="space-y-2">
                        <p><b>Account Holder:</b> {bank_account.account_holder_name}</p>
                        <p><b>Bank:</b> {bank_account.bank_name}</p>
                        <p><b>Account No:</b> {bank_account.account_number}</p>
                        <p><b>IFSC:</b> {bank_account.ifsc_code}</p>

                        <span
                            className={`inline-block px-3 py-1 rounded-full text-xs ${bank_account.is_verified
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                        >
                            {bank_account.is_verified ? "Verified" : "Pending Verification"}
                        </span>

                        {!bank_account.is_verified && (
                            <button
                                disabled={verifying}
                                onClick={() => onVerifyBank(bank_account.id)}
                                className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                Approve Bank Account
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Audit Logs */}
            <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Audit Logs</h3>
                <ul className="space-y-2 text-sm">
                    {audit_logs.map((l, i) => (
                        <li key={i} className="border-l-4 border-indigo-400 pl-3">
                            <p className="font-medium">{l.action}</p>
                            <p className="text-gray-600">{l.reason}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const Info = ({ label, value }) => (
    <div className="bg-gray-50 border rounded-lg p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold">{value}</p>
    </div>
);