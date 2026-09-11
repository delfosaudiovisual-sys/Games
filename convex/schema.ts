import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Tabelas do Convex Auth. Sem elas o login por código de e-mail não persiste.
  ...authTables,

  runs: defineTable({
    name: v.string(),
    mapId: v.string(),
    wave: v.number(),
    kills: v.number(),
    score: v.number(),
    endless: v.boolean(),
  }).index('by_map_score', ['mapId', 'score']),

  // O progresso vai como JSON num campo só, de propósito: `SaveData` ainda
  // muda de forma a cada rodada de conteúdo, e um schema espelhado obrigaria
  // uma migração do banco a cada campo novo.
  saves: defineTable({
    userId: v.id('users'),
    data: v.string(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
})
