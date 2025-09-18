import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// PUT - Atualizar jogador
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      .update({ name, level })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!player) {
      return NextResponse.json({ error: 'Jogador não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ player, message: 'Jogador atualizado com sucesso' })

  } catch (error) {
    console.error('Erro ao atualizar jogador:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE - Deletar jogador
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Jogador deletado com sucesso' })

  } catch (error) {
    console.error('Erro ao deletar jogador:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}