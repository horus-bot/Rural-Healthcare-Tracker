import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from './UserContext';
import { supabase } from './services/supabaseClient';

const ProtectedRoute = ({ children, allowedRoles = [], requireAuth = true }) => {
  const { user, userProfile, loading } = useUser();
  const location = useLocation();

  console.log('ProtectedRoute check:', {
    path: location.pathname,
    hasUser: !!user,
    hasProfile: !!userProfile,
    userRole: userProfile?.role,
    allowedRoles,
    requireAuth,
    loading
  });

  // Show loading spinner while checking authentication
  if (loading) {
    console.log('ProtectedRoute: Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not logged in
  if (requireAuth && !user) {
    console.log('ProtectedRoute: Auth required but no user, redirecting to login');
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If user is not active
  if (user && userProfile && !userProfile.is_active) {
    console.log('ProtectedRoute: User account is inactive');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Account Deactivated</h3>
            <p className="mt-2 text-sm text-gray-500">
              Your account has been deactivated. Please contact your administrator for assistance.
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-4 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If specific roles are required, check user role
  if (allowedRoles.length > 0 && userProfile) {
    if (!allowedRoles.includes(userProfile.role)) {
      console.log('ProtectedRoute: Role not allowed', {
        userRole: userProfile.role,
        allowedRoles
      });
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
              <p className="mt-2 text-sm text-gray-500">
                You don't have permission to access this page. Your role: {userProfile.role}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Required roles: {allowedRoles.join(', ')}
              </p>
              <button
                onClick={() => window.history.back()}
                className="mt-4 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  console.log('ProtectedRoute: All checks passed, rendering children');
  // If all checks pass, render the protected component
  return children;
};

export default ProtectedRoute;
