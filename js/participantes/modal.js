export class ModalParticipar {
  constructor({ onSubmit }) {
    this.onSubmit = onSubmit;

    this.overlay = document.getElementById('modal-overlay');
    this.form = document.getElementById('form-participar');
    this.campoRa = document.getElementById('input-ra');
    this.campoApelido = document.getElementById('input-apelido');
    this.elErro = document.getElementById('form-erro');
    this.btnConfirmar = document.getElementById('btn-confirmar');
    this.btnCancelar = document.getElementById('btn-cancelar');
    this.btnAbrir = document.getElementById('btn-participar');

    this._bind();
  }

  _bind() {
    this.btnAbrir.addEventListener('click', () => this.abrir());
    this.btnCancelar.addEventListener('click', () => this.fechar());
    this.form.addEventListener('submit', (e) => this._handleSubmit(e));
  }

  abrir() {
    this.elErro.hidden = true;
    this.overlay.hidden = false;
  }

  fechar() {
    this.overlay.hidden = true;
    this.elErro.hidden = true;
  }

  async _handleSubmit(e) {
    e.preventDefault();
    const apelido = this.campoApelido.value.trim();
    const ra = this.campoRa.value.trim();

    if (/\d{4,}/.test(apelido)) {
      this.elErro.textContent = 'Escolha um apelido sem sequências de números.';
      this.elErro.hidden = false;
      return;
    }

    this.btnConfirmar.disabled = true;
    this.btnConfirmar.textContent = 'Enviando...';

    try {
      await this.onSubmit({ ra, apelido });
      this.campoRa.value = '';
      this.form.reset();
      this.fechar();
      alert('Inscrição enviada! Seu prédio entrará na próxima atualização.');
    } catch {
      this.elErro.textContent = 'Erro ao enviar inscrição. Tente novamente.';
      this.elErro.hidden = false;
    } finally {
      this.btnConfirmar.disabled = false;
      this.btnConfirmar.textContent = 'Entrar na cidade';
    }
  }
}