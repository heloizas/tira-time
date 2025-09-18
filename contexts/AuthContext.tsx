'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let isMounted = true
    let lastCallbackTime = 0

    // Carrega usuário atual e mantém sessão sincronizada via auth-helpers
    const init = async () => {
      try {
        console.log('AuthContext: Initializing auth...')
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !isMounted) {
          console.log('AuthContext: No user or mount error:', error?.message)
          return
        }

        console.log('AuthContext: User found:', user?.id)
        setUser(user)

        if (user && isMounted) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (profileError && profileError.code !== 'PGRST116') { // Ignore not found
            console.warn('Profile load error:', profileError)
          }
          if (isMounted) {
            setProfile(profile)
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (isMounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) {
          console.log('AuthContext: Auth initialization complete')
          setLoading(false)
        }
      }
    }

    // Timeout de segurança reduzido para melhor UX
    const initTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Auth initialization timeout')
        setLoading(false)
      }
    }, 5000) // 5 segundos

    init().finally(() => {
      clearTimeout(initTimeout)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        console.log('AuthContext: Auth state change:', event, session?.user?.id)

        try {
          setUser(session?.user ?? null)

          if (session?.user && isMounted) {
            console.log('AuthContext: Loading profile for user:', session.user.id)
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (profileError && profileError.code !== 'PGRST116') { // Ignore not found
              console.warn('Profile load error:', profileError)
            }
            if (isMounted) {
              setProfile(profile)
            }
          } else if (isMounted) {
            console.log('AuthContext: No user, clearing profile')
            setProfile(null)
          }

          // Notifica o backend para sincronizar cookies no Next middleware
          // Adiciona throttling para evitar múltiplas chamadas
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
            const now = Date.now()
            if (now - lastCallbackTime > 1000) { // Mínimo 1 segundo entre chamadas
              lastCallbackTime = now
              try {
                await fetch('/auth/callback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ event, session }),
                })
              } catch (e) {
                // ignora erro de rede
              }
            }
          }
        } catch (error) {
          console.error('Auth state change error:', error)
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(initTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error) {
      // Aguardar um pouco para garantir que o estado seja atualizado
      setTimeout(() => {
        window.location.replace('/dashboard')
      }, 100)
    }

    return { error: error?.message || null }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (!error) {
      window.location.replace('/dashboard')
    }

    return { error: error?.message || null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}