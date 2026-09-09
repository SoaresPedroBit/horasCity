// Meta de horas do curso — referência para o quanto falta no prédio.
export const META_HORAS = 15;

// O apelido é texto de outra pessoa — nunca injetar como HTML cru.
export function escaparHtml(txt) {
  const div = document.createElement('div');
  div.textContent = txt;
  return div.innerHTML;
}

// A API manda "6h 25m"; o JSON manda número decimal. Os dois caem aqui.
export function formatarHoras(horas, horasTexto = null) {
  if (horasTexto) return horasTexto;
  const n = Number(horas);
  if (!Number.isFinite(n)) return '—';
  return `${String(Math.round(n * 10) / 10).replace('.', ',')}h`;
}
