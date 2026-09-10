// App solo: fonte = minha chave da API, modo = prédio central + cenário que
// cresce. Só este arquivo conhece os dois lados; a cena e o avião não.
import { criarFonteChave } from '../fontes/fonteChave.js';
import { ModoSolo } from '../modos/modoSolo.js';
import { marcoCruzado } from '../modos/cenarioProgressivo.js';
import { ModalChave } from '../participantes/modalChave.js';
import * as sessao from '../participantes/sessao.js';
import { escaparHtml, formatarDataHora, formatarHoras, META_HORAS } from '../util.js';

export async function iniciar({ cena, piloto }) {
  const fonte = criarFonteChave();
  const modo = new ModoSolo(cena);

  const btnAtualizar = document.getElementById('btn-atualizar');
  const btnMeuPredio = document.getElementById('btn-meu-predio');
  const chip = document.getElementById('chip-horas');
  document.getElementById('ui-solo').hidden = false;

  let atual = null;
  let primeiroDesenho = true;

  function desenhar(participantes) {
    atual = participantes[0] ?? null;
    modo.construir(participantes);

    // A câmera só é reposicionada na primeira vez: atualizar horas não deve
    // arrancar a câmera de onde a pessoa deixou.
    if (primeiroDesenho) {
      cena.enquadrarVisaoGeral();
      primeiroDesenho = false;
    }
    pintarPainel();
  }

  function pintarPainel() {
    const conectado = fonte.estaConectado();
    btnAtualizar.hidden = !conectado;
    btnMeuPredio.hidden = !(conectado && atual && cena.temFoco(atual.id));
    chip.hidden = false;
    chip.textContent = conectado && atual
      ? `🕒 ${formatarHoras(atual.horas, atual.horasTexto)} de ${META_HORAS}h`
      : `👀 exemplo: a cidade em ${META_HORAS}h — conecte sua chave para ver a sua`;

    const base = formatarDataHora(sessao.lerMinhasHoras()?.baseAtualizadaEm);
    chip.title = conectado && base ? `Base de horas apurada até ${base}` : '';
  }

  async function atualizarHoras() {
    const antes = atual?.horas ?? 0;
    const baseAntes = sessao.lerMinhasHoras()?.baseAtualizadaEm ?? null;
    const rotulo = btnAtualizar.textContent;
    btnAtualizar.disabled = true;
    btnAtualizar.textContent = '⏳ Consultando...';

    try {
      desenhar(await fonte.atualizar());
      const marco = marcoCruzado(antes, atual.horas);
      const horas = escaparHtml(formatarHoras(atual.horas, atual.horasTexto));
      const base = sessao.lerMinhasHoras()?.baseAtualizadaEm ?? null;

      // Horas iguais podem ser "você não estudou" ou "a base nem foi
      // reimportada". Só a segunda o aluno não tem como adivinhar.
      if (marco) {
        piloto.mostrarAviso(`🎉 <strong>${horas}</strong> — ${escaparHtml(marco.texto)}`, 3800);
      } else if (atual.horas === antes && base && base === baseAntes) {
        piloto.mostrarAviso(
          `🕒 <strong>${horas}</strong> · a base não mudou desde ${escaparHtml(formatarDataHora(base))}`,
          4200
        );
      } else {
        piloto.mostrarAviso(`🕒 Suas horas agora: <strong>${horas}</strong>`, 3800);
      }
    } catch (err) {
      piloto.mostrarAviso(`⚠️ ${escaparHtml(err?.message || 'Falha ao consultar suas horas.')}`, 4500);
    } finally {
      btnAtualizar.disabled = false;
      btnAtualizar.textContent = rotulo;
    }
  }

  new ModalChave({
    estaConectado: () => fonte.estaConectado(),
    preencher: () => ({ chave: sessao.lerChave() ?? '', apelido: sessao.lerMeuApelido() ?? '' }),
    onConectar: async ({ chave, apelido }) => {
      desenhar(await fonte.conectar({ chave, apelido }));
      if (piloto.ativo) piloto.alternar();
      cena.focarEm(atual.id);
    },
    // Desconectar volta para a cidade cheia da prévia: sem reenquadrar, a
    // câmera fica presa no zoom da cidade pequena que estava ali antes.
    onDesconectar: () => {
      desenhar(fonte.desconectar());
      cena.irParaVisaoGeral();
    },
  });

  btnAtualizar.addEventListener('click', atualizarHoras);
  btnMeuPredio.addEventListener('click', () => {
    if (!atual) return;
    if (piloto.ativo) piloto.alternar();
    cena.focarEm(atual.id);
  });

  desenhar(await fonte.carregar());
  return modo;
}
