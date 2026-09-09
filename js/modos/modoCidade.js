// Modo cidade: N prédios em espiral, um por participante. É o modo que
// funciona com qualquer fonte que devolva vários alunos — hoje o
// participantes.json, amanhã uma API de turma. Não sabe qual das duas é.
import * as THREE from 'three';
import { FabricaPredios, gerarGradeDeRuas, TAMANHO_CELULA } from '../cidade/pecas.js';

function posicoesEspiral(qtd) {
  const posicoes = [[0, 0]];
  let x = 0, z = 0, dx = 1, dz = 0;
  let passos = 1, dados = 0, viradas = 0;
  while (posicoes.length < qtd) {
    x += dx;
    z += dz;
    posicoes.push([x, z]);
    dados++;
    if (dados === passos) {
      dados = 0;
      [dx, dz] = [-dz, dx];
      viradas++;
      if (viradas % 2 === 0) passos++;
    }
  }
  return posicoes;
}

export class ModoCidade {
  constructor(cena) {
    this.cena = cena;
    this.fabrica = new FabricaPredios(cena.renderer);
  }

  construir(participantes) {
    if (!participantes.length) return;

    const celulas = posicoesEspiral(participantes.length);
    const ruas = gerarGradeDeRuas(celulas);

    const grupoPredios = new THREE.Group();
    const colisores = [];
    const outdoors = [];
    const focos = new Map();

    participantes.forEach((p, i) => {
      const [cx, cz] = celulas[i];
      const predio = this.fabrica.criar(p, cx * TAMANHO_CELULA, cz * TAMANHO_CELULA);
      grupoPredios.add(predio.grupo);
      colisores.push(predio.colisor);
      outdoors.push(predio.outdoor);
      focos.set(p.id, predio.mesh);
    });

    const alcance = celulas.reduce((max, [cx, cz]) => Math.max(max, Math.abs(cx), Math.abs(cz)), 0);

    this.cena.definirConteudo({
      grupos: [ruas.grupo, grupoPredios],
      colisores,
      outdoors,
      focos,
      raio: (alcance + 0.5) * TAMANHO_CELULA,
    });
  }

  animar() {
    /* a cidade de participantes é estática */
  }
}
