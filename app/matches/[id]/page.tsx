'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Layout } from '@/components/Layout'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StarRating } from '@/components/ui/StarRating'
import { Calendar, Users, Trophy, Shuffle, UserPlus, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Player, Match, MatchPlayer } from '@/types/database'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface MatchWithPlayers extends Match {
  match_players: Array<MatchPlayer & {
    players: Player
  }>
}

interface Team {
  number: 1 | 2
  players: Player[]
  totalLevel: number
  averageLevel: number
}

export default function MatchDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [match, setMatch] = useState<MatchWithPlayers | null>(null)
  const [teams, setTeams] = useState<{ team1: Team; team2: Team } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (user && params.id) {
      loadMatch()
    }
  }, [user, params.id])

  const loadMatch = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          match_players (
            *,
            players (*)
          )
        `)
        .eq('id', params.id)
        .eq('user_id', user?.id)
        .single()

      if (error) throw error

      setMatch(data)

      // Se já existem times definidos, calcular estatísticas
      if (data.match_players.some(mp => mp.team === 1) && data.match_players.some(mp => mp.team === 2)) {
        calculateTeams(data.match_players)
      }

    } catch (error) {
      console.error('Erro ao carregar partida:', error)
      toast.error('Partida não encontrada')
    } finally {
      setLoading(false)
    }
  }

  const calculateTeams = (matchPlayers: Array<MatchPlayer & { players: Player }>) => {
    const team1Players = matchPlayers
      .filter(mp => mp.team === 1)
      .map(mp => mp.players)
      .filter(Boolean)

    const team2Players = matchPlayers
      .filter(mp => mp.team === 2)
      .map(mp => mp.players)
      .filter(Boolean)

    const team1TotalLevel = team1Players.reduce((sum, p) => sum + p.level, 0)
    const team2TotalLevel = team2Players.reduce((sum, p) => sum + p.level, 0)

    setTeams({
      team1: {
        number: 1,
        players: team1Players,
        totalLevel: team1TotalLevel,
        averageLevel: team1Players.length > 0 ? team1TotalLevel / team1Players.length : 0
      },
      team2: {
        number: 2,
        players: team2Players,
        totalLevel: team2TotalLevel,
        averageLevel: team2Players.length > 0 ? team2TotalLevel / team2Players.length : 0
      }
    })
  }

  const generateAutomaticTeams = async () => {
    if (!match) return

    setGenerating(true)
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          matchId: match.id,
          mode: 'automatic'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao gerar times')
      }

      toast.success('Times gerados automaticamente!')
      loadMatch() // Recarregar dados
    } catch (error) {
      console.error('Erro ao gerar times:', error)
      toast.error('Erro ao gerar times')
    } finally {
      setGenerating(false)
    }
  }

  const movePlayerToTeam = async (playerId: string, newTeam: 1 | 2) => {
    if (!match) return

    try {
      const { error } = await supabase
        .from('match_players')
        .update({ team: newTeam })
        .eq('match_id', match.id)
        .eq('player_id', playerId)

      if (error) throw error

      toast.success('Jogador movido!')
      loadMatch() // Recarregar dados
    } catch (error) {
      console.error('Erro ao mover jogador:', error)
      toast.error('Erro ao mover jogador')
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

  if (!match) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Partida não encontrada
          </h2>
          <Link href="/matches">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar às Partidas
            </Button>
          </Link>
        </div>
      </Layout>
    )
  }

  const hasTeams = teams && (teams.team1.players.length > 0 || teams.team2.players.length > 0)
  const isBalanced = teams && Math.abs(teams.team1.totalLevel - teams.team2.totalLevel) <= 1

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/matches" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar às Partidas
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Detalhes da Partida</h1>
            <div className="flex items-center text-gray-600 mt-2">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {new Date(match.date).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={generateAutomaticTeams}
              disabled={generating || match.match_players.length < 2}
            >
              <Shuffle className="w-4 h-4 mr-2" />
              {generating ? 'Gerando...' : 'Gerar Times'}
            </Button>
          </div>
        </div>

        {/* Estatísticas da Partida */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody className="text-center p-4">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{match.match_players.length}</p>
              <p className="text-sm text-gray-500">Jogadores</p>
            </CardBody>
          </Card>

          {hasTeams && (
            <>
              <Card>
                <CardBody className="text-center p-4">
                  <Trophy className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {teams.team1.players.length} vs {teams.team2.players.length}
                  </p>
                  <p className="text-sm text-gray-500">Divisão</p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="text-center p-4">
                  <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    isBalanced ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    ⚖️
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {isBalanced ? 'Sim' : 'Não'}
                  </p>
                  <p className="text-sm text-gray-500">Equilibrado</p>
                </CardBody>
              </Card>
            </>
          )}
        </div>

        {/* Times */}
        {hasTeams ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time 1 */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="w-6 h-6 bg-purple-500 rounded mr-3"></div>
                  Time 1
                  <span className="ml-auto text-sm text-gray-500">
                    Nível Total: {teams.team1.totalLevel} | Média: {teams.team1.averageLevel.toFixed(1)}
                  </span>
                </h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {teams.team1.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-purple-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">{player.name}</span>
                      <StarRating rating={player.level} readonly size="sm" />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => movePlayerToTeam(player.id, 2)}
                    >
                      →
                    </Button>
                  </div>
                ))}
                {teams.team1.players.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Nenhum jogador no time</p>
                )}
              </CardBody>
            </Card>

            {/* Time 2 */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="w-6 h-6 bg-orange-500 rounded mr-3"></div>
                  Time 2
                  <span className="ml-auto text-sm text-gray-500">
                    Nível Total: {teams.team2.totalLevel} | Média: {teams.team2.averageLevel.toFixed(1)}
                  </span>
                </h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {teams.team2.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">{player.name}</span>
                      <StarRating rating={player.level} readonly size="sm" />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => movePlayerToTeam(player.id, 1)}
                    >
                      ←
                    </Button>
                  </div>
                ))}
                {teams.team2.players.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Nenhum jogador no time</p>
                )}
              </CardBody>
            </Card>
          </div>
        ) : (
          /* Lista de jogadores sem times definidos */
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">
                Jogadores da Partida
              </h3>
              <p className="text-sm text-gray-600">
                Clique em "Gerar Times" para distribuir automaticamente ou arraste os jogadores manualmente
              </p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {match.match_players.map((mp) => (
                  <div
                    key={mp.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">{mp.players.name}</span>
                      <StarRating rating={mp.players.level} readonly size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Dicas */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">💡 Dicas</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Use "Gerar Times" para distribuição automática baseada nos níveis dos jogadores</p>
              <p>• Você pode mover jogadores entre os times clicando nas setas</p>
              <p>• Times equilibrados têm diferença de nível total ≤ 1</p>
              <p>• A média de nível de cada time ajuda a identificar o equilíbrio</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}