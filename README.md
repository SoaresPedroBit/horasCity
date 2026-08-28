# 🏙️ horasCity

Uma cidade 3D onde cada prédio é um aluno e a altura do prédio são as horas
Blackboard dele no sistema da faculdade. Inspirado no
[GitHub City](https://github.com/honzaap/GithubCity) / conceito CodeCity.

Qualquer pessoa pode passear pela cidade. Um aluno pode informar seu RA,
aceitar participar, e o prédio dele passa a fazer parte da cidade — podendo
voltar depois para encontrar o próprio prédio e ver seu total de horas.

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
- ✅ Botão "Meu prédio": leva a câmera até o prédio de quem já participa
  (usa o id salvo no navegador — não pede o RA de novo)
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
- ✅ Fluxo "Participar da cidade" com consentimento — **em modo demo**: as
  horas são geradas de forma fictícia
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
- ⬜ Integração com a API real da faculdade
- ⬜ Persistência real dos participantes
- ⬜ Botão "sair da cidade" (remoção do registro)

## Privacidade — a regra central do projeto

**O RA nunca aparece do lado público, e nada publicado permite chegar até
ele.** O que a cidade expõe é apenas:

```json
{ "id": "9896194fbbde957e", "apelido": "Pedro S.", "horas": 125 }
```

O `id` é um valor **aleatório**, sorteado no servidor no momento do cadastro.
Ele não é derivado do RA.

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
- O navegador guarda só o `id` público (`localStorage`), nunca o RA. É o que
  faz o marcador "você" e o botão "Meu prédio" funcionarem sem pedir o RA de
  novo.
- Não existe busca por RA em lugar nenhum: seria um oráculo de "o RA X está
  na cidade como fulano, com N horas".
- O apelido é validado contra sequências de 4+ dígitos (evita que alguém use
  o próprio RA como apelido) e escapado antes de ir para o HTML.

### O que o backend precisa respeitar

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

- **Posse do RA**: com um `GET` aberto, alguém pode cadastrar o RA de outra
  pessoa e expor as horas dela sob um apelido qualquer. A correção real é
  provar a posse — login institucional ou confirmação por e-mail da
  faculdade — antes de criar o prédio.
- **Turmas pequenas**: em cursos com poucos participantes, "maior número de
  horas" pode identificar alguém mesmo sem o RA. Está coberto pelo
  consentimento, mas vale ter o botão de sair funcionando.
- **O tooltip ainda mostra apelido + horas** ao passar o mouse num prédio.
  Se a intenção de tirar o leaderboard foi impedir que se veja quantas horas
  cada pessoa tem, o tooltip precisa mudar junto — hoje ele expõe o mesmo par
  apelido↔horas, só que um prédio por vez.

## Arquitetura planejada

```
[Aluno]                                    [GitHub Pages / Vercel]
   │  RA + apelido + consentimento              │ serve index.html
   │  (o RA para aqui ─────────┐)               │ e participantes.json
   ▼                           │               ▲   (sem RA nenhum)
[Serverless function] ──GET /horas/{RA}──► [API da faculdade]
   │                           │
   │  guarda RA → id  ─────────┘  (privado, só no servidor)
   │
   └── grava { id, apelido, horas } no arquivo público
   ◄── devolve ao navegador APENAS { id, horas }
```

- **Frontend**: 100% estático. Lê o JSON e desenha a cidade.
- **Escrita**: o navegador não consegue gravar num site estático, então a
  adesão passa por uma função mínima (Vercel/Cloudflare, gratuita) que:
  1. recebe o RA e o apelido;
  2. faz o `GET` na API da faculdade e obtém as horas;
  3. sorteia um `id` aleatório (ou recupera o já existente para aquele RA);
  4. grava `{ id, apelido, horas }` no arquivo público — commit via GitHub API
     ou insert no Supabase;
  5. responde `{ id, horas }`. O RA não volta.
- **Atualização**: as horas ficam gravadas até a próxima consulta — quando o
  aluno volta e informa o RA, a função reconsulta, atualiza o registro e
  reencontra o mesmo `id`. Opcionalmente, um cron atualiza todo mundo.

## Estrutura

```
index.html               página única (UI + importmap do Three.js)
css/style.css            estilos dos painéis/modal
js/main.js               cena 3D, cidade, limite do mapa, voo, fluxo de adesão
js/aviao.js              só o modelo 3D do avião (nariz para -Z)
data/participantes.json  "banco de dados" PÚBLICO da cidade — jamais com RA
preview-aviao.html       ferramenta de desenvolvimento: renderiza o avião em
                         frente/lado/cima/3-4 para conferir a silhueta.
                         Pode apagar — nada do app depende dela.
```
