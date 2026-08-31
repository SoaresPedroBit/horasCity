export class EntradaControles {
  constructor() {
    this.teclas = new Set();
    this.toque = { x: 0, y: 0, turbo: false };
    this.temToque = window.matchMedia('(pointer: coarse)').matches;
    this.ponteiroJoystick = null;

    this.elJoystick = document.getElementById('joystick');
    this.elManete = document.getElementById('joystick-manete');
    this.elBtnTurbo = document.getElementById('btn-turbo');
    this.elControlesToque = document.getElementById('controles-toque');
    this.elDicas = document.getElementById('dicas-voo');

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT') this.teclas.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.teclas.delete(e.code));

    this.elJoystick.addEventListener('pointerdown', (e) => {
      this.ponteiroJoystick = e.pointerId;
      this.elJoystick.setPointerCapture(e.pointerId);
      this._mover(e);
    });
    this.elJoystick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.ponteiroJoystick) this._mover(e);
    });
    const limparToque = (e) => {
      if (e.pointerId === this.ponteiroJoystick) this._zerar();
    };
    this.elJoystick.addEventListener('pointerup', limparToque);
    this.elJoystick.addEventListener('pointercancel', limparToque);

    this.elBtnTurbo.addEventListener('pointerdown', (e) => {
      this.elBtnTurbo.setPointerCapture(e.pointerId);
      this.toque.turbo = true;
      this.elBtnTurbo.classList.add('ativo');
    });
    const limparTurbo = () => {
      this.toque.turbo = false;
      this.elBtnTurbo.classList.remove('ativo');
    };
    this.elBtnTurbo.addEventListener('pointerup', limparTurbo);
    this.elBtnTurbo.addEventListener('pointercancel', limparTurbo);
  }

  _mover(e) {
    const area = this.elJoystick.getBoundingClientRect();
    const r = area.width / 2;
    let dx = (e.clientX - (area.left + r)) / r;
    let dy = (e.clientY - (area.top + r)) / r;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) { dx /= dist; dy /= dist; }
    this.toque.x = dx;
    this.toque.y = -dy;
    this.elManete.style.transform = `translate(${dx * r * 0.6}px, ${dy * r * 0.6}px)`;
  }

  _zerar() {
    this.ponteiroJoystick = null;
    this.toque.x = 0;
    this.toque.y = 0;
    this.elManete.style.transform = 'translate(0, 0)';
  }

  definirModoAviao(ativo) {
    this.elDicas.hidden = !ativo || this.temToque;
    this.elControlesToque.hidden = !(ativo && this.temToque);
    if (!ativo) {
      this._zerar();
      this.toque.turbo = false;
      this.elBtnTurbo.classList.remove('ativo');
    }
  }

  obterComandos() {
    const subir = Math.max(-1, Math.min(1, (this.teclas.has('KeyW') ? 1 : 0) - (this.teclas.has('KeyS') ? 1 : 0) + this.toque.y));
    const virar = Math.max(-1, Math.min(1, (this.teclas.has('KeyA') ? 1 : 0) - (this.teclas.has('KeyD') ? 1 : 0) - this.toque.x));
    const turbo = this.teclas.has('ShiftLeft') || this.teclas.has('ShiftRight') || this.toque.turbo;
    return { subir, virar, turbo };
  }
}