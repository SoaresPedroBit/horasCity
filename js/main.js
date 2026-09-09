// Infra compartilhada (cena, avião, circuito, dirigíveis) + escolha do app.
// Os dois apps são independentes: cada um monta sua fonte de dados e seu modo
// de cidade. Nada aqui sabe o que é uma chave de API ou um participantes.json.
import * as THREE from 'three';
import { CenaCidade, LIMITES_MAPA } from './cidade/cena.js';
import { GerenciadorPilotagem } from './aviao/pilotagem.js';
import { GerenciadorDirigiveis } from './dirigiveis/frota.js';
import { AnuncioDirigivel } from './dirigiveis/anuncio.js';
import * as appSolo from './apps/appSolo.js';
import * as appCidade from './apps/appCidade.js';

// solo  = minhas horas pela chave da API (padrão, é o que a API permite hoje)
// cidade = lista pública de participantes  ->  index.html?modo=cidade
const APPS = { solo: appSolo, cidade: appCidade };
const MODO_PADRAO = 'solo';

function escolherApp() {
  const pedido = new URLSearchParams(location.search).get('modo');
  return APPS[pedido] ?? APPS[MODO_PADRAO];
}

const canvas = document.getElementById('city-canvas');
const cena = new CenaCidade(canvas);
const piloto = new GerenciadorPilotagem(cena, (modoAviao) => {
  cena.tooltip.setAtivo(!modoAviao);
});

const dirigiveis = new GerenciadorDirigiveis(cena.scene, LIMITES_MAPA);
const anuncio = new AnuncioDirigivel(cena, dirigiveis, piloto);

let modoAtivo = null;
const relogio = new THREE.Clock();

function animar() {
  requestAnimationFrame(animar);
  const dt = Math.min(relogio.getDelta(), 0.1);

  cena.orientarOutdoors();
  dirigiveis.atualizar(dt, relogio.elapsedTime, cena.camera);
  modoAtivo?.animar(dt, relogio.elapsedTime);

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

escolherApp()
  .iniciar({ cena, piloto })
  .then((modo) => {
    modoAtivo = modo;
  })
  .catch((err) => {
    console.error('Falha ao montar a cidade:', err);
  });

animar();
