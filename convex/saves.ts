import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

/** Progresso do jogador logado, ou null se não houver sessão. */
export const load = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const row = await ctx.db
      .query('saves')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    return row?.data ?? null
  },
})

/** Grava o progresso do jogador logado. Sem sessão, não faz nada. */
export const store = mutation({
  args: { data: v.string() },
  handler: async (ctx, { data }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    const row = await ctx.db
      .query('saves')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (row) await ctx.db.patch(row._id, { data, updatedAt: Date.now() })
    else await ctx.db.insert('saves', { userId, data, updatedAt: Date.now() })
    return true
  },
})
