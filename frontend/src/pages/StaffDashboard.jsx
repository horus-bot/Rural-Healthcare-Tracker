import LogoutButton from '../components/LogoutButton';
import { useUser } from '../UserContext';

function StaffDashboard() {
  const { userProfile } = useUser();

  return (
    <div>
      <LogoutButton />
      <h1>Welcome {userProfile?.full_name || 'Staff Member'}</h1>
      <p>Role: Healthcare Staff</p>
      <p>Designation: {userProfile?.designation}</p>
      <p>Department: {userProfile?.department}</p>
      <div>
        <h2>Staff Dashboard Features:</h2>
        <ul>
          <li>View center equipment</li>
          <li>Create maintenance requests</li>
          <li>Update equipment status</li>
          <li>View maintenance history</li>
          <li>Generate center reports</li>
        </ul>
      </div>
    </div>
  );
}

export default StaffDashboard;
