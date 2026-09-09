# horasCity

Link de acesso: **https://soarespedrobit.github.io/horasCity/**

Visualizador 3D de uma cidade que cresce com as suas horas de acesso ao curso.

## Dois modos, dois códigos separados

A API de horas identifica o aluno **pela chave**: toda consulta devolve as horas
de uma pessoa só — a dona da chave. Não existe endpoint que liste a turma. Por
isso o projeto tem dois modos independentes, e o código de um não passa pelo do
outro:

| Modo | URL | Fonte de dados | O que desenha |
| --- | --- | --- | --- |
| **solo** (padrão) | `index.html` | sua chave da API (`js/fontes/fonteChave.js`) | um prédio central + a cidade que se povoa até a meta de 15h |
| **cidade** | `index.html?modo=cidade` | `data/participantes.json` (`js/fontes/fonteJson.js`) | um prédio por participante, em espiral |

Quando existir uma API que sirva a turma inteira, basta escrever
`js/fontes/fonteTurma.js` com o mesmo contrato e trocar a fonte em
`js/apps/appCidade.js` — o modo solo não é tocado.

```
js/cidade/    cena + primitivas (não sabem de fonte nem de modo)
js/fontes/    de onde vêm os dados   -> carregar() / atualizar() -> Participante[]
js/modos/     como a cidade é desenhada -> construir(participantes) / animar(dt)
js/apps/      juntam uma fonte + um modo + a UI daquele modo
js/aviao/ js/dirigiveis/   infra compartilhada pelos dois modos
```

Um `Participante` é sempre `{ id, apelido, horas, horasTexto? }` — nunca RA nem nome.

## Modo solo: minhas horas

1. Peça sua chave em `https://horas.zibikoski.com.br/api/registrar` e espere a
   aprovação de um professor.
2. Clique em **🔑 Minhas horas**, cole a chave (`chk_live_...`) e escolha um apelido.
3. Use **🔄 Atualizar horas** quando quiser: cada clique é uma consulta à API.

A altura do prédio é `horas × 8` (a meta do curso é 15h; sem o multiplicador um
prédio de 7h teria 7 andares e sumiria no mapa). Conforme as horas sobem, o
entorno se povoa: árvores desde o começo, casas a partir de 3h, carrinhos a
partir de 6h e iluminação pública a partir de 9h.

## Controles

### Modo Cidade
* Girar câmera: botão esquerdo do mouse
* Mover mapa: botão direito do mouse
* Zoom: scroll do mouse

### Modo Avião
* W / S: subir / descer
* A / D: virar
* Shift: turbo
* Esc: sair do modo avião
* Dispositivos móveis: joystick virtual e botão de turbo na tela

## Privacidade

* A chave da API fica **só no seu navegador** (`localStorage`) — nunca vai para o
  repositório nem para outro servidor além da própria API.
* `GET /api/v1/hours` devolve também `ra` e `nome`; esses campos são descartados
  em `js/participantes/horasApi.js` e não chegam à cena. A cidade só conhece
  apelido e horas.
* O arquivo `participantes.json` é público e não armazena dados pessoais: os
  participantes aparecem só pelo apelido cadastrado, e o `id` é aleatório.
* Para apagar a chave deste navegador, use **Desconectar** no modal da chave.
  Para apagar a conta na API, use `DELETE /api/v1/me` no painel deles.
