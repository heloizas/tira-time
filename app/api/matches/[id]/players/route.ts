import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// POST - Adicionar jogador à partida
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { playerId } = await request.json()
    const matchId = params.id

    if (!playerId) {
      return NextResponse.json(
        { error: 'ID do jogador é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a partida pertence ao usuário
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .eq('id', matchId)
      .eq('user_id', user.id)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Partida não encontrada' }, { status: 404 })
    }

    // Verificar se o jogador pertence ao usuário
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .eq('user_id', user.id)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: 'Jogador não encontrado' }, { status: 404 })
    }

    // Verificar se o jogador já está na partida
    const { data: existingMatchPlayer } = await supabase
      .from('match_players')
      .select('id')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .single()

    if (existingMatchPlayer) {
      return NextResponse.json({ error: 'Jogador já está na partida' }, { status: 400 })
    }

    // Adicionar jogador à partida
    const { data: matchPlayer, error } = await supabase
      .from('match_players')
      .insert({
        match_id: matchId,
        player_id: playerId,
        team: null // Sem time inicialmente
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      matchPlayer,
      message: 'Jogador adicionado à partida com sucesso'
    })

  } catch (error) {
    console.error('Erro ao adicionar jogador à partida:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE - Remover jogador da partida
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { playerId } = await request.json()
    const matchId = params.id

    if (!playerId) {
      return NextResponse.json(
        { error: 'ID do jogador é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a partida pertence ao usuário
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .eq('id', matchId)
      .eq('user_id', user.id)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Partida não encontrada' }, { status: 404 })
    }

    // Remover jogador da partida
    const { error } = await supabase
      .from('match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('player_id', playerId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Jogador removido da partida com sucesso'
    })

  } catch (error) {
    console.error('Erro ao remover jogador da partida:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}