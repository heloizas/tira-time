'use client'

import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, Calendar, Users, Trophy } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Player, Match } from '@/types/database'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface MatchForm {
  date: string
  selectedPlayers: string[]
}

interface MatchWithPlayers extends Match {
  match_players: Array<{
    players: Player
  }>
}

export default function MatchesPage() {
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])

  const form = useForm<MatchForm>({
    defaultValues: {
      date: '',
      selectedPlayers: []
    }
  })

  useEffect(() => {
    if (user) {
      loadData()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading])

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    // Timeout de segurança
    const timeoutId = setTimeout(() => {
      console.warn('Matches data load timeout')
      setLoading(false)
      toast.error('Timeout ao carregar dados')
    }, 15000) // 15 segundos

    try {
      // Carregar partidas
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          *,
          match_players (
            players (*)
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (matchesError) throw matchesError

      // Carregar jogadores
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (playersError) throw playersError

      setMatches(matchesData || [])
      setPlayers(playersData || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados das partidas')
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const handlePlayerToggle = (playerId: string) => {
    setSelectedPlayers(prev => {
      const newSelected = prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]

      form.setValue('selectedPlayers', newSelected)
      return newSelected
    })
  }

  const handleSubmit = async (data: MatchForm) => {
    if (selectedPlayers.length < 2) {
      toast.error('Selecione pelo menos 2 jogadores')
      return
    }

    try {
      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          date: data.date,
          user_id: user?.id
        })
        .select()
        .single()

      if (error) throw error

      // Adicionar jogadores à partida
      const matchPlayersData = selectedPlayers.map(playerId => ({
        match_id: match.id,
        player_id: playerId,
        team: null // Sem time inicialmente; será definido na geração de times
      }))

      const { error: playersError } = await supabase
        .from('match_players')
        .insert(matchPlayersData)

      if (playersError) {
        // Se erro, deletar a partida criada
        await supabase.from('matches').delete().eq('id', match.id)
        throw playersError
      }

      toast.success('Partida criada com sucesso!')
      form.reset()
      setSelectedPlayers([])
      setShowForm(false)
      loadData()
    } catch (error) {
      console.error('Erro ao criar partida:', error)
      toast.error('Erro ao criar partida')
    }
  }

  const resetForm = () => {
    form.reset()
    setSelectedPlayers([])
    setShowForm(false)
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Partidas</h1>
            <p className="mt-2 text-gray-600">
              Crie partidas e monte times equilibrados
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="mt-4 sm:mt-0"
            disabled={players.length < 2}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Partida
          </Button>
        </div>

        {/* Aviso se não há jogadores suficientes */}
        {players.length < 2 && (
          <Card>
            <CardBody className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Jogadores insuficientes
              </h3>
              <p className="text-gray-500 mb-4">
                Você precisa de pelo menos 2 jogadores para criar uma partida
              </p>
              <Link href="/players">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Jogadores
                </Button>
              </Link>
            </CardBody>
          </Card>
        )}

        {/* Formulário */}
        {showForm && players.length >= 2 && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Nova Partida</h3>
            </CardHeader>
            <CardBody>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <Input
                  label="Data da Partida"
                  type="date"
                  {...form.register('date', { required: 'Data é obrigatória' })}
                  error={form.formState.errors.date?.message}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Selecionar Jogadores ({selectedPlayers.length} selecionados)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto border rounded-lg p-4">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className={`
                          p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                          ${selectedPlayers.includes(player.id)
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                          }
                        `}
                        onClick={() => handlePlayerToggle(player.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">
                            {player.name}
                          </span>
                          <div className="flex">
                            {Array.from({ length: player.level }, (_, i) => (
                              <div
                                key={i}
                                className="w-3 h-3 bg-orange-400 rounded-full ml-1"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedPlayers.length < 2 && (
                    <p className="mt-2 text-sm text-red-600">
                      Selecione pelo menos 2 jogadores
                    </p>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting || selectedPlayers.length < 2}
                  >
                    {form.formState.isSubmitting ? 'Criando...' : 'Criar Partida'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {/* Lista de Partidas */}
        {matches.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma partida criada
              </h3>
              <p className="text-gray-500 mb-4">
                Comece criando sua primeira partida
              </p>
              {players.length >= 2 && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Partida
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <Card key={match.id}>
                <CardBody className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span className="font-medium">
                            {new Date(match.date).toLocaleDateString('pt-BR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          <span>{match.match_players?.length || 0} jogadores</span>
                        </div>
                        <span>•</span>
                        <span>
                          Criada em {new Date(match.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Jogadores da partida */}
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {match.match_players?.slice(0, 5).map((mp, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                            >
                              {mp.players?.name}
                            </span>
                          ))}
                          {(match.match_players?.length || 0) > 5 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                              +{(match.match_players?.length || 0) - 5} mais
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2 mt-4 sm:mt-0">
                      <Link href={`/matches/${match.id}`}>
                        <Button variant="secondary" size="sm">
                          <Trophy className="w-4 h-4 mr-2" />
                          Tira Time
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}