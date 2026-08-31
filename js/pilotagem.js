import * as THREE from 'three';
import { criarAviao } from './aviao.js';
import { CONFIG_MAPA, STORAGE_KEYS } from './constantes.js';

const DURACAO_EXPLOSAO = 0.9;
const DURACAO_HORAS = 1.4;

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

const aviao = criarAviao();
aviao.visible = false;
const heliceAviao = aviao.userData.helice;

export let modoAviao = false;
const estadoAviao = { yaw: 0, pitch: 0, roll: 0 };
const teclas = new Set();
let manobraRetorno = null;

let timerAviso = null;
let predioAvisado = null;
let timerPredioAvisado = null;

const RAIO_AVIAO = (() => {
  const tam = new THREE.Box3().setFromObject(aviao).getSize(new THREE.Vector3());
  return Math.max(tam.x, tam.z) / 2;
})();

// DOM
const elAvisoBarreira = document.getElementById('aviso-barreira');
const controlesToque = document.getElementById('controles-toque');
const joystick = document.getElementById('joystick');
const manete = document.getElementById('joystick-manete');
const btnTurbo = document.getElementById('btn-turbo');
const btnAviao = document.getElementById('btn-aviao');
const dicasVoo = document.getElementById('dicas-voo');
const temToque = window.matchMedia('(pointer: coarse)').matches;

const comandoToque = { x: 0, y: 0, turbo: false };
let ponteiroJoystick = null;

// Circuito
const grupoArgolas = new THREE.Group();
grupoArgolas.visible = false;

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
  const bruto = Number(localStorage.getItem(STORAGE_KEYS.RECORDE_CIRCUITO));
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
  if (superou) localStorage.setItem(STORAGE_KEYS.RECORDE_CIRCUITO, String(Math.round(ms)));
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

// ---------------------------------------------------------------------------
// Otimização: Cache de Texturas de Explosão (Sem alocação no loop)
// ---------------------------------------------------------------------------

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

const cacheTexturasHoras = new Map();

function obterTexturaHoras(horas) {
  if (cacheTexturasHoras.has(horas)) {
    return cacheTexturasHoras.get(horas);
  }

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
  cacheTexturasHoras.set(horas, tex);
  return tex;
}

const explosoes = [];

function explodir(ponto, participante, scene) {
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

  const texturaHoras = obterTexturaHoras(participante.horas);
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
  explosoes.push({ grupo, flash, faiscas, velocidades, etiqueta, t: 0 });
}

function descartarExplosao(e, scene) {
  scene.remove(e.grupo);
  e.flash.geometry.dispose();
  e.flash.material.dispose();
  e.faiscas.geometry.dispose();
  e.faiscas.material.dispose();
  e.etiqueta.material.dispose();
}

export function atualizarExplosoes(dt, scene) {
  for (let i = explosoes.length - 1; i >= 0; i--) {
    const e = explosoes[i];
    e.t += dt;
    if (e.t >= DURACAO_HORAS) {
      descartarExplosao(e, scene);
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

// ---------------------------------------------------------------------------
// Funções de Voo e Colisão
// ---------------------------------------------------------------------------

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

function encerrarManobraRetorno() {
  manobraRetorno = null;
}

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

function escaparHtml(txt) {
  const div = document.createElement('div');
  div.textContent = txt;
  return div.innerHTML;
}

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

function resolverColisaoPredios(colisoresPredios) {
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

// ---------------------------------------------------------------------------
// Joystick de Toque
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

let contextoExterno = {
  controls: null,
  camera: null,
  scene: null,
  colisoresPredios: [],
  vistaGeralCidade: () => ({ camera: new THREE.Vector3(70, 60, 70) }),
  irParaVistaGeral: () => {},
  onResetVoo: () => {},
  onEsconderTooltip: () => {},
};

export function alternarModoAviao() {
  modoAviao = !modoAviao;
  aviao.visible = modoAviao;
  contextoExterno.controls.enabled = !modoAviao;
  dicasVoo.hidden = !modoAviao || temToque;
  controlesToque.hidden = !(modoAviao && temToque);
  zerarComandoToque();
  if (!modoAviao) encerrarCorrida();
  btnAviao.classList.toggle('ativo', modoAviao);
  btnAviao.textContent = modoAviao ? '🛬 Sair do avião' : '✈️ Pilotar avião';

  encerrarManobraRetorno();
  esconderAviso();
  predioAvisado = null;
  contextoExterno.onEsconderTooltip();

  if (modoAviao) {
    contextoExterno.onResetVoo();
    const afastamento = contextoExterno.vistaGeralCidade().camera.length() * 0.7;
    const alvo = new THREE.Vector3(contextoExterno.controls.target.x, 38, contextoExterno.controls.target.z + afastamento);
    const raio = Math.hypot(alvo.x, alvo.z);
    if (raio > CONFIG_MAPA.RAIO - 30) {
      const fator = (CONFIG_MAPA.RAIO - 30) / raio;
      alvo.x *= fator;
      alvo.z *= fator;
    }
    aviao.position.copy(alvo);
    estadoAviao.yaw = yawParaOCentro();
    estadoAviao.pitch = 0;
    estadoAviao.roll = 0;
  } else {
    contextoExterno.irParaVistaGeral();
  }
}

export function inicializarPilotagem(config) {
  Object.assign(contextoExterno, config);

  if (contextoExterno.scene) {
    contextoExterno.scene.add(aviao);
    contextoExterno.scene.add(grupoArgolas);
  }

  window.addEventListener('keydown', (ev) => {
    if (ev.target.tagName === 'INPUT') return;
    teclas.add(ev.code);
    if (ev.code === 'Escape' && modoAviao && !ev.repeat) alternarModoAviao();
  });
  window.addEventListener('keyup', (ev) => teclas.delete(ev.code));

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

  btnAviao.addEventListener('click', () => {
    btnAviao.blur();
    alternarModoAviao();
  });

  btnCorrida.addEventListener('click', () => {
    btnCorrida.blur();
    if (corrida && !corrida.fim) encerrarCorrida();
    else iniciarCorrida();
  });
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

const _dirAviao = new THREE.Vector3();
const _posAnteriorAviao = new THREE.Vector3();
const _posCamera = new THREE.Vector3();
const _alvoOlhar = new THREE.Vector3();

export function atualizarAviao(dt, tempoDecorrido) {
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

  aviao.position.y = THREE.MathUtils.clamp(aviao.position.y, 6, CONFIG_MAPA.ALTURA - 10);

  const batida = resolverColisaoPredios(contextoExterno.colisoresPredios);
  if (batida && avisarBatida(batida.predio.participante)) {
    explodir(batida.ponto, batida.predio.participante, contextoExterno.scene);
  }

  atualizarCorrida(_posAnteriorAviao, aviao.position);

  const raio = Math.hypot(aviao.position.x, aviao.position.z);
  if (raio >= CONFIG_MAPA.RAIO && !manobraRetorno) {
    iniciarManobra(yawParaOCentro());
    mostrarAviso('🚧 Limite do mapa — retornando à cidade', 2000);
  }

  const raioMaximo = CONFIG_MAPA.RAIO + 12;
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
  contextoExterno.camera.position.lerp(_posCamera, 1 - Math.pow(0.0005, dt));

  _alvoOlhar.copy(aviao.position).addScaledVector(_dirAviao, 12);
  _alvoOlhar.y -= 3.2;
  contextoExterno.camera.lookAt(_alvoOlhar);

  if (corrida) {
    atualizarHudCorrida();
    if (!corrida.fim) {
      argolas[corrida.indice].material.emissiveIntensity =
        1.4 + Math.sin(tempoDecorrido * 5) * 0.6;
    }
  }
}