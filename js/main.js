import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { ApiService, ModalParticipar } from './formulario.js';
import { CONFIG_MAPA, PALETA_PREDIOS, STORAGE_KEYS } from './constantes.js';
import {
  modoAviao,
  inicializarPilotagem,
  alternarModoAviao,
  atualizarAviao,
  atualizarExplosoes,
} from './pilotagem.js';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

let participantes = [];
const prediosPorId = new Map();
const colisoresPredios = [];
const outdoors = [];

// ---------------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------------

const canvas = document.getElementById('city-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 120, 420);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(70, 60, 70);

const controls = new MapControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 15;
controls.maxDistance = 300;

scene.add(new THREE.HemisphereLight(0x8899cc, 0x223344, 1.1));
const sol = new THREE.DirectionalLight(0xfff2d8, 1.4);
sol.position.set(80, 120, 40);
scene.add(sol);

// Chão
const chao = new THREE.Mesh(
  new THREE.PlaneGeometry(1200, 1200),
  new THREE.MeshLambertMaterial({ color: 0x141a26 })
);
chao.rotation.x = -Math.PI / 2;
chao.position.y = -0.05;
scene.add(chao);

const grupoPredios = new THREE.Group();
scene.add(grupoPredios);

// ---------------------------------------------------------------------------
// Limite do mapa
// ---------------------------------------------------------------------------

const paredeMapa = new THREE.Mesh(
  new THREE.CylinderGeometry(CONFIG_MAPA.RAIO, CONFIG_MAPA.RAIO, CONFIG_MAPA.ALTURA, 72, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x5ad0e0,
    transparent: true,
    opacity: 0.06,
    side: THREE.BackSide,
    depthWrite: false,
  })
);
paredeMapa.position.y = CONFIG_MAPA.ALTURA / 2;
scene.add(paredeMapa);

const anelMapa = new THREE.Mesh(
  new THREE.RingGeometry(CONFIG_MAPA.RAIO - 2, CONFIG_MAPA.RAIO, 72),
  new THREE.MeshBasicMaterial({
    color: 0x5ad0e0,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  })
);
anelMapa.rotation.x = -Math.PI / 2;
anelMapa.position.y = 0.2;
scene.add(anelMapa);

// ---------------------------------------------------------------------------
// Textura de janelas
// ---------------------------------------------------------------------------

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

const texturaJanelasBase = criarTexturaJanelas();

// ---------------------------------------------------------------------------
// Ruas
// ---------------------------------------------------------------------------

const grupoRuas = new THREE.Group();
scene.add(grupoRuas);

const geoPistaUnitaria = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const materialAsfalto = new THREE.MeshLambertMaterial({ color: 0x1b2130 });
const materialFaixa = new THREE.MeshBasicMaterial({ color: 0xd8c98a });

const Y_VIA_Z = 0.05;
const Y_VIA_X = 0.052;
const Y_FAIXA = 0.07;

function criarPista(x, z, largura, comprimento, y) {
  const pista = new THREE.Mesh(geoPistaUnitaria, materialAsfalto);
  pista.position.set(x, y, z);
  pista.scale.set(largura, 1, comprimento);
  return pista;
}

function construirRuas(celulas) {
  for (const filho of grupoRuas.children) filho.dispose?.();
  grupoRuas.clear();
  if (!celulas.length) return;

  const xs = celulas.map(([cx]) => cx);
  const zs = celulas.map(([, cz]) => cz);

  const xsVia = [];
  for (let i = Math.min(...xs); i <= Math.max(...xs) + 1; i++) {
    xsVia.push((i - 0.5) * CONFIG_MAPA.TAMANHO_CELULA);
  }
  const zsVia = [];
  for (let j = Math.min(...zs); j <= Math.max(...zs) + 1; j++) {
    zsVia.push((j - 0.5) * CONFIG_MAPA.TAMANHO_CELULA);
  }

  const x0 = xsVia[0], x1 = xsVia[xsVia.length - 1];
  const z0 = zsVia[0], z1 = zsVia[zsVia.length - 1];

  for (const x of xsVia) {
    grupoRuas.add(criarPista(x, (z0 + z1) / 2, CONFIG_MAPA.LARGURA_RUA, z1 - z0 + CONFIG_MAPA.LARGURA_RUA, Y_VIA_Z));
  }
  for (const z of zsVia) {
    grupoRuas.add(criarPista((x0 + x1) / 2, z, x1 - x0 + CONFIG_MAPA.LARGURA_RUA, CONFIG_MAPA.LARGURA_RUA, Y_VIA_X));
  }

  const vao = CONFIG_MAPA.TAMANHO_CELULA - CONFIG_MAPA.LARGURA_RUA;
  const passo = CONFIG_MAPA.TRACO_COMPRIMENTO + 3;
  const porTrecho = Math.max(1, Math.floor(vao / passo));
  const tracos = [];
  for (const x of xsVia) {
    for (let k = 0; k < zsVia.length - 1; k++) {
      const centro = (zsVia[k] + zsVia[k + 1]) / 2;
      for (let t = 0; t < porTrecho; t++) {
        tracos.push([x, centro + (t - (porTrecho - 1) / 2) * passo, false]);
      }
    }
  }
  for (const z of zsVia) {
    for (let k = 0; k < xsVia.length - 1; k++) {
      const centro = (xsVia[k] + xsVia[k + 1]) / 2;
      for (let t = 0; t < porTrecho; t++) {
        tracos.push([centro + (t - (porTrecho - 1) / 2) * passo, z, true]);
      }
    }
  }

  const faixas = new THREE.InstancedMesh(geoPistaUnitaria, materialFaixa, tracos.length);
  const matriz = new THREE.Matrix4();
  tracos.forEach(([x, z, aoLongoDeX], i) => {
    matriz.makeScale(
      aoLongoDeX ? CONFIG_MAPA.TRACO_COMPRIMENTO : CONFIG_MAPA.TRACO_LARGURA,
      1,
      aoLongoDeX ? CONFIG_MAPA.TRACO_LARGURA : CONFIG_MAPA.TRACO_COMPRIMENTO
    );
    matriz.setPosition(x, Y_FAIXA, z);
    faixas.setMatrixAt(i, matriz);
  });
  faixas.instanceMatrix.needsUpdate = true;
  grupoRuas.add(faixas);
}

// ---------------------------------------------------------------------------
// Geração da Cidade
// ---------------------------------------------------------------------------

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

function hashId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
}

function criarTexturaApelido(apelido, cor) {
  const L = 512;
  const A = 128;
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

  const larguraUtil = L - 56;
  let tamanho = 74;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `bold ${tamanho}px system-ui, "Segoe UI", Arial, sans-serif`;
    if (ctx.measureText(apelido).width <= larguraUtil) break;
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

function criarOutdoor(participante, larguraPredio, cor) {
  const larguraPainel = Math.max(7.5, larguraPredio + 1.5);
  const grupo = new THREE.Group();

  const textura = criarTexturaApelido(participante.apelido, cor);
  const frente = new THREE.MeshBasicMaterial({ map: textura });
  const moldura = new THREE.MeshLambertMaterial({ color: 0x2b3448 });
  const painel = new THREE.Mesh(
    new THREE.BoxGeometry(larguraPainel, CONFIG_MAPA.OUTDOOR_ALTURA_PAINEL, 0.25),
    [moldura, moldura, moldura, moldura, frente, frente]
  );
  painel.position.y = CONFIG_MAPA.OUTDOOR_ALTURA_POSTE + CONFIG_MAPA.OUTDOOR_ALTURA_PAINEL / 2;
  painel.userData.participante = participante;

  const geoPoste = new THREE.CylinderGeometry(0.16, 0.16, CONFIG_MAPA.OUTDOOR_ALTURA_POSTE, 6);
  const matPoste = new THREE.MeshLambertMaterial({ color: 0x39435a });
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(geoPoste, matPoste);
    poste.position.set(lado * (larguraPainel / 2 - 0.8), CONFIG_MAPA.OUTDOOR_ALTURA_POSTE / 2, 0);
    grupo.add(poste);
  }

  grupo.add(painel);
  grupo.userData.textura = textura;
  return grupo;
}

function criarPredio(participante, celula) {
  const altura = CONFIG_MAPA.ALTURA_MINIMA + participante.horas * CONFIG_MAPA.ALTURA_POR_HORA;
  const h = hashId(participante.id);
  const largura = 6 + (h % 4);
  const profundidade = 6 + ((h >>> 4) % 4);
  const cor = PALETA_PREDIOS[(h >>> 8) % PALETA_PREDIOS.length];

  const textura = texturaJanelasBase.clone();
  textura.repeat.set(Math.max(1, Math.round(largura / 4)), Math.max(1, Math.round(altura / 5)));

  const lateral = new THREE.MeshLambertMaterial({ map: textura, color: cor });
  const topo = new THREE.MeshLambertMaterial({ color: new THREE.Color(cor).multiplyScalar(0.5) });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(largura, altura, profundidade),
    [lateral, lateral, topo, topo, lateral, lateral]
  );

  const [cx, cz] = celula;
  mesh.position.set(cx * CONFIG_MAPA.TAMANHO_CELULA, altura / 2, cz * CONFIG_MAPA.TAMANHO_CELULA);
  mesh.userData.participante = participante;

  const lote = new THREE.Mesh(
    new THREE.BoxGeometry(largura + 6, 0.2, profundidade + 6),
    new THREE.MeshLambertMaterial({ color: 0x222a3a })
  );
  lote.position.set(cx * CONFIG_MAPA.TAMANHO_CELULA, 0.1, cz * CONFIG_MAPA.TAMANHO_CELULA);

  const outdoor = criarOutdoor(participante, largura, cor);
  outdoor.position.set(cx * CONFIG_MAPA.TAMANHO_CELULA, altura, cz * CONFIG_MAPA.TAMANHO_CELULA);
  outdoors.push(outdoor);

  grupoPredios.add(lote, mesh, outdoor);
  prediosPorId.set(participante.id, mesh);

  colisoresPredios.push({
    x: mesh.position.x,
    z: mesh.position.z,
    hx: largura / 2,
    hz: profundidade / 2,
    altura,
    alturaColisao: altura + CONFIG_MAPA.OUTDOOR_ALTURA_TOTAL,
    participante,
  });

  return mesh;
}

function construirCidade() {
  for (const o of outdoors) o.userData.textura.dispose();
  outdoors.length = 0;
  grupoPredios.clear();
  prediosPorId.clear();
  colisoresPredios.length = 0;
  const celulas = posicoesEspiral(participantes.length);
  construirRuas(celulas);
  participantes.forEach((p, i) => criarPredio(p, celulas[i]));
  atualizarUI();
}

// ---------------------------------------------------------------------------
// UI & Auxiliares
// ---------------------------------------------------------------------------

function escaparHtml(txt) {
  const div = document.createElement('div');
  div.textContent = txt;
  return div.innerHTML;
}

function lerMeuId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.MEU_ID);
  } catch {
    return null;
  }
}

function atualizarUI() {
  document.getElementById('stat-participantes').textContent = participantes.length;
  document.getElementById('stat-max').textContent = CONFIG_MAPA.MAX_PREDIOS;
  document.getElementById('stat-horas').textContent =
    participantes.reduce((acc, p) => acc + p.horas, 0);

  const meuId = lerMeuId();
  const jaParticipa = Boolean(meuId && prediosPorId.has(meuId));
  document.getElementById('btn-meu-predio').hidden = !jaParticipa;

  const lotada = participantes.length >= CONFIG_MAPA.MAX_PREDIOS;
  const btnParticipar = document.getElementById('btn-participar');
  btnParticipar.disabled = lotada;
  btnParticipar.textContent = lotada ? '🏗️ Cidade lotada' : '＋ Participar da cidade';
}

new ModalParticipar({
  getEstaLotado: () => participantes.length >= CONFIG_MAPA.MAX_PREDIOS,
  onSubmit: async ({ ra, apelido }) => {
    await ApiService.enviarInscricao(ra, apelido);
  },
});

// ---------------------------------------------------------------------------
// Navegação e Câmera
// ---------------------------------------------------------------------------

let voo = null;

function vistaGeralCidade() {
  const anel = Math.max(2, Math.ceil(Math.sqrt(Math.max(participantes.length, 1)) / 2));
  const dist = Math.max(60, anel * CONFIG_MAPA.TAMANHO_CELULA + 40);
  return {
    camera: new THREE.Vector3(dist * 0.85, dist * 0.75, dist * 0.85),
    alvo: new THREE.Vector3(0, 0, 0),
  };
}

function irParaVistaGeral() {
  const vista = vistaGeralCidade();
  voo = {
    origemCamera: camera.position.clone(),
    origemAlvo: controls.target.clone(),
    alvoCamera: vista.camera,
    alvoControles: vista.alvo,
    t: 0,
  };
}

function voarAte(id) {
  if (modoAviao) alternarModoAviao();
  const predio = prediosPorId.get(id);
  if (!predio) return;
  const p = predio.position;
  voo = {
    origemCamera: camera.position.clone(),
    origemAlvo: controls.target.clone(),
    alvoCamera: new THREE.Vector3(p.x + 28, p.y + 24, p.z + 28),
    alvoControles: new THREE.Vector3(p.x, p.y, p.z),
    t: 0,
  };
}

document.getElementById('btn-meu-predio').addEventListener('click', () => {
  const meuId = lerMeuId();
  if (meuId && prediosPorId.has(meuId)) voarAte(meuId);
});

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
const elTooltip = document.getElementById('tooltip');

window.addEventListener('pointermove', (ev) => {
  if (modoAviao) {
    elTooltip.hidden = true;
    return;
  }

  ponteiro.x = (ev.clientX / window.innerWidth) * 2 - 1;
  ponteiro.y = -(ev.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(ponteiro, camera);
  const hit = raycaster
    .intersectObjects(grupoPredios.children)
    .find((i) => i.object.userData.participante);

  if (hit) {
    const p = hit.object.userData.participante;
    elTooltip.innerHTML =
      `<div class="t-nome">${escaparHtml(p.apelido)}</div>` +
      `<div><span class="t-horas">${p.horas}h</span> Blackboard</div>`;
    elTooltip.hidden = false;
    elTooltip.style.left = `${Math.min(ev.clientX + 14, window.innerWidth - 260)}px`;
    elTooltip.style.top = `${ev.clientY + 14}px`;
  } else {
    elTooltip.hidden = true;
  }
});

// ---------------------------------------------------------------------------
// Inicialização da Pilotagem e Loop
// ---------------------------------------------------------------------------

inicializarPilotagem({
  controls,
  camera,
  scene,
  colisoresPredios,
  vistaGeralCidade,
  irParaVistaGeral,
  onResetVoo: () => { voo = null; },
  onEsconderTooltip: () => { elTooltip.hidden = true; },
});

const relogio = new THREE.Clock();

function animar() {
  requestAnimationFrame(animar);
  const dt = Math.min(relogio.getDelta(), 0.1);

  for (const o of outdoors) {
    o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
  }

  atualizarExplosoes(dt, scene);

  if (modoAviao) {
    atualizarAviao(dt, relogio.elapsedTime);
  } else {
    if (voo) {
      voo.t = Math.min(1, voo.t + 0.02);
      const e = 1 - Math.pow(1 - voo.t, 3);
      camera.position.lerpVectors(voo.origemCamera, voo.alvoCamera, e);
      controls.target.lerpVectors(voo.origemAlvo, voo.alvoControles, e);
      if (voo.t >= 1) voo = null;
    }
    controls.update();

    const raioAlvo = Math.hypot(controls.target.x, controls.target.z);
    if (raioAlvo > CONFIG_MAPA.RAIO) {
      const fator = CONFIG_MAPA.RAIO / raioAlvo;
      controls.target.x *= fator;
      controls.target.z *= fator;
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Carga dos Dados
// ---------------------------------------------------------------------------

fetch('data/participantes.json')
  .then((r) => r.json())
  .then((dados) => {
    participantes = dados.participantes.slice(0, CONFIG_MAPA.MAX_PREDIOS);
    if (dados.participantes.length > CONFIG_MAPA.MAX_PREDIOS) {
      console.warn(
        `participantes.json tem ${dados.participantes.length} registros; ` +
          `exibindo apenas os primeiros ${CONFIG_MAPA.MAX_PREDIOS}.`
      );
    }
    construirCidade();

    const vista = vistaGeralCidade();
    camera.position.copy(vista.camera);
    controls.target.copy(vista.alvo);

    animar();
  })
  .catch((err) => {
    console.error('Falha ao carregar participantes.json:', err);
    document.getElementById('rodape').textContent =
      'Erro ao carregar os dados.';
    animar();
  });