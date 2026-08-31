import * as THREE from 'three';
import { CenaCidade } from './cidade/cena.js';
import { GerenciadorPilotagem } from './aviao/pilotagem.js';
import { carregarParticipantes, lerMeuId } from './participantes/dados.js';
import { enviarInscricao } from './participantes/api.js';
import { ModalParticipar } from './participantes/modal.js';

let participantes = [];
const canvas = document.getElementById('city-canvas');

const cena = new CenaCidade(canvas);
const piloto = new GerenciadorPilotagem(cena, (modoAviao) => {
  cena.tooltip.setAtivo(!modoAviao);
});

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

  if (piloto.ativo) {
    piloto.atualizar(dt, relogio.elapsedTime);
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