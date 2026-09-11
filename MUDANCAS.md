# Redesenho visual — "Papel e Nanquim"

Rodada de revisão visual de **Guardiões do Prisma**. A fonte de verdade do
projeto é a Macaly; este branch é o registro da mudança.

## O que motivou

O jogo tinha passado por um redesenho ainda não validado visualmente. Rodei o
próprio `render.ts` num Chromium headless e fotografei os estados reais. O que
apareceu:

| Achado | Evidência |
| --- | --- |
| Torre e inimigo eram a mesma espécie | ambos redondos, com olhos brancos grandes e boca |
| 8 dos 11 inimigos eram o mesmo círculo com pernas | só cor e diâmetro mudavam |
| A 390px (celular) sobravam 3 silhuetas distinguíveis | Curandeiro, Espectro e os chefes |
| Cano da Faísca escondido atrás da própria cabeça | a "atiradora rápida" não tinha arma visível |
| Arte da torre estourava a célula de 64px em ~50% | Lança-Prisma ocupava ~98px de altura |
| Farol tinha dois rostos | lanterna com olho + cara no corpo |
| Balão ENTRADA cortado na borda esquerda | só existia trava do lado direito |
| Realce de construção pintava ~70 células de verde | realçar tudo é o mesmo que realçar nada |
| A paleta do CSS não controlava o canvas | 49 hex + 46 `rgba()` soltos em `render.ts` |

## Direção de arte

**Você desenha em cor. A corrupção é nanquim.**

O terreno é papel tonalizado com grão. As defesas são lápis de cor saturado. A
estrada é uma aguada de tinta escura derramada na página, e os inimigos são
borrões dessa tinta — dessaturados, sem cor própria. Fundo claro contra estrada
escura inverte a relação antiga, em que a coisa mais brilhante do tabuleiro era
justamente a única onde não se pode agir.

O tremido das linhas é **determinístico**, semeado pelo `uid` da unidade. Tremido
sorteado a cada quadro faria a tela ferver a 60fps.

## História — O Caderno

Alguém derrubou o tinteiro sobre o caderno. A Mancha não odeia ninguém: ela
apaga. O Prisma é a última cor que sobrou.

| Ato | Mapa | Desfecho |
| --- | --- | --- |
| I | A Margem | Você contém — e descobre que a Mancha escorreu de uma página anterior |
| II | A Página Rasgada | A Mancha imita o que apaga; cada coisa engolida vira uma forma nova dela |
| III | O Tinteiro | Você não a mata: desenha por cima, e a página vira um desenho novo |

## Plataformas de torre

Saímos de ~70 células livres por mapa para **17 / 15 / 16 plataformas fixas**,
desenhadas à mão (modelo Kingdom Rush / Defense Grid). Todas encostam na estrada
e nunca duas ficam coladas, então cada posição decide alguma coisa.

⚠️ Isso **é** mudança de dificuldade, ainda que nenhum número de balanceamento
tenha sido tocado. O jogo ficou mais difícil e o ouro passa a ir para menos
torres mais evoluídas. Precisa de playtest.

`ferramentas/valida-plataformas.py` confere as 48 coordenadas: dentro da grade,
fora da estrada, fora de célula bloqueada, encostando na estrada e nunca
ortogonalmente adjacentes entre si.

## Arquivos neste branch

Escritos por inteiro nesta rodada:

- `src/game/palette.ts` — **novo**. Fonte única das cores do canvas.
- `src/game/sketch.ts` — **novo**. Primitivas de desenho à mão.
- `src/game/render.ts` — reescrito.
- `src/components/prisma/glyphs.tsx` — reescrito, para o retrato da loja bater
  com o bicho em campo.
- `ferramentas/harness/` — o harness de validação visual. Compila o TS real e
  fotografa os estados do jogo, incluindo o teste de silhueta chapada.

## Edições cirúrgicas (aplicadas na Macaly)

Estes arquivos receberam alterações pontuais e **não estão copiados aqui** — o
diff real está no histórico git da Macaly. Resumo do que mudou em cada um:

- `src/game/types.ts` — `MapDef` ganhou `pads: Array<[number, number]>`.
- `src/game/content.ts` — plataformas dos 3 mapas; renomeação completa para a
  história (torres, inimigos, mapas, ondas, habilidades). **Nenhum número de
  balanceamento alterado** — verificado comparando os numerais das linhas
  removidas e adicionadas do diff.
- `src/game/engine.ts` — campo `padCells`; `isBuildable` passou a exigir
  plataforma; mensagens de "quadrado azul" trocadas.
- `src/styles.css` — paleta papel/nanquim; fonte manuscrita (Patrick Hand);
  removida a varredura arco-íris animada de `.pr-title`; glassmorphism virou
  ficha de papel sobre mesa de madeira.
- `src/components/prisma/game-screen.tsx` — tutorial reescrito para a história;
  legenda e dica ajustadas para plataformas; onda passou a mostrar o **nome** do
  inimigo em vez do id cru.
- `src/components/prisma/menu-screen.tsx` — sinopse e ajuda reescritas.

## Verificação

- `.sandbox/check-errors` — TypeScript e Tailwind CSS limpos.
- `npx vitest run` — 16 testes, todos passando.
- Harness visual — partida, primeiro contato, modo construção, celular 390px e
  teste de silhueta chapada.

---

# Rodada 2 — fechamento

## Balanceamento: eu estava errado

Eu tinha alertado que as plataformas deixariam o jogo mais difícil. Medi em vez
de adivinhar: `__tests__/sim.test.ts` roda o motor **sem renderização**, com um
jogador automático, e compara plataformas contra a colocação livre antiga.

| mapa | modo | onda | vidas | torres | vitórias |
| --- | --- | --- | --- | --- | --- |
| A Margem | plataformas | 20 | 20/20 | 17 | 5/5 |
| A Margem | livre (antigo) | 20 | 20/20 | 75 | 5/5 |
| A Página Rasgada | plataformas | 20 | 18/18 | 15 | 5/5 |
| A Página Rasgada | livre (antigo) | 20 | 18/18 | 74 | 5/5 |
| O Tinteiro | plataformas | 20 | 15/15 | 16 | 5/5 |
| O Tinteiro | livre (antigo) | 20 | 15,6/15 | 71 | 5/5 |

**As plataformas não pioraram nada.** Concentrar o ouro em ~16 posições, todas
coladas na estrada, compensa exatamente a perda de quantidade.

O que a medição expôs de verdade é outra coisa: **a campanha é fácil demais**.
Um jogador automático burro — cicla tipos de torre, sempre melhora a mais barata
— vence os três mapas de vida cheia, inclusive "O Tinteiro", que deveria ser
brutal. Isso já era verdade antes da mudança, então não é regressão; é dívida de
design que fica anotada.

Ressalvas honestas da simulação: o autômato gasta cada moeda no instante em que
ela entra e nunca erra de economia, o que um humano não faz; em compensação ele
posiciona pior. Serve como **piso** de poder, não como modelo de jogador real.

O teste é opt-in (`SIM=1 npx vitest run`) porque leva ~20s.

## Conta e progresso sincronizado

- `convex/schema.ts` — entram `authTables` (faltavam: sem elas o login por
  código de e-mail não persistia) e a tabela `saves` por usuário.
- `convex/saves.ts` — `load` e `store`, ambos recusando sem sessão.
- `src/game/save.ts` — `mergeSaves` e `parseSave`.
- `src/components/prisma/conta.tsx` — hook de espelhamento e login por código.

**A regra de fusão é a parte delicada.** Prismas são moeda que se gasta, então
somar os dois lados duplicaria dinheiro: um rank comprado no celular sairia de
graça se juntássemos os prismas do computador. A economia (prismas em caixa +
ranks da árvore) vem **inteira do lado mais avançado**, medido por
`prismas + skillSpent`. O que não é econômico — mapas, conquistas, recordes,
contadores — une pelo melhor dos dois. Conquista herdada do outro lado vem sem
o prêmio em prismas, de propósito: é o lado conservador do trade-off.

`__tests__/fusao-de-save.test.ts` cobre isso em 5 casos, incluindo o de não
duplicar moeda e o de comutatividade.

O localStorage continua sendo a fonte imediata — o jogo nunca espera a rede para
começar. A conta é espelho durável, com fusão única ao vincular e envio com
respiro de 1,5s depois.

## Ajuste

Sinergias "Tempestade Gélida" e "Mira Congelada" → "Pó Condutor" e "Mira Firme".
Ecoavam o "Gélido", que virou "Giz".

## Verificação

- `.sandbox/check-errors` — TypeScript e Tailwind limpos.
- `.sandbox/deploy-convex-app` — "Live deployed. The public Convex contract is
  backward-compatible." 9 tabelas no deployment.
- `npx convex run saves:load '{}'` → `null`; `saves:store` → `false` (sem sessão).
- `npx vitest run` — 25 testes passando, 1 opt-in pulado.
- `npm run build` — limpo.
- Bundle publicado varrido: marcadores da conta e das sinergias novas presentes,
  os antigos zerados.
