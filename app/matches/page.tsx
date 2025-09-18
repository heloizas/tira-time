'use client'

import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PlayerDropdownChip } from '@/components/ui/PlayerDropdownChip'
import { Plus, Calendar, Users, Trophy, Edit, Trash2 } from 'lucide-react'
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
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingMatch, setEditingMatch] = useState<MatchWithPlayers | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [timeoutOccurred, setTimeoutOccurred] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<MatchForm>({
    defaultValues: {
      date: '',
      selectedPlayers: []
    }
  })

  const editForm = useForm<MatchForm>({
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

    const controller = new AbortController()
    let timeoutTriggered = false

    // Timeout de segurança reduzido
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true
      controller.abort()
      setTimeoutOccurred(true)
      console.warn('Matches data load timeout')
      setLoading(false)
      toast.error('Timeout ao carregar dados')
    }, 8000) // 8 segundos

    try {
      // Executar queries em paralelo para melhor performance
      const [matchesResult, playersResult] = await Promise.all([
        supabase
          .from('matches')
          .select(`
            *,
            match_players (
              players (*)
            )
          `)
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .abortSignal(controller.signal),
        supabase
          .from('players')
          .select('*')
          .eq('user_id', user.id)
          .order('name')
          .abortSignal(controller.signal)
      ])

      if (!timeoutTriggered) {
        // Verificar erros
        if (matchesResult.error) throw matchesResult.error
        if (playersResult.error) throw playersResult.error

        setMatches(matchesResult.data || [])
        setPlayers(playersResult.data || [])
        setTimeoutOccurred(false)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (!timeoutTriggered && error.name !== 'AbortError') {
        console.error('Erro ao carregar dados:', error)

        // Mensagens de erro mais específicas
        if (error.message?.includes('JWT')) {
          toast.error('Sessão expirada. Recarregue a página.')
        } else if (error.message?.includes('network')) {
          toast.error('Erro de conexão. Verifique sua internet.')
          setTimeoutOccurred(true)
        } else {
          toast.error('Erro ao carregar dados das partidas')
        }
      }
    } finally {
      clearTimeout(timeoutId)
      if (!timeoutTriggered) {
        setLoading(false)
      }
    }
  }

  const retryLoad = () => {
    setTimeoutOccurred(false)
    setLoading(true)
    loadData()
  }

  const handlePlayersChange = (playerIds: string[]) => {
    setSelectedPlayers(playerIds)
    form.setValue('selectedPlayers', playerIds)
  }

  const handleSubmit = async (data: MatchForm) => {
    if (selectedPlayers.length < 2) {
      toast.error('Selecione pelo menos 2 jogadores')
      return
    }

    try {
      // Garantir que a data seja interpretada corretamente sem problemas de timezone
      const selectedDate = new Date(data.date + 'T12:00:00')
      const formattedDate = selectedDate.toISOString().split('T')[0]

      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          date: formattedDate,
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
      setShowModal(false)
      loadData()
    } catch (error) {
      console.error('Erro ao criar partida:', error)
      toast.error('Erro ao criar partida')
    }
  }

  const resetForm = () => {
    form.reset()
    setSelectedPlayers([])
    setShowModal(false)
  }

  const openEditModal = (match: MatchWithPlayers) => {
    setEditingMatch(match)
    const matchPlayerIds = match.match_players?.map(mp => mp.players.id) || []
    setSelectedPlayers(matchPlayerIds)
    editForm.setValue('date', match.date)
    editForm.setValue('selectedPlayers', matchPlayerIds)
    setShowEditModal(true)
  }

  const resetEditForm = () => {
    editForm.reset()
    setSelectedPlayers([])
    setEditingMatch(null)
    setShowEditModal(false)
  }

  const handleDeleteMatch = async () => {
    if (!editingMatch) return

    setDeleting(true)
    try {
      // Delete match_players first (foreign key constraint)
      const { error: playersError } = await supabase
        .from('match_players')
        .delete()
        .eq('match_id', editingMatch.id)

      if (playersError) throw playersError

      // Delete the match
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('id', editingMatch.id)

      if (matchError) throw matchError

      toast.success('Partida excluída com sucesso!')
      setShowDeleteConfirm(false)
      resetEditForm()
      loadData() // Reload matches list
    } catch (error) {
      console.error('Erro ao excluir partida:', error)
      toast.error('Erro ao excluir partida')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditSubmit = async (data: MatchForm) => {
    if (!editingMatch) return

    if (selectedPlayers.length < 2) {
      toast.error('Selecione pelo menos 2 jogadores')
      return
    }

    try {
      const selectedDate = new Date(data.date + 'T12:00:00')
      const formattedDate = selectedDate.toISOString().split('T')[0]

      // Check if match has teams assigned
      const hasTeams = editingMatch.match_players?.some(mp => mp.team && mp.team > 0) || false

      // Update match date
      const { error: matchError } = await supabase
        .from('matches')
        .update({ date: formattedDate })
        .eq('id', editingMatch.id)

      if (matchError) throw matchError

      // Get current players in the match
      const currentPlayerIds = editingMatch.match_players?.map(mp => mp.players.id) || []

      // Find players to remove and add
      const playersToRemove = currentPlayerIds.filter(id => !selectedPlayers.includes(id))
      const playersToAdd = selectedPlayers.filter(id => !currentPlayerIds.includes(id))

      // Remove players no longer selected
      if (playersToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('match_players')
          .delete()
          .eq('match_id', editingMatch.id)
          .in('player_id', playersToRemove)

        if (removeError) throw removeError
      }

      // Add new players
      if (playersToAdd.length > 0) {
        const matchPlayersData = playersToAdd.map(playerId => ({
          match_id: editingMatch.id,
          player_id: playerId,
          team: null // No team initially; will be cleared if teams were assigned
        }))

        const { error: addError } = await supabase
          .from('match_players')
          .insert(matchPlayersData)

        if (addError) throw addError
      }

      // If match had teams assigned, clear all teams and notify user
      if (hasTeams) {
        const { error: clearTeamsError } = await supabase
          .from('match_players')
          .update({ team: null })
          .eq('match_id', editingMatch.id)

        if (clearTeamsError) throw clearTeamsError

        toast.success('Partida editada! O sorteio foi desfeito - você deve sortear os times novamente.')
      } else {
        toast.success('Partida editada com sucesso!')
      }

      resetEditForm()
      loadData()
    } catch (error) {
      console.error('Erro ao editar partida:', error)
      toast.error('Erro ao editar partida')
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
            onClick={() => setShowModal(true)}
            className="mt-4 sm:mt-0"
            disabled={players.length < 2 || timeoutOccurred}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Partida
          </Button>
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
                      Timeout no carregamento das partidas
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

        {/* Modal de Nova Partida */}
        <Modal
          isOpen={showModal}
          onClose={resetForm}
          title="Nova Partida"
          footer={
            <>
              <Button
                type="button"
                onClick={form.handleSubmit(handleSubmit)}
                disabled={form.formState.isSubmitting || selectedPlayers.length < 2}
                className="w-full sm:ml-3 sm:w-auto"
              >
                {form.formState.isSubmitting ? 'Criando...' : 'Criar Partida'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                className="mt-3 w-full sm:mt-0 sm:w-auto"
              >
                Cancelar
              </Button>
            </>
          }
        >
          <form className="space-y-6">
            <Input
              label="Data da Partida"
              type="date"
              {...form.register('date', { required: 'Data é obrigatória' })}
              error={form.formState.errors.date?.message}
            />

            <PlayerDropdownChip
              players={players}
              selectedPlayers={selectedPlayers}
              onPlayersChange={handlePlayersChange}
              error={selectedPlayers.length < 2 ? 'Selecione pelo menos 2 jogadores' : undefined}
            />
          </form>
        </Modal>

        {/* Modal de Editar Partida */}
        <Modal
          isOpen={showEditModal}
          onClose={resetEditForm}
          title="Editar Partida e Jogadores"
          footer={
            <>
              <div className="flex flex-col sm:flex-row sm:justify-between w-full">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mb-3 sm:mb-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Partida
                </Button>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetEditForm}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={editForm.handleSubmit(handleEditSubmit)}
                    disabled={editForm.formState.isSubmitting || selectedPlayers.length < 2}
                  >
                    {editForm.formState.isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </div>
            </>
          }
        >
          <form className="space-y-6">
            <Input
              label="Data da Partida"
              type="date"
              {...editForm.register('date', { required: 'Data é obrigatória' })}
              error={editForm.formState.errors.date?.message}
            />

            <PlayerDropdownChip
              players={players}
              selectedPlayers={selectedPlayers}
              onPlayersChange={handlePlayersChange}
              error={selectedPlayers.length < 2 ? 'Selecione pelo menos 2 jogadores' : undefined}
            />

            {/* Warning about team draw */}
            {editingMatch?.match_players?.some(mp => mp.team && mp.team > 0) && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <div className="text-yellow-600 mr-2">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Atenção: Times já sorteados
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Ao editar esta partida, o sorteio atual será desfeito e você precisará sortear os times novamente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Modal>

        {/* Modal de Confirmação de Exclusão */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Excluir Partida"
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                className="mr-3"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDeleteMatch}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? 'Excluindo...' : 'Excluir Partida'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Tem certeza de que deseja excluir esta partida? Esta ação não pode ser desfeita.
            </p>
            {editingMatch?.match_players && editingMatch.match_players.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <div className="text-red-600 mr-2">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Atenção
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Todos os dados da partida, incluindo jogadores e times sorteados, serão perdidos permanentemente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>

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
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <Card key={match.id}>
                <CardBody className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span className="font-medium">
                          {new Date(match.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }).replace(/^\w/, c => c.toUpperCase())}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(match)}
                        disabled={timeoutOccurred}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      <Link href={`/matches/${match.id}`}>
                        <Button variant="secondary" size="sm">
                          <Trophy className="w-4 h-4 mr-2" />
                          Tira Time
                        </Button>
                      </Link>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        <span>{match.match_players?.length || 0} jogadores</span>
                      </div>
                    </div>

                    {/* Jogadores da partida */}
                    <div>
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
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}