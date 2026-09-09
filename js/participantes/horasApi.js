const BASE = 'https://horas.zibikoski.com.br';
const PREFIXO_CHAVE = 'chk_live_';

const MENSAGENS = {
  401: 'Chave inválida, revogada ou ainda não aprovada por um professor.',
  403: 'Esta chave não tem permissão para essa consulta.',
  404: 'Seu RA ainda não está na base de horas. Tente após a próxima atualização.',
  422: 'A API recusou os dados enviados.',
  429: 'Muitas consultas em pouco tempo. Espere um minuto e tente de novo.',
  503: 'A base de horas está indisponível agora. Tente mais tarde.',
};

export class ErroApi extends Error {
  constructor(mensagem, status = 0) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
  }
}

export function chaveParecePlausivel(chave) {
  return typeof chave === 'string'
    && chave.startsWith(PREFIXO_CHAVE)
    && chave.length >= PREFIXO_CHAVE.length + 8;
}

async function chamar(caminho, chave) {
  let resposta;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      headers: { Authorization: `Bearer ${chave}` },
      cache: 'no-store',
    });
  } catch {
    throw new ErroApi('Não foi possível falar com a API. Verifique sua conexão.');
  }

  if (!resposta.ok) {
    throw new ErroApi(MENSAGENS[resposta.status] ?? `A API respondeu ${resposta.status}.`, resposta.status);
  }
  return resposta.json();
}

// GET /api/v1/hours devolve também `ra` e `nome`. Esses campos param aqui:
// a cidade é pública e só pode conhecer apelido e horas.
export async function buscarMinhasHoras(chave) {
  const dados = await chamar('/api/v1/hours', chave);
  const horas = Number(dados.horas_decimais);
  if (!Number.isFinite(horas)) {
    throw new ErroApi('A API não devolveu as horas em formato numérico.');
  }
  return {
    horas,
    horasTexto: typeof dados.horas_formatadas === 'string' ? dados.horas_formatadas : null,
    baseAtualizadaEm: dados.base_atualizada_em ?? null,
  };
}
