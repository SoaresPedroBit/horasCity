import * as THREE from 'three';

const PALETA = [0x4f8ff7, 0x9d6ff7, 0x34c98e, 0xf7b23b, 0xf76f6f, 0x5ad0e0];
const TAMANHO_CELULA = 24;
const LARGURA_RUA = 8;
const ALTURA_POR_HORA = 0.35;
const ALTURA_MINIMA = 2;

function hashId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
}

function posicoesEspiral(qtd) {
  const posicoes = [[0, 0]];
  let x = 0, z = 0, dx = 1, dz = 0;
  let passos = 1, dados = 0, viradas = 0;
  while (posicoes.length < qtd) {
    x += dx;
    z += dz;
    posicoes.push([x, z]);
    dados++;
    if (dados === passos) {
      dados = 0;
      [dx, dz] = [-dz, dx];
      viradas++;
      if (viradas % 2 === 0) passos++;
    }
  }
  return posicoes;
}

function criarTexturaJanelas() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c6cbd6';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 6; y < 64; y += 16) {
    for (let x = 6; x < 64; x += 16) {
      ctx.fillStyle = Math.random() < 0.55 ? '#fff6d8' : '#252a36';
      ctx.fillRect(x, y, 8, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function criarTexturaApelido(apelido, cor, renderer) {
  const L = 512, A = 128;
  const c = document.createElement('canvas');
  c.width = L;
  c.height = A;
  const ctx = c.getContext('2d');
  const corHex = `#${new THREE.Color(cor).getHexString()}`;

  ctx.fillStyle = '#0d1220';
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = corHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, L - 8, A - 8);
  ctx.fillStyle = corHex;
  ctx.fillRect(4, A - 16, L - 8, 12);

  let tamanho = 74;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `bold ${tamanho}px system-ui, "Segoe UI", Arial, sans-serif`;
    if (ctx.measureText(apelido).width <= L - 56) break;
    tamanho -= 4;
  } while (tamanho > 22);

  ctx.fillStyle = corHex;
  ctx.shadowColor = corHex;
  ctx.shadowBlur = 18;
  ctx.fillText(apelido, L / 2, A / 2 - 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(apelido, L / 2, A / 2 - 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export class ConstrutorCidade {
  constructor(renderer) {
    this.renderer = renderer;
    this.texturaJanelas = criarTexturaJanelas();
  }

  gerarMalhas(participantes) {
    const grupoPredios = new THREE.Group();
    const grupoRuas = new THREE.Group();
    const prediosPorId = new Map();
    const colisores = [];
    const outdoors = [];

    const celulas = posicoesEspiral(participantes.length);
    this._gerarRuas(grupoRuas, celulas);

    participantes.forEach((p, i) => {
      const [cx, cz] = celulas[i];
      const altura = ALTURA_MINIMA + p.horas * ALTURA_POR_HORA;
      const h = hashId(p.id);
      const largura = 6 + (h % 4);
      const profundidade = 6 + ((h >>> 4) % 4);
      const cor = PALETA[(h >>> 8) % PALETA.length];

      const tex = this.texturaJanelas.clone();
      tex.repeat.set(Math.max(1, Math.round(largura / 4)), Math.max(1, Math.round(altura / 5)));

      const lateral = new THREE.MeshLambertMaterial({ map: tex, color: cor });
      const topo = new THREE.MeshLambertMaterial({ color: new THREE.Color(cor).multiplyScalar(0.5) });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(largura, altura, profundidade),
        [lateral, lateral, topo, topo, lateral, lateral]
      );
      mesh.position.set(cx * TAMANHO_CELULA, altura / 2, cz * TAMANHO_CELULA);
      mesh.userData.participante = p;

      const lote = new THREE.Mesh(
        new THREE.BoxGeometry(largura + 6, 0.2, profundidade + 6),
        new THREE.MeshLambertMaterial({ color: 0x222a3a })
      );
      lote.position.set(cx * TAMANHO_CELULA, 0.1, cz * TAMANHO_CELULA);

      // Outdoor
      const larguraPainel = Math.max(7.5, largura + 1.5);
      const grupoOutdoor = new THREE.Group();
      const texturaApelido = criarTexturaApelido(p.apelido, cor, this.renderer);
      const frente = new THREE.MeshBasicMaterial({ map: texturaApelido });
      const moldura = new THREE.MeshLambertMaterial({ color: 0x2b3448 });
      const painel = new THREE.Mesh(
        new THREE.BoxGeometry(larguraPainel, 2.4, 0.25),
        [moldura, moldura, moldura, moldura, frente, frente]
      );
      painel.position.y = 1.4 + 1.2;
      painel.userData.participante = p;

      const geoPoste = new THREE.CylinderGeometry(0.16, 0.16, 1.4, 6);
      const matPoste = new THREE.MeshLambertMaterial({ color: 0x39435a });
      for (const lado of [-1, 1]) {
        const poste = new THREE.Mesh(geoPoste, matPoste);
        poste.position.set(lado * (larguraPainel / 2 - 0.8), 0.7, 0);
        grupoOutdoor.add(poste);
      }
      grupoOutdoor.add(painel);
      grupoOutdoor.position.set(cx * TAMANHO_CELULA, altura, cz * TAMANHO_CELULA);
      grupoOutdoor.userData.textura = texturaApelido;
      outdoors.push(grupoOutdoor);

      grupoPredios.add(lote, mesh, grupoOutdoor);
      prediosPorId.set(p.id, mesh);

      colisores.push({
        x: mesh.position.x,
        z: mesh.position.z,
        hx: largura / 2,
        hz: profundidade / 2,
        altura,
        alturaColisao: altura + 3.8,
        participante: p,
      });
    });

    return { grupoPredios, grupoRuas, prediosPorId, colisores, outdoors };
  }

  _gerarRuas(grupoRuas, celulas) {
    if (!celulas.length) return;
    const geoPista = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const matAsfalto = new THREE.MeshLambertMaterial({ color: 0x1b2130 });
    const matFaixa = new THREE.MeshBasicMaterial({ color: 0xd8c98a });

    const xs = celulas.map(([cx]) => cx);
    const zs = celulas.map(([, cz]) => cz);
    const xsVia = [];
    for (let i = Math.min(...xs); i <= Math.max(...xs) + 1; i++) xsVia.push((i - 0.5) * TAMANHO_CELULA);
    const zsVia = [];
    for (let j = Math.min(...zs); j <= Math.max(...zs) + 1; j++) zsVia.push((j - 0.5) * TAMANHO_CELULA);

    const x0 = xsVia[0], x1 = xsVia[xsVia.length - 1];
    const z0 = zsVia[0], z1 = zsVia[zsVia.length - 1];

    for (const x of xsVia) {
      const p = new THREE.Mesh(geoPista, matAsfalto);
      p.position.set(x, 0.05, (z0 + z1) / 2);
      p.scale.set(LARGURA_RUA, 1, z1 - z0 + LARGURA_RUA);
      grupoRuas.add(p);
    }
    for (const z of zsVia) {
      const p = new THREE.Mesh(geoPista, matAsfalto);
      p.position.set((x0 + x1) / 2, 0.052, z);
      p.scale.set(x1 - x0 + LARGURA_RUA, 1, LARGURA_RUA);
      grupoRuas.add(p);
    }

    const vao = TAMANHO_CELULA - LARGURA_RUA;
    const passo = 8;
    const porTrecho = Math.max(1, Math.floor(vao / passo));
    const tracos = [];

    for (const x of xsVia) {
      for (let k = 0; k < zsVia.length - 1; k++) {
        const centro = (zsVia[k] + zsVia[k + 1]) / 2;
        for (let t = 0; t < porTrecho; t++) tracos.push([x, centro + (t - (porTrecho - 1) / 2) * passo, false]);
      }
    }
    for (const z of zsVia) {
      for (let k = 0; k < xsVia.length - 1; k++) {
        const centro = (xsVia[k] + xsVia[k + 1]) / 2;
        for (let t = 0; t < porTrecho; t++) tracos.push([centro + (t - (porTrecho - 1) / 2) * passo, z, true]);
      }
    }

    const faixas = new THREE.InstancedMesh(geoPista, matFaixa, tracos.length);
    const mat = new THREE.Matrix4();
    tracos.forEach(([x, z, alongX], i) => {
      mat.makeScale(alongX ? 5 : 0.35, 1, alongX ? 0.35 : 5);
      mat.setPosition(x, 0.07, z);
      faixas.setMatrixAt(i, mat);
    });
    faixas.instanceMatrix.needsUpdate = true;
    grupoRuas.add(faixas);
  }
}