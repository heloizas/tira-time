"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Layout } from "@/components/Layout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PlayerDropdownChip } from "@/components/ui/PlayerDropdownChip";
import { StarRating } from "@/components/ui/StarRating";
import {
  Calendar,
  Users,
  Trophy,
  Shuffle,
  ArrowLeft,
  X,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Player, Match, MatchPlayer } from "@/types/database";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Link from "next/link";

interface MatchWithPlayers extends Match {
  match_players: Array<
    MatchPlayer & {
      players: Player;
    }
  >;
}

interface Team {
  number: number;
  players: Player[];
  totalLevel: number;
  averageLevel: number;
}

interface TeamsData {
  teams: Team[];
  playersOut: Player[];
}

interface MatchForm {
  date: string;
  selectedPlayers: string[];
}

export default function MatchDetailPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [match, setMatch] = useState<MatchWithPlayers | null>(null);
  const [teamsData, setTeamsData] = useState<TeamsData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [timeoutOccurred, setTimeoutOccurred] = useState(false);
  const [showTeamSizeModal, setShowTeamSizeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamSize, setTeamSize] = useState(4);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const editForm = useForm<MatchForm>({
    defaultValues: {
      date: '',
      selectedPlayers: []
    }
  });

  useEffect(() => {
    if (user && params.id) {
      loadData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, params.id, authLoading]);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (openDropdown && !target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const loadData = async () => {
    if (!user?.id || !params.id) {
      setLoading(false);
      return;
    }

    let timeoutTriggered = false;

    // Timeout de segurança
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      setTimeoutOccurred(true);
      console.warn("Match detail load timeout");
      setLoading(false);
      toast.error("Timeout ao carregar dados");
    }, 15000); // 15 segundos

    try {
      // Executar queries em paralelo para melhor performance
      const [matchResult, playersResult] = await Promise.all([
        supabase
          .from("matches")
          .select(
            `
            *,
            match_players (
              *,
              players (*)
            )
          `
          )
          .eq("id", params.id)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .order("name")
      ]);

      if (!timeoutTriggered) {
        if (matchResult.error) throw matchResult.error;
        if (playersResult.error) throw playersResult.error;

        setMatch(matchResult.data);
        setPlayers(playersResult.data || []);

        // Se já existem times definidos, calcular estatísticas
        if (
          matchResult.data.match_players.some(
            (mp: MatchPlayer & { players: Player }) => mp.team && mp.team > 0
          )
        ) {
          calculateTeams(matchResult.data.match_players);
        }
        setTimeoutOccurred(false);
      }
    } catch (error) {
      if (!timeoutTriggered) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar dados");
      }
    } finally {
      clearTimeout(timeoutId);
      if (!timeoutTriggered) {
        setLoading(false);
      }
    }
  };

  const retryLoad = () => {
    setTimeoutOccurred(false);
    setLoading(true);
    loadData();
  };

  const calculateTeams = (
    matchPlayers: Array<MatchPlayer & { players: Player }>
  ) => {
    // Agrupar jogadores por time
    const playersByTeam = new Map<number, Player[]>();
    const playersOut: Player[] = [];

    matchPlayers.forEach((mp) => {
      if (mp.players) {
        if (mp.team && mp.team > 0) {
          if (!playersByTeam.has(mp.team)) {
            playersByTeam.set(mp.team, []);
          }
          playersByTeam.get(mp.team)!.push(mp.players);
        } else {
          playersOut.push(mp.players);
        }
      }
    });

    // Criar array de times
    const teams: Team[] = [];
    playersByTeam.forEach((players, teamNumber) => {
      const totalLevel = players.reduce((sum: number, p: Player) => sum + p.level, 0);
      teams.push({
        number: teamNumber,
        players,
        totalLevel,
        averageLevel: players.length > 0 ? totalLevel / players.length : 0,
      });
    });

    // Ordenar times por número
    teams.sort((a, b) => a.number - b.number);

    setTeamsData({
      teams,
      playersOut,
    });
  };

  const generateAutomaticTeams = async () => {
    if (!match) return;

    setGenerating(true);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: match.id,
          mode: "automatic",
          teamSize: teamSize,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao gerar times");
      }

      toast.success("Times gerados automaticamente!");
      loadData(); // Recarregar dados
      setShowTeamSizeModal(false);
    } catch (error) {
      console.error("Erro ao gerar times:", error);
      toast.error("Erro ao gerar times");
    } finally {
      setGenerating(false);
    }
  };

  const handlePlayersChange = (playerIds: string[]) => {
    setSelectedPlayers(playerIds);
    editForm.setValue('selectedPlayers', playerIds);
  };

  const openEditModal = () => {
    if (!match) return;

    const matchPlayerIds = match.match_players?.map(mp => mp.players.id) || [];
    setSelectedPlayers(matchPlayerIds);
    editForm.setValue('date', match.date);
    editForm.setValue('selectedPlayers', matchPlayerIds);
    setShowEditModal(true);
  };

  const resetEditForm = () => {
    editForm.reset();
    setSelectedPlayers([]);
    setShowEditModal(false);
  };

  const handleDeleteMatch = async () => {
    if (!match) return;

    setDeleting(true);
    try {
      // Delete match_players first (foreign key constraint)
      const { error: playersError } = await supabase
        .from('match_players')
        .delete()
        .eq('match_id', match.id);

      if (playersError) throw playersError;

      // Delete the match
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('id', match.id);

      if (matchError) throw matchError;

      toast.success('Partida excluída com sucesso!');
      // Redirect to matches page
      window.location.href = '/matches';
    } catch (error) {
      console.error('Erro ao excluir partida:', error);
      toast.error('Erro ao excluir partida');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditSubmit = async (data: MatchForm) => {
    if (!match) return;

    if (selectedPlayers.length < 2) {
      toast.error('Selecione pelo menos 2 jogadores');
      return;
    }

    try {
      const selectedDate = new Date(data.date + 'T12:00:00');
      const formattedDate = selectedDate.toISOString().split('T')[0];

      // Check if match has teams assigned
      const hasTeams = match.match_players?.some(mp => mp.team && mp.team > 0) || false;

      // Update match date
      const { error: matchError } = await supabase
        .from('matches')
        .update({ date: formattedDate })
        .eq('id', match.id);

      if (matchError) throw matchError;

      // Get current players in the match
      const currentPlayerIds = match.match_players?.map(mp => mp.players.id) || [];

      // Find players to remove and add
      const playersToRemove = currentPlayerIds.filter(id => !selectedPlayers.includes(id));
      const playersToAdd = selectedPlayers.filter(id => !currentPlayerIds.includes(id));

      // Remove players no longer selected
      if (playersToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('match_players')
          .delete()
          .eq('match_id', match.id)
          .in('player_id', playersToRemove);

        if (removeError) throw removeError;
      }

      // Add new players
      if (playersToAdd.length > 0) {
        const matchPlayersData = playersToAdd.map(playerId => ({
          match_id: match.id,
          player_id: playerId,
          team: null // No team initially; will be cleared if teams were assigned
        }));

        const { error: addError } = await supabase
          .from('match_players')
          .insert(matchPlayersData);

        if (addError) throw addError;
      }

      // If match had teams assigned, clear all teams and notify user
      if (hasTeams) {
        const { error: clearTeamsError } = await supabase
          .from('match_players')
          .update({ team: null })
          .eq('match_id', match.id);

        if (clearTeamsError) throw clearTeamsError;

        // Clear teams data immediately to update UI
        setTeamsData(null);

        toast.success('Partida editada! O sorteio foi desfeito - você deve sortear os times novamente.');
      } else {
        toast.success('Partida editada com sucesso!');
      }

      resetEditForm();
      loadData();
    } catch (error) {
      console.error('Erro ao editar partida:', error);
      toast.error('Erro ao editar partida');
    }
  };

  const movePlayerToTeam = async (playerId: string, newTeam: number | null) => {
    if (!match) {
      console.error("No match found");
      return;
    }

    console.log("movePlayerToTeam called with:", { playerId, newTeam, matchId: match.id });

    try {
      const { error } = await supabase
        .from("match_players")
        .update({ team: newTeam })
        .eq("match_id", match.id)
        .eq("player_id", playerId);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Player moved successfully");
      toast.success("Jogador movido!");
      setOpenDropdown(null); // Fechar dropdown
      loadData(); // Recarregar dados
    } catch (error) {
      console.error("Erro ao mover jogador:", error);
      toast.error("Erro ao mover jogador");
    }
  };

  const toggleDropdown = (playerId: string) => {
    setOpenDropdown(openDropdown === playerId ? null : playerId);
  };

  // Componente de dropdown para mover jogador
  const MovePlayerDropdown = ({ player, currentTeam, isInTeam }: {
    player: Player,
    currentTeam?: number,
    isInTeam: boolean
  }) => {
    const isOpen = openDropdown === player.id;

    const handleMovePlayer = (newTeam: number | null) => {
      console.log('Moving player:', player.name, 'to team:', newTeam);
      movePlayerToTeam(player.id, newTeam);
    };

    return (
      <div className="relative dropdown-container">
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            toggleDropdown(player.id);
          }}
          className="px-2"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>

        {isOpen && (
          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-32">
            <div className="py-1">
              {/* Opções para mover para outros times */}
              {teamsData?.teams
                .filter(t => t.number !== currentTeam)
                .map((team) => (
                  <button
                    key={team.number}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMovePlayer(team.number);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center"
                  >
                    <div className={`w-3 h-3 rounded mr-2 ${
                      ['bg-purple-500', 'bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500'][(team.number - 1) % 8]
                    }`}></div>
                    Time {team.number}
                  </button>
                ))}

              {/* Separador se há times e opção de colocar de fora */}
              {teamsData?.teams && teamsData.teams.length > 0 && isInTeam && (
                <div className="border-t border-gray-100"></div>
              )}

              {/* Opção para colocar de fora */}
              {isInTeam && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMovePlayer(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center text-gray-600"
                >
                  <div className="w-3 h-3 rounded mr-2 bg-gray-400"></div>
                  Colocar de fora
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </Layout>
    );
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
    );
  }

  const hasTeams = teamsData && teamsData.teams.length > 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div>
            <Link
              href="/matches"
              className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar às Partidas
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Detalhes da Partida
            </h1>
            <div className="flex items-center text-gray-600 mt-2 mb-4">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {new Date(match.date + "T12:00:00")
                  .toLocaleDateString("pt-BR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </span>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => openEditModal()}
              disabled={timeoutOccurred}
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar Partida e Jogadores
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowTeamSizeModal(true)}
              disabled={
                generating || match.match_players.length < 2 || timeoutOccurred
              }
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Gerar Times
            </Button>
          </div>
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
                      Timeout ao carregar a partida
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
                  {loading ? "Carregando..." : "Tentar novamente"}
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Modal de Editar Partida */}
        <Modal
          isOpen={showEditModal}
          onClose={resetEditForm}
          title="Editar Partida"
          footer={
            <>
              <div className="flex flex-col sm:flex-row sm:justify-between w-full">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mb-3 sm:mb-0 bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
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
            {match?.match_players?.some(mp => mp.team && mp.team > 0) && (
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
            {match?.match_players && match.match_players.length > 0 && (
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

        {/* Modal de Seleção de Tamanho do Time */}
        {showTeamSizeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Configurar Times
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowTeamSizeModal(false)}
                    className="p-1"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Quantas pessoas você quer em cada time?
                  </p>
                  <Input
                    type="number"
                    min="1"
                    max={Math.floor(match.match_players.length / 2)}
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                    label="Tamanho do time"
                    placeholder="Ex: 4"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Com {match.match_players.length} jogadores e times de {teamSize} pessoas,
                    serão formados {Math.floor(match.match_players.length / teamSize)} times.
                    {match.match_players.length % teamSize > 0 && (
                      <span> {match.match_players.length % teamSize} jogador(es) ficarão de fora.</span>
                    )}
                  </p>
                </div>
                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowTeamSizeModal(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={generateAutomaticTeams}
                    disabled={generating || teamSize < 1}
                    className="flex-1"
                  >
                    {generating ? "Gerando..." : "Gerar Times"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Estatísticas da Partida */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <Card>
            <CardBody className="text-center p-2 md:p-4">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-purple-600 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {match.match_players.length}
              </p>
              <p className="text-xs md:text-sm text-gray-500">Jogadores</p>
            </CardBody>
          </Card>

          {hasTeams && (
            <>
              <Card>
                <CardBody className="text-center p-2 md:p-4">
                  <Trophy className="w-6 h-6 md:w-8 md:h-8 text-orange-600 mx-auto mb-1 md:mb-2" />
                  <p className="text-lg md:text-2xl font-bold text-gray-900">
                    {teamsData.teams.length}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500">Times</p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="text-center p-2 md:p-4">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full mx-auto mb-1 md:mb-2 flex items-center justify-center bg-blue-100 text-blue-600">
                    🔄
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-gray-900">
                    {teamsData.playersOut.length}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500">De fora</p>
                </CardBody>
              </Card>
            </>
          )}
        </div>

        {/* Times */}
        {hasTeams ? (
          <div className="space-y-6">
            {/* Times Formados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamsData.teams.map((team, index) => {
                const colors = [
                  'bg-purple-500',
                  'bg-orange-500',
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-red-500',
                  'bg-yellow-500',
                  'bg-pink-500',
                  'bg-indigo-500'
                ];
                const bgColors = [
                  'bg-purple-50',
                  'bg-orange-50',
                  'bg-blue-50',
                  'bg-green-50',
                  'bg-red-50',
                  'bg-yellow-50',
                  'bg-pink-50',
                  'bg-indigo-50'
                ];

                return (
                  <Card key={team.number}>
                    <CardHeader>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <div className={`w-6 h-6 ${colors[index % colors.length]} rounded mr-3`}></div>
                        Time {team.number}
                        <span className="ml-auto text-sm text-gray-500">
                          Nível: {team.totalLevel} | Média: {team.averageLevel.toFixed(1)}
                        </span>
                      </h3>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      {team.players.map((player) => (
                        <div
                          key={player.id}
                          className={`flex items-center justify-between p-3 ${bgColors[index % bgColors.length]} rounded-lg`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="font-medium text-gray-900">
                              {player.name}
                            </span>
                            <StarRating rating={player.level} readonly size="sm" />
                          </div>
                          <MovePlayerDropdown
                            player={player}
                            currentTeam={team.number}
                            isInTeam={true}
                          />
                        </div>
                      ))}
                      {team.players.length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                          Nenhum jogador no time
                        </p>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>

            {/* Jogadores de Fora */}
            {teamsData.playersOut.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <div className="w-6 h-6 bg-gray-400 rounded mr-3"></div>
                    Jogadores de Fora ({teamsData.playersOut.length})
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teamsData.playersOut.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-medium text-gray-900">
                            {player.name}
                          </span>
                          <StarRating rating={player.level} readonly size="sm" />
                        </div>
                        <MovePlayerDropdown
                          player={player}
                          isInTeam={false}
                        />
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        ) : (
          /* Lista de jogadores sem times definidos */
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">
                Jogadores da Partida
              </h3>
              <p className="text-sm text-gray-600">
                Clique em "Gerar Times" para distribuir automaticamente ou
                arraste os jogadores manualmente
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
                      <span className="font-medium text-gray-900">
                        {mp.players.name}
                      </span>
                      <StarRating
                        rating={mp.players.level}
                        readonly
                        size="sm"
                      />
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
              <p>
                • Clique em "Gerar Times" para escolher o tamanho do time e fazer a distribuição automática
              </p>
              <p>
                • Use o botão ⋮ ao lado de cada jogador para mover entre times
              </p>
              <p>
                • O dropdown mostra todas as opções disponíveis: outros times ou "colocar de fora"
              </p>
              <p>
                • Jogadores de fora podem ser adicionados a qualquer time através do mesmo menu
              </p>
              <p>
                • A distribuição automática equilibra os times baseada no nível dos jogadores
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}
