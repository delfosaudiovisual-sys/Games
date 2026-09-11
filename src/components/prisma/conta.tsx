import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { makeFunctionReference } from 'convex/server'
import { mergeSaves, parseSave } from '@/game/save'
import type { SaveData } from '@/game/types'

/* `convex/_generated` não vai para o repositório, então as funções novas são
   referenciadas por nome, igual ao leaderboard. */
const loadRef = makeFunctionReference<'query', Record<string, never>, string | null>('saves:load')
const storeRef = makeFunctionReference<'mutation', { data: string }, boolean>('saves:store')

export type EstadoSync = 'desligado' | 'fundindo' | 'sincronizado' | 'erro'

/**
 * Mantém o progresso espelhado na conta.
 *
 * O localStorage continua sendo a fonte imediata — o jogo nunca espera a rede
 * para começar. A conta entra como espelho durável: ao vincular, funde uma vez
 * e daí em diante empurra as mudanças com um respiro de 1,5s.
 */
export function useCloudSave(save: SaveData, ready: boolean, onMerge: (s: SaveData) => void): EstadoSync {
  const { isAuthenticated } = useConvexAuth()
  const remoteRaw = useQuery(loadRef, isAuthenticated ? {} : 'skip')
  const store = useMutation(storeRef)
  const fundido = useRef(false)
  const saveRef = useRef(save)
  saveRef.current = save
  const [estado, setEstado] = useState<EstadoSync>('desligado')

  useEffect(() => {
    if (!isAuthenticated) {
      fundido.current = false
      setEstado('desligado')
    }
  }, [isAuthenticated])

  // Fusão única, no momento em que a conta é vinculada.
  useEffect(() => {
    if (!ready || !isAuthenticated || remoteRaw === undefined || fundido.current) return
    fundido.current = true
    setEstado('fundindo')
    const nuvem = parseSave(remoteRaw)
    const final = nuvem ? mergeSaves(saveRef.current, nuvem) : saveRef.current
    onMerge(final)
    store({ data: JSON.stringify(final) })
      .then(() => setEstado('sincronizado'))
      .catch(() => setEstado('erro'))
  }, [ready, isAuthenticated, remoteRaw, onMerge, store])

  // Alterações posteriores sobem com respiro, para não gravar a cada clique.
  useEffect(() => {
    if (!fundido.current || !isAuthenticated) return
    const id = window.setTimeout(() => {
      store({ data: JSON.stringify(saveRef.current) })
        .then(() => setEstado('sincronizado'))
        .catch(() => setEstado('erro'))
    }, 1500)
    return () => window.clearTimeout(id)
  }, [save, isAuthenticated, store])

  return estado
}

const ROTULO: Record<EstadoSync, string> = {
  desligado: 'só neste aparelho',
  fundindo: 'juntando progresso…',
  sincronizado: 'sincronizado',
  erro: 'falhou ao sincronizar',
}

/** Painel de conta: login por código de e-mail e estado da sincronização. */
export function ContaPanel({ estado }: { estado: EstadoSync }) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const pedirCodigo = useCallback(async () => {
    setErro('')
    setOcupado(true)
    try {
      await signIn('resend-otp', { email })
      setEtapa('codigo')
    } catch {
      setErro('Não consegui enviar o código. Confira o e-mail.')
    } finally {
      setOcupado(false)
    }
  }, [email, signIn])

  const confirmar = useCallback(async () => {
    setErro('')
    setOcupado(true)
    try {
      await signIn('resend-otp', { email, code: codigo })
    } catch {
      setErro('Código inválido ou expirado.')
    } finally {
      setOcupado(false)
    }
  }, [email, codigo, signIn])

  if (isLoading) {
    return <div className="pr-panel p-4 text-xs text-ink-dim">Verificando sessão…</div>
  }

  if (isAuthenticated) {
    return (
      <div className="pr-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-sm font-bold text-ink">Progresso na conta</div>
            <div className="text-[11px] text-ink-soft">
              {ROTULO[estado]}
              {estado === 'sincronizado' && ' — dá para continuar em outro aparelho'}
            </div>
          </div>
          <button className="pr-btn px-3 py-1.5 text-xs" onClick={() => void signOut()}>
            Sair
          </button>
        </div>
      </div>
    )
  }
  return <FormularioLogin {...{ etapa, setEtapa, email, setEmail, codigo, setCodigo, erro, ocupado, pedirCodigo, confirmar }} />
}

interface FormProps {
  etapa: 'email' | 'codigo'
  setEtapa: (e: 'email' | 'codigo') => void
  email: string
  setEmail: (v: string) => void
  codigo: string
  setCodigo: (v: string) => void
  erro: string
  ocupado: boolean
  pedirCodigo: () => Promise<void>
  confirmar: () => Promise<void>
}

const CAMPO =
  'min-w-[170px] flex-1 rounded-xl border-2 border-edge bg-ink/5 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-dim'

function FormularioLogin(p: FormProps) {
  return (
    <div className="pr-panel p-4">
      <div className="font-display text-sm font-bold text-ink">Guardar progresso numa conta</div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
        Sem conta, o progresso vive só neste navegador: some se você limpar os dados do site ou
        trocar de aparelho. Com conta, ele te acompanha.
      </p>

      {p.etapa === 'email' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            value={p.email}
            onChange={(e) => p.setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && p.email) void p.pedirCodigo() }}
            placeholder="seu@email.com"
            className={CAMPO}
          />
          <button
            className="pr-btn pr-btn-hot px-4 py-2 text-sm"
            disabled={!p.email || p.ocupado}
            onClick={() => void p.pedirCodigo()}
          >
            {p.ocupado ? 'Enviando…' : 'Enviar código'}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            inputMode="numeric"
            value={p.codigo}
            onChange={(e) => p.setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter' && p.codigo.length === 6) void p.confirmar() }}
            placeholder="código de 6 dígitos"
            className={`${CAMPO} text-center font-display tracking-[0.3em]`}
          />
          <button
            className="pr-btn pr-btn-hot px-4 py-2 text-sm"
            disabled={p.codigo.length !== 6 || p.ocupado}
            onClick={() => void p.confirmar()}
          >
            {p.ocupado ? 'Conferindo…' : 'Entrar'}
          </button>
          <button
            className="pr-btn px-3 py-2 text-xs"
            onClick={() => { p.setEtapa('email'); p.setCodigo('') }}
          >
            Trocar e-mail
          </button>
        </div>
      )}

      {p.erro && <p className="mt-2 text-[11px] text-rose">{p.erro}</p>}
    </div>
  )
}
