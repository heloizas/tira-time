'use client'

import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StarRating } from '@/components/ui/StarRating'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Player } from '@/types/database'
import toast from 'react-hot-toast'

interface PlayerForm {
  name: string
  level: 1 | 2 | 3
}

export default function PlayersPage() {
  const { user, loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [timeoutOccurred, setTimeoutOccurred] = useState(false)

  const form = useForm<PlayerForm>({
    defaultValues: {
      name: '',
      level: 1
    }
  })

  useEffect(() => {
    if (user) {
      loadPlayers()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading])

  const loadPlayers = async () => {
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
      console.warn('Players data load timeout')
      setLoading(false)
      toast.error('Timeout ao carregar jogadores')
    }, 8000) // 8 segundos

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)

      // Se não houve timeout, processa os dados normalmente
      if (!timeoutTriggered) {
        if (error) throw error
        setPlayers(data || [])
        setTimeoutOccurred(false) // Reset timeout flag on success
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (!timeoutTriggered && error.name !== 'AbortError') {
        console.error('Erro ao carregar jogadores:', error)

        // Mensagens de erro mais específicas
        if (error.message?.includes('JWT')) {
          toast.error('Sessão expirada. Recarregue a página.')
        } else if (error.message?.includes('network')) {
          toast.error('Erro de conexão. Verifique sua internet.')
          setTimeoutOccurred(true)
        } else {
          toast.error('Erro ao carregar jogadores')
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
    loadPlayers()
  }

  const handleSubmit = async (data: PlayerForm) => {
    // Validação adicional antes de tentar salvar
    if (!user?.id) {
      toast.error('Usuário não autenticado. Recarregue a página.')
      return
    }

    if (!data.name.trim()) {
      toast.error('Nome do jogador é obrigatório')
      return
    }

    try {
      if (editingPlayer) {
        // Atualizar jogador existente
        const { error } = await supabase
          .from('players')
          .update({
            name: data.name,
            level: data.level
          })
          .eq('id', editingPlayer.id)

        if (error) throw error
        toast.success('Jogador atualizado com sucesso!')
      } else {
        // Criar novo jogador
        const { error } = await supabase
          .from('players')
          .insert({
            name: data.name,
            level: data.level,
            user_id: user.id
          })

        if (error) throw error
        toast.success('Jogador criado com sucesso!')
      }

      form.reset()
      setShowForm(false)
      setEditingPlayer(null)
      loadPlayers()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('Erro ao salvar jogador:', error)

      // Mensagens de erro mais específicas
      if (error.message?.includes('JWT')) {
        toast.error('Sessão expirada. Faça login novamente.')
      } else if (error.message?.includes('network')) {
        toast.error('Erro de conexão. Verifique sua internet.')
      } else {
        toast.error('Erro ao salvar jogador. Tente novamente.')
      }
    }
  }

  const handleEdit = (player: Player) => {
    setEditingPlayer(player)
    form.setValue('name', player.name)
    form.setValue('level', player.level)
    setShowForm(true)
  }

  const handleDelete = async (player: Player) => {
    if (!confirm(`Tem certeza que deseja deletar ${player.name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', player.id)

      if (error) throw error

      toast.success('Jogador deletado com sucesso!')
      loadPlayers()
    } catch (error) {
      console.error('Erro ao deletar jogador:', error)
      toast.error('Erro ao deletar jogador')
    }
  }

  const resetForm = () => {
    form.reset()
    setShowForm(false)
    setEditingPlayer(null)
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jogadores</h1>
          <p className="mt-2 text-gray-600">
            Gerencie seus jogadores e seus níveis de habilidade
          </p>
        </div>

        {/* Estatísticas */}
        {players.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Estatísticas</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-purple-600">{players.length}</p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {players.filter(p => p.level === 1).length}
                  </p>
                  <p className="text-sm text-gray-500">Iniciantes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {players.filter(p => p.level === 2).length}
                  </p>
                  <p className="text-sm text-gray-500">Intermediários</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {players.filter(p => p.level === 3).length}
                  </p>
                  <p className="text-sm text-gray-500">Avançados</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Aviso de Timeout */}
        {timeoutOccurred && (
          <Card className="border-orange-200 bg-orange-50">
            <CardBody className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-orange-600">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-orange-800">
                      Timeout no carregamento dos jogadores
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

        {/* Novo Jogador Button */}
        <Button
          onClick={() => setShowForm(true)}
          className="w-full"
          disabled={timeoutOccurred}
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Jogador
        </Button>

        {/* Lista de Jogadores */}
        {players.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Plus className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum jogador cadastrado
              </h3>
              <p className="text-gray-500 mb-4">
                Comece criando seu primeiro jogador
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player) => (
              <Card key={player.id}>
                <CardBody className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {player.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">Nível:</span>
                        <StarRating rating={player.level} readonly size="sm" />
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEdit(player)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(player)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Edição/Criação */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={resetForm}></div>

              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                        {editingPlayer ? 'Editar Jogador' : 'Novo Jogador'}
                      </h3>
                      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <Input
                          label="Nome do Jogador"
                          placeholder="Digite o nome"
                          {...form.register('name', { required: 'Nome é obrigatório' })}
                          error={form.formState.errors.name?.message}
                        />

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nível de Habilidade
                          </label>
                          <StarRating
                            rating={form.watch('level')}
                            onChange={(rating) => form.setValue('level', rating as 1 | 2 | 3)}
                            size="lg"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            1 estrela = Iniciante | 2 estrelas = Intermediário | 3 estrelas = Avançado
                          </p>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <Button
                    type="button"
                    onClick={form.handleSubmit(handleSubmit)}
                    disabled={form.formState.isSubmitting}
                    className="w-full sm:ml-3 sm:w-auto"
                  >
                    {form.formState.isSubmitting
                      ? 'Salvando...'
                      : editingPlayer
                      ? 'Atualizar'
                      : 'Criar'
                    }
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}