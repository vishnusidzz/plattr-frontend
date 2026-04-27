import React, { useEffect, useState } from "react";

/**
 * MenuItemModal (Web, Tailwind)
 *
 * Props:
 *  - visible (boolean)
 *  - item (object|null)
 *  - saving (boolean)
 *  - catererCuisine: "veg"|"nonveg"|"both" (expected lowercase)
 *  - onClose()
 *  - onSave(payload, id)
 */
export default function MenuItemModal({
  visible,
  item = null,
  saving = false,
  catererCuisine = "both",
  onClose = () => { },
  onSave = () => { },
}) {
  // normalize backend / incoming strings
  const normalizeCuisine = (raw) => {
    if (!raw) return null;
    const r = String(raw).toLowerCase();
    if (r.includes("non")) return "nonveg";
    if (r.includes("veg")) return "veg";
    return null;
  };

  const computeInitialCuisine = () => {
    const fromItem = normalizeCuisine(item?.cuisine);
    if (fromItem) return fromItem;
    if (catererCuisine === "veg") return "veg";
    if (catererCuisine === "nonveg") return "nonveg";
    return "veg";
  };

  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [price, setPrice] = useState(item?.price ? String(item.price) : "");
  const [cuisine, setCuisine] = useState(computeInitialCuisine());
  const [isAddon, setIsAddon] = useState(item?.is_addon ?? false);
  const [compositionType, setCompositionType] = useState(item?.composition_type || "main_course"); // NEW
  const [addToPackage, setAddToPackage] = useState(item?.add_to_package ?? false); // NEW

  useEffect(() => {
    if (!visible) return;
    setName(item?.name || "");
    setDescription(item?.description || "");
    setPrice(item?.price ? String(item.price) : "");
    setCuisine(computeInitialCuisine());
    setIsAddon(item?.is_addon ?? false);
    setCompositionType(item?.composition_type || "main_course");
    setAddToPackage(item?.add_to_package ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item, catererCuisine]);

  // NEW: when item type changes to Default Item (not addon),
  // force price to "0" and keep it read-only/disabled.
  useEffect(() => {
    if (!isAddon) {
      // default items are complimentary with price 0
      setPrice("0");
    } else {
      // if switching back to addon and the item has an original price, keep it or clear
      if (item?.price) {
        setPrice(String(item.price));
      } else {
        setPrice("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddon]);

  const submit = () => {
    if (!name.trim()) {
      window.alert("Name is required");
      return;
    }
    if (!compositionType) {
      window.alert("Composition type is required");
      return;
    }

    // If default item (not addon), price must be 0 regardless of the input
    const parsedPrice = isAddon ? (parseFloat(price) || 0) : 0;
    const cuisineForBackend = cuisine === "nonveg" ? "Non-Veg" : "Veg";

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      cuisine: cuisineForBackend,
      is_addon: !!isAddon,
      composition_type: compositionType,
      add_to_package: !!addToPackage,
    };

    onSave(payload, item?.id || null);
  };

  if (!visible) return null;

  const compositionOptions = [
    { key: "main_course", label: "Main Course" },
    { key: "rice", label: "Rice" },
    { key: "bread", label: "Bread" },
    { key: "dessert", label: "Dessert" },
    { key: "live_counter", label: "Live Counter" },
    { key: "drinks", label: "Drinks" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!saving) onClose();
        }}
      />

      <div className="relative max-w-2xl w-full mx-4 bg-white rounded-lg shadow-xl p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{item ? "Edit Item" : "Add Menu Item"}</h3>
          <button
            onClick={() => !saving && onClose()}
            className="text-gray-500 hover:text-gray-700 rounded-full p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 text-sm">
          {/* Name */}
          <div>
            <label className="block font-medium text-gray-700">Name</label>
            <input
              className="mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
            />
          </div>

          {/* Short description */}
          <div>
            <label className="block font-medium text-gray-700">Short Description</label>
            <input
              className="mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g. Perfect for weddings or parties"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block font-medium text-gray-700">Per Plate Price (₹)</label>
            <input
              className={`mt-1 block w-40 border rounded-md px-3 py-2 focus:outline-none ${!isAddon ? "bg-gray-100 cursor-not-allowed" : "focus:ring-2 focus:ring-indigo-200"}`}
              value={price}
              onChange={(e) => {
                // only allow price change when it's an addon
                if (!isAddon) return;
                setPrice(e.target.value.replace(/[^0-9.]/g, ""));
              }}
              placeholder="0.00"
              readOnly={!isAddon}
              disabled={!isAddon}
            />
            {!isAddon && (
              <div className="text-xs text-emerald-600 mt-1">
                ✅ Default items are complimentary and set to ₹0.
              </div>
            )}
          </div>

          {/* Cuisine */}
          <div>
            <label className="block font-medium text-gray-700">Cuisine</label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className={`px-3 py-1 rounded-md font-semibold transition ${cuisine === "veg"
                    ? "bg-green-600 text-white shadow"
                    : "bg-white border hover:bg-gray-50"
                  }`}
                onClick={() => setCuisine("veg")}
              >
                Veg
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-md font-semibold transition ${cuisine === "nonveg"
                    ? "bg-red-600 text-white shadow"
                    : "bg-white border hover:bg-gray-50"
                  }`}
                onClick={() => setCuisine("nonveg")}
              >
                Non-Veg
              </button>
            </div>
          </div>

          {/* Type of composition */}
          <div>
            <label className="block font-medium text-gray-700">Type of Composition</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {compositionOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`px-3 py-1 rounded-md text-sm font-medium transition ${compositionType === opt.key
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-white border hover:bg-gray-50"
                    }`}
                  onClick={() => setCompositionType(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type (Addon vs Default) */}
          <div>
            <label className="block font-medium text-gray-700">Item Type</label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className={`px-3 py-1 rounded-md font-semibold transition ${isAddon ? "bg-indigo-600 text-white" : "bg-white border hover:bg-gray-50"
                  }`}
                onClick={() => setIsAddon(true)}
              >
                Addon
              </button>
              <div>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md font-semibold transition ${!isAddon ? "bg-indigo-600 text-white" : "bg-white border hover:bg-gray-50"
                    }`}
                  onClick={() => setIsAddon(false)}
                >
                  Default Item
                </button>
                
              </div>
            </div>
          </div>

          {/* Add to Package */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={addToPackage}
              onChange={(e) => setAddToPackage(e.target.checked)}
            />
            <span>Add this item to packages</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => !saving && onClose()}
            className="px-4 py-2 rounded-md border bg-white text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>

          <button
            onClick={submit}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : item ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}