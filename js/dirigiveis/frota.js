import * as THREE from 'three';
import { criarDirigivel, RAIO_COLISAO_DIRIGIVEL } from './modelo.js';
import { MENSAGENS_DIRIGIVEIS } from './mensagens.js';

const COOLDOWN_COLISAO_MS = 4000;

export class GerenciadorDirigiveis {
  constructor(scene, limites) {
    this.grupo = new THREE.Group();
    this.frota = [];

    const raioMax = Math.max(40, limites.RAIO - 25);
    MENSAGENS_DIRIGIVEIS.forEach((mensagem, i) => {
      const dirigivel = criarDirigivel(mensagem);
      const passo = raioMax - 45;
      const raio = 45 + (passo * i) / Math.max(1, MENSAGENS_DIRIGIVEIS.length - 1) + (Math.random() * 10 - 5);
      const sentido = i % 2 === 0 ? 1 : -1;

      dirigivel.userData.orbita = {
        raio: THREE.MathUtils.clamp(raio, 40, raioMax),
        altura: 55 + Math.random() * 35,
        velocidade: sentido * (0.045 + Math.random() * 0.02),
        fase: Math.random() * Math.PI * 2,
        bobFase: Math.random() * Math.PI * 2,
      };

      this.frota.push(dirigivel);
      this.grupo.add(dirigivel);
    });

    scene.add(this.grupo);
  }

  atualizar(dt, tempo, camera) {
    for (const d of this.frota) {
      const o = d.userData.orbita;
      o.fase += o.velocidade * dt;
      const x = Math.cos(o.fase) * o.raio;
      const z = Math.sin(o.fase) * o.raio;
      d.position.set(x, o.altura + Math.sin(tempo * 0.5 + o.bobFase) * 2.5, z);

      const sentido = Math.sign(o.velocidade) || 1;
      const dirX = -Math.sin(o.fase) * sentido;
      const dirZ = Math.cos(o.fase) * sentido;
      // o corpo do dirigível é comprido no eixo local +X (proa), não +Z
      d.rotation.y = Math.atan2(-dirZ, dirX);

      // a placa sempre encara a câmera (como os outdoors), senão fica ilegível de lado
      if (camera) {
        const anguloMundo = Math.atan2(camera.position.x - d.position.x, camera.position.z - d.position.z);
        d.userData.placa.rotation.y = anguloMundo - d.rotation.y;
      }
    }
  }

  /** Retorna o dirigível colidido pelo avião (respeitando um cooldown por dirigível), ou null. */
  detectarColisao(posicaoAviao, raioAviao) {
    const agora = performance.now();
    const raioColisao = RAIO_COLISAO_DIRIGIVEL + raioAviao;
    for (const d of this.frota) {
      const o = d.userData.orbita;
      if (o.cooldownAte && agora < o.cooldownAte) continue;
      if (d.position.distanceTo(posicaoAviao) <= raioColisao) {
        o.cooldownAte = agora + COOLDOWN_COLISAO_MS;
        return d;
      }
    }
    return null;
  }
}
