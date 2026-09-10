// Modo solo: um prédio central (o dono da chave) e uma cidade que se povoa
// conforme as horas sobem até a meta. Não sabe de onde vêm os dados.
import { FabricaPredios, gerarGradeDeRuas, hashId } from '../cidade/pecas.js';
import { criarCenario, raioEmCelulas } from './cenarioProgressivo.js';

// O vão entre duas ruas é TAMANHO_CELULA - LARGURA_RUA = 16, ou seja ±8 do
// centro. Base 13 + calçada 2 fecha em 15 e sobra meia unidade até o asfalto.
const PLANTA_CENTRAL = { planta: 13, margemLote: 2 };

function celulasDoQuadrado(raio) {
  const celulas = [];
  for (let cx = -raio; cx <= raio; cx++) {
    for (let cz = -raio; cz <= raio; cz++) celulas.push([cx, cz]);
  }
  return celulas;
}

export class ModoSolo {
  constructor(cena) {
    this.cena = cena;
    this.fabrica = new FabricaPredios(cena.renderer);
    this.cenario = null;
    this.participante = null;
  }

  // Recebe a mesma lista que qualquer modo recebe; aqui só o primeiro conta.
  construir(participantes) {
    const participante = participantes[0];
    if (!participante) return;
    this.participante = participante;

    const semente = hashId(participante.id);
    const ruas = gerarGradeDeRuas(celulasDoQuadrado(raioEmCelulas(participante.horas)));
    const cenario = criarCenario({ horas: participante.horas, semente });
    cenario.montarCarros(ruas);

    const predio = this.fabrica.criar(participante, 0, 0, PLANTA_CENTRAL);

    this.cena.definirConteudo({
      grupos: [ruas.grupo, cenario.grupo, predio.grupo],
      colisores: [predio.colisor],
      outdoors: [predio.outdoor],
      focos: new Map([[participante.id, predio.mesh]]),
      raio: cenario.limite,
    });

    this.cenario = cenario;
  }

  animar(dt) {
    this.cenario?.animar(dt);
  }
}
