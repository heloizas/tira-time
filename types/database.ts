// Tipos TypeScript para o banco de dados
export interface Profile {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  name: string
  level: 1 | 2 | 3
  user_id: string
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  date: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface MatchPlayer {
  id: string
  match_id: string
  player_id: string
  team: number | null
  created_at: string
}

// Tipos para operações
export interface CreatePlayerData {
  name: string
  level: 1 | 2 | 3
}

export interface UpdatePlayerData {
  name?: string
  level?: 1 | 2 | 3
}

export interface CreateMatchData {
  date: string
  players: string[] // IDs dos jogadores
}

export interface Team {
  number: number
  players: Player[]
  totalLevel: number
}