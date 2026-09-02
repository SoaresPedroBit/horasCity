import * as THREE from 'three';
import { montarUrlQrReal, gerarQrFallbackDataUrl, gerarFallbackFoto } from './qr.js';

const MAX_FUGAS = 3;

export class AnuncioDirigivel {
  constructor(cena, gerenciadorDirigiveis, piloto) {
    this.cena = cena;
    this.gerenciador = gerenciadorDirigiveis;
    this.piloto = piloto;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.fugasRestantes = MAX_FUGAS;
    this.timeoutErro = null;

    this.overlay = document.getElementById('anuncio-overlay');
    this.conteudoAd = document.getElementById('anuncio-conteudo-ad');
    this.conteudoFoto = document.getElementById('anuncio-conteudo-foto');
    this.elTexto = document.getElementById('anuncio-texto');
    this.elStatus = document.getElementById('anuncio-status');
    this.elFoto = document.getElementById('anuncio-foto');
    this.btnFechar = document.getElementById('anuncio-fechar');
    this.btnPago = document.getElementById('anuncio-pago');
    this.btnSair = document.getElementById('anuncio-sair');
    this.btnQr = document.getElementById('anuncio-qr-botao');
    this.btnVoltarFoto = document.getElementById('anuncio-foto-voltar');
    this.elQr = document.getElementById('anuncio-qr');

    this.elQr.src = montarUrlQrReal();
    this.elQr.addEventListener('error', () => { this.elQr.src = gerarQrFallbackDataUrl(); }, { once: true });
    this.elFoto.addEventListener('error', () => { this.elFoto.src = gerarFallbackFoto(); }, { once: true });

    this._bind();
  }

  _bind() {
    const canvas = this.cena.renderer.domElement;
    let inicioPonteiro = null;

    canvas.addEventListener('pointerdown', (e) => {
      inicioPonteiro = { x: e.clientX, y: e.clientY, t: performance.now() };
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!inicioPonteiro) return;
      const dist = Math.hypot(e.clientX - inicioPonteiro.x, e.clientY - inicioPonteiro.y);
      const dt = performance.now() - inicioPonteiro.t;
      inicioPonteiro = null;
      if (dist > 6 || dt > 500) return;
      this._checarClique(e);
    });

    this.btnFechar.addEventListener('click', () => this.fechar());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.fechar();
    });

    this.btnPago.addEventListener('click', () => this._simularPagamento());
    this.btnSair.addEventListener('click', () => this.fechar());
    this.btnSair.addEventListener('pointerenter', () => this._fugirBotao());

    this.btnQr.addEventListener('click', () => this._mostrarFoto());
    this.btnVoltarFoto.addEventListener('click', () => this._mostrarAnuncio());
  }

  _checarClique(e) {
    if (this.piloto?.ativo || !this.overlay.hidden) return;

    const rect = this.cena.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.cena.camera);

    const acertos = this.raycaster.intersectObjects(this.gerenciador.grupo.children, true);
    const alvo = acertos.find((a) => a.object.userData.mensagem);
    if (alvo) this.abrir(alvo.object.userData.mensagem);
  }

  abrir(mensagem) {
    clearTimeout(this.timeoutErro);
    this.elTexto.textContent = mensagem;
    this.fugasRestantes = MAX_FUGAS;
    this.btnSair.style.transform = 'none';
    this.btnPago.disabled = false;
    this.btnSair.disabled = false;
    this.elStatus.hidden = true;
    this._mostrarAnuncio();
    this.overlay.hidden = false;
  }

  fechar() {
    this.overlay.hidden = true;
    clearTimeout(this.timeoutErro);
  }

  _mostrarAnuncio() {
    this.conteudoAd.hidden = false;
    this.conteudoFoto.hidden = true;
  }

  _mostrarFoto() {
    this.conteudoAd.hidden = true;
    this.conteudoFoto.hidden = false;
  }

  _fugirBotao() {
    if (this.fugasRestantes <= 0) return;
    this.fugasRestantes--;
    const dx = (Math.random() - 0.5) * 220;
    const dy = -30 - Math.random() * 70;
    this.btnSair.style.transform = `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
  }

  _simularPagamento() {
    clearTimeout(this.timeoutErro);
    this.btnPago.disabled = true;
    this.btnSair.disabled = true;
    this.elStatus.hidden = false;
    this.elStatus.className = 'anuncio-status processando';
    this.elStatus.textContent = '⏳ Processando pagamento...';

    this.timeoutErro = setTimeout(() => {
      this.elStatus.className = 'anuncio-status erro';
      this.elStatus.textContent = '❌ Erro no pagamento. Tente novamente.';
      this.btnPago.disabled = false;
      this.btnSair.disabled = false;
    }, 1400);
  }
}
