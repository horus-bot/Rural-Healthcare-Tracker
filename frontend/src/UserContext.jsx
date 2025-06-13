import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth event:', event, session?.user?.email);
      
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email);
        setUser(session.user);
        setUserProfile(null);
        setError(null);
        setLoading(true);
        await fetchUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setUserProfile(null);
        setError(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (authId) => {
    console.log('🔍 Starting profile fetch for:', authId);
    
    try {
      // Test 1: Simple count query
      console.log('🧪 Test 1: Checking if users table exists...');
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      console.log('📊 Users table count result:', { count, countError });
      
      if (countError) {
        console.error('❌ Users table access failed:', countError);
        setError(`Table access error: ${countError.message}`);
        setLoading(false);
        return;
      }

      // Test 2: Get all users (limit 1)
      console.log('🧪 Test 2: Fetching first user...');
      const { data: firstUser, error: firstError } = await supabase
        .from('users')
        .select('auth_id, email, role')
        .limit(1);
      
      console.log('📊 First user result:', { firstUser, firstError });

      // Test 3: Search for our specific user
      console.log('🧪 Test 3: Searching for specific user...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('auth_id, email, role, full_name, is_active')
        .eq('auth_id', authId);
      
      console.log('📊 User search result:', { userData, userError });

      if (userError) {
        console.error('❌ User search failed:', userError);
        setError(`User search error: ${userError.message}`);
      } else if (userData && userData.length > 0) {
        console.log('✅ User found:', userData[0]);
        setUserProfile(userData[0]);
        setError(null);
      } else {
        console.log('⚠️ No user found with auth_id:', authId);
        setError('User profile not found');
      }

    } catch (error) {
      console.error('❌ Profile fetch exception:', error);
      setError(`Fetch error: ${error.message}`);
    } finally {
      console.log('🏁 Profile fetch completed');
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      setError(null);
      setLoading(false);
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    error,
    signOut,
    isAuthenticated: !!user,
    hasValidProfile: !!userProfile && userProfile.is_active !== false,
    isAdmin: userProfile?.role === 'district_admin',
    isStaff: userProfile?.role === 'staff',
    isPublic: userProfile?.role === 'public'
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
