// src/components/LogoutButton.jsx
import { useUser } from '../UserContext';
import { useNavigate } from 'react-router-dom';

function LogoutButton() {
  const { signOut } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/'); // back to login
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '8px 16px',
        backgroundColor: '#e63946',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Logout
    </button>
  );
}

export default LogoutButton;
