import * as THREE from 'three';

const STORAGE_KEY_RECORDE = 'horascity:recorde-circuito';
const PONTOS = [
  [-36,  12,  12,  1, 0],
  [-12,  12,  20,  1, 0],
  [ 12,  12,  12,  1, 0],
  [ 36,  12,  20,  1, 0],
  [ 36, -12,  12, -1, 0],
  [ 12, -12,  20, -1, 0],
  [-12, -12,  12, -1, 0],
  [-36, -12,  20, -1, 0],
];

export class CircuitoCorrida {
  constructor(scene, onFinalizado, onIniciar) {
    this.scene = scene;
    this.onFinalizado = onFinalizado;
    this.onIniciar = onIniciar;
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    this.scene.add(this.grupo);

    this.argolas = [];
    this.corrida = null;
    this.jaCompletouUmaVez = false; 

    this.hud = document.getElementById('hud-corrida');
    this.elTempo = document.getElementById('corrida-tempo');
    this.elProgresso = document.getElementById('corrida-progresso');
    this.elRecorde = document.getElementById('corrida-recorde');
    this.btnCorrida = document.getElementById('btn-corrida');

    this._montar();
    this._atualizarRecorde();
    this._atualizarBtn();

    this.btnCorrida.addEventListener('click', () => {
      this.btnCorrida.blur();
      if (this.corrida && !this.corrida.fim) this.parar();
      else this.onIniciar();
    });
  }

  _montar() {
    const geo = new THREE.TorusGeometry(6, 0.45, 10, 40);
    this.argolas = PONTOS.map(([x, z, y, dx, dz]) => {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0x3a4a63,
          emissive: 0x1b2a3a,
          roughness: 0.4,
        })
      );
      mesh.position.set(x, y, z);
      mesh.rotation.y = Math.atan2(dx, dz);
      mesh.userData.dir = { x: dx, z: dz };
      this.grupo.add(mesh);
      return mesh;
    });
  }

  _atualizarRecorde() {
    if (!this.elRecorde) return;
    const bruto = Number(localStorage.getItem(STORAGE_KEY_RECORDE));
    this.elRecorde.hidden = !bruto;
    if (bruto) {
      this.elRecorde.textContent = `recorde ${(bruto / 1000).toFixed(2)}s`;
    }
  }

  iniciar() {
    this.corrida = { indice: 0, inicio: null, fim: null };
    this.grupo.visible = true;
    if (this.hud) this.hud.hidden = false;
    this._pintar();
    this._atualizarBtn();
    this._atualizarRecorde();

    const primeira = this.argolas[0];
    const dir = primeira.userData.dir;
    return {
      posicao: new THREE.Vector3(
        primeira.position.x - dir.x * 50,
        primeira.position.y,
        primeira.position.z - dir.z * 50
      ),
      yaw: Math.atan2(-dir.x, -dir.z),
    };
  }

  parar() {
    this.corrida = null;
    this.grupo.visible = false;

    if (this.elTempo) this.elTempo.textContent = '';
    if (this.elProgresso) this.elProgresso.textContent = '';

    this._atualizarRecorde();
    this._atualizarBtn();
  }

  _pintar() {
    this.argolas.forEach((a, i) => {
      const passada = this.corrida && i < this.corrida.indice;
      const proxima = this.corrida && i === this.corrida.indice;
      a.material.color.setHex(passada ? 0x34c98e : proxima ? 0x5ad0e0 : 0x3a4a63);
      a.material.emissive.setHex(passada ? 0x0e3d2a : proxima ? 0x1d6f7c : 0x1b2a3a);
    });
  }

  _atualizarBtn() {
    const emAndamento = this.corrida !== null && !this.corrida.fim;
    this.btnCorrida.classList.toggle('ativo', emAndamento);

    if (emAndamento) {
      this.btnCorrida.textContent = '✕ Sair do circuito';
    } else if (this.jaCompletouUmaVez || (this.corrida && this.corrida.fim)) {
      this.btnCorrida.textContent = '🔁 Correr de novo';
    } else {
      this.btnCorrida.textContent = '🏁 Circuito';
    }
  }

  atualizar(posAntes, posDepois, tDecorrido) {
    if (!this.corrida || this.corrida.fim) return;

    const decorrido = this.corrida.inicio === null ? 0 : performance.now() - this.corrida.inicio;
    if (this.elTempo) this.elTempo.textContent = `${(decorrido / 1000).toFixed(2)}s`;
    if (this.elProgresso) this.elProgresso.textContent = `${this.corrida.indice} / ${this.argolas.length} argolas`;

    const bruto = Number(localStorage.getItem(STORAGE_KEY_RECORDE));

    this.argolas[this.corrida.indice].material.emissiveIntensity =
      1.4 + Math.sin(tDecorrido * 5) * 0.6;

    const argola = this.argolas[this.corrida.indice];
    const _a = argola.worldToLocal(posAntes.clone());
    const _d = argola.worldToLocal(posDepois.clone());

    if ((_a.z > 0) !== (_d.z > 0)) {
      const t = _a.z / (_a.z - _d.z);
      const x = _a.x + (_d.x - _a.x) * t;
      const y = _a.y + (_d.y - _a.y) * t;
      if (Math.hypot(x, y) <= 6) {
        if (this.corrida.indice === 0) this.corrida.inicio = performance.now();
        this.corrida.indice++;
        this._pintar();
        if (this.corrida.indice >= this.argolas.length) {
          this.corrida.fim = performance.now();
          this.jaCompletouUmaVez = true; 

          const ms = this.corrida.fim - this.corrida.inicio;
          const superou = !bruto || ms < bruto;
          if (superou) {
            localStorage.setItem(STORAGE_KEY_RECORDE, String(Math.round(ms)));
          }
          this._atualizarRecorde();
          this.onFinalizado(ms, bruto, superou);
          this._atualizarBtn();

          setTimeout(() => {
            if (this.corrida && this.corrida.fim) {
              this.parar();
            }
          }, 2500);
        }
      }
    }
  }
}