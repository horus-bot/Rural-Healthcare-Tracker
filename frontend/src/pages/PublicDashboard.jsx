import LogoutButton from '../components/LogoutButton';
import { useUser } from '../UserContext';

function PublicDashboard() {
  const { userProfile } = useUser();

  return (
    <div>
      <LogoutButton />
      <h1>Welcome {userProfile?.full_name || 'Public User'}</h1>
      <p>Role: Public User</p>
      <div>
        <h2>Public Dashboard Features:</h2>
        <ul>
          <li>View nearby health centers</li>
          <li>Find available equipment</li>
          <li>Report equipment issues</li>
          <li>View public health statistics</li>
          <li>Contact health centers</li>
        </ul>
      </div>
    </div>
  );
}

export default PublicDashboard;
