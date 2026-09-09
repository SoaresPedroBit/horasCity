export class ModalChave {
  constructor({ onConectar, onDesconectar, estaConectado, preencher = () => ({}) }) {
    this.onConectar = onConectar;
    this.onDesconectar = onDesconectar;
    this.estaConectado = estaConectado;
    this.preencher = preencher;

    this.overlay = document.getElementById('chave-overlay');
    this.form = document.getElementById('form-chave');
    this.campoChave = document.getElementById('input-chave');
    this.campoApelido = document.getElementById('input-chave-apelido');
    this.elErro = document.getElementById('chave-erro');
    this.btnConfirmar = document.getElementById('btn-chave-confirmar');
    this.btnCancelar = document.getElementById('btn-chave-cancelar');
    this.btnDesconectar = document.getElementById('btn-chave-desconectar');
    this.btnAbrir = document.getElementById('btn-chave');

    this._bind();
  }

  _bind() {
    this.btnAbrir.addEventListener('click', () => this.abrir(this.preencher()));
    this.btnCancelar.addEventListener('click', () => this.fechar());
    this.btnDesconectar.addEventListener('click', () => {
      this.onDesconectar();
      this.campoChave.value = '';
      this.fechar();
    });
    this.form.addEventListener('submit', (e) => this._handleSubmit(e));
  }

  abrir({ chave = '', apelido = '' } = {}) {
    const conectado = this.estaConectado();
    this.campoChave.value = chave;
    this.campoApelido.value = apelido;
    this.btnDesconectar.hidden = !conectado;
    this.btnConfirmar.textContent = conectado ? 'Reconectar' : 'Conectar';
    this.elErro.hidden = true;
    this.overlay.hidden = false;
    (conectado ? this.campoApelido : this.campoChave).focus();
  }

  fechar() {
    this.overlay.hidden = true;
    this.elErro.hidden = true;
  }

  _mostrarErro(mensagem) {
    this.elErro.textContent = mensagem;
    this.elErro.hidden = false;
  }

  async _handleSubmit(e) {
    e.preventDefault();
    const chave = this.campoChave.value.trim();
    const apelido = this.campoApelido.value.trim();

    if (/\d{4,}/.test(apelido)) {
      this._mostrarErro('Escolha um apelido sem sequências de números.');
      return;
    }

    this.btnConfirmar.disabled = true;
    const rotulo = this.btnConfirmar.textContent;
    this.btnConfirmar.textContent = 'Consultando...';

    try {
      await this.onConectar({ chave, apelido });
      this.fechar();
    } catch (err) {
      this._mostrarErro(err?.message || 'Não foi possível consultar suas horas.');
    } finally {
      this.btnConfirmar.disabled = false;
      this.btnConfirmar.textContent = rotulo;
    }
  }
}
