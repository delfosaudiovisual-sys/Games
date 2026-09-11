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
