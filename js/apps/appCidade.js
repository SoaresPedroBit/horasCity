// App cidade: fonte = lista pública de participantes, modo = espiral de
// prédios. Trocar o participantes.json por uma API de turma é trocar a
// fonte desta linha — nada mais.
import { criarFonteJson } from '../fontes/fonteJson.js';
import { ModoCidade } from '../modos/modoCidade.js';
import { ModalParticipar } from '../participantes/modal.js';
import { enviarInscricao } from '../participantes/api.js';
import * as sessao from '../participantes/sessao.js';

export async function iniciar({ cena, piloto }) {
  const fonte = criarFonteJson();
  const modo = new ModoCidade(cena);

  const btnMeuPredio = document.getElementById('btn-meu-predio');
  document.getElementById('ui-cidade').hidden = false;

  new ModalParticipar({
    onSubmit: ({ ra, apelido }) => enviarInscricao(ra, apelido),
  });

  btnMeuPredio.addEventListener('click', () => {
    const meuId = sessao.lerMeuId();
    if (!meuId || !cena.temFoco(meuId)) return;
    if (piloto.ativo) piloto.alternar();
    cena.focarEm(meuId);
  });

  modo.construir(await fonte.carregar());
  cena.enquadrarVisaoGeral();

  const meuId = sessao.lerMeuId();
  btnMeuPredio.hidden = !(meuId && cena.temFoco(meuId));

  return modo;
}
