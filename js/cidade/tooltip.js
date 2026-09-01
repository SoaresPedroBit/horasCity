import * as THREE from 'three';
import { escaparHtml } from '../util.js';

export class TooltipCidade {
  constructor(elementoId = 'tooltip') {
    this.el = document.getElementById(elementoId);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.ativo = true;
    this.posicaoCursor = { x: 0, y: 0 };

    // (0,0) em coordenadas normalizadas é o centro da tela, não "lugar nenhum"
    this.temPosicao = false;

    window.addEventListener('pointermove', (e) => {
      this.temPosicao = true;
      this.posicaoCursor.x = e.clientX;
      this.posicaoCursor.y = e.clientY;
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  setAtivo(ativo) {
    this.ativo = ativo;
    if (!ativo && this.el) this.el.hidden = true;
  }

  atualizar(camera, grupoPredios) {
    if (!this.ativo || !this.el || !this.temPosicao) return;

    this.raycaster.setFromCamera(this.mouse, camera);
    const hit = this.raycaster
      .intersectObjects(grupoPredios.children)
      .find((i) => i.object.userData.participante);

    if (hit) {
      const p = hit.object.userData.participante;
      this.el.innerHTML = `<div class="t-nome">${escaparHtml(p.apelido)}</div><div><span class="t-horas">${p.horas}h</span> Blackboard</div>`;
      this.el.hidden = false;
      this.el.style.left = `${Math.min(this.posicaoCursor.x + 14, window.innerWidth - 260)}px`;
      this.el.style.top = `${this.posicaoCursor.y + 14}px`;
    } else {
      this.el.hidden = true;
    }
  }
}