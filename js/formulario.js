const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScW7ZZ6IhQBWmkjaawyRBb_ocDqFBMIiUxL6_cGNmzvEiPEpg/formResponse';
const ENTRY_RA = 'entry.1408214994';
const ENTRY_APELIDO = 'entry.964858180';

export class ApiService {
  static async enviarInscricao(ra, apelido) {
    const formData = new URLSearchParams();
    formData.append(ENTRY_RA, ra);
    formData.append(ENTRY_APELIDO, apelido);

    await fetch(FORM_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
  }
}

export class ModalParticipar {
  constructor({ onSubmit, getEstaLotado }) {
    this.onSubmit = onSubmit;
    this.getEstaLotado = getEstaLotado;

    this.overlay = document.getElementById('modal-overlay');
    this.form = document.getElementById('form-participar');
    this.campoRa = document.getElementById('input-ra');
    this.campoApelido = document.getElementById('input-apelido');
    this.elErro = document.getElementById('form-erro');
    this.btnConfirmar = document.getElementById('btn-confirmar');
    this.btnCancelar = document.getElementById('btn-cancelar');
    this.btnAbrir = document.getElementById('btn-participar');

    this._bindEvents();
  }

  _bindEvents() {
    this.btnAbrir.addEventListener('click', () => this.abrir());
    this.btnCancelar.addEventListener('click', () => this.fechar());
    this.form.addEventListener('submit', (ev) => this._handleSubmit(ev));
  }

  abrir() {
    this.limparErro();
    this.overlay.hidden = false;
  }

  fechar() {
    this.overlay.hidden = true;
    this.limparErro();
  }

  mostrarErro(msg) {
    this.elErro.textContent = msg;
    this.elErro.hidden = false;
  }

  limparErro() {
    this.elErro.hidden = true;
  }

  async _handleSubmit(ev) {
    ev.preventDefault();
    const apelido = this.campoApelido.value.trim();
    const ra = this.campoRa.value.trim();

    this.limparErro();

    if (/\d{4,}/.test(apelido)) {
      this.mostrarErro('Escolha um apelido sem sequências de números — ele fica visível para todos.');
      return;
    }

    if (this.getEstaLotado()) {
      this.mostrarErro('A cidade já atingiu o limite de prédios cadastrados.');
      return;
    }

    this.btnConfirmar.disabled = true;
    this.btnConfirmar.textContent = 'Enviando...';

    try {
      await this.onSubmit({ ra, apelido });
      this.campoRa.value = '';
      this.form.reset();
      this.fechar();
      alert('Inscrição enviada! Seu prédio entrará na próxima atualização da cidade.');
    } catch {
      this.mostrarErro('Erro ao enviar inscrição. Tente novamente.');
    } finally {
      this.btnConfirmar.disabled = false;
      this.btnConfirmar.textContent = 'Entrar na cidade';
    }
  }
}