import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useUser } from '../UserContext';
import LogoutButton from '../components/LogoutButton';
import './AdminDashboard.css';

// Simple Chart Components
const PieChart = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  
  const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="flex items-center justify-center">
        <svg width="200" height="200" className="mr-6">
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            
            const x1 = 100 + 80 * Math.cos((startAngle * Math.PI) / 180);
            const y1 = 100 + 80 * Math.sin((startAngle * Math.PI) / 180);
            const x2 = 100 + 80 * Math.cos((endAngle * Math.PI) / 180);
            const y2 = 100 + 80 * Math.sin((endAngle * Math.PI) / 180);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const pathData = [
              `M 100 100`,
              `L ${x1} ${y1}`,
              `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');
            
            currentAngle += angle;
            
            return (
              <path
                key={index}
                d={pathData}
                fill={colors[index % colors.length]}
                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                style={{
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
                }}
              />
            );
          })}
        </svg>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center">
              <div 
                className="w-4 h-4 rounded mr-2"
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              <span className="text-sm font-medium">{item.label}: {item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BarChart = ({ data, title }) => {
  const maxValue = Math.max(...data.map(item => item.value));
  
  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center">
            <div className="w-24 text-sm font-medium text-gray-700 mr-3">
              {item.label}
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  background: `linear-gradient(90deg, ${item.color || '#667eea'}, ${item.color || '#764ba2'})`,
                  width: `${(item.value / maxValue) * 100}%`,
                  boxShadow: `0 2px 8px ${item.color || '#667eea'}40`
                }}
              ></div>
              <span className="absolute right-2 top-0 h-full flex items-center text-xs font-bold text-white">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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
      working: 'status-working',
      broken: 'status-broken',
      under_repair: 'status-under-repair',
      idle: 'status-idle',
      decommissioned: 'status-broken'
    };
    return colors[status] || 'status-idle';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'priority-critical',
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low'
    };
    return colors[priority] || 'priority-low';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      completed: 'bg-green-500 text-white',
      approved: 'bg-blue-500 text-white',
      pending: 'bg-yellow-500 text-white',
      in_progress: 'bg-blue-500 text-white',
      rejected: 'bg-red-500 text-white',
      cancelled: 'bg-gray-500 text-white'
    };
    return colors[status] || 'bg-gray-500 text-white';
  };

  // Chart data preparation
  const equipmentStatusData = [
    { label: 'Working', value: dashboardData.equipment.filter(eq => eq.status === 'working').length, color: '#4CAF50' },
    { label: 'Broken', value: dashboardData.equipment.filter(eq => eq.status === 'broken').length, color: '#f44336' },
    { label: 'Under Repair', value: dashboardData.equipment.filter(eq => eq.status === 'under_repair').length, color: '#FF9800' },
    { label: 'Idle', value: dashboardData.equipment.filter(eq => eq.status === 'idle').length, color: '#9E9E9E' }
  ].filter(item => item.value > 0);

  const maintenancePriorityData = [
    { label: 'Critical', value: dashboardData.maintenanceRequests.filter(req => req.priority === 'critical').length, color: '#d32f2f' },
    { label: 'High', value: dashboardData.maintenanceRequests.filter(req => req.priority === 'high').length, color: '#FF5722' },
    { label: 'Medium', value: dashboardData.maintenanceRequests.filter(req => req.priority === 'medium').length, color: '#FF9800' },
    { label: 'Low', value: dashboardData.maintenanceRequests.filter(req => req.priority === 'low').length, color: '#4CAF50' }
  ].filter(item => item.value > 0);

  // Loading state
  if (userLoading) {
    return (
      <div className="admin-dashboard flex items-center justify-center">
        <div className="flex flex-col items-center bounce-in">
          <div className="loading-spinner w-16 h-16 rounded-full mb-6"></div>
          <p className="text-white text-xl font-semibold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state for user profile
  if (!userProfile) {
    return (
      <div className="admin-dashboard flex items-center justify-center">
        <div className="text-center fade-in">
          <h2 className="text-3xl font-bold text-white mb-4">Profile Not Found</h2>
          <p className="text-white mb-6">Unable to load user profile. Please try logging in again.</p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  // Dashboard loading state
  if (dashboardData.loading) {
    return (
      <div className="admin-dashboard">
        <LogoutButton />
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center bounce-in">
            <div className="loading-spinner w-20 h-20 rounded-full mb-6"></div>
            <p className="text-white text-xl font-semibold">Loading Dashboard Data...</p>
          </div>
        </div>
      </div>
    );
  }

  const { centerInfo, equipment, equipmentHistory, transfers, maintenanceRequests, notifications, error } = dashboardData;

  return (
    <div className="admin-dashboard">
      <LogoutButton />
      
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Debug Info - Remove in production */}
        <div className="debug-info rounded-xl p-4 text-sm fade-in">
          <strong>🔧 Debug Info:</strong> User ID: {userProfile?.id || 'undefined'}, 
          Center ID: {userProfile?.center_id || 'undefined'}, 
          Role: {userProfile?.role || 'undefined'}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500 text-white rounded-xl p-4 fade-in">
            <div className="flex items-center">
              <svg className="h-6 w-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold">Dashboard Error</h3>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="dashboard-header rounded-2xl p-8 fade-in">
          <div className="flex justify-between items-start">
            <div className="slide-in-left">
              <h1 className="dashboard-title">Admin Dashboard</h1>
              <p className="text-gray-600 mt-2 text-lg">Welcome back, {userProfile?.full_name || 'User'}</p>
              <div className="mt-4 flex items-center space-x-4">
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold">
                  {userProfile?.role === 'district_admin' ? '👨‍💼 District Administrator' : `👤 ${userProfile?.role}`}
                </span>
                {userProfile?.designation && (
                  <span className="text-gray-600 font-medium">{userProfile.designation}</span>
                )}
              </div>
            </div>
            <div className="text-right slide-in-left">
              {centerInfo ? (
                <>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {centerInfo.name}
                  </h2>
                  <p className="text-gray-600 font-medium">{centerInfo.type}</p>
                  <p className="text-sm text-gray-500">{centerInfo.address}</p>
                </>
              ) : (
                <div className="text-gray-500">
                  <p className="text-xl font-semibold">🌐 District-wide Access</p>
                  <p className="text-sm">Managing multiple centers</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[{
            title: "Total Equipment",
            value: equipment.length,
            icon: "📊",
            gradient: "from-blue-500 to-blue-600",
            bgColor: "bg-blue-100"
          },
          {
            title: "Working Equipment",
            value: equipment.filter(eq => eq.status === 'working').length,
            icon: "✅",
            gradient: "from-green-500 to-green-600",
            bgColor: "bg-green-100"
          },
          {
            title: "Needs Attention",
            value: equipment.filter(eq => ['broken', 'under_repair'].includes(eq.status)).length,
            icon: "⚠️",
            gradient: "from-red-500 to-red-600",
            bgColor: "bg-red-100"
          },
          {
            title: "Pending Requests",
            value: maintenanceRequests.filter(req => req.status === 'pending').length,
            icon: "🔧",
            gradient: "from-yellow-500 to-yellow-600",
            bgColor: "bg-yellow-100"
          }
        ].map((stat, index) => (
            <div key={index} className={`stats-card rounded-2xl p-6 bounce-in`} style={{animationDelay: `${index * 0.1}s`}}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`stats-icon p-4 rounded-2xl ${stat.bgColor}`}>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bounce-in" style={{animationDelay: '0.2s'}}>
            <PieChart 
              data={equipmentStatusData} 
              title="📈 Equipment Status Distribution" 
            />
          </div>
          <div className="bounce-in" style={{animationDelay: '0.3s'}}>
            <BarChart 
              data={maintenancePriorityData} 
              title="🔧 Maintenance Priority Levels" 
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tab-navigation rounded-2xl shadow-2xl fade-in">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8">
              {[{
                key: 'overview',
                label: '🏠 Equipment Overview',
                icon: '🏠'
              },
              {
                key: 'history',
                label: '📜 Equipment History',
                icon: '📜'
              },
              {
                key: 'transfers',
                label: '🔄 Transfers',
                icon: '🔄'
              },
              {
                key: 'maintenance',
                label: '🔧 Maintenance',
                icon: '🔧'
              },
              {
                key: 'notifications',
                label: `🔔 Notifications (${notifications.length})`,
                icon: '🔔'
              }].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`tab-button py-6 px-2 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === tab.key ? 'active' : ''
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {/* Equipment Overview Tab */}
            {activeTab === 'overview' && (
              <div className="fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">
                    🏠 Equipment {centerInfo ? `in ${centerInfo.name}` : 'Overview'}
                  </h3>
                  <button
                    onClick={fetchDashboardData}
                    className="refresh-button px-6 py-3 rounded-xl font-semibold transition-all duration-300"
                  >
                    <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Data
                  </button>
                </div>
                
                {equipment.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Equipment Found</h3>
                    <p className="text-gray-500">
                      {centerInfo ? 'This center has no equipment registered.' : 'You may not have access to any centers.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {equipment.map((eq, index) => (
                      <div 
                        key={eq.id} 
                        className="equipment-card rounded-2xl p-6 cursor-pointer bounce-in"
                        style={{animationDelay: `${index * 0.05}s`}}
                        onClick={() => setSelectedEquipment(eq)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-bold text-gray-900 text-lg truncate">{eq.name}</h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(eq.status)}`}>
                            {eq.status}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2 font-medium">{eq.type} - {eq.category}</p>
                        <p className="text-gray-500 font-mono text-sm bg-gray-100 px-2 py-1 rounded">{eq.qr_code}</p>
                        <p className="text-gray-500 mt-2">📍 {eq.location_within_center}</p>
                        {eq.is_critical && (
                          <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold priority-critical">
                            🚨 Critical Equipment
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
              <div className="fade-in">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">📜 Recent Equipment History</h3>
                {equipmentHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📝</div>
                    <p className="text-gray-500 text-lg">No equipment history available</p>
                  </div>
                ) : (
                  <div className="data-table">
                    <table className="min-w-full">
                      <thead className="table-header">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Equipment</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Change Type</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Changed By</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Changes</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {equipmentHistory.map((history, index) => (
                          <tr key={history.id} className="table-row slide-in-left" style={{animationDelay: `${index * 0.05}s`}}>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-semibold text-gray-900">{history.equipment?.name || 'Unknown Equipment'}</div>
                                <div className="text-sm text-gray-500 font-mono">{history.equipment?.qr_code}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                                {history.change_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {history.changed_by_user?.full_name || 'Unknown User'}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-red-600 font-semibold">{history.old_value}</span>
                              <span className="mx-2 text-gray-400">→</span>
                              <span className="text-green-600 font-semibold">{history.new_value}</span>
                            </td>
                            <td className="px-6 py-4 text-gray-500 font-medium">
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
              <div className="fade-in">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🔄 Equipment Transfers</h3>
                {transfers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📦</div>
                    <p className="text-gray-500 text-lg">No transfers found</p>
                  </div>
                ) : (
                  <div className="data-table">
                    <table className="min-w-full">
                      <thead className="table-header">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Equipment</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">From → To</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Requested By</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Reason</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transfers.map((transfer, index) => (
                          <tr key={transfer.id} className="table-row slide-in-left" style={{animationDelay: `${index * 0.05}s`}}>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-semibold text-gray-900">{transfer.equipment?.name || 'Unknown Equipment'}</div>
                                <div className="text-sm text-gray-500 font-mono">{transfer.equipment?.qr_code}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="font-semibold text-blue-600">{transfer.from_center?.name || 'Unknown Center'}</div>
                                <div className="text-center text-gray-400">↓</div>
                                <div className="font-semibold text-green-600">{transfer.to_center?.name || 'Unknown Center'}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {transfer.requested_by_user?.full_name || 'Unknown User'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="max-w-xs truncate font-medium text-gray-700" title={transfer.transfer_reason}>
                                {transfer.transfer_reason}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(transfer.status)}`}>
                                {transfer.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500 font-medium">
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
              <div className="fade-in">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🔧 Maintenance Requests</h3>
                {maintenanceRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">🛠️</div>
                    <p className="text-gray-500 text-lg">No maintenance requests found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {maintenanceRequests.map((request, index) => (
                      <div key={request.id} className="equipment-card rounded-2xl p-6 slide-in-left" style={{animationDelay: `${index * 0.05}s`}}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-lg">{request.title}</h4>
                            <p className="text-gray-600 font-medium">
                              {request.equipment?.name || 'Unknown Equipment'} ({request.equipment?.qr_code})
                            </p>
                            <p className="text-gray-600 mt-1 font-mono text-sm">Request #{request.request_number}</p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(request.priority)}`}>
                              {request.priority}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(request.status)}`}>
                              {request.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-700 mb-4 font-medium leading-relaxed">{request.description}</p>
                        <div className="flex flex-wrap justify-between items-center text-sm text-gray-500 gap-2">
                          <div className="flex flex-wrap gap-4">
                            <span className="font-medium">👤 Requested by: {request.requested_by_user?.full_name || 'Unknown User'}</span>
                            {request.assigned_to_user && (
                              <span className="font-medium">🔧 Assigned to: {request.assigned_to_user.full_name}</span>
                            )}
                          </div>
                          <div className="flex gap-4">
                            {request.estimated_cost && (
                              <span className="font-semibold text-green-600">💰 Cost: ₹{Number(request.estimated_cost).toLocaleString()}</span>
                            )}
                            <span className="font-medium">📅 {new Date(request.requested_date).toLocaleDateString()}</span>
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
              <div className="fade-in">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🔔 Recent Notifications</h3>
                {notifications.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">🔕</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Notifications</h3>
                    <p className="text-gray-500 text-lg">You're all caught up! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notifications.map((notification, index) => (
                      <div 
                        key={notification.id} 
                        className={`rounded-2xl p-6 transition-all duration-300 slide-in-left ${
                          notification.is_read ? 'notification-read' : 'notification-unread'
                        }`}
                        style={{animationDelay: `${index * 0.05}s`}}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2 flex-wrap">
                              <h4 className="font-bold text-gray-900 text-lg">{notification.title}</h4>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(notification.priority)}`}>
                                {notification.priority}
                              </span>
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500 text-white">
                                {notification.type}
                              </span>
                            </div>
                            <p className="text-gray-700 mb-3 font-medium leading-relaxed">{notification.message}</p>
                            {notification.equipment && (
                              <p className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-lg inline-block">
                                🔧 Equipment: {notification.equipment.name} ({notification.equipment.qr_code})
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-6">
                            <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                              📅 {new Date(notification.created_at).toLocaleDateString()}
                            </div>
                            {!notification.is_read && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 ml-auto animate-pulse"></div>
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
          <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="modal-content rounded-3xl p-8 max-w-6xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-bold text-gray-900">{selectedEquipment.name}</h3>
                  <p className="text-lg text-gray-500 font-mono mt-2 bg-gray-100 px-3 py-1 rounded-lg inline-block">{selectedEquipment.qr_code}</p>
                </div>
                <button 
                  onClick={() => setSelectedEquipment(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                      <span className="mr-2">📋</span> Basic Information
                    </h4>
                    <div className="space-y-3">
                      {[{
                        label: 'Status',
                        value: selectedEquipment.status,
                        special: true
                      },
                      {
                        label: 'Type',
                        value: selectedEquipment.type
                      },
                      {
                        label: 'Category',
                        value: selectedEquipment.category
                      },
                      {
                        label: 'Manufacturer',
                        value: selectedEquipment.manufacturer || 'N/A'
                      },
                      {
                        label: 'Model',
                        value: selectedEquipment.model || 'N/A'
                      },
                      {
                        label: 'Serial Number',
                        value: selectedEquipment.serial_number || 'N/A',
                        mono: true
                      }
                    ].map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="font-medium text-gray-600">{item.label}:</span>
                          {item.special ? (
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(item.value)}`}>
                              {item.value}
                            </span>
                          ) : (
                            <span className={`font-semibold text-gray-900 ${item.mono ? 'font-mono text-sm' : ''}`}>
                              {item.value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                      <span className="mr-2">💰</span> Location & Financial
                    </h4>
                    <div className="space-y-3">
                      {[{
                        label: 'Location',
                        value: selectedEquipment.location_within_center || 'N/A'
                      },
                      {
                        label: 'Purchase Cost',
                        value: selectedEquipment.purchase_cost ? `₹${Number(selectedEquipment.purchase_cost).toLocaleString()}` : 'N/A'
                      },
                      {
                        label: 'Current Value',
                        value: selectedEquipment.current_value ? `₹${Number(selectedEquipment.current_value).toLocaleString()}` : 'N/A'
                      }
                    ].map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="font-medium text-gray-600">{item.label}:</span>
                          <span className="font-semibold text-gray-900">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                      <span className="mr-2">📅</span> Dates & Maintenance
                    </h4>
                    <div className="space-y-3">
                      {[{
                        label: 'Installation Date',
                        value: selectedEquipment.installation_date ? new Date(selectedEquipment.installation_date).toLocaleDateString() : 'N/A'
                      },
                      {
                        label: 'Warranty Expires',
                        value: selectedEquipment.warranty_expiry_date ? new Date(selectedEquipment.warranty_expiry_date).toLocaleDateString() : 'N/A'
                      },
                      {
                        label: 'Next Maintenance',
                        value: selectedEquipment.next_maintenance_due ? new Date(selectedEquipment.next_maintenance_due).toLocaleDateString() : 'N/A'
                      },
                      {
                        label: 'Critical Equipment',
                        value: selectedEquipment.is_critical ? 'Yes' : 'No',
                        critical: selectedEquipment.is_critical
                      }
                    ].map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="font-medium text-gray-600">{item.label}:</span>
                          <span className={`font-semibold ${item.critical ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedEquipment.notes && (
                    <div className="bg-gray-50 rounded-2xl p-6">
                      <h4 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">📝</span> Notes
                      </h4>
                      <p className="text-gray-900 bg-white p-4 rounded-xl font-medium leading-relaxed">
                        {selectedEquipment.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {selectedEquipment.specifications && (
                <div className="mt-8 bg-gray-50 rounded-2xl p-6">
                  <h4 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                    <span className="mr-2">⚙️</span> Technical Specifications
                  </h4>
                  <div className="bg-white p-6 rounded-xl">
                    <pre className="text-sm text-gray-900 whitespace-pre-wrap overflow-x-auto font-mono">
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
