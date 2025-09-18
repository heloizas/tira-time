import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { authRateLimiter } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown'

    if (!authRateLimiter.isAllowed(clientIp)) {
      return NextResponse.json(
        { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
        { status: 429 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Login realizado com sucesso'
    })

  } catch (error) {
    console.error('Erro no login:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}