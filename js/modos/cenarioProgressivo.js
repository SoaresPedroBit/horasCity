// O entorno do prédio central: árvores, casas, postes e carrinhos.
// Cada peça entra a partir de uma hora e vai enchendo a cidade até a meta.
import * as THREE from 'three';
import { TAMANHO_CELULA, LARGURA_RUA, geradorAleatorio } from '../cidade/pecas.js';
import { META_HORAS } from '../util.js';

const RECEITAS = {
  arvores: { inicio: 0, base: 8, maximo: 150 },
  casas: { inicio: 3, base: 3, maximo: 62 },
  carros: { inicio: 6, base: 3, maximo: 18 },
  postes: { inicio: 9, base: 4, maximo: 44 },
};

export const MARCOS = [
  { horas: 3, texto: 'a vizinhança começou a construir 🏠' },
  { horas: 6, texto: 'os primeiros carros pegaram a rua 🚗' },
  { horas: 9, texto: 'a iluminação pública acendeu 💡' },
  { horas: 12, texto: 'o bairro está cheio 🌳' },
  { horas: META_HORAS, texto: 'cidade completa! 🎉' },
];

const CORES_CASA = [0x3d4a63, 0x4a3f5c, 0x35513f, 0x5c4a35, 0x53373c];
const CORES_CARRO = [0xf7b23b, 0xf76f6f, 0x5ad0e0, 0xe8ecf4, 0x9d6ff7, 0x34c98e];

export function quantidadeDePecas(nome, horas) {
  const receita = RECEITAS[nome];
  const n = Number(horas);
  const h = Number.isFinite(n) ? n : 0;
  if (h < receita.inicio) return 0;
  const fracao = Math.min(1, (h - receita.inicio) / Math.max(1, META_HORAS - receita.inicio));
  return Math.round(receita.base + fracao * (receita.maximo - receita.base));
}

// Último marco cruzado entre duas leituras de horas — serve de feedback.
export function marcoCruzado(antes, depois) {
  return [...MARCOS].reverse().find((m) => antes < m.horas && depois >= m.horas) ?? null;
}

// Quantas células de rua a cidade ocupa em cada direção.
export function raioEmCelulas(horas) {
  const n = Number(horas);
  const fracao = Math.min(1, Math.max(0, (Number.isFinite(n) ? n : 0) / META_HORAS));
  return 1 + Math.round(fracao * 4);
}

// Vagas de terreno dentro das quadras, longe do asfalto, ordenadas do centro
// para fora: assim a cidade cresce de dentro para fora conforme as horas.
function gerarVagas(raioCelulas, aleatorio) {
  const folga = (TAMANHO_CELULA - LARGURA_RUA) / 2 - 1;
  const vagas = [];

  for (let cx = -raioCelulas; cx <= raioCelulas; cx++) {
    for (let cz = -raioCelulas; cz <= raioCelulas; cz++) {
      if (cx === 0 && cz === 0) continue; // lote do prédio central
      for (let k = 0; k < 4; k++) {
        const x = cx * TAMANHO_CELULA + (aleatorio() * 2 - 1) * folga;
        const z = cz * TAMANHO_CELULA + (aleatorio() * 2 - 1) * folga;
        vagas.push({ x, z, d: Math.hypot(x, z), sorte: aleatorio() });
      }
    }
  }

  vagas.sort((a, b) => a.d - b.d);
  return vagas;
}

function instanciar(geometria, material, posicoes, montarMatriz) {
  const malha = new THREE.InstancedMesh(geometria, material, Math.max(posicoes.length, 1));
  malha.count = posicoes.length;
  const m = new THREE.Matrix4();
  posicoes.forEach((vaga, i) => {
    montarMatriz(m, vaga, i);
    malha.setMatrixAt(i, m);
  });
  malha.instanceMatrix.needsUpdate = true;
  return malha;
}

function pintar(malha, posicoes, paleta) {
  const cor = new THREE.Color();
  posicoes.forEach((vaga, i) => {
    malha.setColorAt(i, cor.setHex(paleta[Math.floor(vaga.sorte * paleta.length) % paleta.length]));
  });
  if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
}

function criarArvores(vagas) {
  const grupo = new THREE.Group();
  if (!vagas.length) return grupo;

  const troncos = instanciar(
    new THREE.CylinderGeometry(0.28, 0.34, 2.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a4632 }),
    vagas,
    (m, v) => m.makeTranslation(v.x, 1.1, v.z)
  );

  const copas = instanciar(
    new THREE.IcosahedronGeometry(1.7, 0),
    new THREE.MeshLambertMaterial({ color: 0x2f7d4f }),
    vagas,
    (m, v) => {
      const escala = 0.8 + v.sorte * 0.7;
      m.makeRotationY(v.sorte * Math.PI * 2);
      m.scale(new THREE.Vector3(escala, escala * 1.15, escala));
      m.setPosition(v.x, 2.2 + escala * 1.1, v.z);
    }
  );

  grupo.add(troncos, copas);
  return grupo;
}

function criarCasas(vagas) {
  const grupo = new THREE.Group();
  if (!vagas.length) return grupo;

  const paredes = instanciar(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    vagas,
    (m, v) => {
      const largura = 4 + v.sorte * 3;
      const altura = 3 + v.sorte * 3;
      m.makeRotationY(Math.round(v.sorte * 4) * (Math.PI / 2));
      m.scale(new THREE.Vector3(largura, altura, largura * 0.85));
      m.setPosition(v.x, altura / 2, v.z);
    }
  );
  pintar(paredes, vagas, CORES_CASA);

  const telhados = instanciar(
    new THREE.ConeGeometry(1, 1, 4),
    new THREE.MeshLambertMaterial({ color: 0x8c4a3f }),
    vagas,
    (m, v) => {
      const largura = 4 + v.sorte * 3;
      const altura = 3 + v.sorte * 3;
      m.makeRotationY(Math.PI / 4 + Math.round(v.sorte * 4) * (Math.PI / 2));
      m.scale(new THREE.Vector3(largura * 0.82, 2.2, largura * 0.82));
      m.setPosition(v.x, altura + 1.1, v.z);
    }
  );

  grupo.add(paredes, telhados);
  return grupo;
}

function criarPostes(vagas) {
  const grupo = new THREE.Group();
  if (!vagas.length) return grupo;

  const hastes = instanciar(
    new THREE.CylinderGeometry(0.14, 0.18, 5.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x39435a }),
    vagas,
    (m, v) => m.makeTranslation(v.x, 2.6, v.z)
  );

  const luzes = instanciar(
    new THREE.SphereGeometry(0.42, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8 }),
    vagas,
    (m, v) => m.makeTranslation(v.x, 5.3, v.z)
  );

  grupo.add(hastes, luzes);
  return grupo;
}

// Peças que se repetem dentro de um mesmo carro. O deslocamento é local: a
// matriz do carro é aplicada por cima, então tudo gira junto com ele.
const RODAS = [[1.05, 0.3, 0.63], [1.05, 0.3, -0.63], [-1.05, 0.3, 0.63], [-1.05, 0.3, -0.63]];
const LUZES = [[1.66, 0.8, 0.5], [1.66, 0.8, -0.5], [-1.66, 0.82, 0.52], [-1.66, 0.82, -0.52]];
const CORES_LUZ = [0xfff2c8, 0xfff2c8, 0xff5545, 0xff5545];

function matrizesDeOffset(lista) {
  return lista.map(([x, y, z]) => new THREE.Matrix4().makeTranslation(x, y, z));
}

// Carrinhos andando nas faixas, cada um preso a uma rua da grade. O carro é
// montado em X: o nariz aponta para +X local, e a matriz de cada quadro gira
// esse eixo para a direção de marcha.
function criarCarros(quantidade, ruas, limite, aleatorio) {
  const grupo = new THREE.Group();
  if (!quantidade) return { grupo, carros: [], malhas: [] };

  const carros = [];
  for (let i = 0; i < quantidade; i++) {
    const eixoX = aleatorio() < 0.5;
    const vias = eixoX ? ruas.zsVia : ruas.xsVia;
    const via = vias.length ? vias[Math.floor(aleatorio() * vias.length)] : 0;
    carros.push({
      eixoX,
      via,
      sentido: aleatorio() < 0.5 ? 1 : -1,
      velocidade: 7 + aleatorio() * 9,
      pos: (aleatorio() * 2 - 1) * limite,
      sorte: aleatorio(),
    });
  }

  const corpo = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.3, 0.72, 1.62).translate(0, 0.7, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    quantidade
  );
  pintar(corpo, carros, CORES_CARRO);

  // Cabine recuada e mais estreita que o corpo — é o degrau da silhueta que
  // separa "carro" de "caixa".
  const cabine = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.62, 0.56, 1.4).translate(-0.22, 1.3, 0),
    new THREE.MeshLambertMaterial({ color: 0x161b2a }),
    quantidade
  );

  const rodas = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.24, 10).rotateX(Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x14161c }),
    quantidade * RODAS.length
  );

  const luzes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, 0.16, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    quantidade * LUZES.length
  );
  const cor = new THREE.Color();
  for (let i = 0; i < quantidade; i++) {
    CORES_LUZ.forEach((hex, k) => luzes.setColorAt(i * LUZES.length + k, cor.setHex(hex)));
  }
  if (luzes.instanceColor) luzes.instanceColor.needsUpdate = true;

  const malhas = [
    { mesh: corpo, offsets: null },
    { mesh: cabine, offsets: null },
    { mesh: rodas, offsets: matrizesDeOffset(RODAS) },
    { mesh: luzes, offsets: matrizesDeOffset(LUZES) },
  ];

  grupo.add(corpo, cabine, rodas, luzes);
  return { grupo, carros, malhas };
}

// Devolve o cenário pronto para a hora informada. Reconstruir é barato:
// a cada consulta de horas o modo joga o antigo fora e chama isto de novo.
export function criarCenario({ horas, semente = 1 }) {
  const aleatorio = geradorAleatorio(semente);
  const raioCelulas = raioEmCelulas(horas);
  const limite = (raioCelulas + 0.5) * TAMANHO_CELULA;

  const vagas = gerarVagas(raioCelulas, aleatorio);
  const porTipo = { arvores: [], casas: [], postes: [] };
  for (const vaga of vagas) {
    if (vaga.sorte < 0.58) porTipo.arvores.push(vaga);
    else if (vaga.sorte < 0.85) porTipo.casas.push(vaga);
    else porTipo.postes.push(vaga);
  }

  const grupo = new THREE.Group();
  grupo.add(criarArvores(porTipo.arvores.slice(0, quantidadeDePecas('arvores', horas))));
  grupo.add(criarCasas(porTipo.casas.slice(0, quantidadeDePecas('casas', horas))));
  grupo.add(criarPostes(porTipo.postes.slice(0, quantidadeDePecas('postes', horas))));

  return {
    grupo,
    limite,
    raioCelulas,
    montarCarros(ruas) {
      const { grupo: grupoCarros, carros, malhas } = criarCarros(
        quantidadeDePecas('carros', horas), ruas, limite, aleatorio
      );
      grupo.add(grupoCarros);
      this._carros = carros;
      this._malhasCarros = malhas;
    },
    animar(dt) {
      if (!this._malhasCarros?.length) return;
      const base = new THREE.Matrix4();
      const peca = new THREE.Matrix4();

      this._carros.forEach((carro, i) => {
        carro.pos += carro.velocidade * carro.sentido * dt;
        if (carro.pos > limite) carro.pos = -limite;
        if (carro.pos < -limite) carro.pos = limite;

        const desvio = carro.sentido * 2;
        const x = carro.eixoX ? carro.pos : carro.via - desvio;
        const z = carro.eixoX ? carro.via + desvio : carro.pos;

        // O nariz é +X local. Andando em X basta 0 ou π; andando em Z, ∓π/2.
        // Antes as duas contas estavam trocadas e o carro corria de lado.
        base.makeRotationY(
          carro.eixoX
            ? (carro.sentido > 0 ? 0 : Math.PI)
            : (carro.sentido > 0 ? -Math.PI / 2 : Math.PI / 2)
        );
        base.setPosition(x, 0.06, z);

        for (const { mesh, offsets } of this._malhasCarros) {
          if (!offsets) {
            mesh.setMatrixAt(i, base);
            continue;
          }
          offsets.forEach((off, k) => {
            peca.multiplyMatrices(base, off);
            mesh.setMatrixAt(i * offsets.length + k, peca);
          });
        }
      });

      for (const { mesh } of this._malhasCarros) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
