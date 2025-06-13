import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './UserContext';
import Login from './pages/login';
import Signup from './pages/signup';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import PublicDashboard from './pages/PublicDashboard';
import ProtectedRoute from './ProtectedRoute';
import { useUser } from './UserContext';

// Component to redirect to appropriate dashboard based on user role
const DashboardRedirect = () => {
  const { userProfile, loading } = useUser();
  
  console.log('DashboardRedirect - userProfile:', userProfile, 'loading:', loading);
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!userProfile) {
    console.log('No user profile found, redirecting to login');
    return <Navigate to="/" replace />;
  }
  
  console.log('Redirecting based on role:', userProfile.role);
  
  switch (userProfile.role) {
    case 'district_admin':
      return <Navigate to="/admin-dashboard" replace />;
    case 'staff':
      return <Navigate to="/staff-dashboard" replace />;
    case 'public':
      return <Navigate to="/public-dashboard" replace />;
    default:
      console.warn('Unknown role in DashboardRedirect:', userProfile.role);
      return <Navigate to="/" replace />;
  }
};

function App() {
  console.log('App component rendering');
  
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes - Role-specific dashboards */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={['district_admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard"
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/public-dashboard"
            element={
              <ProtectedRoute allowedRoles={['public']}>
                <PublicDashboard />
              </ProtectedRoute>
            }
          />

          {/* General dashboard route that redirects based on role */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardRedirect />
              </ProtectedRoute>
            } 
          />

          {/* Catch all route - redirect to login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
