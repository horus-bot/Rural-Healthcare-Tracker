import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useUser } from '../UserContext';
import LogoutButton from '../components/LogoutButton';

const AdminDashboard = () => {
  const { user, userProfile, loading: userLoading } = useUser();
  const [dashboardData, setDashboardData] = useState({
    centerInfo: null,
    equipment: [],
    equipmentHistory: [],
    transfers: [],
    maintenanceRequests: [],
    notifications: [],
    loading: true,
    error: null
  });
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (userProfile && userProfile.id && !userLoading) {
      fetchDashboardData();
    }
  }, [userProfile, userLoading]);

  const fetchDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true, error: null }));

      // Validate userProfile before proceeding
      if (!userProfile || !userProfile.id) {
        throw new Error('User profile not available');
      }

      // Get center info based on user's center_id
      let centerId = userProfile.center_id;
      let centerInfo = null;

      if (centerId) {
        const { data: center, error: centerError } = await supabase
          .from('centers')
          .select('*')
          .eq('id', centerId)
          .single();

        if (centerError && centerError.code !== 'PGRST116') {
          console.error('Center fetch error:', centerError);
        } else {
          centerInfo = center;
        }
      }

      // Fetch equipment for the center (or all if district admin without specific center)
      let equipmentQuery = supabase
        .from('equipment')
        .select('*')
        .order('name');

      if (centerId) {
        equipmentQuery = equipmentQuery.eq('center_id', centerId);
      }

      const { data: equipment, error: equipmentError } = await equipmentQuery;

      if (equipmentError) {
        console.error('Equipment fetch error:', equipmentError);
        throw equipmentError;
      }

      const equipmentIds = equipment?.map(eq => eq.id) || [];

      // Fetch equipment history
      let historyData = [];
      if (equipmentIds.length > 0) {
        const { data: equipmentHistory, error: historyError } = await supabase
          .from('equipment_history')
          .select(`
            *,
            equipment:equipment_id (name, qr_code),
            changed_by_user:changed_by (full_name)
          `)
          .in('equipment_id', equipmentIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (historyError) {
          console.error('History fetch error:', historyError);
        } else {
          historyData = equipmentHistory || [];
        }
      }

      // Fetch equipment transfers
      let transfersData = [];
      if (centerId) {
        const { data: transfers, error: transferError } = await supabase
          .from('equipment_transfers')
          .select(`
            *,
            equipment:equipment_id (name, qr_code),
            from_center:from_center_id (name),
            to_center:to_center_id (name),
            requested_by_user:requested_by (full_name)
          `)
          .or(`from_center_id.eq.${centerId},to_center_id.eq.${centerId}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (transferError) {
          console.error('Transfer fetch error:', transferError);
        } else {
          transfersData = transfers || [];
        }
      }

      // Fetch maintenance requests
      let maintenanceData = [];
      if (equipmentIds.length > 0) {
        const { data: maintenanceRequests, error: maintenanceError } = await supabase
          .from('maintenance_requests')
          .select(`
            *,
            equipment:equipment_id (name, qr_code, center_id),
            requested_by_user:requested_by (full_name),
            assigned_to_user:assigned_to (full_name)
          `)
          .in('equipment_id', equipmentIds)
          .order('created_at', { ascending: false })
          .limit(30);

        if (maintenanceError) {
          console.error('Maintenance fetch error:', maintenanceError);
        } else {
          maintenanceData = maintenanceRequests || [];
        }
      }

      // Fetch notifications for current user - with proper validation
      let notificationsData = [];
      if (userProfile.id) {
        console.log('Fetching notifications for user ID:', userProfile.id); // Debug log
        
        const { data: notifications, error: notificationError } = await supabase
          .from('notifications')
          .select(`
            *,
            equipment:equipment_id (name, qr_code),
            center:center_id (name)
          `)
          .eq('user_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (notificationError) {
          console.error('Notification fetch error:', notificationError);
          // Don't throw here, just log the error and continue
        } else {
          notificationsData = notifications || [];
        }
      } else {
        console.warn('No user ID available for fetching notifications');
      }

      setDashboardData({
        centerInfo,
        equipment: equipment || [],
        equipmentHistory: historyData,
        transfers: transfersData,
        maintenanceRequests: maintenanceData,
        notifications: notificationsData,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || 'Failed to load dashboard data'
      }));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      working: 'bg-green-100 text-green-800',
      broken: 'bg-red-100 text-red-800',
      under_repair: 'bg-yellow-100 text-yellow-800',
      idle: 'bg-gray-100 text-gray-800',
      decommissioned: 'bg-red-100 text-red-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      approved: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Loading state
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading user profile...</p>
        </div>
      </div>
    );
  }

  // Error state for user profile
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-4">Unable to load user profile. Please try logging in again.</p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  // Debug log for user profile
  console.log('User Profile:', userProfile); // Debug log

  // Dashboard loading state
  if (dashboardData.loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LogoutButton />
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  const { centerInfo, equipment, equipmentHistory, transfers, maintenanceRequests, notifications, error } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50">
      <LogoutButton />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Debug Info - Remove in production */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm">
          <strong>Debug Info:</strong> User ID: {userProfile?.id || 'undefined'}, 
          Center ID: {userProfile?.center_id || 'undefined'}, 
          Role: {userProfile?.role || 'undefined'}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Dashboard Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back, {userProfile?.full_name || 'User'}</p>
              <div className="mt-2 text-sm text-gray-500">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {userProfile?.role === 'district_admin' ? 'District Administrator' : userProfile?.role}
                </span>
                {userProfile?.designation && (
                  <span className="ml-2 text-gray-600">{userProfile.designation}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              {centerInfo ? (
                <>
                  <h2 className="text-xl font-semibold text-blue-600">{centerInfo.name}</h2>
                  <p className="text-gray-600">{centerInfo.type}</p>
                  <p className="text-sm text-gray-500">{centerInfo.address}</p>
                </>
              ) : (
                <div className="text-gray-500">
                  <p>District-wide Access</p>
                  <p className="text-sm">Managing multiple centers</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Equipment</p>
                <p className="text-2xl font-semibold text-gray-900">{equipment.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Working Equipment</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {equipment.filter(eq => eq.status === 'working').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Needs Attention</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {equipment.filter(eq => ['broken', 'under_repair'].includes(eq.status)).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {maintenanceRequests.filter(req => req.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[{
                key: 'overview',
                label: 'Equipment Overview'
              },
              {
                key: 'history',
                label: 'Equipment History'
              },
              {
                key: 'transfers',
                label: 'Transfers'
              },
              {
                key: 'maintenance',
                label: 'Maintenance'
              },
              {
                key: 'notifications',
                label: `Notifications (${notifications.length})`
              }].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Equipment Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Equipment {centerInfo ? `in ${centerInfo.name}` : 'Overview'}
                  </h3>
                  <button
                    onClick={fetchDashboardData}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
                
                {equipment.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No equipment found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {centerInfo ? 'This center has no equipment registered.' : 'You may not have access to any centers.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {equipment.map(eq => (
                      <div 
                        key={eq.id} 
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                        onClick={() => setSelectedEquipment(eq)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900 truncate">{eq.name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${getStatusColor(eq.status)}`}>
                            {eq.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{eq.type} - {eq.category}</p>
                        <p className="text-sm text-gray-500 font-mono">{eq.qr_code}</p>
                        <p className="text-sm text-gray-500">{eq.location_within_center}</p>
                        {eq.is_critical && (
                          <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Critical Equipment
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Equipment History Tab */}
            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Equipment History</h3>
                {equipmentHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No equipment history available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changed By</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changes</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {equipmentHistory.map(history => (
                          <tr key={history.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{history.equipment?.name || 'Unknown Equipment'}</div>
                                <div className="text-sm text-gray-500 font-mono">{history.equipment?.qr_code}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {history.change_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {history.changed_by_user?.full_name || 'Unknown User'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="text-red-600">{history.old_value}</span>
                              <span className="mx-2 text-gray-400">→</span>
                              <span className="text-green-600">{history.new_value}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(history.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Equipment Transfers Tab */}
            {activeTab === 'transfers' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Equipment Transfers</h3>
                {transfers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No transfers found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From → To</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transfers.map(transfer => (
                          <tr key={transfer.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{transfer.equipment?.name || 'Unknown Equipment'}</div>
                                <div className="text-sm text-gray-500 font-mono">{transfer.equipment?.qr_code}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="space-y-1">
                                <div className="font-medium">{transfer.from_center?.name || 'Unknown Center'}</div>
                                <div className="text-xs text-gray-500 text-center">↓</div>
                                <div className="font-medium">{transfer.to_center?.name || 'Unknown Center'}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {transfer.requested_by_user?.full_name || 'Unknown User'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="max-w-xs truncate" title={transfer.transfer_reason}>
                                {transfer.transfer_reason}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(transfer.status)}`}>
                                {transfer.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(transfer.transfer_date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Maintenance Requests Tab */}
            {activeTab === 'maintenance' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance Requests</h3>
                {maintenanceRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No maintenance requests found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {maintenanceRequests.map(request => (
                      <div key={request.id} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{request.title}</h4>
                            <p className="text-sm text-gray-600">
                              {request.equipment?.name || 'Unknown Equipment'} ({request.equipment?.qr_code})
                            </p>
                            <p className="text-sm text-gray-600 mt-1">Request #{request.request_number}</p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                              {request.priority}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(request.status)}`}>
                              {request.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{request.description}</p>
                        <div className="flex flex-wrap justify-between items-center text-xs text-gray-500 gap-2">
                          <div className="flex flex-wrap gap-4">
                            <span>Requested by: {request.requested_by_user?.full_name || 'Unknown User'}</span>
                            {request.assigned_to_user && (
                              <span>Assigned to: {request.assigned_to_user.full_name}</span>
                            )}
                          </div>
                          <div className="flex gap-4">
                            {request.estimated_cost && (
                              <span>Cost: ₹{Number(request.estimated_cost).toLocaleString()}</span>
                            )}
                            <span>{new Date(request.requested_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Notifications</h3>
                {notifications.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19H6.931A1.922 1.922 0 015 17.087V8c0-.552.224-1.052.586-1.414S6.448 6 7 6h10c.552 0 1.052.224 1.414.586S19 7.448 19 8v4.069" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications</h3>
                    <p className="mt-1 text-sm text-gray-500">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map(notification => (
                      <div 
                        key={notification.id} 
                        className={`border rounded-lg p-4 transition-colors ${
                          notification.is_read ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-200 shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <h4 className="font-medium text-gray-900">{notification.title}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                                {notification.priority}
                              </span>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {notification.type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{notification.message}</p>
                            {notification.equipment && (
                              <p className="text-xs text-gray-500">
                                Equipment: {notification.equipment.name} ({notification.equipment.qr_code})
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </div>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-auto"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Equipment Detail Modal */}
        {selectedEquipment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedEquipment.name}</h3>
                  <p className="text-sm text-gray-500 font-mono mt-1">{selectedEquipment.qr_code}</p>
                </div>
                <button 
                  onClick={() => setSelectedEquipment(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Basic Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Status:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEquipment.status)}`}>
                          {selectedEquipment.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Type:</span>
                        <span className="text-sm text-gray-900">{selectedEquipment.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Category:</span>
                        <span className="text-sm text-gray-900">{selectedEquipment.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Manufacturer:</span>
                        <span className="text-sm text-gray-900">{selectedEquipment.manufacturer || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Model:</span>
                        <span className="text-sm text-gray-900">{selectedEquipment.model || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Serial Number:</span>
                        <span className="text-sm text-gray-900 font-mono">{selectedEquipment.serial_number || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Location & Financial</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Location:</span>
                        <span className="text-sm text-gray-900">{selectedEquipment.location_within_center || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Purchase Cost:</span>
                        <span className="text-sm text-gray-900">
                          {selectedEquipment.purchase_cost ? `₹${Number(selectedEquipment.purchase_cost).toLocaleString()}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Current Value:</span>
                        <span className="text-sm text-gray-900">
                          {selectedEquipment.current_value ? `₹${Number(selectedEquipment.current_value).toLocaleString()}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Dates & Maintenance</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Installation Date:</span>
                        <span className="text-sm text-gray-900">
                          {selectedEquipment.installation_date ? 
                            new Date(selectedEquipment.installation_date).toLocaleDateString() : 
                            'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Warranty Expires:</span>
                        <span className="text-sm text-gray-900">
                          {selectedEquipment.warranty_expiry_date ? 
                            new Date(selectedEquipment.warranty_expiry_date).toLocaleDateString() : 
                            'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Next Maintenance:</span>
                        <span className="text-sm text-gray-900">
                          {selectedEquipment.next_maintenance_due ? 
                            new Date(selectedEquipment.next_maintenance_due).toLocaleDateString() : 
                            'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Critical Equipment:</span>
                        <span className={`text-sm font-medium ${selectedEquipment.is_critical ? 'text-red-600' : 'text-gray-600'}`}>
                          {selectedEquipment.is_critical ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedEquipment.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Notes</h4>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{selectedEquipment.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedEquipment.specifications && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Technical Specifications</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <pre className="text-sm text-gray-900 whitespace-pre-wrap overflow-x-auto">
                      {typeof selectedEquipment.specifications === 'string' 
                        ? selectedEquipment.specifications 
                        : JSON.stringify(selectedEquipment.specifications, null, 2)
                      }
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
