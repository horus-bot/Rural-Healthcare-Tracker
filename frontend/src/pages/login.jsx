import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import './login.css'; 

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
      <div className="min-h-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Don't show login form if already authenticated
  if (isAuthenticated && userProfile) {
    return (
      <div className="min-h-screen">
        <div className="redirect-container">
          <div className="loading-spinner success"></div>
          <p className="redirect-text">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-md w-full space-y-8">
        <div className="header-container">
          <h2 className="text-3xl">Sign in to your account</h2>
          <p className="text-sm text-gray-600">Rural Health Equipment Management System</p>
        </div>
        
        <form className="login-form" onSubmit={handleLogin}>
          {(error || contextError) && (
            <div className="bg-red-50">
              {error || contextError}
            </div>
          )}

          <div className="form-fields">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your email address"
                disabled={loginLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your password"
                disabled={loginLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="login-button"
          >
            {loginLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="signup-link-container">
            <p className="signup-text">
              Don't have an account?{' '}
              <Link to="/signup" className="signup-link">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
