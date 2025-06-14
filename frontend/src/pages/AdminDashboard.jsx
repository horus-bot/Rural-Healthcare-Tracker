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
                className="chart-path"
              />
            );
          })}
        </svg>
        <div className="chart-legend">
          {data.map((item, index) => (
            <div key={index} className="legend-item">
              <div 
                className="legend-color"
                data-color={colors[index % colors.length]}
              ></div>
              <span className="legend-text">{item.label}: {item.value}</span>
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
      <div className="bar-chart-container">
        {data.map((item, index) => (
          <div key={index} className="bar-item">
            <div className="bar-label">
              {item.label}
            </div>
            <div className="bar-track">
              <div 
                className="bar-fill"
                data-color={item.color}
                data-width={`${(item.value / maxValue) * 100}%`}
              >
                <span className="bar-value">{item.value}</span>
              </div>
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

      if (!userProfile || !userProfile.id) {
        throw new Error('User profile not available');
      }

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

      let notificationsData = [];
      if (userProfile.id) {
        console.log('Fetching notifications for user ID:', userProfile.id);
        
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
      completed: 'status-completed',
      approved: 'status-approved',
      pending: 'status-pending',
      in_progress: 'status-in-progress',
      rejected: 'status-rejected',
      cancelled: 'status-cancelled'
    };
    return colors[status] || 'status-default';
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
      <div className="admin-dashboard dashboard-loading">
        <div className="loading-container bounce-in">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state for user profile
  if (!userProfile) {
    return (
      <div className="admin-dashboard dashboard-error">
        <div className="error-container fade-in">
          <h2 className="error-title">Profile Not Found</h2>
          <p className="error-message">Unable to load user profile. Please try logging in again.</p>
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
        <div className="dashboard-loading-content">
          <div className="loading-container bounce-in">
            <div className="loading-spinner loading-spinner-large"></div>
            <p className="loading-text">Loading Dashboard Data...</p>
          </div>
        </div>
      </div>
    );
  }

  const { centerInfo, equipment, equipmentHistory, transfers, maintenanceRequests, notifications, error } = dashboardData;

  return (
    <div className="admin-dashboard">
      <LogoutButton />
      
      <div className="dashboard-container">
        {/* Debug Info */}
        <div className="debug-info fade-in">
          <strong>🔧 Debug Info:</strong> User ID: {userProfile?.id || 'undefined'}, 
          Center ID: {userProfile?.center_id || 'undefined'}, 
          Role: {userProfile?.role || 'undefined'}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="error-alert fade-in">
            <div className="error-alert-content">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="error-alert-title">Dashboard Error</h3>
                <p className="error-alert-message">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="dashboard-header fade-in">
          <div className="dashboard-header-content">
            <div className="dashboard-header-left slide-in-left">
              <h1 className="dashboard-title">Admin Dashboard</h1>
              <p className="dashboard-subtitle">Welcome back, {userProfile?.full_name || 'User'}</p>
              <div className="dashboard-user-info">
                <span className="user-role-badge">
                  {userProfile?.role === 'district_admin' ? '👨‍💼 District Administrator' : `👤 ${userProfile?.role}`}
                </span>
                {userProfile?.designation && (
                  <span className="user-designation">{userProfile.designation}</span>
                )}
              </div>
            </div>
            <div className="dashboard-header-right slide-in-left">
              {centerInfo ? (
                <>
                  <h2 className="center-name">{centerInfo.name}</h2>
                  <p className="center-type">{centerInfo.type}</p>
                  <p className="center-address">{centerInfo.address}</p>
                </>
              ) : (
                <div className="district-access">
                  <p className="district-title">🌐 District-wide Access</p>
                  <p className="district-subtitle">Managing multiple centers</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stats-card stats-card-1 bounce-in">
            <div className="stats-card-content">
              <div className="stats-info">
                <p className="stats-label">Total Equipment</p>
                <p className="stats-value">{equipment.length}</p>
              </div>
              <div className="stats-icon stats-icon-blue">
                <span>📊</span>
              </div>
            </div>
          </div>
          
          <div className="stats-card stats-card-2 bounce-in">
            <div className="stats-card-content">
              <div className="stats-info">
                <p className="stats-label">Working Equipment</p>
                <p className="stats-value">{equipment.filter(eq => eq.status === 'working').length}</p>
              </div>
              <div className="stats-icon stats-icon-green">
                <span>✅</span>
              </div>
            </div>
          </div>
          
          <div className="stats-card stats-card-3 bounce-in">
            <div className="stats-card-content">
              <div className="stats-info">
                <p className="stats-label">Needs Attention</p>
                <p className="stats-value">{equipment.filter(eq => ['broken', 'under_repair'].includes(eq.status)).length}</p>
              </div>
              <div className="stats-icon stats-icon-red">
                <span>⚠️</span>
              </div>
            </div>
          </div>
          
          <div className="stats-card stats-card-4 bounce-in">
            <div className="stats-card-content">
              <div className="stats-info">
                <p className="stats-label">Pending Requests</p>
                <p className="stats-value">{maintenanceRequests.filter(req => req.status === 'pending').length}</p>
              </div>
              <div className="stats-icon stats-icon-yellow">
                <span>🔧</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          <div className="chart-wrapper bounce-in">
            <PieChart 
              data={equipmentStatusData} 
              title="📈 Equipment Status Distribution" 
            />
          </div>
          <div className="chart-wrapper bounce-in">
            <BarChart 
              data={maintenancePriorityData} 
              title="🔧 Maintenance Priority Levels" 
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tab-navigation fade-in">
          <div className="tab-nav-header">
            <nav className="tab-nav">
              <button
                onClick={() => setActiveTab('overview')}
                className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              >
                <span>🏠</span>
                Equipment Overview
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
              >
                <span>📜</span>
                Equipment History
              </button>
              <button
                onClick={() => setActiveTab('transfers')}
                className={`tab-button ${activeTab === 'transfers' ? 'active' : ''}`}
              >
                <span>🔄</span>
                Transfers
              </button>
              <button
                onClick={() => setActiveTab('maintenance')}
                className={`tab-button ${activeTab === 'maintenance' ? 'active' : ''}`}
              >
                <span>🔧</span>
                Maintenance
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
              >
                <span>🔔</span>
                Notifications ({notifications.length})
              </button>
            </nav>
          </div>

          <div className="tab-content">
            {/* Equipment Overview Tab */}
            {activeTab === 'overview' && (
              <div className="tab-panel fade-in">
                <div className="tab-panel-header">
                  <h3 className="tab-panel-title">
                    🏠 Equipment {centerInfo ? `in ${centerInfo.name}` : 'Overview'}
                  </h3>
                  <button
                    onClick={fetchDashboardData}
                    className="refresh-button"
                  >
                    <svg className="refresh-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Data
                  </button>
                </div>
                
                {equipment.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h3 className="empty-title">No Equipment Found</h3>
                    <p className="empty-message">
                      {centerInfo ? 'This center has no equipment registered.' : 'You may not have access to any centers.'}
                    </p>
                  </div>
                ) : (
                  <div className="equipment-grid">
                    {equipment.map((eq, index) => (
                      <div 
                        key={eq.id} 
                        className="equipment-card bounce-in"
                        onClick={() => setSelectedEquipment(eq)}
                      >
                        <div className="equipment-card-header">
                          <h4 className="equipment-name">{eq.name}</h4>
                          <span className={`status-badge ${getStatusColor(eq.status)}`}>
                            {eq.status}
                          </span>
                        </div>
                        <p className="equipment-type">{eq.type} - {eq.category}</p>
                        <p className="equipment-qr">{eq.qr_code}</p>
                        <p className="equipment-location">📍 {eq.location_within_center}</p>
                        {eq.is_critical && (
                          <span className="critical-badge">
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
              <div className="tab-panel fade-in">
                <h3 className="tab-panel-title">📜 Recent Equipment History</h3>
                {equipmentHistory.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <p className="empty-message">No equipment history available</p>
                  </div>
                ) : (
                  <div className="data-table">
                    <table className="table">
                      <thead className="table-header">
                        <tr>
                          <th className="table-th">Equipment</th>
                          <th className="table-th">Change Type</th>
                          <th className="table-th">Changed By</th>
                          <th className="table-th">Changes</th>
                          <th className="table-th">Date</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {equipmentHistory.map((history, index) => (
                          <tr key={history.id} className="table-row slide-in-left">
                            <td className="table-td">
                              <div className="equipment-info">
                                <div className="equipment-info-name">{history.equipment?.name || 'Unknown Equipment'}</div>
                                <div className="equipment-info-qr">{history.equipment?.qr_code}</div>
                              </div>
                            </td>
                            <td className="table-td">
                              <span className="change-type-badge">
                                {history.change_type}
                              </span>
                            </td>
                            <td className="table-td">
                              <span className="user-name">{history.changed_by_user?.full_name || 'Unknown User'}</span>
                            </td>
                            <td className="table-td">
                              <div className="change-values">
                                <span className="old-value">{history.old_value}</span>
                                <span className="arrow">→</span>
                                <span className="new-value">{history.new_value}</span>
                              </div>
                            </td>
                            <td className="table-td">
                              <span className="date-text">{new Date(history.created_at).toLocaleDateString()}</span>
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
              <div className="tab-panel fade-in">
                <h3 className="tab-panel-title">🔄 Equipment Transfers</h3>
                {transfers.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <p className="empty-message">No transfers found</p>
                  </div>
                ) : (
                  <div className="data-table">
                    <table className="table">
                      <thead className="table-header">
                        <tr>
                          <th className="table-th">Equipment</th>
                          <th className="table-th">From → To</th>
                          <th className="table-th">Requested By</th>
                          <th className="table-th">Reason</th>
                          <th className="table-th">Status</th>
                          <th className="table-th">Date</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {transfers.map((transfer, index) => (
                          <tr key={transfer.id} className="table-row slide-in-left">
                            <td className="table-td">
                              <div className="equipment-info">
                                <div className="equipment-info-name">{transfer.equipment?.name || 'Unknown Equipment'}</div>
                                <div className="equipment-info-qr">{transfer.equipment?.qr_code}</div>
                              </div>
                            </td>
                            <td className="table-td">
                              <div className="transfer-centers">
                                <div className="from-center">{transfer.from_center?.name || 'Unknown Center'}</div>
                                <div className="transfer-arrow">↓</div>
                                <div className="to-center">{transfer.to_center?.name || 'Unknown Center'}</div>
                              </div>
                            </td>
                            <td className="table-td">
                              <span className="user-name">{transfer.requested_by_user?.full_name || 'Unknown User'}</span>
                            </td>
                            <td className="table-td">
                              <div className="transfer-reason" title={transfer.transfer_reason}>
                                {transfer.transfer_reason}
                              </div>
                            </td>
                            <td className="table-td">
                              <span className={`status-badge ${getStatusBadgeColor(transfer.status)}`}>
                                {transfer.status}
                              </span>
                            </td>
                            <td className="table-td">
                              <span className="date-text">{new Date(transfer.transfer_date).toLocaleDateString()}</span>
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
              <div className="tab-panel fade-in">
                <h3 className="tab-panel-title">🔧 Maintenance Requests</h3>
                {maintenanceRequests.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🛠️</div>
                    <p className="empty-message">No maintenance requests found</p>
                  </div>
                ) : (
                  <div className="maintenance-list">
                    {maintenanceRequests.map((request, index) => (
                      <div key={request.id} className="maintenance-card slide-in-left">
                        <div className="maintenance-card-header">
                          <div className="maintenance-info">
                            <h4 className="maintenance-title">{request.title}</h4>
                            <p className="maintenance-equipment">
                              {request.equipment?.name || 'Unknown Equipment'} ({request.equipment?.qr_code})
                            </p>
                            <p className="maintenance-request-number">Request #{request.request_number}</p>
                          </div>
                          <div className="maintenance-badges">
                            <span className={`priority-badge ${getPriorityColor(request.priority)}`}>
                              {request.priority}
                            </span>
                            <span className={`status-badge ${getStatusBadgeColor(request.status)}`}>
                              {request.status}
                            </span>
                          </div>
                        </div>
                        <p className="maintenance-description">{request.description}</p>
                        <div className="maintenance-meta">
                          <div className="maintenance-users">
                            <span className="requested-by">👤 Requested by: {request.requested_by_user?.full_name || 'Unknown User'}</span>
                            {request.assigned_to_user && (
                              <span className="assigned-to">🔧 Assigned to: {request.assigned_to_user.full_name}</span>
                            )}
                          </div>
                          <div className="maintenance-details">
                            {request.estimated_cost && (
                              <span className="estimated-cost">💰 Cost: ₹{Number(request.estimated_cost).toLocaleString()}</span>
                            )}
                            <span className="request-date">📅 {new Date(request.requested_date).toLocaleDateString()}</span>
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
              <div className="tab-panel fade-in">
                <h3 className="tab-panel-title">🔔 Recent Notifications</h3>
                {notifications.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔕</div>
                    <h3 className="empty-title">No Notifications</h3>
                    <p className="empty-message">You're all caught up! 🎉</p>
                  </div>
                ) : (
                  <div className="notifications-list">
                    {notifications.map((notification, index) => (
                      <div 
                        key={notification.id} 
                        className={`notification-card slide-in-left ${
                          notification.is_read ? 'notification-read' : 'notification-unread'
                        }`}
                      >
                        <div className="notification-content">
                          <div className="notification-main">
                            <div className="notification-header">
                              <h4 className="notification-title">{notification.title}</h4>
                              <div className="notification-badges">
                                <span className={`priority-badge ${getPriorityColor(notification.priority)}`}>
                                  {notification.priority}
                                </span>
                                <span className="notification-type-badge">
                                  {notification.type}
                                </span>
                              </div>
                            </div>
                            <p className="notification-message">{notification.message}</p>
                            {notification.equipment && (
                              <p className="notification-equipment">
                                🔧 Equipment: {notification.equipment.name} ({notification.equipment.qr_code})
                              </p>
                            )}
                          </div>
                          <div className="notification-side">
                            <div className="notification-date">
                              📅 {new Date(notification.created_at).toLocaleDateString()}
                            </div>
                            {!notification.is_read && (
                              <div className="notification-indicator"></div>
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
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <div className="modal-title-section">
                  <h3 className="modal-title">{selectedEquipment.name}</h3>
                  <p className="modal-qr">{selectedEquipment.qr_code}</p>
                </div>
                <button 
                  onClick={() => setSelectedEquipment(null)}
                  className="modal-close"
                >
                  <svg className="modal-close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="modal-sections">
                  <div className="modal-section">
                    <div className="info-section">
                      <h4 className="info-section-title">
                        <span>📋</span> Basic Information
                      </h4>
                      <div className="info-items">
                        <div className="info-item">
                          <span className="info-label">Status:</span>
                          <span className={`status-badge ${getStatusColor(selectedEquipment.status)}`}>
                            {selectedEquipment.status}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Type:</span>
                          <span className="info-value">{selectedEquipment.type}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Category:</span>
                          <span className="info-value">{selectedEquipment.category}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Manufacturer:</span>
                          <span className="info-value">{selectedEquipment.manufacturer || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Model:</span>
                          <span className="info-value">{selectedEquipment.model || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Serial Number:</span>
                          <span className="info-value info-value-mono">{selectedEquipment.serial_number || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="info-section">
                      <h4 className="info-section-title">
                        <span>💰</span> Location & Financial
                      </h4>
                      <div className="info-items">
                        <div className="info-item">
                          <span className="info-label">Location:</span>
                          <span className="info-value">{selectedEquipment.location_within_center || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Purchase Cost:</span>
                          <span className="info-value">{selectedEquipment.purchase_cost ? `₹${Number(selectedEquipment.purchase_cost).toLocaleString()}` : 'N/A'}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Current Value:</span>
                          <span className="info-value">{selectedEquipment.current_value ? `₹${Number(selectedEquipment.current_value).toLocaleString()}` : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-section">
                    <div className="info-section">
                      <h4 className="info-section-title">
                        <span>📅</span> Dates & Maintenance
                      </h4>
                      <div className="info-items">
                        <div className="info-item">
                          <span className="info-label">Installation Date:</span>
                          <span className="info-value">{selectedEquipment.installation_date ? new Date(selectedEquipment.installation_date).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Warranty Expires:</span>
                          <span className="info-value">{selectedEquipment.warranty_expiry_date ? new Date(selectedEquipment.warranty_expiry_date).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Next Maintenance:</span>
                          <span className="info-value">{selectedEquipment.next_maintenance_due ? new Date(selectedEquipment.next_maintenance_due).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Critical Equipment:</span>
                          <span className={`info-value ${selectedEquipment.is_critical ? 'critical-text' : ''}`}>
                            {selectedEquipment.is_critical ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedEquipment.notes && (
                      <div className="info-section">
                        <h4 className="info-section-title">
                          <span>📝</span> Notes
                        </h4>
                        <p className="equipment-notes">
                          {selectedEquipment.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedEquipment.specifications && (
                  <div className="specifications-section">
                    <h4 className="info-section-title">
                      <span>⚙️</span> Technical Specifications
                    </h4>
                    <div className="specifications-content">
                      <pre className="specifications-text">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
