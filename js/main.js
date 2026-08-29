import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { criarAviao } from './aviao.js';
import { ApiService, ModalParticipar } from './formulario.js';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

// Paleta usada só para variedade visual — a cor de cada prédio é sorteada
// de forma determinística pelo id público (nunca pelo RA)
const PALETA_PREDIOS = [0x4f8ff7, 0x9d6ff7, 0x34c98e, 0xf7b23b, 0xf76f6f, 0x5ad0e0];

// Onde o navegador guarda "qual prédio é o meu". Guardamos apenas o id
// público — o RA nunca é persistido no navegador.
const CHAVE_MEU_ID = 'horascity:meu-id';

// Espaçamento entre prédios na malha. Os prédios têm 6–9 de largura, então
// 24 deixa ruas largas o bastante para atravessar de avião com folga.
const TAMANHO_CELULA = 24;
const ALTURA_POR_HORA = 0.35;   // 1 hora Blackboard = 0.35 unidades de altura
const ALTURA_MINIMA = 2;

// Malha viária. As vias correm pelo meio do vão entre duas fileiras: o maior
// lote ocupa 15 das 24 unidades da célula, então uma pista de 8 passa entre as
// calçadas sem encostar em nenhuma delas.
const LARGURA_RUA = 8;
const TRACO_COMPRIMENTO = 5;   // faixa central tracejada
const TRACO_LARGURA = 0.35;

// Outdoor no telhado: dois postes e o painel com o apelido. As medidas são
// fixas (não acompanham a altura do prédio) para que o letreiro tenha o mesmo
// tamanho na cidade inteira — quem tem poucas horas continua legível.
const OUTDOOR_ALTURA_POSTE = 1.4;
const OUTDOOR_ALTURA_PAINEL = 2.4;
const OUTDOOR_ALTURA_TOTAL = OUTDOOR_ALTURA_POSTE + OUTDOOR_ALTURA_PAINEL;

// Capacidade da cidade. A espiral de 100 células chega a ±5 células do centro,
// ou seja ±120 unidades por eixo — os prédios de canto ficam a ~170 do centro.
// O mapa em 230 mantém a barreira fora da cidade com espaço para contorná-la.
const MAX_PREDIOS = 100;
const RAIO_MAPA = 230;
const ALTURA_MAPA = 130;

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

let participantes = [];
const prediosPorId = new Map(); // id público -> THREE.Mesh
const colisoresPredios = [];    // caixas dos prédios, para a colisão do avião
const outdoors = [];            // letreiros do telhado, girados para a câmera

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
controls.maxPolarAngle = Math.PI / 2.05; // não deixa a câmera ir para baixo do chão
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
// Limite do mapa — cúpula translúcida + anel no chão marcando a borda
// ---------------------------------------------------------------------------

const paredeMapa = new THREE.Mesh(
  new THREE.CylinderGeometry(RAIO_MAPA, RAIO_MAPA, ALTURA_MAPA, 72, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x5ad0e0,
    transparent: true,
    opacity: 0.06,
    side: THREE.BackSide, // só visível de dentro, não atrapalha a vista externa
    depthWrite: false,
  })
);
paredeMapa.position.y = ALTURA_MAPA / 2;
scene.add(paredeMapa);

const anelMapa = new THREE.Mesh(
  new THREE.RingGeometry(RAIO_MAPA - 2, RAIO_MAPA, 72),
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
// Textura de janelas (compartilhada, tingida pela cor de cada prédio)
// ---------------------------------------------------------------------------

function criarTexturaJanelas() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c6cbd6'; // fachada (clara — a cor do prédio tinge por multiplicação)
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 6; y < 64; y += 16) {
    for (let x = 6; x < 64; x += 16) {
      // parte das janelas fica acesa, parte apagada
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

// Um plano unitário deitado, reaproveitado por toda a malha viária: cada peça
// é o mesmo retângulo esticado pela escala do mesh. Assim a cidade pode ser
// reconstruída quantas vezes for sem gerar geometria nova a cada vez.
const geoPistaUnitaria = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const materialAsfalto = new THREE.MeshLambertMaterial({ color: 0x1b2130 });
const materialFaixa = new THREE.MeshBasicMaterial({ color: 0xd8c98a });

// As vias dos dois eixos se cruzam no mesmo plano e brigariam no z-buffer;
// dois milésimos de diferença resolvem sem que o degrau apareça.
const Y_VIA_Z = 0.05;   // vias que correm ao longo de Z
const Y_VIA_X = 0.052;  // vias que correm ao longo de X
const Y_FAIXA = 0.07;   // faixa central, acima das duas camadas de asfalto

function criarPista(x, z, largura, comprimento, y) {
  const pista = new THREE.Mesh(geoPistaUnitaria, materialAsfalto);
  pista.position.set(x, y, z);
  pista.scale.set(largura, 1, comprimento);
  return pista;
}

// Reconstrói a malha viária em volta das células ocupadas. Recebe as células
// porque a espiral cresce a cada novo participante — fixar a extensão deixaria
// asfalto sobrando no vazio agora e rua faltando na borda nova depois.
function construirRuas(celulas) {
  for (const filho of grupoRuas.children) filho.dispose?.();
  grupoRuas.clear();
  if (!celulas.length) return;

  const xs = celulas.map(([cx]) => cx);
  const zs = celulas.map(([, cz]) => cz);

  // As vias ficam nos meios-inteiros da malha, de uma borda à outra: a cidade
  // acaba cercada por rua, sem quadra aberta na ponta.
  const xsVia = [];
  for (let i = Math.min(...xs); i <= Math.max(...xs) + 1; i++) {
    xsVia.push((i - 0.5) * TAMANHO_CELULA);
  }
  const zsVia = [];
  for (let j = Math.min(...zs); j <= Math.max(...zs) + 1; j++) {
    zsVia.push((j - 0.5) * TAMANHO_CELULA);
  }

  const x0 = xsVia[0], x1 = xsVia[xsVia.length - 1];
  const z0 = zsVia[0], z1 = zsVia[zsVia.length - 1];

  // Cada via atravessa a cidade inteira; os cruzamentos saem de graça na
  // sobreposição das duas camadas. O meio-quarteirão a mais no comprimento
  // fecha o cruzamento das pontas.
  for (const x of xsVia) {
    grupoRuas.add(criarPista(x, (z0 + z1) / 2, LARGURA_RUA, z1 - z0 + LARGURA_RUA, Y_VIA_Z));
  }
  for (const z of zsVia) {
    grupoRuas.add(criarPista((x0 + x1) / 2, z, x1 - x0 + LARGURA_RUA, LARGURA_RUA, Y_VIA_X));
  }

  // Faixa central tracejada só nos trechos entre cruzamentos: um traço cortando
  // o cruzamento leria como uma pista passando por cima da outra.
  const vao = TAMANHO_CELULA - LARGURA_RUA;
  const passo = TRACO_COMPRIMENTO + 3;
  const porTrecho = Math.max(1, Math.floor(vao / passo));
  const tracos = []; // [x, z, corre ao longo de X?]
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

  // Um traço por mesh custaria centenas de draw calls numa cidade cheia; como
  // todos são o mesmo retângulo, uma InstancedMesh desenha o conjunto de uma vez.
  const faixas = new THREE.InstancedMesh(geoPistaUnitaria, materialFaixa, tracos.length);
  const matriz = new THREE.Matrix4();
  tracos.forEach(([x, z, aoLongoDeX], i) => {
    matriz.makeScale(
      aoLongoDeX ? TRACO_COMPRIMENTO : TRACO_LARGURA,
      1,
      aoLongoDeX ? TRACO_LARGURA : TRACO_COMPRIMENTO
    );
    matriz.setPosition(x, Y_FAIXA, z);
    faixas.setMatrixAt(i, matriz);
  });
  faixas.instanceMatrix.needsUpdate = true;
  grupoRuas.add(faixas);
}

// ---------------------------------------------------------------------------
// Geração da cidade
// ---------------------------------------------------------------------------

// Caminhada em espiral: o participante N ocupa sempre a mesma célula,
// então a cidade cresce para fora sem mover os prédios já existentes.
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
      [dx, dz] = [-dz, dx]; // vira 90°
      viradas++;
      if (viradas % 2 === 0) passos++;
    }
  }
  return posicoes;
}

// Hash do id PÚBLICO, só para variar a aparência do prédio.
function hashId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
}

// Painel do outdoor desenhado em canvas: fundo escuro, moldura na cor do
// prédio e o apelido em letras claras.
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
  ctx.fillRect(4, A - 16, L - 8, 12); // faixa acesa na base, como um letreiro

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

// Outdoor plantado no telhado.
function criarOutdoor(participante, larguraPredio, cor) {
  const larguraPainel = Math.max(7.5, larguraPredio + 1.5);
  const grupo = new THREE.Group();

  const textura = criarTexturaApelido(participante.apelido, cor);
  const frente = new THREE.MeshBasicMaterial({ map: textura });
  const moldura = new THREE.MeshLambertMaterial({ color: 0x2b3448 });
  const painel = new THREE.Mesh(
    new THREE.BoxGeometry(larguraPainel, OUTDOOR_ALTURA_PAINEL, 0.25),
    [moldura, moldura, moldura, moldura, frente, frente]
  );
  painel.position.y = OUTDOOR_ALTURA_POSTE + OUTDOOR_ALTURA_PAINEL / 2;
  painel.userData.participante = participante;

  const geoPoste = new THREE.CylinderGeometry(0.16, 0.16, OUTDOOR_ALTURA_POSTE, 6);
  const matPoste = new THREE.MeshLambertMaterial({ color: 0x39435a });
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(geoPoste, matPoste);
    poste.position.set(lado * (larguraPainel / 2 - 0.8), OUTDOOR_ALTURA_POSTE / 2, 0);
    grupo.add(poste);
  }

  grupo.add(painel);
  grupo.userData.textura = textura;
  return grupo;
}

function criarPredio(participante, celula) {
  const altura = ALTURA_MINIMA + participante.horas * ALTURA_POR_HORA;
  const h = hashId(participante.id);
  const largura = 6 + (h % 4);          // 6–9
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
  mesh.position.set(cx * TAMANHO_CELULA, altura / 2, cz * TAMANHO_CELULA);
  mesh.userData.participante = participante;

  const lote = new THREE.Mesh(
    new THREE.BoxGeometry(largura + 6, 0.2, profundidade + 6),
    new THREE.MeshLambertMaterial({ color: 0x222a3a })
  );
  lote.position.set(cx * TAMANHO_CELULA, 0.1, cz * TAMANHO_CELULA);

  const outdoor = criarOutdoor(participante, largura, cor);
  outdoor.position.set(cx * TAMANHO_CELULA, altura, cz * TAMANHO_CELULA);
  outdoors.push(outdoor);

  grupoPredios.add(lote, mesh, outdoor);
  prediosPorId.set(participante.id, mesh);

  colisoresPredios.push({
    x: mesh.position.x,
    z: mesh.position.z,
    hx: largura / 2,
    hz: profundidade / 2,
    altura,
    alturaColisao: altura + OUTDOOR_ALTURA_TOTAL,
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
// UI: estatísticas
// ---------------------------------------------------------------------------

function atualizarUI() {
  document.getElementById('stat-participantes').textContent = participantes.length;
  document.getElementById('stat-max').textContent = MAX_PREDIOS;
  document.getElementById('stat-horas').textContent =
    participantes.reduce((acc, p) => acc + p.horas, 0);

  const meuId = lerMeuId();
  const jaParticipa = Boolean(meuId && prediosPorId.has(meuId));
  document.getElementById('btn-meu-predio').hidden = !jaParticipa;

  const lotada = participantes.length >= MAX_PREDIOS;
  const btnParticipar = document.getElementById('btn-participar');
  btnParticipar.disabled = lotada;
  btnParticipar.textContent = lotada ? '🏗️ Cidade lotada' : '＋ Participar da cidade';
}

function escaparHtml(txt) {
  const div = document.createElement('div');
  div.textContent = txt;
  return div.innerHTML;
}

function lerMeuId() {
  try {
    return localStorage.getItem(CHAVE_MEU_ID);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Instanciação do Modal de Inscrição
// ---------------------------------------------------------------------------

new ModalParticipar({
  getEstaLotado: () => participantes.length >= MAX_PREDIOS,
  onSubmit: async ({ ra, apelido }) => {
    await ApiService.enviarInscricao(ra, apelido);
  },
});

// ---------------------------------------------------------------------------
// Voo de câmera até um prédio
// ---------------------------------------------------------------------------

let voo = null;

function vistaGeralCidade() {
  const anel = Math.max(2, Math.ceil(Math.sqrt(Math.max(participantes.length, 1)) / 2));
  const dist = Math.max(60, anel * TAMANHO_CELULA + 40);
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

// Atalho para quem já participa
document.getElementById('btn-meu-predio').addEventListener('click', () => {
  const meuId = lerMeuId();
  if (meuId && prediosPorId.has(meuId)) voarAte(meuId);
});

// ---------------------------------------------------------------------------
// Tooltip (hover nos prédios)
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
// Modo avião — pilote sobre a cidade (WASD + Shift, Esc para sair)
// ---------------------------------------------------------------------------

const aviao = criarAviao();
aviao.visible = false;
scene.add(aviao);
const heliceAviao = aviao.userData.helice;
let modoAviao = false;
const estadoAviao = { yaw: 0, pitch: 0, roll: 0 };
const teclas = new Set();

let manobraRetorno = null;
const elAvisoBarreira = document.getElementById('aviso-barreira');

function normalizarAngulo(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function yawParaOCentro() {
  return Math.atan2(aviao.position.x, aviao.position.z);
}

function iniciarManobra(yawAlvo) {
  const delta = normalizarAngulo(yawAlvo - estadoAviao.yaw);
  manobraRetorno = {
    yawAlvo,
    sentido: delta >= 0 ? 1 : -1,
  };
}

let timerAviso = null;

function mostrarAviso(html, duracaoMs, tipo) {
  elAvisoBarreira.innerHTML = html;
  elAvisoBarreira.classList.toggle('colisao', tipo === 'colisao');
  elAvisoBarreira.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => (elAvisoBarreira.hidden = true), duracaoMs);
}

function esconderAviso() {
  clearTimeout(timerAviso);
  elAvisoBarreira.hidden = true;
}

let predioAvisado = null;
let timerPredioAvisado = null;

function avisarBatida(participante) {
  if (participante === predioAvisado) return false;
  predioAvisado = participante;
  mostrarAviso(
    `💥 Bateu no prédio de <strong>${escaparHtml(participante.apelido)}</strong>` +
      ` — <strong>${participante.horas}h</strong> Blackboard`,
    2800,
    'colisao'
  );
  clearTimeout(timerPredioAvisado);
  timerPredioAvisado = setTimeout(() => (predioAvisado = null), 2800);
  return true;
}

// ---------------------------------------------------------------------------
// Explosão da batida
// ---------------------------------------------------------------------------

const DURACAO_EXPLOSAO = 0.9;
const DURACAO_HORAS = 1.4;

const texturaFaisca = (() => {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,190,110,0.85)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

function criarTexturaHoras(horas) {
  const L = 256;
  const A = 128;
  const c = document.createElement('canvas');
  c.width = L;
  c.height = A;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 72px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = '#ff9a3c';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffcf7a';
  ctx.fillText(`${horas}h`, L / 2, A / 2 - 12);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${horas}h`, L / 2, A / 2 - 12);

  ctx.font = 'bold 22px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffd9a8';
  ctx.fillText('Blackboard', L / 2, A - 26);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const explosoes = [];

function explodir(ponto, participante) {
  const grupo = new THREE.Group();
  grupo.position.set(ponto.x, ponto.y, ponto.z);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  grupo.add(flash);

  const QTD_FAISCAS = 22;
  const velocidades = [];
  for (let i = 0; i < QTD_FAISCAS; i++) {
    velocidades.push(
      new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        .normalize()
        .multiplyScalar(3 + Math.random() * 5)
    );
  }
  const geoFaiscas = new THREE.BufferGeometry();
  geoFaiscas.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(QTD_FAISCAS * 3), 3)
  );
  const faiscas = new THREE.Points(
    geoFaiscas,
    new THREE.PointsMaterial({
      size: 0.7,
      map: texturaFaisca,
      color: 0xffa63d,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  grupo.add(faiscas);

  const texturaHoras = criarTexturaHoras(participante.horas);
  const etiqueta = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texturaHoras,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  etiqueta.scale.set(5, 2.5, 1);
  etiqueta.position.y = 2;
  grupo.add(etiqueta);

  scene.add(grupo);
  explosoes.push({ grupo, flash, faiscas, velocidades, etiqueta, texturaHoras, t: 0 });
}

function descartarExplosao(e) {
  scene.remove(e.grupo);
  e.flash.geometry.dispose();
  e.flash.material.dispose();
  e.faiscas.geometry.dispose();
  e.faiscas.material.dispose();
  e.etiqueta.material.dispose();
  e.texturaHoras.dispose();
}

function atualizarExplosoes(dt) {
  for (let i = explosoes.length - 1; i >= 0; i--) {
    const e = explosoes[i];
    e.t += dt;
    if (e.t >= DURACAO_HORAS) {
      descartarExplosao(e);
      explosoes.splice(i, 1);
      continue;
    }

    const k = Math.min(1, e.t / DURACAO_EXPLOSAO);
    const kh = e.t / DURACAO_HORAS;

    e.flash.scale.setScalar(0.7 + k * 2.2);
    e.flash.material.opacity = Math.max(0, 1 - k * 1.8) * 0.8;

    const pos = e.faiscas.geometry.attributes.position;
    for (let j = 0; j < e.velocidades.length; j++) {
      const v = e.velocidades[j];
      pos.setXYZ(j, v.x * e.t, v.y * e.t - 4 * e.t * e.t, v.z * e.t);
    }
    pos.needsUpdate = true;
    e.faiscas.material.opacity = 1 - k;

    e.etiqueta.position.y = 2 + kh * 3.5;
    e.etiqueta.material.opacity = kh < 0.75 ? 1 : (1 - kh) / 0.25;
  }
}

function encerrarManobraRetorno() {
  manobraRetorno = null;
}

const RAIO_AVIAO = (() => {
  const tam = new THREE.Box3().setFromObject(aviao).getSize(new THREE.Vector3());
  return Math.max(tam.x, tam.z) / 2;
})();

function resolverColisaoPredios() {
  const p = aviao.position;
  let batida = null;

  for (const c of colisoresPredios) {
    if (Math.abs(p.x - c.x) > c.hx + RAIO_AVIAO) continue;
    if (Math.abs(p.z - c.z) > c.hz + RAIO_AVIAO) continue;
    if (p.y - RAIO_AVIAO > c.alturaColisao) continue;

    const px = THREE.MathUtils.clamp(p.x, c.x - c.hx, c.x + c.hx);
    const py = THREE.MathUtils.clamp(p.y, 0, c.alturaColisao);
    const pz = THREE.MathUtils.clamp(p.z, c.z - c.hz, c.z + c.hz);

    const dx = p.x - px;
    const dy = p.y - py;
    const dz = p.z - pz;
    const dist2 = dx * dx + dy * dy + dz * dz;
    if (dist2 >= RAIO_AVIAO * RAIO_AVIAO) continue;

    let nx, ny, nz, empurrao;
    if (dist2 > 1e-6) {
      const dist = Math.sqrt(dist2);
      nx = dx / dist;
      ny = dy / dist;
      nz = dz / dist;
      empurrao = RAIO_AVIAO - dist;
    } else {
      const paraX = c.hx - Math.abs(p.x - c.x);
      const paraZ = c.hz - Math.abs(p.z - c.z);
      const paraCima = c.alturaColisao - p.y;
      if (paraCima <= paraX && paraCima <= paraZ) {
        nx = 0; ny = 1; nz = 0; empurrao = paraCima + RAIO_AVIAO;
      } else if (paraX <= paraZ) {
        nx = Math.sign(p.x - c.x) || 1; ny = 0; nz = 0; empurrao = paraX + RAIO_AVIAO;
      } else {
        nx = 0; ny = 0; nz = Math.sign(p.z - c.z) || 1; empurrao = paraZ + RAIO_AVIAO;
      }
    }

    p.x += nx * empurrao;
    p.y += ny * empurrao;
    p.z += nz * empurrao;
    batida = { ponto: { x: px, y: py, z: pz }, predio: c };
  }

  return batida;
}

window.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'INPUT') return;
  teclas.add(ev.code);
  if (ev.code === 'Escape' && modoAviao && !ev.repeat) alternarModoAviao();
});
window.addEventListener('keyup', (ev) => teclas.delete(ev.code));

// ---------------------------------------------------------------------------
// Joystick de toque
// ---------------------------------------------------------------------------

const controlesToque = document.getElementById('controles-toque');
const joystick = document.getElementById('joystick');
const manete = document.getElementById('joystick-manete');
const btnTurbo = document.getElementById('btn-turbo');
const temToque = window.matchMedia('(pointer: coarse)').matches;

const comandoToque = { x: 0, y: 0, turbo: false };
let ponteiroJoystick = null;

function moverManete(ev) {
  const area = joystick.getBoundingClientRect();
  const raio = area.width / 2;
  let dx = (ev.clientX - (area.left + raio)) / raio;
  let dy = (ev.clientY - (area.top + raio)) / raio;

  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    dx /= dist;
    dy /= dist;
  }

  comandoToque.x = dx;
  comandoToque.y = -dy;
  manete.style.transform = `translate(${dx * raio * 0.6}px, ${dy * raio * 0.6}px)`;
}

function zerarComandoToque() {
  ponteiroJoystick = null;
  comandoToque.x = 0;
  comandoToque.y = 0;
  comandoToque.turbo = false;
  manete.style.transform = 'translate(0px, 0px)';
  btnTurbo.classList.remove('ativo');
}

joystick.addEventListener('pointerdown', (ev) => {
  ponteiroJoystick = ev.pointerId;
  joystick.setPointerCapture(ev.pointerId);
  moverManete(ev);
});

joystick.addEventListener('pointermove', (ev) => {
  if (ev.pointerId === ponteiroJoystick) moverManete(ev);
});

for (const evento of ['pointerup', 'pointercancel']) {
  joystick.addEventListener(evento, (ev) => {
    if (ev.pointerId === ponteiroJoystick) zerarComandoToque();
  });
}

btnTurbo.addEventListener('pointerdown', (ev) => {
  btnTurbo.setPointerCapture(ev.pointerId);
  comandoToque.turbo = true;
  btnTurbo.classList.add('ativo');
});

for (const evento of ['pointerup', 'pointercancel']) {
  btnTurbo.addEventListener(evento, () => {
    comandoToque.turbo = false;
    btnTurbo.classList.remove('ativo');
  });
}

const btnAviao = document.getElementById('btn-aviao');
const dicasVoo = document.getElementById('dicas-voo');
btnAviao.addEventListener('click', () => {
  btnAviao.blur();
  alternarModoAviao();
});

function alternarModoAviao() {
  modoAviao = !modoAviao;
  aviao.visible = modoAviao;
  controls.enabled = !modoAviao;
  dicasVoo.hidden = !modoAviao || temToque;
  controlesToque.hidden = !(modoAviao && temToque);
  zerarComandoToque();
  if (!modoAviao) encerrarCorrida();
  btnAviao.classList.toggle('ativo', modoAviao);
  btnAviao.textContent = modoAviao ? '🛬 Sair do avião' : '✈️ Pilotar avião';

  encerrarManobraRetorno();
  esconderAviso();
  predioAvisado = null;
  elTooltip.hidden = true;

  if (modoAviao) {
    voo = null;
    const afastamento = vistaGeralCidade().camera.length() * 0.7;
    const alvo = new THREE.Vector3(controls.target.x, 38, controls.target.z + afastamento);
    const raio = Math.hypot(alvo.x, alvo.z);
    if (raio > RAIO_MAPA - 30) {
      const fator = (RAIO_MAPA - 30) / raio;
      alvo.x *= fator;
      alvo.z *= fator;
    }
    aviao.position.copy(alvo);
    estadoAviao.yaw = yawParaOCentro();
    estadoAviao.pitch = 0;
    estadoAviao.roll = 0;
  } else {
    irParaVistaGeral();
  }
}

// ---------------------------------------------------------------------------
// Circuito de argolas
// ---------------------------------------------------------------------------

const CIRCUITO = [
  [-36,  12, 12,  1, 0],
  [-12,  12, 20,  1, 0],
  [ 12,  12, 12,  1, 0],
  [ 36,  12, 20,  1, 0],
  [ 36, -12, 12, -1, 0],
  [ 12, -12, 20, -1, 0],
  [-12, -12, 12, -1, 0],
  [-36, -12, 20, -1, 0],
];

const RAIO_ARGOLA = 6;
const CHAVE_RECORDE = 'horascity:recorde-circuito';

const grupoArgolas = new THREE.Group();
grupoArgolas.visible = false;
scene.add(grupoArgolas);

const geoArgola = new THREE.TorusGeometry(RAIO_ARGOLA, 0.45, 10, 40);

const argolas = CIRCUITO.map(([x, z, y, dx, dz]) => {
  const argola = new THREE.Mesh(
    geoArgola,
    new THREE.MeshStandardMaterial({ color: 0x3a4a63, emissive: 0x1b2a3a, roughness: 0.4 })
  );
  argola.position.set(x, y, z);
  argola.rotation.y = Math.atan2(dx, dz);
  argola.userData.direcao = { x: dx, z: dz };
  grupoArgolas.add(argola);
  return argola;
});

grupoArgolas.updateMatrixWorld(true);

let corrida = null;

const hudCorrida = document.getElementById('hud-corrida');
const elCorridaTempo = document.getElementById('corrida-tempo');
const elCorridaProgresso = document.getElementById('corrida-progresso');
const elCorridaRecorde = document.getElementById('corrida-recorde');
const btnCorrida = document.getElementById('btn-corrida');

function formatarTempo(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function lerRecorde() {
  const bruto = Number(localStorage.getItem(CHAVE_RECORDE));
  return Number.isFinite(bruto) && bruto > 0 ? bruto : null;
}

function pintarArgolas() {
  argolas.forEach((argola, i) => {
    const passada = corrida && i < corrida.indice;
    const proxima = corrida && i === corrida.indice;
    argola.material.color.setHex(passada ? 0x34c98e : proxima ? 0x5ad0e0 : 0x3a4a63);
    argola.material.emissive.setHex(passada ? 0x0e3d2a : proxima ? 0x1d6f7c : 0x1b2a3a);
    argola.material.emissiveIntensity = 1;
  });
}

function atualizarHudCorrida() {
  if (!corrida) return;
  const decorrido = corrida.inicio === null ? 0 : (corrida.fim ?? performance.now()) - corrida.inicio;
  elCorridaTempo.textContent = formatarTempo(decorrido);
  elCorridaProgresso.textContent = `${corrida.indice} / ${argolas.length} argolas`;
  const recorde = lerRecorde();
  elCorridaRecorde.hidden = recorde === null;
  if (recorde !== null) elCorridaRecorde.textContent = `recorde ${formatarTempo(recorde)}`;
}

function atualizarBotaoCorrida() {
  btnCorrida.classList.toggle('ativo', corrida !== null);
  btnCorrida.textContent = !corrida
    ? '🏁 Circuito'
    : corrida.fim
      ? '🔁 Correr de novo'
      : '✕ Sair do circuito';
}

function iniciarCorrida() {
  if (!modoAviao) alternarModoAviao();

  corrida = { indice: 0, inicio: null, fim: null };
  grupoArgolas.visible = true;
  pintarArgolas();

  const primeira = argolas[0];
  const dir = primeira.userData.direcao;
  aviao.position.set(
    primeira.position.x - dir.x * 50,
    primeira.position.y,
    primeira.position.z - dir.z * 50
  );
  estadoAviao.yaw = Math.atan2(-dir.x, -dir.z);
  estadoAviao.pitch = 0;
  estadoAviao.roll = 0;
  encerrarManobraRetorno();

  hudCorrida.hidden = false;
  atualizarHudCorrida();
  atualizarBotaoCorrida();
}

function encerrarCorrida() {
  if (!corrida) return;
  corrida = null;
  grupoArgolas.visible = false;
  hudCorrida.hidden = true;
  atualizarBotaoCorrida();
}

function concluirCorrida() {
  const ms = corrida.fim - corrida.inicio;
  const recorde = lerRecorde();
  const superou = recorde === null || ms < recorde;
  if (superou) localStorage.setItem(CHAVE_RECORDE, String(Math.round(ms)));
  mostrarAviso(
    superou
      ? `🏁 <strong>${formatarTempo(ms)}</strong> — novo recorde!`
      : `🏁 <strong>${formatarTempo(ms)}</strong> · seu recorde é ${formatarTempo(recorde)}`,
    5000
  );
  atualizarBotaoCorrida();
}

const _localAntes = new THREE.Vector3();
const _localDepois = new THREE.Vector3();

function atualizarCorrida(posAntes, posDepois) {
  if (!corrida || corrida.fim) return;

  const argola = argolas[corrida.indice];
  argola.worldToLocal(_localAntes.copy(posAntes));
  argola.worldToLocal(_localDepois.copy(posDepois));

  if ((_localAntes.z > 0) === (_localDepois.z > 0)) return;

  const t = _localAntes.z / (_localAntes.z - _localDepois.z);
  const x = _localAntes.x + (_localDepois.x - _localAntes.x) * t;
  const y = _localAntes.y + (_localDepois.y - _localAntes.y) * t;
  if (Math.hypot(x, y) > RAIO_ARGOLA) return;

  if (corrida.indice === 0) corrida.inicio = performance.now();
  corrida.indice++;
  pintarArgolas();

  if (corrida.indice >= argolas.length) {
    corrida.fim = performance.now();
    concluirCorrida();
  }
}

btnCorrida.addEventListener('click', () => {
  btnCorrida.blur();
  if (corrida && !corrida.fim) encerrarCorrida();
  else iniciarCorrida();
});

const _dirAviao = new THREE.Vector3();
const _posAnteriorAviao = new THREE.Vector3();
const _posCamera = new THREE.Vector3();
const _alvoOlhar = new THREE.Vector3();

function atualizarAviao(dt) {
  _posAnteriorAviao.copy(aviao.position);

  const subir = THREE.MathUtils.clamp(
    (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0) + comandoToque.y, -1, 1);
  const turbo = teclas.has('ShiftLeft') || teclas.has('ShiftRight') || comandoToque.turbo;
  const velocidade = turbo ? 60 : 30;

  let virar;
  let taxaGiro = 1.5;

  if (manobraRetorno) {
    const restante = normalizarAngulo(manobraRetorno.yawAlvo - estadoAviao.yaw);
    if (Math.abs(restante) < 0.06) {
      estadoAviao.yaw = manobraRetorno.yawAlvo;
      encerrarManobraRetorno();
      virar = 0;
    } else {
      taxaGiro = 2.6;
      virar = manobraRetorno.sentido;
    }
  } else {
    virar = THREE.MathUtils.clamp(
      (teclas.has('KeyA') ? 1 : 0) - (teclas.has('KeyD') ? 1 : 0) - comandoToque.x, -1, 1);
  }

  estadoAviao.yaw += virar * taxaGiro * dt;
  estadoAviao.pitch += (subir * 0.45 - estadoAviao.pitch) * Math.min(1, 4 * dt);
  estadoAviao.roll += (virar * 0.55 - estadoAviao.roll) * Math.min(1, 4 * dt);
  
  _dirAviao
    .set(0, 0, -1)
    .applyEuler(new THREE.Euler(estadoAviao.pitch, estadoAviao.yaw, 0, 'YXZ'));
  aviao.position.addScaledVector(_dirAviao, velocidade * dt);

  aviao.position.y = THREE.MathUtils.clamp(aviao.position.y, 6, ALTURA_MAPA - 10);

  const batida = resolverColisaoPredios();
  if (batida && avisarBatida(batida.predio.participante)) {
    explodir(batida.ponto, batida.predio.participante);
  }

  atualizarCorrida(_posAnteriorAviao, aviao.position);

  const raio = Math.hypot(aviao.position.x, aviao.position.z);
  if (raio >= RAIO_MAPA && !manobraRetorno) {
    iniciarManobra(yawParaOCentro());
    mostrarAviso('🚧 Limite do mapa — retornando à cidade', 2000);
  }

  const raioMaximo = RAIO_MAPA + 12;
  if (raio > raioMaximo) {
    const fator = raioMaximo / raio;
    aviao.position.x *= fator;
    aviao.position.z *= fator;
  }

  aviao.rotation.set(estadoAviao.pitch, estadoAviao.yaw, estadoAviao.roll);
  heliceAviao.rotation.z += (turbo ? 42 : 26) * dt;

  _posCamera
    .set(0, 3.2, 9.5)
    .applyEuler(new THREE.Euler(estadoAviao.pitch * 0.4, estadoAviao.yaw, 0, 'YXZ'))
    .add(aviao.position);
  camera.position.lerp(_posCamera, 1 - Math.pow(0.0005, dt));

  _alvoOlhar.copy(aviao.position).addScaledVector(_dirAviao, 12);
  _alvoOlhar.y -= 3.2;
  camera.lookAt(_alvoOlhar);
}

// ---------------------------------------------------------------------------
// Loop de renderização
// ---------------------------------------------------------------------------

const relogio = new THREE.Clock();

function animar() {
  requestAnimationFrame(animar);
  const dt = Math.min(relogio.getDelta(), 0.1);

  for (const o of outdoors) {
    o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
  }

  atualizarExplosoes(dt);

  if (modoAviao) {
    atualizarAviao(dt);

    if (corrida) {
      atualizarHudCorrida();
      if (!corrida.fim) {
        argolas[corrida.indice].material.emissiveIntensity =
          1.4 + Math.sin(relogio.elapsedTime * 5) * 0.6;
      }
    }
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
    if (raioAlvo > RAIO_MAPA) {
      const fator = RAIO_MAPA / raioAlvo;
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
// Inicialização
// ---------------------------------------------------------------------------

fetch('data/participantes.json')
  .then((r) => r.json())
  .then((dados) => {
    participantes = dados.participantes.slice(0, MAX_PREDIOS);
    if (dados.participantes.length > MAX_PREDIOS) {
      console.warn(
        `participantes.json tem ${dados.participantes.length} registros; ` +
          `exibindo apenas os primeiros ${MAX_PREDIOS}.`
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
      'Erro ao carregar os dados — abra o site por um servidor local (ex.: npx serve).';
    animar();
  });