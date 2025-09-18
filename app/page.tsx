'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Trophy, Users, Calendar } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

interface LoginForm {
  email: string
  password: string
}

interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export default function HomePage() {
  const { user, signIn, signUp, loading } = useAuth()
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)

  const loginForm = useForm<LoginForm>()
  const registerForm = useForm<RegisterForm>()

  // O middleware já cuida do redirecionamento quando o usuário está logado

  const handleLogin = async (data: LoginForm) => {
    const { error } = await signIn(data.email, data.password)

    if (error) {
      toast.error(error)
    } else {
      toast.success('Login realizado com sucesso!')
      // O middleware fará o redirecionamento automático
    }
  }

  const handleRegister = async (data: RegisterForm) => {
    if (data.password !== data.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    const { error } = await signUp(data.email, data.password, data.name)

    if (error) {
      toast.error(error)
    } else {
      toast.success('Cadastro realizado com sucesso!')
      // O middleware fará o redirecionamento automático
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    )
  }

  if (user) {
    return null // Redirecionamento já está acontecendo
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Trophy className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Tira Time</h1>
          <p className="text-purple-100">
            Crie times equilibrados para suas partidas
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <div className="flex items-center text-white">
            <Users className="w-5 h-5 mr-3 text-orange-300" />
            <span className="text-sm">Cadastre seus jogadores</span>
          </div>
          <div className="flex items-center text-white">
            <Calendar className="w-5 h-5 mr-3 text-orange-300" />
            <span className="text-sm">Organize suas partidas</span>
          </div>
          <div className="flex items-center text-white">
            <Trophy className="w-5 h-5 mr-3 text-orange-300" />
            <span className="text-sm">Gere times automaticamente</span>
          </div>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader>
            <div className="flex justify-center space-x-1">
              <Button
                variant={isLogin ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setIsLogin(true)}
                className="rounded-r-none"
              >
                Entrar
              </Button>
              <Button
                variant={!isLogin ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setIsLogin(false)}
                className="rounded-l-none"
              >
                Cadastrar
              </Button>
            </div>
          </CardHeader>

          <CardBody>
            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  {...loginForm.register('email', { required: true })}
                />
                <Input
                  label="Senha"
                  type="password"
                  placeholder="Sua senha"
                  {...loginForm.register('password', { required: true })}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginForm.formState.isSubmitting}
                >
                  {loginForm.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <Input
                  label="Nome"
                  type="text"
                  placeholder="Seu nome"
                  {...registerForm.register('name', { required: true })}
                />
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  {...registerForm.register('email', { required: true })}
                />
                <Input
                  label="Senha"
                  type="password"
                  placeholder="Sua senha"
                  {...registerForm.register('password', { required: true, minLength: 6 })}
                />
                <Input
                  label="Confirmar Senha"
                  type="password"
                  placeholder="Confirme sua senha"
                  {...registerForm.register('confirmPassword', { required: true })}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerForm.formState.isSubmitting}
                >
                  {registerForm.formState.isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}