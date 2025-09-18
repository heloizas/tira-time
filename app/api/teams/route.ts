import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Player, Team } from '@/types/database'

// Função para gerar times automaticamente com tamanho customizável
function generateBalancedTeams(players: Player[], teamSize: number): { teams: Player[][], playersOut: Player[] } {
  // Calcular quantos times podem ser formados
  const numberOfTeams = Math.floor(players.length / teamSize)

  if (numberOfTeams === 0) {
    return { teams: [], playersOut: players }
  }

  // Ordenar jogadores por nível (maior para menor) para distribuição equilibrada
  const sortedPlayers = [...players].sort((a, b) => b.level - a.level)

  // Inicializar times vazios
  const teams: Player[][] = Array.from({ length: numberOfTeams }, () => [])
  const teamLevels: number[] = Array.from({ length: numberOfTeams }, () => 0)

  // Distribuir jogadores nos times de forma equilibrada
  const playersToDistribute = sortedPlayers.slice(0, numberOfTeams * teamSize)
  const playersOut = sortedPlayers.slice(numberOfTeams * teamSize)

  // Distribuir jogadores usando algoritmo round-robin modificado para equilibrar níveis
  for (const player of playersToDistribute) {
    // Encontrar o time com menor nível total que ainda tem espaço
    let targetTeamIndex = 0
    let minLevel = teamLevels[0]

    for (let i = 1; i < numberOfTeams; i++) {
      if (teamLevels[i] < minLevel && teams[i].length < teamSize) {
        minLevel = teamLevels[i]
        targetTeamIndex = i
      }
    }

    // Se todos os times estão cheios, encontrar o com menor nível
    if (teams[targetTeamIndex].length >= teamSize) {
      for (let i = 0; i < numberOfTeams; i++) {
        if (teams[i].length < teamSize) {
          targetTeamIndex = i
          break
        }
      }
    }

    teams[targetTeamIndex].push(player)
    teamLevels[targetTeamIndex] += player.level
  }

  return { teams, playersOut }
}

// POST - Gerar times (manual ou automático)
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const { matchId, mode, teams, teamSize } = await request.json()

    if (!matchId || !mode || !['manual', 'automatic'].includes(mode)) {
      return NextResponse.json(
        { error: 'ID da partida e modo (manual/automatic) são obrigatórios' },
        { status: 400 }
      )
    }

    if (mode === 'automatic' && (!teamSize || teamSize < 1)) {
      return NextResponse.json(
        { error: 'Tamanho do time é obrigatório no modo automático' },
        { status: 400 }
      )
    }

    // Verificar se a partida pertence ao usuário
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .eq('user_id', user.id)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Partida não encontrada' }, { status: 404 })
    }

    // Buscar jogadores da partida
    const { data: matchPlayers, error: playersError } = await supabase
      .from('match_players')
      .select(`
        *,
        players (*)
      `)
      .eq('match_id', matchId)

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 400 })
    }

    if (mode === 'automatic') {
      // Limpar times existentes primeiro
      await supabase
        .from('match_players')
        .update({ team: null })
        .eq('match_id', matchId)

      // Gerar times automaticamente
      const players = matchPlayers.map(mp => mp.players).filter(Boolean)
      const { teams: generatedTeams, playersOut } = generateBalancedTeams(players, teamSize)

      // Atualizar os times na tabela match_players
      const updates = []

      // Atribuir jogadores aos times
      for (let teamIndex = 0; teamIndex < generatedTeams.length; teamIndex++) {
        const teamPlayers = generatedTeams[teamIndex]
        const teamNumber = teamIndex + 1

        for (const player of teamPlayers) {
          updates.push(
            supabase
              .from('match_players')
              .update({ team: teamNumber })
              .eq('match_id', matchId)
              .eq('player_id', player.id)
          )
        }
      }

      // Jogadores de fora ficam com team = null (já definido acima)

      // Executar todas as atualizações
      await Promise.all(updates)

      // Calcular estatísticas dos times
      const teamsStats = generatedTeams.map((teamPlayers, index) => {
        const totalLevel = teamPlayers.reduce((sum, player) => sum + player.level, 0)
        return {
          number: index + 1,
          players: teamPlayers,
          totalLevel,
          averageLevel: teamPlayers.length > 0 ? totalLevel / teamPlayers.length : 0,
          playerCount: teamPlayers.length
        }
      })

      return NextResponse.json({
        teams: teamsStats,
        playersOut,
        numberOfTeams: generatedTeams.length,
        teamSize,
        message: `${generatedTeams.length} times gerados com sucesso`
      })

    } else {
      // Modo manual - usar times fornecidos
      if (!teams) {
        return NextResponse.json(
          { error: 'Times são obrigatórios no modo manual' },
          { status: 400 }
        )
      }

      // Implementar lógica manual se necessário
      return NextResponse.json({ error: 'Modo manual não implementado ainda' }, { status: 400 })
    }

  } catch (error) {
    console.error('Erro ao gerar times:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}