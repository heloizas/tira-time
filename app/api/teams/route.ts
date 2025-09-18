import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Player, Team } from '@/types/database'

// Função para gerar times automaticamente (distribuição equilibrada)
function generateBalancedTeams(players: Player[]): { team1: Player[], team2: Player[] } {
  // Ordenar jogadores por nível (maior para menor)
  const sortedPlayers = [...players].sort((a, b) => b.level - a.level)

  const team1: Player[] = []
  const team2: Player[] = []
  let team1Level = 0
  let team2Level = 0

  // Distribuir jogadores alternando entre os times, priorizando equilíbrio
  for (const player of sortedPlayers) {
    if (team1Level <= team2Level) {
      team1.push(player)
      team1Level += player.level
    } else {
      team2.push(player)
      team2Level += player.level
    }
  }

  return { team1, team2 }
}

// POST - Gerar times (manual ou automático)
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const { matchId, mode, teams } = await request.json()

    if (!matchId || !mode || !['manual', 'automatic'].includes(mode)) {
      return NextResponse.json(
        { error: 'ID da partida e modo (manual/automatic) são obrigatórios' },
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

    let finalTeams: { team1: Player[], team2: Player[] }

    if (mode === 'automatic') {
      // Gerar times automaticamente
      const players = matchPlayers.map(mp => mp.players).filter(Boolean)
      finalTeams = generateBalancedTeams(players)
    } else {
      // Modo manual - usar times fornecidos
      if (!teams || !teams.team1 || !teams.team2) {
        return NextResponse.json(
          { error: 'Times são obrigatórios no modo manual' },
          { status: 400 }
        )
      }
      finalTeams = teams
    }

    // Atualizar os times na tabela match_players
    const updates = []

    // Time 1
    for (const player of finalTeams.team1) {
      updates.push(
        supabase
          .from('match_players')
          .update({ team: 1 })
          .eq('match_id', matchId)
          .eq('player_id', player.id)
      )
    }

    // Time 2
    for (const player of finalTeams.team2) {
      updates.push(
        supabase
          .from('match_players')
          .update({ team: 2 })
          .eq('match_id', matchId)
          .eq('player_id', player.id)
      )
    }

    // Executar todas as atualizações
    await Promise.all(updates)

    // Calcular estatísticas dos times
    const team1Stats = {
      totalLevel: finalTeams.team1.reduce((sum, player) => sum + player.level, 0),
      averageLevel: finalTeams.team1.reduce((sum, player) => sum + player.level, 0) / finalTeams.team1.length,
      playerCount: finalTeams.team1.length
    }

    const team2Stats = {
      totalLevel: finalTeams.team2.reduce((sum, player) => sum + player.level, 0),
      averageLevel: finalTeams.team2.reduce((sum, player) => sum + player.level, 0) / finalTeams.team2.length,
      playerCount: finalTeams.team2.length
    }

    return NextResponse.json({
      teams: {
        team1: finalTeams.team1,
        team2: finalTeams.team2
      },
      stats: {
        team1: team1Stats,
        team2: team2Stats,
        balanced: Math.abs(team1Stats.totalLevel - team2Stats.totalLevel) <= 1
      },
      message: 'Times gerados com sucesso'
    })

  } catch (error) {
    console.error('Erro ao gerar times:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}