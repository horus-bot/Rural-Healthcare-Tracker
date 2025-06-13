import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';

const Login = () => {
  const navigate = useNavigate();
  const { userProfile, isAuthenticated, loading, hasValidProfile, error: contextError } = useUser();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle redirect ONLY after successful login
  useEffect(() => {
    if (!loading && isAuthenticated && hasValidProfile && userProfile) {
      console.log('✅ Login successful, redirecting to:', userProfile.role);
      
      switch (userProfile.role) {
        case 'district_admin':
          navigate('/admin-dashboard', { replace: true });
          break;
        case 'staff':
          navigate('/staff-dashboard', { replace: true });
          break;
        case 'public':
          navigate('/public-dashboard', { replace: true });
          break;
        default:
          navigate('/dashboard', { replace: true });
      }
    }
  }, [loading, isAuthenticated, hasValidProfile, userProfile, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return;
    }
    
    setLoginLoading(true);
    setError('');
    
    try {
      console.log('🔐 Attempting login for:', formData.email);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        console.error('❌ Login failed:', authError.message);
        setError(authError.message.includes('Invalid') ? 'Invalid email or password' : authError.message);
        return;
      }

      if (!authData.user) {
        setError('Login failed. Please try again.');
        return;
      }

      console.log('✅ Login successful for:', authData.user.email);
      // UserContext will handle profile fetching and redirect
      
    } catch (error) {
      console.error('❌ Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Don't show anything if we're in the middle of authenticating
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Don't show login form if already authenticated
  if (isAuthenticated && userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-sm text-gray-600">Rural Health Equipment Management System</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {(error || contextError) && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error || contextError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter your email address"
                disabled={loginLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter your password"
                disabled={loginLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loginLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign up
              </Link>
            </p>
            <div className="mt-4 text-xs text-gray-500">
              <p><strong>Test accounts:</strong></p>
              <p>Admin: test@gmail.com</p>
              <p>Public: test1@harsh.com</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
