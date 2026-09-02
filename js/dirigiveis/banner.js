import * as THREE from 'three';

function quebrarLinhas(ctx, texto, larguraMax) {
  const palavras = texto.split(' ');
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > larguraMax && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function criarTexturaBanner(mensagem) {
  const L = 1536, A = 560;
  const c = document.createElement('canvas');
  c.width = L;
  c.height = A;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f7d23b';
  ctx.fillRect(0, 0, L, A);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(14, 14, L - 28, A - 28);

  ctx.fillStyle = '#d32f2f';
  ctx.fillRect(14, 14, 300, 62);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚠ ANÚNCIO', 32, 46);

  ctx.fillStyle = '#111';
  ctx.font = 'bold 74px Arial, sans-serif';
  ctx.textAlign = 'center';
  const linhas = quebrarLinhas(ctx, mensagem, L - 130).slice(0, 4);
  const inicioY = A / 2 - ((linhas.length - 1) * 84) / 2 + 10;
  linhas.forEach((linha, i) => ctx.fillText(linha, L / 2, inicioY + i * 84));

  ctx.fillStyle = '#d32f2f';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('👆 CLIQUE AQUI', L - 34, A - 42);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
