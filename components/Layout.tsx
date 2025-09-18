'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { LogOut, Users, Calendar, Trophy } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, profile, signOut } = useAuth()
  const pathname = usePathname()

  if (!user) {
    return <>{children}</>
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Trophy },
    { name: 'Jogadores', href: '/players', icon: Users },
    { name: 'Partidas', href: '/matches', icon: Calendar },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <Trophy className="w-8 h-8 text-purple-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Tira Time</h1>
            </Link>

            <div className="flex items-center space-x-4">
              {profile?.name && (
                <span className="text-sm text-gray-600">
                  Olá, {profile.name.split(' ')[0]}!
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={signOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-1 py-4 text-sm font-medium border-b-2 transition-colors duration-200
                    ${
                      isActive
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}