import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// GET - Listar partidas do usuário
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Buscar partidas com jogadores e times
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        *,
        match_players (
          *,
          players (*)
        )
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ matches })

  } catch (error) {
    console.error('Erro ao buscar partidas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST - Criar nova partida
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { date, players } = await request.json()

    if (!date || !players || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { error: 'Data e lista de jogadores são obrigatórios' },
        { status: 400 }
      )
    }

    // Criar a partida
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        date,
        user_id: user.id,
      })
      .select()
      .single()

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 400 })
    }

    // Associar jogadores à partida (sem times ainda)
    const matchPlayersData = players.map(playerId => ({
      match_id: match.id,
      player_id: playerId,
      team: null, // Sem time inicialmente; será definido na geração de times
    }))

    const { error: playersError } = await supabase
      .from('match_players')
      .insert(matchPlayersData)

    if (playersError) {
      // Se erro, deletar a partida criada
      await supabase.from('matches').delete().eq('id', match.id)
      return NextResponse.json({ error: playersError.message }, { status: 400 })
    }

    return NextResponse.json({ match, message: 'Partida criada com sucesso' })

  } catch (error) {
    console.error('Erro ao criar partida:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}