// Fonte de um aluno só: a API de horas identifica quem é pela chave, então
// toda consulta devolve exatamente um participante — o dono da chave.
import { buscarMinhasHoras, chaveParecePlausivel, ErroApi } from '../participantes/horasApi.js';
import * as sessao from '../participantes/sessao.js';

// Enquanto ninguém conectou uma chave, a cidade mostra uma prévia — deixa
// claro no apelido que aquele prédio ainda não é de ninguém.
const PREVIA = { id: 'previa', apelido: 'Seu prédio (prévia)', horas: 6, horasTexto: null, previa: true };

function meuParticipante({ horas, horasTexto = null }) {
  return {
    id: sessao.lerMeuId(),
    apelido: sessao.lerMeuApelido() || 'Eu',
    horas,
    horasTexto,
  };
}

export function criarFonteChave() {
  return {
    id: 'chave',
    rotulo: 'API de horas (minha chave)',
    requerChave: true,

    estaConectado() {
      return sessao.estaConectado();
    },

    // Sem rede: último valor lido neste navegador, ou a prévia.
    async carregar() {
      if (!sessao.estaConectado()) return [{ ...PREVIA }];
      const cache = sessao.lerMinhasHoras();
      return [meuParticipante({ horas: cache?.horas ?? 0, horasTexto: cache?.horasTexto ?? null })];
    },

    // Botão "Atualizar horas": uma requisição por clique.
    async atualizar() {
      const chave = sessao.lerChave();
      if (!chave) throw new ErroApi('Conecte sua chave antes de atualizar.');
      const dados = await buscarMinhasHoras(chave);
      sessao.salvarMinhasHoras(dados);
      return [meuParticipante(dados)];
    },

    async conectar({ chave, apelido }) {
      if (!chaveParecePlausivel(chave)) {
        throw new ErroApi('A chave precisa começar com chk_live_ — copie ela inteira do painel.');
      }

      // A própria consulta valida a chave: se ela não presta, nada é salvo.
      const dados = await buscarMinhasHoras(chave);
      sessao.conectar({ chave, apelido, id: sessao.lerMeuId() ?? sessao.gerarId() });
      sessao.salvarMinhasHoras(dados);
      return [meuParticipante(dados)];
    },

    desconectar() {
      sessao.desconectar();
      return [{ ...PREVIA }];
    },
  };
}

export { PREVIA };
