import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { criarAviao } from './aviao.js';

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
// Nunca aplique isto a um RA: o espaço de RAs é pequeno o bastante para ser
// enumerado em segundos, então um hash de RA publicado equivale a publicar o RA.
function hashId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
}

// Painel do outdoor desenhado em canvas: fundo escuro, moldura na cor do
// prédio e o apelido em letras claras. A fonte encolhe até o texto caber, então
// apelidos longos aparecem menores em vez de vazarem para fora do painel.
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

// Outdoor plantado no telhado. A base do grupo fica na altura do telhado, e o
// grupo inteiro gira em torno de Y para encarar a câmera (ver animar()), então
// o apelido é legível de qualquer ângulo — os dois postes são simétricos e
// acompanham o giro sem denunciá-lo.
function criarOutdoor(participante, larguraPredio, cor) {
  const larguraPainel = Math.max(7.5, larguraPredio + 1.5);
  const grupo = new THREE.Group();

  const textura = criarTexturaApelido(participante.apelido, cor);
  const frente = new THREE.MeshBasicMaterial({ map: textura });
  const moldura = new THREE.MeshLambertMaterial({ color: 0x2b3448 });
  // Caixa fina em vez de plano: as faces +Z e -Z já vêm com as UVs corretas,
  // então o texto aparece na leitura certa dos dois lados (um plano de dupla
  // face mostraria o verso espelhado).
  const painel = new THREE.Mesh(
    new THREE.BoxGeometry(larguraPainel, OUTDOOR_ALTURA_PAINEL, 0.25),
    [moldura, moldura, moldura, moldura, frente, frente]
  );
  painel.position.y = OUTDOOR_ALTURA_POSTE + OUTDOOR_ALTURA_PAINEL / 2;
  // O hover no letreiro mostra o mesmo tooltip do prédio
  painel.userData.participante = participante;

  const geoPoste = new THREE.CylinderGeometry(0.16, 0.16, OUTDOOR_ALTURA_POSTE, 6);
  const matPoste = new THREE.MeshLambertMaterial({ color: 0x39435a });
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(geoPoste, matPoste);
    poste.position.set(lado * (larguraPainel / 2 - 0.8), OUTDOOR_ALTURA_POSTE / 2, 0);
    grupo.add(poste);
  }

  grupo.add(painel);
  grupo.userData.textura = textura; // guardado para liberar na reconstrução
  return grupo;
}

function criarPredio(participante, celula) {
  const altura = ALTURA_MINIMA + participante.horas * ALTURA_POR_HORA;
  const h = hashId(participante.id);
  // Deslocamento sem sinal (>>>): com >> o bit alto do hash torna o resultado
  // negativo, e o índice negativo devolvia undefined — o prédio saía branco.
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

  // Calçada do lote. Acompanha o prédio, não a célula: presa ao tamanho da
  // célula, o aumento do espaçamento faria os lotes se encostarem e as ruas
  // sumirem visualmente.
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

  // Caixa usada na colisão do avião. Os prédios não têm rotação, então basta
  // guardar centro, meias-medidas e altura — o teste vira esfera-vs-AABB.
  colisoresPredios.push({
    x: mesh.position.x,
    z: mesh.position.z,
    hx: largura / 2,
    hz: profundidade / 2,
    altura,
    // O outdoor gira, então a caixa de colisão sobe até o topo dele cobrindo
    // o telhado inteiro: seja qual for a orientação do painel, o avião bate.
    alturaColisao: altura + OUTDOOR_ALTURA_TOTAL,
    participante, // para mostrar de quem é o prédio na hora da batida
  });

  return mesh;
}

function construirCidade() {
  // Cada outdoor tem sua própria textura de canvas; sem liberar aqui, cada
  // reconstrução da cidade deixaria uma textura órfã na GPU por prédio.
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

  // Cidade cheia: só quem já tem prédio continua podendo atualizar as horas
  const lotada = participantes.length >= MAX_PREDIOS && !jaParticipa;
  const btnParticipar = document.getElementById('btn-participar');
  btnParticipar.disabled = lotada;
  btnParticipar.textContent = lotada ? '🏗️ Cidade lotada' : '＋ Participar da cidade';
}

// O apelido é texto enviado por outra pessoa — nunca injetar como HTML cru
function escaparHtml(txt) {
  const div = document.createElement('div');
  div.textContent = txt;
  return div.innerHTML;
}

function lerMeuId() {
  try {
    return localStorage.getItem(CHAVE_MEU_ID);
  } catch {
    return null; // navegação privada / cookies bloqueados
  }
}

function gravarMeuId(id) {
  try {
    localStorage.setItem(CHAVE_MEU_ID, id);
  } catch {
    /* sem persistência é aceitável: o usuário só perde o marcador "você" */
  }
}

// ---------------------------------------------------------------------------
// Voo de câmera até um prédio
// ---------------------------------------------------------------------------

let voo = null; // { alvoCamera, alvoControles, t }

// Vista de abertura: a cidade inteira, em diagonal. O afastamento acompanha o
// tamanho da espiral, para continuar cabendo tudo conforme a cidade cresce.
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
  if (modoAviao) alternarModoAviao(); // sai do avião antes do voo de câmera
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

// ---------------------------------------------------------------------------
// Tooltip (hover nos prédios)
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
const elTooltip = document.getElementById('tooltip');

window.addEventListener('pointermove', (ev) => {
  // No modo avião o tooltip só atualiza quando o mouse mexe, então ficaria
  // parado na tela apontando para um prédio que já ficou para trás.
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
// Fluxo "Participar" (demo — na versão final chama a API da faculdade)
// ---------------------------------------------------------------------------

const overlay = document.getElementById('modal-overlay');
const elFormErro = document.getElementById('form-erro');

function mostrarErro(msg) {
  elFormErro.textContent = msg;
  elFormErro.hidden = false;
}

function limparErro() {
  elFormErro.hidden = true;
}

document.getElementById('btn-participar').addEventListener('click', () => {
  limparErro();
  overlay.hidden = false;
});
document.getElementById('btn-cancelar').addEventListener('click', () => (overlay.hidden = true));

// Faz o papel do endpoint POST /participar do servidor.
//
// Contrato: recebe o RA, devolve APENAS { id, horas }. O RA fica do lado de lá
// e nunca volta para o navegador nem entra no arquivo público. O id é
// aleatório, não derivado do RA — é isso que impede alguém de partir do
// participantes.json e chegar de volta no RA.
function apiFalsaParticipar(ra) {
  const semente = (hashId(ra) * 1103515245 + 12345) >>> 0;
  const horas = semente % 130;
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  return new Promise((resolve) => setTimeout(() => resolve({ id, horas }), 400));
}

document.getElementById('form-participar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const campoRa = document.getElementById('input-ra');
  const apelido = document.getElementById('input-apelido').value.trim();
  const existente = participantes.find((p) => p.id === lerMeuId());

  limparErro();

  // Um apelido com cara de RA anularia todo o resto do desenho
  if (/\d{4,}/.test(apelido)) {
    mostrarErro('Escolha um apelido sem sequências de números — ele fica visível para todos.');
    return;
  }

  if (!existente && participantes.length >= MAX_PREDIOS) {
    mostrarErro(
      `A cidade chegou ao limite de ${MAX_PREDIOS} prédios. ` +
        'Não é possível entrar até que alguém saia.'
    );
    return;
  }

  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  btn.textContent = 'Consultando horas...';

  const { id, horas } = await apiFalsaParticipar(campoRa.value.trim());

  // A partir daqui o RA não é mais necessário: some do formulário e da memória
  campoRa.value = '';
  ev.target.reset();

  if (existente) {
    // Já participava neste navegador: atualiza em vez de criar outro prédio.
    // No servidor a deduplicação é feita pelo RA.
    existente.apelido = apelido;
    existente.horas = horas;
  } else {
    participantes.push({ id, apelido, horas });
    gravarMeuId(id);
  }
  construirCidade();

  btn.disabled = false;
  btn.textContent = 'Entrar na cidade';
  overlay.hidden = true;
  voarAte(lerMeuId());
});

// Atalho para quem já participa: encontra o próprio prédio sem digitar o RA
document.getElementById('btn-meu-predio').addEventListener('click', () => {
  const meuId = lerMeuId();
  if (meuId && prediosPorId.has(meuId)) voarAte(meuId);
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

// Manobra automática ao encostar na barreira: o avião faz a volta e segue voando
let manobraRetorno = null; // { yawAlvo, sentido }
const elAvisoBarreira = document.getElementById('aviso-barreira');

// Normaliza um ângulo para o intervalo (-π, π]
function normalizarAngulo(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// Yaw que faz o avião apontar de volta para o centro da cidade.
// Batendo de frente na barreira isso equivale exatamente a um giro de 180°;
// numa raspada de lado, evita ficar preso raspando na parede.
function yawParaOCentro() {
  return Math.atan2(aviao.position.x, aviao.position.z);
}

function iniciarManobra(yawAlvo) {
  const delta = normalizarAngulo(yawAlvo - estadoAviao.yaw);
  manobraRetorno = {
    yawAlvo,
    // num 180° exato o delta fica em ±π e o sinal é indiferente; fora disso,
    // gira pelo lado mais curto
    sentido: delta >= 0 ? 1 : -1,
  };
}

// Faixa de aviso do modo avião. Tem tempo próprio: continua na tela depois de
// a explosão já ter apagado, para dar tempo de ler de quem era o prédio.
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

// Evita reescrever o aviso a cada quadro enquanto o avião raspa no mesmo prédio
let predioAvisado = null;
let timerPredioAvisado = null;

// Devolve true só na primeira vez de cada batida — é o que impede o avião
// raspando na mesma parede de reescrever o aviso e explodir a cada quadro.
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
// Explosão da batida — fogo leve no ponto do impacto e as horas subindo
// ---------------------------------------------------------------------------

const DURACAO_EXPLOSAO = 0.9; // segundos — o fogo
// As horas têm tempo próprio, mais longo: o fogo é um susto, o número é
// informação e precisa sobrar tempo para lê-lo depois de o clarão apagar.
const DURACAO_HORAS = 1.4;

// Ponto redondo com degradê: sem isto as faíscas saem como quadradinhos
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

// Número que sobe do impacto. É a mesma informação da faixa, mas no lugar para
// onde o piloto está olhando — a faixa fica no topo da tela.
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

  // Clarão: uma bola que cresce e apaga. Aditivo e sem depthWrite, para
  // acender a fachada em vez de recortar um buraco nela.
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

  // Faíscas: guardamos só a velocidade de cada uma, e a posição sai de v*t
  // (com uma gravidade leve), então nada acumula erro entre quadros.
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

  // Sprite já encara a câmera sozinho; depthTest desligado para as horas não
  // ficarem escondidas dentro do prédio em que o avião acabou de bater.
  const texturaHoras = criarTexturaHoras(participante.horas);
  const etiqueta = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texturaHoras,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  // A câmera de perseguição fica a ~10 unidades do avião: em escala maior o
  // letreiro das horas tapa a tela inteira na hora da batida.
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
  e.texturaHoras.dispose(); // uma textura por batida: sem isto, vazam na GPU
}

function atualizarExplosoes(dt) {
  for (let i = explosoes.length - 1; i >= 0; i--) {
    const e = explosoes[i];
    e.t += dt;
    // a explosão só é descartada quando o mais lento dos dois tempos acaba
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

    // as horas sobem e só começam a sumir no fim, para dar tempo de ler
    e.etiqueta.position.y = 2 + kh * 3.5;
    e.etiqueta.material.opacity = kh < 0.75 ? 1 : (1 - kh) / 0.25;
  }
}

function encerrarManobraRetorno() {
  manobraRetorno = null;
}

// Raio de colisão do avião, tirado do próprio modelo — se o modelo mudar de
// tamanho em aviao.js, a colisão acompanha sem precisar de ajuste manual.
const RAIO_AVIAO = (() => {
  const tam = new THREE.Box3().setFromObject(aviao).getSize(new THREE.Vector3());
  return Math.max(tam.x, tam.z) / 2;
})();

// Empurra o avião para fora de qualquer prédio em que tenha entrado.
// Os prédios são caixas alinhadas aos eixos (sem rotação), então o ponto mais
// próximo da caixa sai de um clamp e o teste é exato, não aproximado.
// Devolve { ponto, predio } do contato, ou null se não houve colisão.
function resolverColisaoPredios() {
  const p = aviao.position;
  let batida = null;

  for (const c of colisoresPredios) {
    // descarte rápido: caixa expandida pelo raio do avião
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
      // centro do avião dentro do prédio: sai pela face mais próxima
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
    // o ponto de contato é onde a explosão nasce
    batida = { ponto: { x: px, y: py, z: pz }, predio: c };
  }

  return batida;
}

window.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'INPUT') return;
  teclas.add(ev.code);
  // ev.repeat: segurar Esc dispararia o toggle a cada repetição do teclado,
  // fazendo o modo avião piscar entre ligado e desligado
  if (ev.code === 'Escape' && modoAviao && !ev.repeat) alternarModoAviao();
});
window.addEventListener('keyup', (ev) => teclas.delete(ev.code));

// ---------------------------------------------------------------------------
// Joystick de toque — pilotar no celular, onde não existe WASD
// ---------------------------------------------------------------------------

const controlesToque = document.getElementById('controles-toque');
const joystick = document.getElementById('joystick');
const manete = document.getElementById('joystick-manete');
const btnTurbo = document.getElementById('btn-turbo');

// Só aparece em tela de toque: com mouse e teclado o joystick apenas tomaria
// espaço da cidade, já que o WASD comanda melhor.
const temToque = window.matchMedia('(pointer: coarse)').matches;

// Eixos da manete, de -1 a 1. São somados ao teclado no controle de voo, então
// quem tem os dois pode usar qualquer um deles.
const comandoToque = { x: 0, y: 0, turbo: false };

let ponteiroJoystick = null;

function moverManete(ev) {
  const area = joystick.getBoundingClientRect();
  const raio = area.width / 2;
  let dx = (ev.clientX - (area.left + raio)) / raio;
  let dy = (ev.clientY - (area.top + raio)) / raio;

  // Dedo além da borda ainda comanda, mas preso no limite do círculo — sem
  // isto, arrastar para longe daria uma curva mais fechada que o máximo.
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    dx /= dist;
    dy /= dist;
  }

  comandoToque.x = dx;
  comandoToque.y = -dy; // a tela cresce para baixo; no voo, para cima é subir
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
  // captura: o dedo pode sair do círculo no meio da curva sem perder o comando
  joystick.setPointerCapture(ev.pointerId);
  moverManete(ev);
});

joystick.addEventListener('pointermove', (ev) => {
  if (ev.pointerId === ponteiroJoystick) moverManete(ev);
});

// pointercancel junto do pointerup: sem ele, uma interrupção do sistema (uma
// chamada, um gesto do Android) deixaria o avião girando sozinho para sempre.
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
  // No toque quem manda é o joystick: o painel só falaria de teclas que não
  // existem ali e tomaria tela. Mesma condição que mostra os controles, para
  // as duas decisões não divergirem.
  dicasVoo.hidden = !modoAviao || temToque;
  controlesToque.hidden = !(modoAviao && temToque);
  zerarComandoToque(); // sai do avião sem deixar comando preso da última curva
  if (!modoAviao) encerrarCorrida(); // pousou: o circuito não continua sozinho
  btnAviao.classList.toggle('ativo', modoAviao);
  btnAviao.textContent = modoAviao ? '🛬 Sair do avião' : '✈️ Pilotar avião';

  encerrarManobraRetorno();
  esconderAviso();
  predioAvisado = null;
  elTooltip.hidden = true;

  if (modoAviao) {
    voo = null; // cancela qualquer voo de câmera em andamento
    // nasce dentro do mapa, mesmo que a câmera estivesse olhando para a borda
    // Nasce fora da cidade, apontando para ela. A distância acompanha o
    // tamanho da cidade: fixa, o avião passaria a nascer dentro dela conforme
    // a espiral cresce. Altura de cruzeiro logo acima dos prédios mais altos,
    // para a cidade ficar enquadrada em vez de sumir abaixo do horizonte.
    const afastamento = vistaGeralCidade().camera.length() * 0.7;
    const alvo = new THREE.Vector3(controls.target.x, 38, controls.target.z + afastamento);
    const raio = Math.hypot(alvo.x, alvo.z);
    if (raio > RAIO_MAPA - 30) {
      const fator = (RAIO_MAPA - 30) / raio;
      alvo.x *= fator;
      alvo.z *= fator;
    }
    aviao.position.copy(alvo);
    estadoAviao.yaw = yawParaOCentro(); // já entra apontando para a cidade
    estadoAviao.pitch = 0;
    estadoAviao.roll = 0;
  } else {
    // Sem isto a câmera fica largada onde o avião parou, apontando para o
    // vazio; volta enquadrando a cidade inteira.
    irParaVistaGeral();
  }
}

// ---------------------------------------------------------------------------
// Circuito de argolas — corrida contra o relógio
// ---------------------------------------------------------------------------

// O traçado é fixo em coordenadas do mundo, não das células ocupadas. Se
// acompanhasse o tamanho da cidade, cada tempo teria sido feito num percurso
// diferente e o recorde não compararia nada. Todos os pontos caem em cruzamento
// de rua (múltiplos ímpares de 12) — o único lugar da malha onde é certo não
// haver prédio nenhum, por maior que a cidade fique.
// Vai e volta por duas ruas vizinhas do miolo da cidade, sempre no nível do
// canyon. As ruas escolhidas são as centrais de propósito: a espiral preenche
// a cidade de dentro para fora, então essas quadras têm prédios dos dois lados
// desde os primeiros participantes — um circuito largo ficaria sobrevoando
// chão vazio numa cidade pequena. A curva de 180° entre a ida e a volta é
// deixada de fora da cidade, onde há espaço livre para manobrar.
// A direção é dada, não deduzida dos vizinhos: na virada o avião chega pelo
// lado oposto ao da linha reta entre as duas argolas, e o aro tem de encarar
// quem vem pela rua.
// [x, z, altura, direção x, direção z]
const CIRCUITO = [
  [-36,  12, 12,  1, 0], // ida pela rua z=12, rumo ao leste
  [-12,  12, 20,  1, 0],
  [ 12,  12, 12,  1, 0],
  [ 36,  12, 20,  1, 0],
  [ 36, -12, 12, -1, 0], // volta pela rua z=-12, rumo ao oeste
  [ 12, -12, 20, -1, 0],
  [-12, -12, 12, -1, 0],
  [-36, -12, 20, -1, 0],
];

// A envergadura do avião é de ~5 unidades: um aro de 6 de raio passa com folga
// sem virar um alvo grande demais.
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
  // O furo do torus é o eixo Z local: este ângulo o deixa encarando quem chega
  // pela rua
  argola.rotation.y = Math.atan2(dx, dz);
  argola.userData.direcao = { x: dx, z: dz };
  grupoArgolas.add(argola);
  return argola;
});

grupoArgolas.updateMatrixWorld(true); // as argolas não se mexem: basta uma vez

// null fora da corrida. `inicio` só é preenchido ao cruzar a primeira argola:
// o tempo de aceleração até ela não conta.
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
    argola.material.emissiveIntensity = 1; // a pulsação da anterior não fica presa
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
  if (!modoAviao) alternarModoAviao(); // o circuito só existe no ar

  corrida = { indice: 0, inicio: null, fim: null };
  grupoArgolas.visible = true;
  pintarArgolas();

  // Nasce alinhado com a primeira argola e um pouco antes dela: como o relógio
  // só parte no primeiro aro, dá para chegar nele já acelerado.
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

// Recebe as posições de antes e depois do passo do quadro. Testar a distância
// até o centro da argola não funcionaria: a 60 u/s o avião anda uns 6 por
// quadro e atravessa o aro sem nunca aparecer "dentro" dele. O que vale é o
// cruzamento do plano da argola entre um quadro e o outro.
function atualizarCorrida(posAntes, posDepois) {
  if (!corrida || corrida.fim) return;

  const argola = argolas[corrida.indice];
  argola.worldToLocal(_localAntes.copy(posAntes));
  argola.worldToLocal(_localDepois.copy(posDepois));

  // Sinais iguais: ficou do mesmo lado do plano, não cruzou nada
  if ((_localAntes.z > 0) === (_localDepois.z > 0)) return;

  // Ponto exato onde a trajetória furou o plano — é ele que decide se passou
  // pelo buraco ou raspou por fora do aro
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
  // Depois da chegada o mesmo botão recomeça: sair e entrar de novo só para
  // repetir a volta seria um passo a mais sem motivo
  if (corrida && !corrida.fim) encerrarCorrida();
  else iniciarCorrida();
});

const _dirAviao = new THREE.Vector3();
const _posAnteriorAviao = new THREE.Vector3();
const _posCamera = new THREE.Vector3();
const _alvoOlhar = new THREE.Vector3();

function atualizarAviao(dt) {
  // Guardada antes do passo: a passagem pelas argolas é testada no segmento
  // percorrido no quadro, não na posição isolada
  _posAnteriorAviao.copy(aviao.position);

  // Teclado e joystick somam. O joystick é analógico, então subir e virar
  // podem valer frações: meia inclinação faz meia curva.
  const subir = THREE.MathUtils.clamp(
    (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0) + comandoToque.y, -1, 1);
  const turbo = teclas.has('ShiftLeft') || teclas.has('ShiftRight') || comandoToque.turbo;
  const velocidade = turbo ? 60 : 30;

  let virar;
  let taxaGiro = 1.5;

  if (manobraRetorno) {
    // Durante a volta o comando do piloto fica suspenso até o avião terminar
    const restante = normalizarAngulo(manobraRetorno.yawAlvo - estadoAviao.yaw);
    if (Math.abs(restante) < 0.06) {
      estadoAviao.yaw = manobraRetorno.yawAlvo;
      encerrarManobraRetorno();
      virar = 0;
    } else {
      taxaGiro = 2.6; // a volta é mais rápida que a curva normal
      virar = manobraRetorno.sentido;
    }
  } else {
    // x da manete cresce para a direita; virar é positivo para a esquerda
    virar = THREE.MathUtils.clamp(
      (teclas.has('KeyA') ? 1 : 0) - (teclas.has('KeyD') ? 1 : 0) - comandoToque.x, -1, 1);
  }

  estadoAviao.yaw += virar * taxaGiro * dt;
  estadoAviao.pitch += (subir * 0.45 - estadoAviao.pitch) * Math.min(1, 4 * dt);
  estadoAviao.roll += (-virar * 0.55 - estadoAviao.roll) * Math.min(1, 4 * dt);

  _dirAviao
    .set(0, 0, -1)
    .applyEuler(new THREE.Euler(estadoAviao.pitch, estadoAviao.yaw, 0, 'YXZ'));
  aviao.position.addScaledVector(_dirAviao, velocidade * dt);

  aviao.position.y = THREE.MathUtils.clamp(aviao.position.y, 6, ALTURA_MAPA - 10);

  // Bateu num prédio: continua sendo empurrado para fora, solta uma explosão
  // leve no ponto do impacto e mostra as horas ali mesmo. Não há mais manobra
  // automática de desvio — o comando segue na mão do piloto.
  const batida = resolverColisaoPredios();
  if (batida && avisarBatida(batida.predio.participante)) {
    explodir(batida.ponto, batida.predio.participante);
  }

  atualizarCorrida(_posAnteriorAviao, aviao.position);

  // Encostou na borda do mapa: dispara a volta e segue voando
  const raio = Math.hypot(aviao.position.x, aviao.position.z);
  if (raio >= RAIO_MAPA && !manobraRetorno) {
    iniciarManobra(yawParaOCentro());
    mostrarAviso('🚧 Limite do mapa — retornando à cidade', 2000);
  }

  // Trava de segurança: mesmo manobrando, não atravessa a parede
  const raioMaximo = RAIO_MAPA + 12;
  if (raio > raioMaximo) {
    const fator = raioMaximo / raio;
    aviao.position.x *= fator;
    aviao.position.z *= fator;
  }

  aviao.rotation.set(estadoAviao.pitch, estadoAviao.yaw, estadoAviao.roll);
  heliceAviao.rotation.z += (turbo ? 42 : 26) * dt;

  // câmera em perseguição, atrás e acima do avião
  _posCamera
    .set(0, 3.2, 9.5)
    .applyEuler(new THREE.Euler(estadoAviao.pitch * 0.4, estadoAviao.yaw, 0, 'YXZ'))
    .add(aviao.position);
  camera.position.lerp(_posCamera, 1 - Math.pow(0.0005, dt));
  // mira um pouco abaixo do nariz: mantém os prédios no enquadramento
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

  // Os letreiros encaram a câmera (só em torno de Y, para não tombarem)
  for (const o of outdoors) {
    o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
  }

  atualizarExplosoes(dt);

  if (modoAviao) {
    atualizarAviao(dt);

    if (corrida) {
      atualizarHudCorrida();
      if (!corrida.fim) {
        // Pulsa só o brilho da próxima argola. Pulsar a escala mudaria o raio
        // do aro em coordenadas locais e, junto com ele, o que conta como
        // passagem — o alvo do jogo não pode respirar.
        argolas[corrida.indice].material.emissiveIntensity =
          1.4 + Math.sin(relogio.elapsedTime * 5) * 0.6;
      }
    }
  } else {
    if (voo) {
      voo.t = Math.min(1, voo.t + 0.02);
      const e = 1 - Math.pow(1 - voo.t, 3); // ease-out
      camera.position.lerpVectors(voo.origemCamera, voo.alvoCamera, e);
      controls.target.lerpVectors(voo.origemAlvo, voo.alvoControles, e);
      if (voo.t >= 1) voo = null;
    }
    controls.update();

    // o limite do mapa vale também para a câmera livre
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
    // O servidor também precisa respeitar o teto; aqui é só uma rede de
    // proteção para o arquivo nunca estourar o mapa.
    participantes = dados.participantes.slice(0, MAX_PREDIOS);
    if (dados.participantes.length > MAX_PREDIOS) {
      console.warn(
        `participantes.json tem ${dados.participantes.length} registros; ` +
          `exibindo apenas os primeiros ${MAX_PREDIOS}.`
      );
    }
    construirCidade();

    // mesma vista para onde o botão "sair do avião" devolve o usuário
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
