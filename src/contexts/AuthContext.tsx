'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useSessionStore } from '@/store/sessionStore'; // Import zustand store

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
    // Add signInWithPassword, signUp, etc. if using email/password
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUserState] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const setStoreUser = useSessionStore((state) => state.setUser); // Get action from store

    useEffect(() => {
        const getSession = async () => {
            setLoading(true);
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error("Error getting session:", error);
            }
            setSession(session);
            setUserState(session?.user ?? null);
            setStoreUser(session?.user ?? null); // Update zustand store
            setLoading(false);
        };

        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                console.log("Supabase auth state changed:", _event, session);
                setSession(session);
                setUserState(session?.user ?? null);
                setStoreUser(session?.user ?? null); // Update zustand store
                // No need to setLoading(false) here as initial load handles it
            }
        );

        return () => {
            authListener.subscription?.unsubscribe();
        };
    }, [setStoreUser]); // Add setStoreUser dependency

    const signOut = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Error signing out:", error);
            // Handle error (e.g., show toast)
        }
        // State updates handled by onAuthStateChange listener
        setLoading(false);
    };

    const value = {
        user,
        session,
        loading,
        signOut,
        // Add other auth methods here
    };

    // Render children only after initial auth check is complete
    return (
        <AuthContext.Provider value={value}>
            {loading ? <div className="flex h-screen items-center justify-center"><LoadingSpinner message="Initializing..." /></div> : children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 