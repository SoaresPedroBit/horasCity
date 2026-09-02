import * as THREE from 'three';
import { CenaCidade, LIMITES_MAPA } from './cidade/cena.js';
import { GerenciadorPilotagem } from './aviao/pilotagem.js';
import { carregarParticipantes, lerMeuId } from './participantes/dados.js';
import { enviarInscricao } from './participantes/api.js';
import { ModalParticipar } from './participantes/modal.js';
import { GerenciadorDirigiveis } from './dirigiveis/frota.js';
import { AnuncioDirigivel } from './dirigiveis/anuncio.js';

let participantes = [];
const canvas = document.getElementById('city-canvas');

const cena = new CenaCidade(canvas);
const piloto = new GerenciadorPilotagem(cena, (modoAviao) => {
  cena.tooltip.setAtivo(!modoAviao);
});

const dirigiveis = new GerenciadorDirigiveis(cena.scene, LIMITES_MAPA);
const anuncio = new AnuncioDirigivel(cena, dirigiveis, piloto);

function atualizarVisibilidadeMeuPredio() {
  const meuId = lerMeuId();
  const jaParticipa = Boolean(meuId && cena.prediosPorId.has(meuId));
  document.getElementById('btn-meu-predio').hidden = !jaParticipa;
}

new ModalParticipar({
  onSubmit: async ({ ra, apelido }) => {
    await enviarInscricao(ra, apelido);
  },
});

document.getElementById('btn-meu-predio').addEventListener('click', () => {
  const meuId = lerMeuId();
  if (meuId && cena.prediosPorId.has(meuId)) {
    if (piloto.ativo) piloto.alternar();
    cena.focarNoPredio(meuId);
  }
});

const relogio = new THREE.Clock();

function animar() {
  requestAnimationFrame(animar);
  const dt = Math.min(relogio.getDelta(), 0.1);

  cena.orientarOutdoors();
  dirigiveis.atualizar(dt, relogio.elapsedTime, cena.camera);

  if (piloto.ativo) {
    piloto.atualizar(dt, relogio.elapsedTime);
    const dirigivelAtingido = dirigiveis.detectarColisao(piloto.aviao.position, piloto.raioAviao);
    if (dirigivelAtingido) anuncio.abrir(dirigivelAtingido.userData.mensagem);
  } else {
    cena.atualizarCameraOrbital();
    piloto.explosoes.atualizar(dt);
  }

  cena.renderer.render(cena.scene, cena.camera);
}

async function iniciar() {
  try {
    participantes = await carregarParticipantes();
    cena.construir(participantes);
    atualizarVisibilidadeMeuPredio();

    const geral = cena.posicaoGeral();
    cena.camera.position.copy(geral.camera);
    cena.controls.target.copy(geral.alvo);
  } catch (err) {
    console.error('Falha ao carregar os dados dos participantes:', err);
  } finally {
    animar();
  }
}

iniciar();