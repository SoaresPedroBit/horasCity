const MAX_PREDIOS = 95;
const STORAGE_KEY_MEU_ID = 'horascity:meu-id';

export async function carregarParticipantes() {
  const resposta = await fetch('data/participantes.json');
  if (!resposta.ok) throw new Error(`Status HTTP: ${resposta.status}`);
  const dados = await resposta.json();
  const lista = dados.participantes || [];
  return lista.slice(0, MAX_PREDIOS);
}

export function lerMeuId() {
  try {
    return localStorage.getItem(STORAGE_KEY_MEU_ID);
  } catch {
    return null;
  }
}

export { MAX_PREDIOS };