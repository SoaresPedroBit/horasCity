// Fonte de vários alunos a partir do arquivo público participantes.json.
// Quando existir uma API que sirva a turma inteira, ela entra aqui do lado
// (fonteTurma.js) com o mesmo contrato — nenhum modo precisa mudar.
const MAX_PREDIOS = 95;

export function criarFonteJson() {
  async function buscar() {
    const resposta = await fetch('data/participantes.json');
    if (!resposta.ok) throw new Error(`Status HTTP: ${resposta.status}`);
    const dados = await resposta.json();
    return (dados.participantes || []).slice(0, MAX_PREDIOS);
  }

  return {
    id: 'json',
    rotulo: 'participantes.json',
    requerChave: false,
    carregar: buscar,
    atualizar: buscar,
  };
}

export { MAX_PREDIOS };
