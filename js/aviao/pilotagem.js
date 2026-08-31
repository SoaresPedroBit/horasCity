import * as THREE from 'three';
import { criarAviao } from './aviao.js';
import { EntradaControles } from './controles.js';
import { CircuitoCorrida } from './circuito.js';
import { SistemaExplosoes } from './efeitos.js';
import { LIMITES_MAPA } from '../cidade/cena.js';

export class GerenciadorPilotagem {
  constructor(cenaCidade, onAlternarModo) {
    this.cena = cenaCidade;
    this.onAlternarModo = onAlternarModo;

    this.aviao = criarAviao();
    this.aviao.visible = false;
    this.helice = this.aviao.userData.helice;
    this.cena.scene.add(this.aviao);

    this.raioAviao = (() => {
      const tam = new THREE.Box3().setFromObject(this.aviao).getSize(new THREE.Vector3());
      return Math.max(tam.x, tam.z) / 2;
    })();

    this.controles = new EntradaControles();
    this.explosoes = new SistemaExplosoes(this.cena.scene);

    this.circuito = new CircuitoCorrida(
      this.cena.scene,
      (ms, recorde, superou) => {
        this.mostrarAviso(
          superou
            ? `🏁 <strong>${(ms / 1000).toFixed(2)}s</strong> — novo recorde!`
            : `🏁 <strong>${(ms / 1000).toFixed(2)}s</strong> · recorde: ${(recorde / 1000).toFixed(2)}s`,
          5000
        );
      },
      () => this.iniciarCorridaCircuito()
    );

    this.ativo = false;
    this.estado = { yaw: 0, pitch: 0, roll: 0 };
    this.manobraRetorno = null;
    this.predioAvisado = null;
    this.timerAviso = null;
    this.timerPredio = null;

    this.elAviso = document.getElementById('aviso-barreira');
    this.btnAviao = document.getElementById('btn-aviao');

    this._bind();
  }

  _bind() {
    this.btnAviao.addEventListener('click', () => {
      this.btnAviao.blur();
      this.alternar();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.ativo && !e.repeat) this.alternar();
    });
  }

  iniciarCorridaCircuito() {
    if (!this.ativo) this.alternar();

    const dadosLargada = this.circuito.iniciar();
    this.aviao.position.copy(dadosLargada.posicao);
    this.estado.yaw = dadosLargada.yaw;
    this.estado.pitch = 0;
    this.estado.roll = 0;
    this.manobraRetorno = null;
  }

  alternar() {
    this.ativo = !this.ativo;
    this.aviao.visible = this.ativo;
    this.controles.definirModoAviao(this.ativo);
    this.cena.controls.enabled = !this.ativo;
    this.btnAviao.classList.toggle('ativo', this.ativo);
    this.btnAviao.textContent = this.ativo ? '🛬 Sair do avião' : '✈️ Pilotar avião';

    if (!this.ativo) {
      this.circuito.parar();
      this.elAviso.hidden = true;
      this.cena.irParaVisaoGeral();
    } else {
      this.cena.vooCamera = null;
      const afastamento = this.cena.posicaoGeral().camera.length() * 0.7;
      const alvo = new THREE.Vector3(
        this.cena.controls.target.x,
        38,
        this.cena.controls.target.z + afastamento
      );
      const raio = Math.hypot(alvo.x, alvo.z);
      if (raio > LIMITES_MAPA.RAIO - 30) {
        const fator = (LIMITES_MAPA.RAIO - 30) / raio;
        alvo.x *= fator;
        alvo.z *= fator;
      }
      this.aviao.position.copy(alvo);
      this.estado.yaw = Math.atan2(alvo.x, alvo.z);
      this.estado.pitch = 0;
      this.estado.roll = 0;
    }

    this.onAlternarModo(this.ativo);
  }

  mostrarAviso(html, ms = 2500, colidindo = false) {
    this.elAviso.innerHTML = html;
    this.elAviso.classList.toggle('colisao', colidindo);
    this.elAviso.hidden = false;
    clearTimeout(this.timerAviso);
    this.timerAviso = setTimeout(() => (this.elAviso.hidden = true), ms);
  }

  _resolverColisoes() {
    const p = this.aviao.position;
    for (const c of this.cena.colisores) {
      if (Math.abs(p.x - c.x) > c.hx + this.raioAviao) continue;
      if (Math.abs(p.z - c.z) > c.hz + this.raioAviao) continue;
      if (p.y - this.raioAviao > c.alturaColisao) continue;

      const px = THREE.MathUtils.clamp(p.x, c.x - c.hx, c.x + c.hx);
      const py = THREE.MathUtils.clamp(p.y, 0, c.alturaColisao);
      const pz = THREE.MathUtils.clamp(p.z, c.z - c.hz, c.z + c.hz);
      const dx = p.x - px, dy = p.y - py, dz = p.z - pz;
      const d2 = dx * dx + dy * dy + dz * dz;

      if (d2 < this.raioAviao * this.raioAviao) {
        const dist = Math.sqrt(d2) || 1;
        const emp = this.raioAviao - dist;
        p.x += (dx / dist) * emp;
        p.y += (dy / dist) * emp;
        p.z += (dz / dist) * emp;

        if (this.predioAvisado !== c.participante) {
          this.predioAvisado = c.participante;
          this.mostrarAviso(`💥 Bateu no prédio de <strong>${c.participante.apelido}</strong> — <strong>${c.participante.horas}h</strong> Blackboard`, 2800, true);
          this.explosoes.criar(new THREE.Vector3(px, py, pz), c.participante);
          clearTimeout(this.timerPredio);
          this.timerPredio = setTimeout(() => (this.predioAvisado = null), 2800);
        }
      }
    }
  }

  atualizar(dt, tTotal) {
    this.explosoes.atualizar(dt);
    if (!this.ativo) return;

    const posAnt = this.aviao.position.clone();
    const cmd = this.controles.obterComandos();
    const vel = cmd.turbo ? 60 : 30;

    let virar = cmd.virar;
    let taxaGiro = 1.5;

    if (this.manobraRetorno) {
      const rest = Math.atan2(Math.sin(this.manobraRetorno.alvo - this.estado.yaw), Math.cos(this.manobraRetorno.alvo - this.estado.yaw));
      if (Math.abs(rest) < 0.06) {
        this.estado.yaw = this.manobraRetorno.alvo;
        this.manobraRetorno = null;
      } else {
        taxaGiro = 2.6;
        virar = this.manobraRetorno.sentido;
      }
    }

    this.estado.yaw += virar * taxaGiro * dt;
    this.estado.pitch += (cmd.subir * 0.45 - this.estado.pitch) * Math.min(1, 4 * dt);
    this.estado.roll += (virar * 0.55 - this.estado.roll) * Math.min(1, 4 * dt);

    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.estado.pitch, this.estado.yaw, 0, 'YXZ'));
    this.aviao.position.addScaledVector(dir, vel * dt);
    this.aviao.position.y = THREE.MathUtils.clamp(this.aviao.position.y, 6, LIMITES_MAPA.ALTURA - 10);

    this._resolverColisoes();
    this.circuito.atualizar(posAnt, this.aviao.position, tTotal);

    const r = Math.hypot(this.aviao.position.x, this.aviao.position.z);
    if (r >= LIMITES_MAPA.RAIO && !this.manobraRetorno) {
      const yawCentro = Math.atan2(this.aviao.position.x, this.aviao.position.z);
      const delta = Math.atan2(Math.sin(yawCentro - this.estado.yaw), Math.cos(yawCentro - this.estado.yaw));
      this.manobraRetorno = { alvo: yawCentro, sentido: delta >= 0 ? 1 : -1 };
      this.mostrarAviso('🚧 Limite do mapa — retornando à cidade', 2000);
    }

    this.aviao.rotation.set(this.estado.pitch, this.estado.yaw, this.estado.roll);
    this.helice.rotation.z += (cmd.turbo ? 42 : 26) * dt;

    const posCam = new THREE.Vector3(0, 3.2, 9.5)
      .applyEuler(new THREE.Euler(this.estado.pitch * 0.4, this.estado.yaw, 0, 'YXZ'))
      .add(this.aviao.position);
    this.cena.camera.position.lerp(posCam, 1 - Math.pow(0.0005, dt));

    const alvoOlhar = this.aviao.position.clone().addScaledVector(dir, 12);
    alvoOlhar.y -= 3.2;
    this.cena.camera.lookAt(alvoOlhar);
  }
}