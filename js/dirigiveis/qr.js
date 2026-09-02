// URL pública real (GitHub Pages) para onde o QR code aponta de verdade.
// Só funciona quando este projeto está publicado — em file:// ou localhost o QR
// ainda é escaneável, mas a foto só carrega depois do deploy.
const URL_FOTO_PIX = 'https://soarespedrobit.github.io/horasCity/data/piada-pix.jpg';

export function montarUrlQrReal() {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(URL_FOTO_PIX)}`;
}

// Usado só se o gerador de QR online não carregar (ex.: sem internet) — não é
// escaneável de verdade, é só pra não deixar o espaço vazio.
export function gerarQrFallbackDataUrl(tamanho = 300) {
  const c = document.createElement('canvas');
  c.width = tamanho;
  c.height = tamanho;
  const ctx = c.getContext('2d');
  const modulos = 21;
  const cel = tamanho / modulos;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tamanho, tamanho);
  ctx.fillStyle = '#111';

  let s = 1337;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 1000) / 1000;
  };

  for (let y = 0; y < modulos; y++) {
    for (let x = 0; x < modulos; x++) {
      const nosOlhos = (x < 7 && y < 7) || (x > modulos - 8 && y < 7) || (x < 7 && y > modulos - 8);
      if (nosOlhos) continue;
      if (rand() > 0.55) ctx.fillRect(x * cel, y * cel, cel * 0.92, cel * 0.92);
    }
  }

  function olho(ox, oy) {
    ctx.fillStyle = '#111';
    ctx.fillRect(ox * cel, oy * cel, 7 * cel, 7 * cel);
    ctx.fillStyle = '#fff';
    ctx.fillRect((ox + 1) * cel, (oy + 1) * cel, 5 * cel, 5 * cel);
    ctx.fillStyle = '#111';
    ctx.fillRect((ox + 2) * cel, (oy + 2) * cel, 3 * cel, 3 * cel);
  }
  olho(0, 0);
  olho(modulos - 7, 0);
  olho(0, modulos - 7);

  return c.toDataURL('image/png');
}

export function gerarFallbackFoto() {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 360;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, 480, 360);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '110px "Segoe UI Emoji", Arial';
  ctx.fillText('🦍', 240, 150);
  ctx.font = '70px "Segoe UI Emoji", Arial';
  ctx.fillText('🖕', 240, 250);
  ctx.fillStyle = '#f7d23b';
  ctx.font = 'bold 26px Arial';
  ctx.fillText('PEGADINHA!', 240, 320);
  return c.toDataURL('image/png');
}
