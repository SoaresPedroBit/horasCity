# 🏙️ horasCity

Uma cidade 3D onde cada prédio é um aluno e a altura do prédio são as horas
Blackboard dele no sistema da faculdade. Inspirado no
[GitHub City](https://github.com/honzaap/GithubCity) / conceito CodeCity.

Qualquer pessoa pode passear pela cidade. Um aluno pode informar seu RA e
aceitar participar; a inscrição fica registrada e o prédio entra na cidade na
próxima atualização do `data/participantes.json`.

## Como rodar localmente

O site é estático, mas o `fetch` do JSON exige um servidor local:

```bash
npx serve .
# ou
python -m http.server 8000
```

Depois abra `http://localhost:3000` (ou `:8000`).

## Estado atual

- ✅ Cidade 3D em Three.js (sem build, módulos via CDN) com câmera livre
- ✅ Prédios gerados a partir de `data/participantes.json`
  - Altura = total de horas · cor/largura = variação determinística pelo id
    público · posição = espiral pela ordem de entrada (a cidade cresce sem
    mover ninguém)
- ⚠️ Botão "Meu prédio": **inativo**. O código está todo lá (`lerMeuId`,
  `CHAVE_MEU_ID`, o listener do botão), mas quem gravava a chave era o fluxo
  de adesão antigo. Hoje nada escreve `horascity:meu-id`, então `jaParticipa`
  é sempre falso e o botão nunca aparece. Faz sentido: a adesão virou
  assíncrona e não há `id` para guardar no ato — ele só existe quando a
  inscrição vira uma linha do JSON. Enquanto isso não se resolve, não há como
  reencontrar o próprio prédio
- ✅ Sair do avião (botão ou `Esc`) devolve a câmera à vista geral da cidade.
  O afastamento dessa vista acompanha o tamanho da espiral, então a cidade
  inteira continua cabendo no quadro conforme ela cresce até 100 prédios.
- ✅ Outdoor no telhado de cada prédio com o apelido do dono, desenhado em
  canvas com a cor do prédio na moldura. O letreiro gira em torno de Y para
  encarar a câmera, então é legível de qualquer ângulo — os dois postes são
  simétricos e acompanham o giro sem denunciá-lo. O painel é uma caixa fina
  (não um plano de dupla face), para o texto não sair espelhado no verso. Como
  o letreiro gira, a caixa de colisão do prédio sobe até o topo dele: o avião
  bate no outdoor em vez de atravessá-lo, seja qual for a orientação
- ✅ Tooltip ao passar o mouse num prédio (ou no outdoor dele): apelido + total de horas
  (desligado no modo avião, onde ficaria congelado apontando para um prédio
  que já passou)
- ✅ Modo avião: pilote sobre a cidade (W/S sobe e desce, A/D vira,
  Shift turbo, Esc sai). O modelo é uma homenagem ao Dodo do GTA San Andreas
  feita com primitivas — asa alta de envergadura curta, fuselagem roliça,
  hélice girando no nariz e trem de pouso fixo (`js/aviao.js`)
- ✅ Colisão com os prédios: o avião não atravessa mais nenhum. Como os
  prédios são caixas sem rotação, o teste é esfera-vs-AABB exato (o ponto mais
  próximo sai de um `clamp`), e o avião é empurrado para fora pela face mais
  rasa. O raio de colisão é lido do próprio modelo, então mudar o tamanho do
  avião em `aviao.js` não exige ajuste aqui. **Não há manobra automática de
  desvio na batida** — o comando continua na mão do piloto
- ✅ Ao bater sai uma explosão leve no ponto do impacto: um clarão aditivo que
  cresce e apaga, faíscas (posição analítica `v·t` com gravidade leve, nada
  acumula entre quadros) e as **horas do prédio subindo em letras grandes**,
  num sprite sem `depthTest` para não ficarem escondidas dentro do prédio.
  O fogo dura 0,9 s e as horas 1,4 s — o fogo é o susto, o número é
  informação e precisa sobrar tempo para lê-lo depois do clarão apagar
- ✅ Junto com a explosão, uma faixa no topo mostra de quem é o prédio e
  quantas horas ele tem — é o equivalente em voo do tooltip do modo mapa, e
  tem tempo próprio (2,8 s). Enquanto o avião raspa no mesmo prédio a
  mensagem não é reescrita nem a explosão refeita a cada quadro
- ✅ Limite do mapa: cúpula translúcida com anel no chão marcando a borda.
  Ao encostar nela o avião faz a volta sozinho e segue voando — vira para o
  centro da cidade, o que num toque de frente é exatamente um giro de 180°.
  O comando do piloto fica suspenso durante a manobra (~1,3 s). A borda
  também limita o quanto a câmera livre consegue se afastar.
- ✅ Teto de **100 prédios**. O contador no topo mostra `N / 100`; quando
  lota, o botão vira "Cidade lotada" e o cadastro é recusado com aviso no
  próprio formulário (quem já tem prédio continua podendo atualizar as horas)
- ✅ Fluxo "Participar da cidade" com consentimento, enviando RA + apelido
  para um **Google Forms** (`js/formulario.js`). Os prédios já visíveis na
  cidade continuam sendo dados de demonstração: a consulta das horas na
  faculdade ainda é manual, e a inscrição só vira prédio quando o
  `participantes.json` é atualizado
- ✅ Modelo de privacidade sem RA no lado público (ver abaixo)
- ✅ Circuito de argolas contra o relógio (botão "🏁 Circuito"): oito argolas
  em cruzamentos de rua — o único ponto da malha onde é certo não haver
  prédio. O percurso vai e volta por duas ruas vizinhas do miolo da cidade:
  como a espiral preenche do centro para fora, essas quadras têm prédios dos
  dois lados desde os primeiros participantes, enquanto um traçado largo
  ficaria sobrevoando chão vazio numa cidade pequena. As alturas alternam
  entre 12 e 20 — sempre no nível do canyon, que é onde está a dificuldade —
  e a curva de 180° entre a ida e a volta cai fora da cidade, onde há espaço
  livre para manobrar. O traçado é fixo em coordenadas do mundo e não
  acompanha o tamanho da cidade: se acompanhasse, cada tempo teria sido feito
  num percurso diferente e o recorde não compararia nada.
  A passagem é detectada pelo **cruzamento do plano** da argola entre um
  quadro e o outro — testar a distância até o centro perderia o aro, já que
  a 60 u/s o avião anda ~6 unidades por quadro e o atravessa sem nunca
  aparecer "dentro" dele. O cronômetro usa `performance.now()` e não a soma
  dos `dt`, que é clampada em 0,1 s e daria tempo de brinde a quem trava.
  O recorde fica no `localStorage`
- ⬜ Leaderboard online do circuito (Supabase)
- ⬜ Integração com a API real da faculdade (hoje a consulta das horas é feita
  à mão a partir da planilha de respostas)
- ⬜ Devolver o `id` ao navegador para reativar o "Meu prédio"
- ⬜ Botão "sair da cidade" (remoção do registro). O checkbox de consentimento
  já promete "posso sair quando quiser", então hoje isso só vale como
  compromisso manual

## Privacidade — a regra central do projeto

**O RA nunca aparece do lado público, e nada publicado permite chegar até
ele.** O que a cidade expõe é apenas:

```json
{ "id": "9896194fbbde957e", "apelido": "Pedro S.", "horas": 125 }
```

O `id` é um valor **aleatório**, atribuído no momento em que a inscrição vira
uma linha do JSON. Ele não é derivado do RA.

### Onde o RA está hoje

O RA sai do navegador uma única vez, num `POST` para um Google Forms
(`js/formulario.js`), e cai numa **planilha privada**. Essa planilha é o
mapeamento `RA → apelido` do projeto — o equivalente ao que o desenho abaixo
chama de "guarda RA → id, privado, só no servidor". Duas consequências que a
versão anterior deste documento não previa:

- **O Google passa a ver o RA.** A planilha é privada, mas a requisição é
  registrada por um terceiro. Não é o mesmo que publicar, mas é mais gente
  vendo o RA do que o desenho original previa.
- **O Forms carimba data e hora de cada resposta**, automaticamente. Isso não
  quebra nada enquanto o carimbo ficar na planilha; quebra a regra 6 abaixo no
  dia em que alguém copiar a planilha inteira para o JSON público.

### Por que não basta "hashear" o RA

Foi a primeira ideia descartada. O espaço de RAs é minúsculo: ~1,2 milhão de
combinações para 12 anos de ingresso. Hashear todas elas e montar a tabela
reversa `hash → RA` levou **3 segundos** num script Python comum. Publicar o
hash do RA equivale a publicar o RA. O mesmo vale para qualquer valor derivado
dele (RA embaralhado, base64, "últimos dígitos", posição na cidade por ordem
de RA). Só um identificador aleatório sem relação com o RA resolve — ou um
HMAC com segredo que fique exclusivamente no servidor.

### O que já está garantido no código

- `data/participantes.json` não tem campo `ra`, e o arquivo carrega um aviso
  para quem for editá-lo depois.
- O RA existe apenas dentro do formulário de adesão, é enviado uma vez e o
  campo é limpo em seguida — não entra na lista de participantes em memória.
- O navegador nunca guarda o RA. Hoje o `localStorage` só guarda o recorde do
  circuito; a chave `horascity:meu-id` existe no código mas não é mais
  escrita (ver "Meu prédio" no estado atual).
- Não existe busca por RA em lugar nenhum: seria um oráculo de "o RA X está
  na cidade como fulano, com N horas".
- O apelido é validado contra sequências de 4+ dígitos (evita que alguém use
  o próprio RA como apelido) e escapado antes de ir para o HTML.

### O que o backend precisa respeitar

Estas regras foram escritas para o backend próprio que ainda não existe. Com o
Google Forms no lugar dele, as que dependem de código de servidor (1, 3, 4, 7)
estão **em aberto**, não cumpridas — ver a seção seguinte.

1. O `id` é gerado com um gerador criptográfico (`crypto.randomUUID()`,
   `secrets.token_hex()`), **nunca** a partir do RA.
2. A tabela que liga `RA → id` fica só no servidor, e nada nesse mapeamento é
   servido por endpoint algum.
3. A resposta do `POST /participar` devolve **apenas** `{ id, horas }`.
4. Rate limiting no endpoint. Como a API da faculdade é um `GET` aberto por
   RA, sem limite qualquer um consegue varrer RAs e descobrir as horas de
   todo mundo — inclusive de quem nunca entrou na cidade.
5. Nada de logs com o RA (nem de acesso, nem de erro). Log de RA é vazamento
   de RA com passos extras.
6. Não publicar data/hora de cadastro por participante: quem observa a cidade
   consegue correlacionar "entrou agora" com quem acabou de entrar.
7. Recusar novos cadastros ao chegar em 100 participantes. O limite no
   navegador é só cosmético; quem decide é o servidor.

### Ainda em aberto

- **O endpoint de inscrição é público.** A URL do formulário e os dois
  `entry.` estão no JavaScript, à vista de qualquer um que abra o DevTools.
  Dá para fazer `POST` direto, quantas vezes se quiser, com qualquer RA e
  qualquer apelido — sem rate limit e sem prova de posse. É a regra 4 acima
  não cumprida, e não tem conserto limpo dentro do Google Forms: o endpoint é
  público por natureza. É o argumento mais forte a favor de trocá-lo por uma
  função de servidor com a chave do lado de lá.
- **Posse do RA**: alguém pode inscrever o RA de outra pessoa sob um apelido
  qualquer. Deixou de ser hipótese — com o endpoint aberto, é o caminho de
  menor esforço. A correção real é provar a posse: login institucional ou
  confirmação por e-mail da faculdade antes de criar o prédio.
- **O envio não sabe se deu certo.** O `fetch` usa `mode: 'no-cors'`, então a
  resposta é opaca: erros HTTP (formulário fechado, `entry.` errado) resolvem
  como sucesso, e só uma falha de rede rejeita. Na prática o `catch` de
  `js/formulario.js` quase nunca dispara e a mensagem de "inscrição enviada"
  aparece de qualquer jeito. É inerente a postar num Forms de outra origem;
  o jeito de não ser pego de surpresa é conferir a planilha depois de mexer
  nos `entry.`.
- **Turmas pequenas**: em cursos com poucos participantes, "maior número de
  horas" pode identificar alguém mesmo sem o RA. Está coberto pelo
  consentimento, mas vale ter o botão de sair funcionando.
- **O tooltip ainda mostra apelido + horas** ao passar o mouse num prédio.
  Se a intenção de tirar o leaderboard foi impedir que se veja quantas horas
  cada pessoa tem, o tooltip precisa mudar junto — hoje ele expõe o mesmo par
  apelido↔horas, só que um prédio por vez.

## Arquitetura

### Como está hoje

```
[Aluno]                                    [GitHub Pages]
   │  RA + apelido + consentimento              │ serve index.html
   │                                            │ e participantes.json
   ▼                                            ▲   (sem RA nenhum)
[Google Forms] ──► [Planilha privada]           │
                     RA + apelido + carimbo     │
                          │                     │
                          │  consulta das horas na faculdade: MANUAL
                          └──► commit à mão em data/participantes.json
                               { id, apelido, horas }
```

- **Frontend**: 100% estático, sem build. Lê o JSON e desenha a cidade.
- **Escrita**: o navegador não grava num site estático, então a adesão só
  registra a intenção — um `POST` no Google Forms. Nada volta para o
  navegador (`no-cors`), nem mesmo se deu certo.
- **Fechamento do ciclo**: hoje é manual. Alguém lê a planilha, consulta as
  horas, sorteia um `id` e faz o commit. Enquanto for assim, o `id` nunca
  chega ao navegador de quem se inscreveu — por isso o "Meu prédio" está
  inativo.

### Para onde vai

Trocar o Forms por uma função mínima (Vercel/Cloudflare/Supabase, no plano
gratuito) que:

1. recebe o RA e o apelido;
2. faz o `GET` na API da faculdade e obtém as horas;
3. sorteia um `id` aleatório (ou recupera o já existente para aquele RA);
4. grava `{ id, apelido, horas }` no armazenamento público;
5. responde `{ id, horas }`. O RA não volta.

É o que fecha de uma vez as três pendências que hoje andam juntas: o rate
limit, o "Meu prédio" e a atualização das horas sem trabalho manual.

## Estrutura

```
index.html               página única (UI + importmap do Three.js)
css/style.css            estilos dos painéis/modal
js/main.js               cena 3D, cidade, ruas, limite do mapa, voo,
                         circuito de argolas
js/formulario.js         modal de adesão e o envio ao Google Forms — é o único
                         arquivo que toca no RA
js/aviao.js              só o modelo 3D do avião (nariz para -Z)
data/participantes.json  "banco de dados" PÚBLICO da cidade — jamais com RA
preview-aviao.html       ferramenta de desenvolvimento: renderiza o avião em
                         frente/lado/cima/3-4 para conferir a silhueta.
                         Pode apagar — nada do app depende dela.
```
