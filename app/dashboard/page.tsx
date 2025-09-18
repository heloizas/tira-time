'use client'

import { useMemo, useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Users, Calendar, Trophy, Plus } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'

interface DashboardStats {
  totalPlayers: number
  totalMatches: number
  recentMatches: Array<{
    id: string
    date: string
    playerCount: number
  }>
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [userReady, setUserReady] = useState(false)

  // Aguarda o usuário estar completamente carregado após login
  useEffect(() => {
    console.log('Dashboard: Auth state changed:', { authLoading, userId: user?.id, userReady })

    if (!authLoading && user?.id) {
      // Pequeno delay para garantir que a sessão esteja completamente estabelecida
      const timer = setTimeout(() => {
        console.log('Dashboard: User ready, enabling data fetch for user:', user.id)
        setUserReady(true)
      }, 200) // Aumentado para 200ms
      return () => clearTimeout(timer)
    } else if (!user) {
      console.log('Dashboard: No user, disabling data fetch')
      setUserReady(false)
    }
  }, [user?.id, authLoading, userReady])

  // Função para carregar dados do dashboard
  const fetchDashboardData = useMemo(() => {
    return async (): Promise<DashboardStats | null> => {
      if (!user?.id) {
        console.log('Dashboard: No user ID available')
        return null
      }

      console.log('Dashboard: Fetching data for user:', user.id)

      // Executar queries em paralelo para melhor performance
      const [playersResult, matchesResult, recentResult] = await Promise.all([
        supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('matches')
          .select(`
            id,
            date,
            match_players (
              player_id
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      ])

      // Verificar erros
      if (playersResult.error) throw playersResult.error
      if (matchesResult.error) throw matchesResult.error
      if (recentResult.error) throw recentResult.error

      const stats = {
        totalPlayers: playersResult.count || 0,
        totalMatches: matchesResult.count || 0,
        recentMatches: recentResult.data?.map(match => ({
          id: match.id,
          date: match.date,
          playerCount: match.match_players?.length || 0
        })) || []
      }

      console.log('Dashboard: Fetched stats:', stats)
      return stats
    }
  }, [user?.id])

  const {
    data: stats,
    loading,
    timeoutOccurred,
    retry: retryLoad
  } = useAsyncData({
    fetchFn: fetchDashboardData,
    deps: [user?.id, userReady],
    enabled: userReady && !!user?.id
  })

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </Layout>
    )
  }

  // Usar valores padrão se não houver dados
  const dashboardStats = stats || {
    totalPlayers: 0,
    totalMatches: 0,
    recentMatches: []
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Bem-vindo de volta! Aqui está um resumo das suas atividades.
          </p>
        </div>

        {/* Aviso de Timeout */}
        {timeoutOccurred && (
          <Card className="border-orange-200 bg-orange-50">
            <CardBody className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-orange-600">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-orange-800">
                      Timeout no carregamento do dashboard
                    </p>
                    <p className="text-xs text-orange-600">
                      A conexão pode estar lenta. Clique para tentar novamente.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={retryLoad}
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? 'Carregando...' : 'Tentar novamente'}
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardBody className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Jogadores</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalPlayers}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Partidas</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalMatches}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Ações Rápidas</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Link href="/players" className="block">
                <Button variant="primary" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Jogador
                </Button>
              </Link>
              <Link href="/matches" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Nova Partida
                </Button>
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Partidas Recentes</h3>
            </CardHeader>
            <CardBody>
              {dashboardStats.recentMatches.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma partida criada ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {dashboardStats.recentMatches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(match.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }).replace(/^\w/, c => c.toUpperCase())}
                        </p>
                        <p className="text-xs text-gray-500">
                          {match.playerCount} jogadores
                        </p>
                      </div>
                      <Link href={`/matches/${match.id}`}>
                        <Button size="sm" variant="secondary">
                          Ver
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Dicas */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">💡 Dicas</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm text-gray-600">
              <p>• Cadastre seus jogadores com níveis de 1 a 3 estrelas para gerar times mais equilibrados</p>
              <p>• Use a montagem automática para distribuir jogadores de forma equilibrada</p>
              <p>• Você pode editar manualmente os times antes de finalizar</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}