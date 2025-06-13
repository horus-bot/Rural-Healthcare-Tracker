import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    role: '',
    center_id: '',
    employee_id: '',
    designation: '',
    department: ''
  });
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch centers for dropdown
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const { data, error } = await supabase
          .from('centers')
          .select('id, name, type, district')
          .eq('is_active', true)
          .order('district', { ascending: true })
          .order('name', { ascending: true });
        
        if (error) throw error;
        setCenters(data || []);
      } catch (error) {
        console.error('Error fetching centers:', error);
      }
    };
    
    fetchCenters();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.full_name || !formData.role) {
      setError('Email, password, full name, and role are required');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Additional validation for staff/district_admin roles
    if (formData.role === 'staff' || formData.role === 'district_admin') {
      if (!formData.center_id && formData.role === 'staff') {
        setError('Center selection is required for staff members');
        return false;
      }
      if (!formData.employee_id) {
        setError('Employee ID is required for staff members');
        return false;
      }
      if (!formData.designation) {
        setError('Designation is required for staff members');
        return false;
      }
    }
    
    return true;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Prepare metadata for Supabase Auth
      const metadata = {
        full_name: formData.full_name,
        role: formData.role,
        phone: formData.phone || null,
        employee_id: formData.employee_id || null,
        designation: formData.designation || null,
        department: formData.department || null
      };

      // Only add center_code if it's provided
      if (formData.center_id) {
        metadata.center_code = formData.center_id;
      }

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: metadata
        }
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        setSuccess('Account created successfully! Please check your email for verification.');
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          full_name: '',
          phone: '',
          role: '',
          center_id: '',
          employee_id: '',
          designation: '',
          department: ''
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const isStaffRole = formData.role === 'staff' || formData.role === 'district_admin';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Rural Health Equipment Management System
          </p>
          <p className="mt-1 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
              {success}
            </div>
          )}

          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter your full name"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter your email address"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter your phone number"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter your password"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Confirm your password"
              />
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role *
              </label>
              <select
                id="role"
                name="role"
                required
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Select your role</option>
                <option value="public">Public User</option>
                <option value="staff">Healthcare Staff</option>
                <option value="district_admin">District Administrator</option>
              </select>
            </div>

            {/* Center Selection - Required for staff, optional for district_admin */}
            {(isStaffRole) && (
              <div>
                <label htmlFor="center_id" className="block text-sm font-medium text-gray-700">
                  Health Center {formData.role === 'staff' ? '*' : '(Optional)'}
                </label>
                <select
                  id="center_id"
                  name="center_id"
                  required={formData.role === 'staff'}
                  value={formData.center_id}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select a health center</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.id}>
                      {center.name} ({center.type}) - {center.district}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Employee ID - Required for staff roles */}
            {isStaffRole && (
              <div>
                <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700">
                  Employee ID *
                </label>
                <input
                  id="employee_id"
                  name="employee_id"
                  type="text"
                  required
                  value={formData.employee_id}
                  onChange={handleChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your employee ID"
                />
              </div>
            )}

            {/* Designation - Required for staff roles */}
            {isStaffRole && (
              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-gray-700">
                  Designation *
                </label>
                <select
                  id="designation"
                  name="designation"
                  required
                  value={formData.designation}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select your designation</option>
                  <option value="Medical Officer">Medical Officer</option>
                  <option value="Staff Nurse">Staff Nurse</option>
                  <option value="ANM">ANM (Auxiliary Nurse Midwife)</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Lab Technician">Lab Technician</option>
                  <option value="Radiographer">Radiographer</option>
                  <option value="Biomedical Engineer">Biomedical Engineer</option>
                  <option value="Maintenance Technician">Maintenance Technician</option>
                  <option value="Administrator">Administrator</option>
                  <option value="District Health Officer">District Health Officer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}

            {/* Department - Optional for staff roles */}
            {isStaffRole && (
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select department (optional)</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
                  <option value="Surgery">Surgery</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Laboratory">Laboratory</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Biomedical Engineering">Biomedical Engineering</option>
                  <option value="Administration">Administration</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            <p>* Required fields</p>
            <p className="mt-1">
              By signing up, you agree to the terms and conditions of the 
              Rural Health Equipment Management System.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
