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

---

# Rodada 3 — o canvas nunca era dimensionado

Bug reportado com foto: no celular o mapa aparecia com zoom enorme, mostrando
só o canto superior esquerdo do tabuleiro.

## Causa

`game-screen.tsx` tem um `return` antecipado enquanto `hud` é `null`
("Abrindo o caderno…"). Na primeira renderização o canvas **não está no DOM**.
O `useEffect` que definia `canvas.width/height` lia `canvasRef.current`,
encontrava `null` e pulava o bloco inteiro. O `setHud` seguinte montava o
canvas — mas o efeito tem dependência `[map.id]` e nunca mais rodava.

O canvas ficava no padrão do HTML, **300×150**, e o jogo desenhava 300×150 de um
campo de 832×576, esticado para preencher a caixa. Daí o zoom e a leve distorção
vertical.

**Bug pré-existente** — não veio do redesenho. Ficou gritante porque o novo
tabuleiro tem muito mais o que enxergar.

## Como foi diagnosticado

Não por leitura otimista: reproduzi. `ferramentas/harness/bug.ts` recria o
ciclo de vida do React passo a passo (canvas ausente → efeito roda → canvas
monta) e renderiza o `render.ts` real num viewport de 412px. A imagem saiu
idêntica à foto do bug, com bitmap 300×150 confirmado. A mesma página renderiza
o caminho corrigido logo abaixo, para comparação.

## Correção

- `fitCanvas()` passou a ser aplicado por **ref de callback**, que dispara
  exatamente quando o elemento entra no DOM — não importa em que renderização
  isso aconteça.
- O laço rAF confere o tamanho **a cada quadro** e se autocorrige. É uma
  comparação de inteiros por quadro, e cobre também a mudança de
  `devicePixelRatio` ao girar a tela (mexer em `width`/`height` zera a
  transformação do contexto).

A autocorreção é a rede de segurança: mesmo que alguém mude a ordem de
renderização de novo, o bug não volta.

## Verificação

Bundle publicado contém a função e a guarda:

```js
function _t(e){let t=Math.min(2,window.devicePixelRatio||1),n=Math.round(832*t),r=Math.round(576*t);
  (e.width!==n||e.height!==r)&&(e.width=n,e.height=r),e.getContext(`2d`)?.setTransform(t,0,0,t,0,0)}
n.width!==Math.round(832*Math.min(2,window.devicePixelRatio||1))&&_t(n)
```

---

# Rodada 4 — animações de história na abertura de cada capítulo

Cada mapa da campanha abre com uma cinemática desenhada no mesmo canvas e no
mesmo traço à mão do jogo. Roda **uma vez**, antes da primeira partida
daquele mapa, e pode ser revista pelo botão 📖 no menu.

## O beat é um estado, não um delta

A decisão que sustenta o arquivo inteiro:

```ts
export interface Beat {
  dur: number
  texto: string
  draw: (ctx, t: number, p: Palco, tempo: number) => void
}
```

`draw` recebe o progresso `t` do beat e desenha **a cena inteira naquele
instante** — nunca "o que mudou desde o quadro anterior". O player então
redesenha todos os beats anteriores com `t = 1` e só o atual com o `t` dele.

Três coisas caem de graça disso:

- **acúmulo sem estado guardado** — a tinta que o Ato I espalhou no beat 1
  continua lá no beat 4 porque é redesenhada, não porque ficou num buffer;
- **rewind** — tocar para trás é só passar um `tempo` menor;
- **nada para dessincronizar** — não existe estado mutável entre quadros que
  possa divergir do tempo da cena.

O custo é redesenhar tudo por quadro. Em 832×576 com formas vetoriais isso é
barato; o que **não** é barato é `paperGrain`, que varre cada pixel — então o
papel é rasterizado uma vez em `montarPalco()` e depois só blitado.

## As três cenas

Cada ato tem 4 beats e dura ~15s.

| Ato | Mapa | O que acontece |
|---|---|---|
| I | A Margem | a tinta escorre pela trilha **real do mapa**, e as plataformas se rascunham sobre ela |
| II | A Página Rasgada | a página vira, os desenhos estão cinzas e mortos, a Mancha engole um deles — e **abre olhos** |
| III | O Tinteiro | o tinteiro tomba, a tinta corre até o Prisma cercado, e a cor volta inundando por cima do nanquim |

A trilha do Ato I não é um desenho decorativo: `montarPalco` lê o `MapDef` e
constrói a `Trilha` a partir do caminho que o jogador vai defender. A abertura
é literalmente o mapa se desenhando.

## Defeitos encontrados por quadro-chave

Renderizei tiras de quadros-chave dos três atos em Chromium headless
(`ferramentas/harness/captura-cena.mjs`) e corrigi seis coisas que eu não
teria visto lendo o código:

1. legenda do Ato III **cortada** na largura → `quebrar()` passou a quebrar em
   duas linhas;
2. a inundação de cor estourava em branco com
   `globalCompositeOperation = 'lighter'` → trocada por redesenhar a estrada em
   cor espectral dentro de um `clip` que cresce;
3. o cabeçalho do capítulo ficava atravessado na estrada → agora ele sai em
   fade no fim do beat 1;
4. a gota de tinta era pequena demais para ler como gota;
5. o Prisma morto precisava de linhas de faceta para não virar um polígono;
6. o Prisma desaparecia atrás da estrada colorida → redesenhado por cima.

## Não repetir o bug da rodada 3

`cutscene.tsx` já nasceu com o padrão de **ref de callback** e com a
autocorreção de tamanho por quadro. O bug do canvas 300×150 não podia voltar
por uma tela nova.

## Arquivos

- `src/game/cutscene.ts` — palco, trilha, cenas, primitivas de animação
- `src/components/prisma/cutscene.tsx` — player (rAF, toque/Espaço avança,
  Esc/"Pular ›" sai)
- `seenIntros` no save, com **união** na fusão de saves: quem já viu num
  aparelho não vê de novo no outro

## Verificação

`.sandbox/check-errors` limpo (TypeScript e CSS), `npx vitest run` com 25
testes passando, `npm run build` ok. Balanceamento em `content.ts` intocado.
