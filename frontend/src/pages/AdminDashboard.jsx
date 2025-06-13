// Example: AdminDashboard.jsx
import LogoutButton from '../components/LogoutButton';
import { useUser } from '../UserContext';

function AdminDashboard() {
  const { userProfile, userCenter } = useUser();

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading user profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LogoutButton />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Admin Dashboard - Welcome, {userProfile.full_name}!
            </h1>
            
            <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4 mb-6">
              <h2 className="text-lg font-medium text-indigo-900 mb-2">Administrator Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-indigo-800">
                <div>
                  <p><strong>Role:</strong> District Administrator</p>
                  <p><strong>Employee ID:</strong> {userProfile.employee_id}</p>
                  <p><strong>Designation:</strong> {userProfile.designation}</p>
                </div>
                <div>
                  <p><strong>Department:</strong> {userProfile.department}</p>
                  <p><strong>Email:</strong> {userProfile.email}</p>
                  {userProfile.phone && <p><strong>Phone:</strong> {userProfile.phone}</p>}
                </div>
              </div>
              {userCenter && (
                <div className="mt-3 pt-3 border-t border-indigo-300">
                  <p><strong>Primary Center:</strong> {userCenter.name} ({userCenter.type}) - {userCenter.district}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Centers</h3>
                <p className="text-gray-600 mb-4">Oversee all health centers in the district.</p>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                  View Centers
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Equipment Reports</h3>
                <p className="text-gray-600 mb-4">District-wide equipment status and reports.</p>
                <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                  View Reports
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Staff</h3>
                <p className="text-gray-600 mb-4">Manage staff accounts and permissions.</p>
                <button className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">
                  Manage Staff
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">System Settings</h3>
                <p className="text-gray-600 mb-4">Configure system settings and preferences.</p>
                <button className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
