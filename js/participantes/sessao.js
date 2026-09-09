// Tudo aqui vive só no navegador de quem acessa. A chave de API nunca é
// enviada para o repositório nem para qualquer servidor além da própria API.
const CHAVES = {
  api: 'horascity:chave-api',
  apelido: 'horascity:meu-apelido',
  id: 'horascity:meu-id',
  horas: 'horascity:minhas-horas',
};

function ler(nome) {
  try {
    return localStorage.getItem(nome);
  } catch {
    return null;
  }
}

function gravar(nome, valor) {
  try {
    localStorage.setItem(nome, valor);
  } catch {
    /* modo privado ou storage bloqueado: a sessão só não persiste */
  }
}

function apagar(nome) {
  try {
    localStorage.removeItem(nome);
  } catch {
    /* idem */
  }
}

export function lerChave() {
  return ler(CHAVES.api);
}

export function lerMeuId() {
  return ler(CHAVES.id);
}

export function lerMeuApelido() {
  return ler(CHAVES.apelido);
}

export function estaConectado() {
  return Boolean(lerChave() && lerMeuId());
}

export function lerMinhasHoras() {
  const cru = ler(CHAVES.horas);
  if (!cru) return null;
  try {
    const dados = JSON.parse(cru);
    return Number.isFinite(dados.horas) ? dados : null;
  } catch {
    return null;
  }
}

export function salvarMinhasHoras({ horas, horasTexto }) {
  gravar(CHAVES.horas, JSON.stringify({ horas, horasTexto: horasTexto ?? null, lidoEm: new Date().toISOString() }));
}

export function conectar({ chave, apelido, id }) {
  gravar(CHAVES.api, chave);
  gravar(CHAVES.apelido, apelido);
  gravar(CHAVES.id, id);
}

export function desconectar() {
  Object.values(CHAVES).forEach(apagar);
}

// Mesmo formato dos ids do participantes.json: aleatório, sem relação com o RA.
export function gerarId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
