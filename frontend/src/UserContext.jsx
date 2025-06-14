import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log('🚀 Initializing auth...');
      
      try {
        // Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        if (session?.user) {
          console.log('✅ Existing session found:', session.user.email);
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          console.log('ℹ️ No existing session found');
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    // Initialize auth state
    initializeAuth();

    // Listen for auth changes
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
      setLoading(true);
      setError(null);

      // Direct query for the user profile
      console.log('🔎 Fetching user profile...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          center:center_id (
            id,
            name,
            type,
            address
          )
        `)
        .eq('auth_id', authId)
        .single(); // Use single() to get one record

      if (userError) {
        console.error('❌ User profile fetch error:', userError);
        
        if (userError.code === 'PGRST116') {
          // No rows returned
          setError('User profile not found. Please contact administrator.');
        } else {
          setError(`Database error: ${userError.message}`);
        }
        setUserProfile(null);
      } else if (userData) {
        console.log('✅ User profile loaded:', userData);
        setUserProfile(userData);
        setError(null);
      } else {
        console.log('⚠️ No user data returned');
        setError('User profile not found');
        setUserProfile(null);
      }

    } catch (error) {
      console.error('❌ Profile fetch exception:', error);
      setError(`Fetch error: ${error.message}`);
      setUserProfile(null);
    } finally {
      console.log('🏁 Profile fetch completed');
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      setError(null);
    } catch (error) {
      console.error('❌ Sign out error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
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
