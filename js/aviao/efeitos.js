import * as THREE from 'three';

const texFaisca = (() => {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,190,110,0.85)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

const cacheHoras = new Map();

function obterTexturaHoras(horas) {
  if (cacheHoras.has(horas)) {
    return cacheHoras.get(horas);
  }

  const L = 256;
  const A = 128;
  const c = document.createElement('canvas');
  c.width = L;
  c.height = A;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 72px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = '#ff9a3c';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffcf7a';
  ctx.fillText(`${horas}h`, L / 2, A / 2 - 12);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${horas}h`, L / 2, A / 2 - 12);

  ctx.font = 'bold 22px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffd9a8';
  ctx.fillText('Blackboard', L / 2, A - 26);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cacheHoras.set(horas, tex);
  return tex;
}

export class SistemaExplosoes {
  constructor(scene) {
    this.scene = scene;
    this.lista = [];
  }

  criar(ponto, participante) {
    const grupo = new THREE.Group();
    grupo.position.copy(ponto);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    grupo.add(flash);

    const velocidades = [];
    for (let i = 0; i < 22; i++) {
      velocidades.push(
        new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        )
          .normalize()
          .multiplyScalar(3 + Math.random() * 5)
      );
    }
    const geoFaiscas = new THREE.BufferGeometry();
    geoFaiscas.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(22 * 3), 3)
    );
    const faiscas = new THREE.Points(
      geoFaiscas,
      new THREE.PointsMaterial({
        size: 0.7,
        map: texFaisca,
        color: 0xffa63d,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    grupo.add(faiscas);

    const etiqueta = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: obterTexturaHoras(participante.horas),
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
    );
    etiqueta.scale.set(5, 2.5, 1);
    etiqueta.position.y = 2;
    grupo.add(etiqueta);

    this.scene.add(grupo);
    this.lista.push({ grupo, flash, faiscas, velocidades, etiqueta, t: 0 });
  }

  atualizar(dt) {
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const e = this.lista[i];
      e.t += dt;
      if (e.t >= 1.4) {
        this.scene.remove(e.grupo);
        e.flash.geometry.dispose();
        e.flash.material.dispose();
        e.faiscas.geometry.dispose();
        e.faiscas.material.dispose();
        e.etiqueta.material.dispose();
        this.lista.splice(i, 1);
        continue;
      }
      const k = Math.min(1, e.t / 0.9);
      const kh = e.t / 1.4;
      e.flash.scale.setScalar(0.7 + k * 2.2);
      e.flash.material.opacity = Math.max(0, 1 - k * 1.8) * 0.8;

      const pos = e.faiscas.geometry.attributes.position;
      for (let j = 0; j < e.velocidades.length; j++) {
        const v = e.velocidades[j];
        pos.setXYZ(j, v.x * e.t, v.y * e.t - 4 * e.t * e.t, v.z * e.t);
      }
      pos.needsUpdate = true;
      e.faiscas.material.opacity = 1 - k;
      e.etiqueta.position.y = 2 + kh * 3.5;
      e.etiqueta.material.opacity = kh < 0.75 ? 1 : (1 - kh) / 0.25;
    }
  }
}