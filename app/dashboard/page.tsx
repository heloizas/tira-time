'use client'

import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Users, Calendar, Trophy, Plus } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

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
  const [stats, setStats] = useState<DashboardStats>({
    totalPlayers: 0,
    totalMatches: 0,
    recentMatches: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadDashboardData()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading])

  const loadDashboardData = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    // Timeout de segurança
    const timeoutId = setTimeout(() => {
      console.warn('Dashboard data load timeout')
      setLoading(false)
      toast.error('Timeout ao carregar dados')
    }, 15000) // 15 segundos

    try {
      // Buscar total de jogadores
      const { count: playersCount, error: playersError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (playersError) throw playersError

      // Buscar total de partidas
      const { count: matchesCount, error: matchesError } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (matchesError) throw matchesError

      // Buscar partidas recentes com contagem de jogadores
      const { data: recentMatches, error: recentError } = await supabase
        .from('matches')
        .select(`
          id,
          date,
          match_players (count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentError) throw recentError

      setStats({
        totalPlayers: playersCount || 0,
        totalMatches: matchesCount || 0,
        recentMatches: recentMatches?.map(match => ({
          id: match.id,
          date: match.date,
          playerCount: match.match_players?.length || 0
        })) || []
      })
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </Layout>
    )
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

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardBody className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Jogadores</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPlayers}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Times Gerados</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              {stats.recentMatches.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma partida criada ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.recentMatches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(match.date).toLocaleDateString('pt-BR')}
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