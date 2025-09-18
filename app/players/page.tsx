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
  const { user } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)

  const form = useForm<PlayerForm>({
    defaultValues: {
      name: '',
      level: 1
    }
  })

  useEffect(() => {
    if (user) {
      loadPlayers()
    }
  }, [user])

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setPlayers(data || [])
    } catch (error) {
      console.error('Erro ao carregar jogadores:', error)
      toast.error('Erro ao carregar jogadores')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: PlayerForm) => {
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
            user_id: user?.id
          })

        if (error) throw error
        toast.success('Jogador criado com sucesso!')
      }

      form.reset()
      setShowForm(false)
      setEditingPlayer(null)
      loadPlayers()
    } catch (error) {
      console.error('Erro ao salvar jogador:', error)
      toast.error('Erro ao salvar jogador')
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Jogadores</h1>
            <p className="mt-2 text-gray-600">
              Gerencie seus jogadores e seus níveis de habilidade
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="mt-4 sm:mt-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Jogador
          </Button>
        </div>

        {/* Formulário */}
        {showForm && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPlayer ? 'Editar Jogador' : 'Novo Jogador'}
              </h3>
            </CardHeader>
            <CardBody>
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

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
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
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

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
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Jogador
              </Button>
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
                      <p className="text-xs text-gray-400 mt-2">
                        Criado em {new Date(player.created_at).toLocaleDateString('pt-BR')}
                      </p>
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
      </div>
    </Layout>
  )
}