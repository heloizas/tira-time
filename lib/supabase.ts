import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Cliente para componentes Client (mantém cookies do usuário sincronizados)
export const supabase = createClientComponentClient()