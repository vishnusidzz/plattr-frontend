import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../shared-lib/axiosInstance";

/*
  Behavior:
   - Renders a compact header: average rating, stars, review count.
   - Hover on the little rating chip shows a breakdown popover.
   - Clicking "More comments" opens modal which fetches and shows full reviews.
   - Defensive parsing for API shapes: array or DRF-style { results, count, next }.
   - Fallback: if /api/caterers/:id/reviews/ returns 401/403, switch to /api/reviews/?caterer=<id>
*/

function RatingStars({ value = 0 }) {
    const v = Math.round(Number(value || 0));
    return (
        <div className="flex items-center gap-0.5" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
                <svg
                    key={i}
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill={i < v ? "currentColor" : "none"}
                    className={`text-yellow-500 ${i < v ? "" : "stroke-current text-gray-300"}`}
                >
                    <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.2 1 5.8L10 14.8 4.8 18.7l1-5.8L1.5 8.7l5.9-.9L10 1.5z" />
                </svg>
            ))}
        </div>
    );
}

function RatingBreakdownPopover({ reviews = [], open = false, onSeeAll = () => { } }) {
    const dist = useMemo(() => {
        const d = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        (reviews || []).forEach((r) => {
            const rr = Math.max(1, Math.min(5, Math.round(Number(r.rating || 0))));
            d[rr] = (d[rr] || 0) + 1;
        });
        const total = (reviews || []).length || 1;
        return { d, total };
    }, [reviews]);

    if (!open) return null;
    return (
        <div className="w-72 bg-white rounded-lg shadow-xl border p-4 text-sm z-[9999]">
            <div className="text-sm font-semibold mb-2">Rating breakdown</div>
            {[5, 4, 3, 2, 1].map((star) => {
                const count = dist.d[star] || 0;
                const pct = Math.round((count / dist.total) * 100);
                return (
                    <div key={star} className="flex items-center gap-2 mb-2">
                        <div className="w-6 text-xs text-gray-600">{star}★</div>
                        <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                            <div style={{ width: `${pct}%` }} className="h-2 bg-orange-400 rounded" />
                        </div>
                        <div className="w-8 text-right text-xs text-gray-500">{pct}%</div>
                    </div>
                );
            })}
            <div className="mt-3 text-xs text-gray-500">Total reviews: {dist.total}</div>
            <div className="mt-3 text-right">
                <button onClick={onSeeAll} className="text-indigo-600 text-xs underline">See customer reviews</button>
            </div>
        </div>
    );
}

export default function CatererReviews({ catererId, initial = null }) {
    const [reviews, setReviews] = useState(initial?.results || []);
    const [count, setCount] = useState(initial?.count ?? (initial?.results?.length ?? 0));
    const [loading, setLoading] = useState(!initial);
    const [error, setError] = useState(null);
    const [nextUrl, setNextUrl] = useState(initial?.next ?? null);
    const [loadingMore, setLoadingMore] = useState(false);

    // pagination page (used when falling back to /api/reviews/?caterer=)
    const [page, setPage] = useState(1);

    // UI state
    const [modalOpen, setModalOpen] = useState(false);
    const [ratingPopoverOpen, setRatingPopoverOpen] = useState(false);
    const hoverRef = useRef(null);

    // helpful/likes map (optimistic)
    const [helpfulMap, setHelpfulMap] = useState({});

    // whether to use the public fallback endpoint /api/reviews/?caterer=
    const [useFallbackReviewsEndpoint, setUseFallbackReviewsEndpoint] = useState(false);

    // Helper to normalize response (both array or paginated DRF)
    const normalizeResponse = (resData) => {
        if (Array.isArray(resData)) {
            return { results: resData, count: resData.length, next: null };
        }
        return {
            results: resData.results || [],
            count: resData.count ?? (Array.isArray(resData.results) ? resData.results.length : 0),
            next: resData.next ?? null,
        };
    };

    // fetch summary/page 1 (used to compute average and counts)
    const fetchReviews = useCallback(async (requestedPage = 1) => {
        setLoading(true);
        setError(null);

        // if we've already decided to use fallback, call fallback directly
        if (useFallbackReviewsEndpoint) {
            try {
                const res = await axiosInstance.get(`/api/reviews/`, {
                    params: { caterer: catererId, page: requestedPage, page_size: 10 },
                });
                const norm = normalizeResponse(res.data);
                setReviews(norm.results || []);
                setCount(norm.count || 0);
                setNextUrl(norm.next || null);
                setPage(requestedPage);

                // init helpfulMap using common backend names (norm exists here)
                setHelpfulMap((prev) => {
                    const copy = { ...(prev || {}) };
                    (norm.results || []).forEach((r) => {
                        copy[r.id] = Number(r.helpful_count ?? r.helpfuls ?? r.useful_count ?? r.thumbs_up_count ?? r.helpful ?? 0);
                    });
                    return copy;
                });
            } catch (err) {
                console.error("CatererReviews: fallback fetch failed", err);
                setError("Failed to load reviews");
            } finally {
                setLoading(false);
            }
            return;
        }

        // Try primary endpoint first (/api/caterers/:id/reviews/)
        try {
            const res = await axiosInstance.get(`/api/caterers/${catererId}/reviews/`, {
                params: { page: requestedPage, page_size: 10 },
            });

            const norm = normalizeResponse(res.data);
            setReviews(norm.results || []);
            setCount(norm.count || 0);
            setNextUrl(norm.next || null);
            setPage(requestedPage);

            // init helpfulMap using common backend names (norm exists here)
            setHelpfulMap((prev) => {
                const copy = { ...(prev || {}) };
                (norm.results || []).forEach((r) => {
                    copy[r.id] = Number(r.helpful_count ?? r.helpfuls ?? r.useful_count ?? r.thumbs_up_count ?? r.helpful ?? 0);
                });
                return copy;
            });
        } catch (err) {
            const status = err?.response?.status;
            // If endpoint is protected for some reason, switch to public fallback
            if (status === 401 || status === 403) {
                console.warn("CatererReviews: /api/caterers/:id/reviews/ requires auth — falling back to /api/reviews/?caterer=");
                setUseFallbackReviewsEndpoint(true);
                try {
                    const res = await axiosInstance.get(`/api/reviews/`, {
                        params: { caterer: catererId, page: requestedPage, page_size: 10 },
                    });
                    const norm = normalizeResponse(res.data);
                    setReviews(norm.results || []);
                    setCount(norm.count || 0);
                    setNextUrl(norm.next || null);
                    setPage(requestedPage);

                    setHelpfulMap((prev) => {
                        const copy = { ...(prev || {}) };
                        (norm.results || []).forEach((r) => {
                            copy[r.id] = Number(r.helpful_count ?? r.helpfuls ?? r.useful_count ?? r.thumbs_up_count ?? r.helpful ?? 0);
                        });
                        return copy;
                    });
                } catch (err2) {
                    console.error("CatererReviews: fallback fetch failed", err2);
                    setError("Failed to load reviews");
                } finally {
                    setLoading(false);
                }
                return;
            }

            console.error("CatererReviews: failed to fetch reviews", err);
            setError("Failed to load reviews");
        } finally {
            setLoading(false);
        }
    }, [catererId, useFallbackReviewsEndpoint]);

    // load more using nextUrl if available; if using fallback, request next page param
    const loadMore = useCallback(async () => {
        // If using fallback, increment page and fetch that page
        if (useFallbackReviewsEndpoint) {
            const nextPage = (page || 1) + 1;
            setLoadingMore(true);
            try {
                const res = await axiosInstance.get(`/api/reviews/`, {
                    params: { caterer: catererId, page: nextPage, page_size: 10 },
                });
                const norm = normalizeResponse(res.data);
                setReviews((prev) => [...(prev || []), ...(norm.results || [])]);
                setNextUrl(norm.next || null);
                setPage(nextPage);

                setHelpfulMap((prev) => {
                    const cp = { ...(prev || {}) };
                    (norm.results || []).forEach((r) => {
                        cp[r.id] = Number(r.helpful_count ?? r.helpfuls ?? r.useful_count ?? r.thumbs_up_count ?? r.helpful ?? 0);
                    });
                    return cp;
                });
            } catch (err) {
                console.error("CatererReviews: fallback loadMore failed", err);
                setError("Failed to load more reviews");
            } finally {
                setLoadingMore(false);
            }
            return;
        }

        // Not using fallback: try to use the nextUrl returned by primary endpoint
        if (!nextUrl) return;
        setLoadingMore(true);
        try {
            const res = await axiosInstance.get(nextUrl);
            const norm = normalizeResponse(res.data);
            setReviews((prev) => [...(prev || []), ...(norm.results || [])]);
            setNextUrl(norm.next || null);
            // page isn't tracked for primary endpoint; but if we want to keep page consistent:
            setPage((p) => (p || 1) + 1);

            setHelpfulMap((prev) => {
                const cp = { ...(prev || {}) };
                (norm.results || []).forEach((r) => {
                    cp[r.id] = Number(r.helpful_count ?? r.helpfuls ?? r.useful_count ?? r.thumbs_up_count ?? r.helpful ?? 0);
                });
                return cp;
            });
        } catch (err) {
            const status = err?.response?.status;
            // If nextUrl fails due to auth, flip to fallback and load using fallback next page
            if (status === 401 || status === 403) {
                console.warn("CatererReviews: nextUrl requires auth; switching to fallback");
                setUseFallbackReviewsEndpoint(true);
                // fetch next page of fallback
                const nextPage = (page || 1) + 1;
                try {
                    const res = await axiosInstance.get(`/api/reviews/`, {
                        params: { caterer: catererId, page: nextPage, page_size: 10 },
                    });
                    const norm = normalizeResponse(res.data);
                    setReviews((prev) => [...(prev || []), ...(norm.results || [])]);
                    setNextUrl(norm.next || null);
                    setPage(nextPage);

                    setHelpfulMap((prev) => {
                        const cp = { ...(prev || {}) };
                        (norm.results || []).forEach((r) => {
                            cp[r.id] = Number(r.helpful_count ?? r.helpfuls ?? r.useful_count ?? r.thumbs_up_count ?? r.helpful ?? 0);
                        });
                        return cp;
                    });
                } catch (err2) {
                    console.error("CatererReviews: fallback loadMore also failed", err2);
                    setError("Failed to load more reviews");
                }
            } else {
                console.error("CatererReviews: loadMore failed", err);
                setError("Failed to load more reviews");
            }
        } finally {
            setLoadingMore(false);
        }
    }, [nextUrl, catererId, page, useFallbackReviewsEndpoint]);

    // initial fetch (unless initial prop provided)
    useEffect(() => {
        if (!initial) {
            fetchReviews(1);
        } else {
            // ensure helpfulMap and count initialized from initial
            setHelpfulMap((prev) => {
                const cp = { ...(prev || {}) };
                (initial.results || []).forEach((r) => {
                    cp[r.id] = Number(r.helpful_count ?? r.helpfuls ?? r.useful_count ?? r.thumbs_up_count ?? r.helpful ?? 0);
                });
                return cp;
            });
            setReviews(initial.results || []);
            setCount(initial.count ?? (initial.results?.length ?? 0));
            setNextUrl(initial.next ?? null);
            setPage(1);
            setLoading(false);
        }
    }, [initial, fetchReviews]);

    // open modal: fetch fresh page 1 before opening modal so modal always has latest comments
    const openModal = useCallback(async () => {
        setModalOpen(true);
        try {
            await fetchReviews(1);
        } catch {
            // fetchReviews logs errors
        }
    }, [fetchReviews]);

    // thumbs / helpful optimistic
    const handleHelpful = async (reviewId) => {
        const prev = helpfulMap[reviewId] || { count: 0, marked: false };
        const newMarked = !prev.marked; // toggle
        const newCount = prev.count + (newMarked ? 1 : -1);

        // optimistic UI update
        setHelpfulMap((prevMap) => ({
            ...prevMap,
            [reviewId]: { count: Math.max(0, newCount), marked: newMarked },
        }));

        try {
            const res = await axiosInstance.post(`/api/reviews/${reviewId}/thumbs_up/`);
            setHelpfulMap((prevMap) => ({
                ...prevMap,
                [reviewId]: {
                    count: Number(res.data?.helpful_count ?? newCount),
                    marked: res.data?.helpful ?? newMarked, // backend should return helpful true/false
                },
            }));
        } catch (err) {
            console.error("CatererReviews: helpful toggle failed", err);
            // rollback
            setHelpfulMap((prevMap) => ({
                ...prevMap,
                [reviewId]: prev,
            }));
        }
    };

    // compute average rating
    const averageRating = useMemo(() => {
        if (!reviews || reviews.length === 0) return 0;
        const sum = reviews.reduce((s, r) => s + (Number(r.rating || 0)), 0);
        return +(sum / reviews.length).toFixed(1);
    }, [reviews]);

    // Hover handlers for popover
    const handleMouseEnter = () => {
        if (hoverRef.current) {
            clearTimeout(hoverRef.current);
            hoverRef.current = null;
        }
        setRatingPopoverOpen(true);
    };
    const handleMouseLeave = () => {
        if (hoverRef.current) clearTimeout(hoverRef.current);
        hoverRef.current = setTimeout(() => {
            setRatingPopoverOpen(false);
            hoverRef.current = null;
        }, 150);
    };

    return (
        <div className="mt-2 text-left w-full">
            {/* Compact header only (no inline review rows) */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-3">

                {/* LEFT: Rating summary + title */}
                <div className="flex items-start gap-3">
                    {/* Rating box */}
                    <div className="flex flex-col items-center justify-center px-3 py-2 rounded-md
                    bg-gradient-to-br from-yellow-50 to-orange-50 border shrink-0">
                        <div className="text-2xl font-extrabold text-gray-900">
                            {(reviews && reviews.length) ? averageRating.toFixed(1) : "0.0"}
                        </div>

                        <div className="flex items-center gap-1 mt-1">
                            <RatingStars value={averageRating} />
                        </div>

                        <div className="text-[11px] text-gray-500 mt-1">
                            {count ? `${count} ratings` : "0 ratings"}
                        </div>
                    </div>

                    {/* Title + description */}
                    <div className="flex flex-col min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                            Reviews
                        </h3>

                        <div className="text-sm text-gray-500 mt-1 leading-snug">
                            Honest feedback from customers.
                            <button
                                onClick={openModal}
                                className="ml-1 text-indigo-600 font-medium hover:underline"
                            >
                                More comments
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Rating mini card */}
                <div
                    className="relative w-full lg:w-auto"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Clickable / hover card */}
                    <button
                        type="button"
                        onClick={() => {
                            // Mobile: tap opens modal instead of hover
                            if (window.innerWidth < 1024) openModal();
                        }}
                        onFocus={handleMouseEnter}
                        onBlur={handleMouseLeave}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white shadow-sm w-full sm:w-64 text-left active:scale-[0.98]"
                        aria-haspopup="dialog"
                        aria-expanded={ratingPopoverOpen}
                    >
                        <div className="text-sm font-semibold text-gray-800">
                            {(reviews && reviews.length) ? averageRating.toFixed(1) : "0.0"}
                        </div>

                        <div className="flex items-center">
                            <RatingStars value={averageRating} />
                        </div>

                        <div className="text-xs text-gray-400">•</div>

                        <div className="text-xs text-gray-500">
                            {count ? `${count}` : "0"} reviews
                        </div>
                    </button>

                    {/* Hover popover — DESKTOP ONLY */}
                    <div className="hidden lg:block absolute right-0 mt-2 z-[9999]">
                        <div
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            tabIndex={-1}
                        >
                            <RatingBreakdownPopover
                                reviews={reviews}
                                open={ratingPopoverOpen}
                                onSeeAll={openModal}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* nothing rendered inline for top reviews (per your request) */}

            {/* Modal: all reviews */}
            {modalOpen && (
                <div
                    className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 px-3 sm:px-6"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setModalOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="
        bg-white w-full max-w-3xl
        max-h-[90vh] sm:max-h-[85vh]
        rounded-xl shadow-2xl
        flex flex-col
        overflow-hidden
      "
                    >
                        {/* ===== Sticky Header ===== */}
                        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
                            <div>
                                <div className="text-lg font-semibold">All reviews</div>
                                <div className="text-xs text-gray-500">{count} total</div>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
                            >
                                Close
                            </button>
                        </div>

                        {/* ===== Scrollable Content ===== */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                            {loading ? (
                                <div className="text-sm text-gray-500 text-center py-10">
                                    Loading reviews…
                                </div>
                            ) : error ? (
                                <div className="text-sm text-red-600 text-center py-10">
                                    {error}
                                </div>
                            ) : (!reviews || reviews.length === 0) ? (
                                <div className="text-sm text-gray-500 text-center py-10">
                                    No reviews available.
                                </div>
                            ) : (
                                reviews.map((r) => {
                                    const helpful = Number(
                                        helpfulMap[r.id] ??
                                        r.helpful_count ??
                                        r.helpfuls ??
                                        r.useful_count ??
                                        r.thumbs_up_count ??
                                        r.helpful ??
                                        0
                                    );
                                    const isHelpful = !!helpfulMap[r.id]?.marked;
                                    const helpfulCount = Number(helpfulMap[r.id]?.count ?? helpful);

                                    return (
                                        <div
                                            key={r.id}
                                            className="bg-white border rounded-xl p-4 shadow-sm"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                                                {/* Left */}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-semibold text-gray-800 truncate">
                                                            {r.user_name || r.caterer_name || `User ${r.user}`}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {r.created_at &&
                                                                `• ${new Date(r.created_at).toLocaleDateString()}`}
                                                        </div>
                                                    </div>

                                                    {r.body && (
                                                        <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">
                                                            {r.body}
                                                        </div>
                                                    )}

                                                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                                                        <div className="flex items-center gap-1">
                                                            <RatingStars value={r.rating} />
                                                            <span>{r.rating}/5</span>
                                                        </div>
                                                        {r.verified && (
                                                            <span className="px-2 py-0.5 rounded bg-gray-100">
                                                                Verified
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right */}
                                                <div className="flex sm:flex-col items-end gap-1 shrink-0">
                                                    <button
                                                        onClick={() => handleHelpful(r.id)}
                                                        className={`text-xs px-3 py-1 rounded-md border transition ${isHelpful
                                                                ? "text-indigo-600 border-indigo-600 font-semibold"
                                                                : "text-gray-600 hover:bg-gray-50"
                                                            }`}
                                                    >
                                                        {isHelpful ? "Helpful ✓" : "Helpful"} · {helpfulCount}
                                                    </button>
                                                    {r.is_hidden && (
                                                        <div className="text-[11px] text-gray-400">
                                                            Hidden
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Photos */}
                                            {Array.isArray(r.photos) && r.photos.length > 0 && (
                                                <div className="mt-3 flex gap-2 overflow-x-auto">
                                                    {r.photos
                                                        .filter(p => p?.image)
                                                        .map(p => (
                                                            <img
                                                                key={p.id}
                                                                src={p.image}
                                                                alt="review"
                                                                className="w-20 h-20 object-cover rounded-lg"
                                                            />
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* ===== Footer ===== */}
                        <div className="border-t px-4 py-3 flex justify-center">
                            {(useFallbackReviewsEndpoint
                                ? Boolean(page && reviews.length < count)
                                : Boolean(nextUrl)) ? (
                                <button
                                    disabled={loadingMore}
                                    onClick={loadMore}
                                    className="px-5 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60"
                                >
                                    {loadingMore ? "Loading…" : "Load more"}
                                </button>
                            ) : (
                                <div className="text-xs text-gray-400">
                                    No more reviews
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}