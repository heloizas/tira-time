import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// GET - Listar jogadores do usuário autenticado
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ players })

  } catch (error) {
    console.error('Erro ao buscar jogadores:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST - Criar novo jogador
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { name, level } = await request.json()

    if (!name || !level || level < 1 || level > 3) {
      return NextResponse.json(
        { error: 'Nome e nível (1-3) são obrigatórios' },
        { status: 400 }
      )
    }

    const { data: player, error } = await supabase
      .from('players')
      .insert({
        name,
        level,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ player, message: 'Jogador criado com sucesso' })

  } catch (error) {
    console.error('Erro ao criar jogador:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}