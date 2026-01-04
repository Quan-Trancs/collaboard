/**
 * Authentication Context
 * Manages user authentication state and provides auth methods
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import type { User } from '@/types';

type Profile = User;

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ user: User | null; session: any | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUser: (updates: { email?: string; password?: string; data?: Record<string, any> }) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await apiRequest<User>('/auth/me', { 
          useCache: true, 
          cacheTTL: 2 * 60 * 1000 
        });
        const userWithMetadata: User = {
          ...userData,
          user_metadata: {
            name: userData.name,
            avatar_url: userData.avatar_url || undefined,
          },
        };
        setUser(userWithMetadata);
        setProfile(userData);
      } catch (error) {
        // Do not remove token on API failures - let user handle it explicitly
        // Token will only be removed on explicit logout
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiRequest<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });

      // Verify token exists in response
      if (!data.token) {
        throw new Error('No token received from server');
      }

      // Save token to localStorage
      try {
        localStorage.setItem('auth_token', data.token);
      } catch (storageError) {
        throw new Error('Failed to save token: localStorage may be disabled or full');
      }
      
      // Verify it was saved
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken || savedToken !== data.token) {
        throw new Error('Failed to save token to localStorage');
      }

      const userWithMetadata: User = {
        ...data.user,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_metadata: {
          name: data.user.name,
          avatar_url: data.user.avatar_url || undefined,
        },
      };
      setUser(userWithMetadata);
      setProfile({
        ...data.user,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const data = await apiRequest<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
        skipAuth: true,
      });

      // Verify token exists in response
      if (!data.token) {
        throw new Error('No token received from server');
      }

      // Save token to localStorage
      try {
        localStorage.setItem('auth_token', data.token);
      } catch (storageError) {
        throw new Error('Failed to save token: localStorage may be disabled or full');
      }
      
      // Verify it was saved
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken || savedToken !== data.token) {
        throw new Error('Failed to save token to localStorage');
      }

      const newUser: User = {
        ...data.user,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_metadata: {
          name: data.user.name,
          avatar_url: data.user.avatar_url || undefined,
        },
      };

      setUser(newUser);
      setProfile({
        ...data.user,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return { user: newUser, session: { access_token: data.token } };
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    const userData = await apiRequest<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setProfile(userData);
    const userWithMetadata: User = {
      ...userData,
      user_metadata: {
        name: userData.name,
        avatar_url: userData.avatar_url || undefined,
      },
    };
    setUser(userWithMetadata);
  }, []);

  const resetPassword = async (email: string) => {
    throw new Error('Password reset not yet implemented');
  };

  const updateUser = async (updates: { email?: string; password?: string; data?: Record<string, any> }) => {
    if (updates.data) {
      await updateProfile(updates.data);
    }
    throw new Error('User update not yet fully implemented');
  };

  const signInWithMagicLink = async (email: string) => {
    throw new Error('Magic link login not yet implemented');
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
      resetPassword,
      updateUser,
      signInWithMagicLink,
    }),
    [user, profile, loading, signIn, signUp, signOut, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
