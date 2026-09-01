// O apelido é texto de outra pessoa — nunca injetar como HTML cru.
export function escaparHtml(txt) {
  const div = document.createElement('div');
  div.textContent = txt;
  return div.innerHTML;
}
