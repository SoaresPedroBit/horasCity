// Primitivas de cidade: pedaços que qualquer modo pode usar.
// Este arquivo não conhece nenhum modo nem nenhuma fonte de dados.
import * as THREE from 'three';

export const TAMANHO_CELULA = 24;
export const LARGURA_RUA = 8;

const PALETA = [0x4f8ff7, 0x9d6ff7, 0x34c98e, 0xf7b23b, 0xf76f6f, 0x5ad0e0];
const ALTURA_POR_HORA = 0.35;
const ALTURA_MINIMA = 2;
const ALTURA_MAXIMA = 120; // nunca furar o teto do mapa (LIMITES_MAPA.ALTURA)

// As horas da API são as reais do curso (meta: 15h). Sem multiplicador, quem
// tem 7h viraria um prédio de 7 andares — invisível no meio da cidade.
export const FATOR_HORAS = 8;

// Folga entre o topo do prédio e o topo do outdoor, para colisão do avião.
export const FOLGA_OUTDOOR = 3.8;

export function alturaParaHoras(horas) {
  const n = Number(horas);
  const base = Number.isFinite(n) ? n : 0;
  return Math.min(ALTURA_MAXIMA, ALTURA_MINIMA + base * FATOR_HORAS * ALTURA_POR_HORA);
}

export function hashId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
}

// Gerador determinístico: a mesma semente devolve sempre a mesma cidade.
export function geradorAleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function criarTexturaJanelas() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c6cbd6';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 6; y < 64; y += 16) {
    for (let x = 6; x < 64; x += 16) {
      ctx.fillStyle = Math.random() < 0.55 ? '#fff6d8' : '#252a36';
      ctx.fillRect(x, y, 8, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function criarTexturaApelido(apelido, cor, renderer) {
  const L = 512, A = 128;
  const c = document.createElement('canvas');
  c.width = L;
  c.height = A;
  const ctx = c.getContext('2d');
  const corHex = `#${new THREE.Color(cor).getHexString()}`;

  ctx.fillStyle = '#0d1220';
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = corHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, L - 8, A - 8);
  ctx.fillStyle = corHex;
  ctx.fillRect(4, A - 16, L - 8, 12);

  let tamanho = 74;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `bold ${tamanho}px system-ui, "Segoe UI", Arial, sans-serif`;
    if (ctx.measureText(apelido).width <= L - 56) break;
    tamanho -= 4;
  } while (tamanho > 22);

  ctx.fillStyle = corHex;
  ctx.shadowColor = corHex;
  ctx.shadowBlur = 18;
  ctx.fillText(apelido, L / 2, A / 2 - 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(apelido, L / 2, A / 2 - 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// Um prédio + lote + outdoor com o apelido. A altura vem só das horas.
export class FabricaPredios {
  constructor(renderer) {
    this.renderer = renderer;
    this.texturaJanelas = criarTexturaJanelas();
  }

  // escala engrossa a planta sorteada pelo hash. `planta` ignora o hash e fixa
  // uma base quadrada — no modo solo o prédio é único, então o sorteio só
  // rendia lajes finas. `margemLote` é a calçada em volta: somada à planta,
  // ela precisa caber no vão entre as ruas (TAMANHO_CELULA - LARGURA_RUA).
  criar(participante, x, z, { escala = 1, planta = null, margemLote = 6 } = {}) {
    const altura = alturaParaHoras(participante.horas);
    const h = hashId(participante.id);
    const largura = planta ?? (6 + (h % 4)) * escala;
    const profundidade = planta ?? (6 + ((h >>> 4) % 4)) * escala;
    const cor = PALETA[(h >>> 8) % PALETA.length];

    const grupo = new THREE.Group();

    const tex = this.texturaJanelas.clone();
    tex.repeat.set(Math.max(1, Math.round(largura / 4)), Math.max(1, Math.round(altura / 5)));

    const lateral = new THREE.MeshLambertMaterial({ map: tex, color: cor });
    const topo = new THREE.MeshLambertMaterial({ color: new THREE.Color(cor).multiplyScalar(0.5) });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(largura, altura, profundidade),
      [lateral, lateral, topo, topo, lateral, lateral]
    );
    mesh.position.set(x, altura / 2, z);
    mesh.userData.participante = participante;

    const lote = new THREE.Mesh(
      new THREE.BoxGeometry(largura + margemLote, 0.2, profundidade + margemLote),
      new THREE.MeshLambertMaterial({ color: 0x222a3a })
    );
    lote.position.set(x, 0.1, z);

    const larguraPainel = Math.max(7.5, largura + 1.5);
    const outdoor = new THREE.Group();
    const texturaApelido = criarTexturaApelido(participante.apelido, cor, this.renderer);
    const frente = new THREE.MeshBasicMaterial({ map: texturaApelido });
    const moldura = new THREE.MeshLambertMaterial({ color: 0x2b3448 });
    const painel = new THREE.Mesh(
      new THREE.BoxGeometry(larguraPainel, 2.4, 0.25),
      [moldura, moldura, moldura, moldura, frente, frente]
    );
    painel.position.y = 1.4 + 1.2;
    painel.userData.participante = participante;

    const geoPoste = new THREE.CylinderGeometry(0.16, 0.16, 1.4, 6);
    const matPoste = new THREE.MeshLambertMaterial({ color: 0x39435a });
    for (const lado of [-1, 1]) {
      const poste = new THREE.Mesh(geoPoste, matPoste);
      poste.position.set(lado * (larguraPainel / 2 - 0.8), 0.7, 0);
      outdoor.add(poste);
    }
    outdoor.add(painel);
    outdoor.position.set(x, altura, z);

    grupo.add(lote, mesh, outdoor);

    const colisor = {
      x,
      z,
      hx: largura / 2,
      hz: profundidade / 2,
      altura,
      alturaColisao: altura + FOLGA_OUTDOOR,
      participante,
    };

    return { grupo, mesh, outdoor, colisor, altura, largura, profundidade, cor };
  }
}

// Malha de asfalto + faixas cobrindo as células informadas.
export function gerarGradeDeRuas(celulas) {
  const grupo = new THREE.Group();
  if (!celulas.length) return { grupo, xsVia: [], zsVia: [] };

  const geoPista = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const matAsfalto = new THREE.MeshLambertMaterial({ color: 0x1b2130 });
  const matFaixa = new THREE.MeshBasicMaterial({ color: 0xd8c98a });

  const xs = celulas.map(([cx]) => cx);
  const zs = celulas.map(([, cz]) => cz);
  const xsVia = [];
  for (let i = Math.min(...xs); i <= Math.max(...xs) + 1; i++) xsVia.push((i - 0.5) * TAMANHO_CELULA);
  const zsVia = [];
  for (let j = Math.min(...zs); j <= Math.max(...zs) + 1; j++) zsVia.push((j - 0.5) * TAMANHO_CELULA);

  const x0 = xsVia[0], x1 = xsVia[xsVia.length - 1];
  const z0 = zsVia[0], z1 = zsVia[zsVia.length - 1];

  for (const x of xsVia) {
    const p = new THREE.Mesh(geoPista, matAsfalto);
    p.position.set(x, 0.05, (z0 + z1) / 2);
    p.scale.set(LARGURA_RUA, 1, z1 - z0 + LARGURA_RUA);
    grupo.add(p);
  }
  for (const z of zsVia) {
    const p = new THREE.Mesh(geoPista, matAsfalto);
    p.position.set((x0 + x1) / 2, 0.052, z);
    p.scale.set(x1 - x0 + LARGURA_RUA, 1, LARGURA_RUA);
    grupo.add(p);
  }

  const vao = TAMANHO_CELULA - LARGURA_RUA;
  const passo = 8;
  const porTrecho = Math.max(1, Math.floor(vao / passo));
  const tracos = [];

  for (const x of xsVia) {
    for (let k = 0; k < zsVia.length - 1; k++) {
      const centro = (zsVia[k] + zsVia[k + 1]) / 2;
      for (let t = 0; t < porTrecho; t++) tracos.push([x, centro + (t - (porTrecho - 1) / 2) * passo, false]);
    }
  }
  for (const z of zsVia) {
    for (let k = 0; k < xsVia.length - 1; k++) {
      const centro = (xsVia[k] + xsVia[k + 1]) / 2;
      for (let t = 0; t < porTrecho; t++) tracos.push([centro + (t - (porTrecho - 1) / 2) * passo, z, true]);
    }
  }

  const faixas = new THREE.InstancedMesh(geoPista, matFaixa, tracos.length);
  const mat = new THREE.Matrix4();
  tracos.forEach(([x, z, alongX], i) => {
    mat.makeScale(alongX ? 5 : 0.35, 1, alongX ? 0.35 : 5);
    mat.setPosition(x, 0.07, z);
    faixas.setMatrixAt(i, mat);
  });
  faixas.instanceMatrix.needsUpdate = true;
  grupo.add(faixas);

  return { grupo, xsVia, zsVia };
}
