import React, { useEffect, useState, useRef, forwardRef } from 'react';
import axiosInstance from '../shared-lib/axiosInstance'; // if one level deep
import { toast } from 'react-toastify';
import ConfirmModal from './ConfirmModal';

const AddCatererForm = forwardRef(({ onCatererAdded, editCaterer, setEditCaterer }, ref) => {
  const nameInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    business_name: '',
    contact_number: '',
    email: '',
    address: '',
    city: '',
    cuisine_type: 'Both Veg and Non-Veg',
    description: '',
    is_active: true,
  });

  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (editCaterer) {
      setFormData({
        name: editCaterer.name || '',
        business_name: editCaterer.business_name || '',
        contact_number: editCaterer.contact_number || '',
        email: editCaterer.email || '',
        address: editCaterer.address || '',
        city: editCaterer.city || '',
        cuisine_type: editCaterer.cuisine_type || 'Both Veg and Non-Veg',
        description: editCaterer.description || '',
        is_active: editCaterer.is_active ?? true,
        logo: null,
      });
      setLogo(null);
      setLogoPreview(editCaterer.logoUrl || null);

      // ✅ Smooth scroll to the form
       if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
     if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
    }
  }, [editCaterer, ref]);

  const validateForm = () => {
    const {
      name, business_name, contact_number, email,
      address, city, cuisine_type, description
    } = formData;

    if (!name || !business_name || !contact_number || !email ||
      !address || !city || !cuisine_type || !description) {
      toast.error('All fields must be filled.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
      return false;
    }

    const phoneRegex = /^\d{6,15}$/;
    if (!phoneRegex.test(contact_number)) {
      toast.error('Phone number must be 6–15 digits.');
      return false;
    }

    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setShowConfirm(true);
  };

  const handleConfirmAdd = async () => {
    setShowConfirm(false);

    const data = new FormData();
    for (const key in formData) {
      if (key !== 'logo') {
      data.append(key, formData[key]);
    }
    }
    if (logo) {
      data.append('logo', logo);
    }

    try {
      if (editCaterer) {
        await axiosInstance.put(`/api/caterers/${editCaterer.id}/`,data, {
          headers: {Authorization: `Bearer ${localStorage.getItem("accessToken")}`, 'Content-Type': 'multipart/form-data' },
         // Replace with actual token
        });
        toast.success('✅ Caterer updated successfully!');
      } else {
       await axiosInstance.post('/api/caterers/', data, {
          headers: {Authorization: `Bearer ${localStorage.getItem("accessToken")}`, 'Content-Type': 'multipart/form-data' },
          // Replace with actual token
        });
        toast.success('🎉 Caterer added successfully!');
      }

      onCatererAdded();
      clearForm();
      if (typeof setEditCaterer === 'function') {
        setEditCaterer(null);
      }

    } catch (err) {
      console.error('❌ Add/Edit caterer failed:', err);
      toast.error('Server error while submitting caterer.');
    }
  };

  const handleCancelAdd = () => {
    setShowConfirm(false);
    clearForm();
    toast.info('Action cancelled.');
  };

  const clearForm = () => {
    setFormData({
      name: '',
      business_name: '',
      contact_number: '',
      email: '',
      address: '',
      city: '',
      cuisine_type: 'Both Veg and Non-Veg',
      description: '',
      is_active: true,
    });
    setLogo(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogo(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <div ref={ref} className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
      <h3 className="text-2xl font-semibold mb-4 text-center text-indigo-600">
        {editCaterer ? '✏️ Edit Caterer' : 'Add New Caterer'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4" encType="multipart/form-data">
        {[
          { label: 'Name', name: 'name', max: 30 },
          { label: 'Business Name', name: 'business_name', max: 40 },
          { label: 'Contact Number', name: 'contact_number', max: 15 },
          { label: 'Email', name: 'email', type: 'email', max: 50 },
          { label: 'Address', name: 'address', max: 80 },
          { label: 'City', name: 'city', max: 25 },
          { label: 'Description', name: 'description', max: 200 },
        ].map(({ label, name, type = 'text', max }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label} <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type={type}
              name={name}
              maxLength={max}
              placeholder={`Enter ${label.toLowerCase()}`}
              value={formData[name]}
              onChange={handleChange}
              className="w-full border border-gray-300 p-2 rounded-md"
            />
            <p className="text-xs text-gray-400 mt-1">Max {max} characters</p>
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cuisine Type <span className="text-red-500">*</span>
          </label>
          <select
            name="cuisine_type"
            value={formData.cuisine_type}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded-md"
          >
            <option value="Veg">🥬 Only Veg</option>
            <option value="Non-Veg">🍗 Only Non-Veg</option>
            <option value="Both Veg and Non-Veg">🥦🍗 Both Veg & Non-Veg</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload Logo (optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="w-full border border-gray-300 p-2 rounded-md"
          />
          {logoPreview && (
            <img
              src={logoPreview}
              alt="Logo Preview"
              className="mt-2 w-24 h-24 object-cover rounded border"
            />
          )}
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="mr-2"
          />
          <label htmlFor="is_active">Active Caterer</label>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
        >
          {editCaterer ? 'Update Caterer' : 'Add Caterer'}
        </button>
        {editCaterer && (
  <button
    type="button"
    onClick={() => {
      clearForm();
      setEditCaterer(null);
    }}
    className="w-full mt-2 bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400"
  >
    ❌ Cancel Edit
  </button>
)}
      </form>

      {showConfirm && (
        <ConfirmModal
          title={editCaterer ? 'Confirm Update' : 'Confirm Add Caterer'}
          message={
            editCaterer
              ? "Do you want to update this caterer's details?"
              : "Do you want to add this caterer to the list?"
          }
          onConfirm={handleConfirmAdd}
          onCancel={handleCancelAdd}
        />
      )}
    </div>
  );
});

export default AddCatererForm;