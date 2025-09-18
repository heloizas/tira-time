# Tira Time ⚽

Um aplicativo full-stack para montagem automática de times equilibrados, desenvolvido com Next.js, Supabase e Tailwind CSS.

## 🚀 Funcionalidades

- **Autenticação**: Sistema completo de login/cadastro com Supabase Auth
- **Gestão de Jogadores**: Cadastro de jogadores com sistema de níveis (1-3 estrelas)
- **Criação de Partidas**: Organize partidas e selecione jogadores
- **Montagem de Times**:
  - Automática: Algoritmo inteligente para equilibrar times baseado nos níveis
  - Manual: Arrastar e soltar jogadores entre times
- **Dashboard**: Visão geral com estatísticas e ações rápidas
- **Responsivo**: Interface otimizada para celular e desktop

## 🛠️ Tecnologias

### Frontend
- **Next.js 14**: Framework React com App Router
- **TypeScript**: Tipagem estática
- **Tailwind CSS**: Estilização utilitária
- **React Hook Form**: Gerenciamento de formulários
- **Lucide React**: Ícones
- **React Hot Toast**: Notificações

### Backend
- **Next.js API Routes**: Serverless functions
- **Supabase**:
  - PostgreSQL como banco de dados
  - Autenticação
  - Row Level Security (RLS)

### Deploy
- **Vercel**: Frontend e API Routes
- **Supabase**: Banco de dados

## 📦 Instalação

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd montar-times
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.local.example .env.local
```

Preencha o arquivo `.env.local` com suas credenciais do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_publica_do_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_do_supabase
```

4. **Configure o banco de dados**

Execute os scripts SQL do arquivo `lib/database.sql` no seu projeto Supabase para criar as tabelas e configurar as políticas de segurança.

5. **Execute o projeto**
```bash
npm run dev
```

Acesse http://localhost:3000

## 🗄️ Estrutura do Banco

### Tabelas

- **profiles**: Perfis dos usuários (complementa auth.users)
- **players**: Jogadores cadastrados pelos usuários
- **matches**: Partidas criadas
- **match_players**: Relacionamento entre partidas e jogadores

### Políticas RLS

Todas as tabelas possuem Row Level Security configurado para garantir que usuários só acessem seus próprios dados.

## 📱 Como Usar

1. **Cadastro/Login**: Crie uma conta ou faça login
2. **Cadastre Jogadores**: Adicione jogadores com níveis de 1-3 estrelas
3. **Crie uma Partida**: Selecione data e jogadores
4. **Monte os Times**:
   - Use a montagem automática para equilibrar por níveis
   - Ou arraste jogadores manualmente entre os times
5. **Visualize Estatísticas**: Veja o equilíbrio dos times gerados

## 🎯 Algoritmo de Balanceamento

O algoritmo de montagem automática:
1. Ordena jogadores por nível (maior → menor)
2. Distribui alternadamente entre os times
3. Prioriza o time com menor nível total
4. Considera times equilibrados quando a diferença de nível total ≤ 1

## 🔧 Scripts Disponíveis

- `npm run dev`: Desenvolvimento
- `npm run build`: Build de produção
- `npm run start`: Executar build
- `npm run lint`: Verificar código

## 📁 Estrutura do Projeto

```
montar-times/
├── app/                    # App Router do Next.js
│   ├── api/               # API Routes
│   ├── dashboard/         # Dashboard
│   ├── players/           # Gestão de jogadores
│   ├── matches/           # Gestão de partidas
│   └── page.tsx           # Página inicial (auth)
├── components/            # Componentes reutilizáveis
│   ├── ui/               # Componentes de interface
│   └── Layout.tsx        # Layout principal
├── contexts/             # Context providers
├── lib/                  # Utilitários
│   ├── supabase.ts      # Cliente Supabase
│   └── database.sql     # Scripts SQL
└── types/               # Tipos TypeScript
```

## 🌐 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório GitHub à Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

### Supabase

1. Crie um projeto no Supabase
2. Execute os scripts SQL
3. Configure as variáveis de ambiente

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.

## 🆘 Suporte

Se encontrar problemas ou tiver sugestões:
1. Abra uma issue no GitHub
2. Descreva o problema detalhadamente
3. Inclua steps para reproduzir

---

Desenvolvido com ❤️ para facilitar a montagem de times equilibrados!