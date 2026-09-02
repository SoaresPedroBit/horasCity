import * as THREE from 'three';
import { criarTexturaBanner } from './banner.js';

const matBarbatana = new THREE.MeshLambertMaterial({ color: 0xd32f2f });
const geoBarbatana = new THREE.ConeGeometry(3.4, 4.8, 4);
const matGondola = new THREE.MeshLambertMaterial({ color: 0x2b3448 });
const geoGondola = new THREE.BoxGeometry(4.8, 1.6, 2.2);
const geoBanner = new THREE.PlaneGeometry(17, 6.5);
const geoCabo = new THREE.CylinderGeometry(0.12, 0.12, 6.5, 6);
const matCabo = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

// raio aproximado do casco, usado para detectar colisão do avião com o dirigível
export const RAIO_COLISAO_DIRIGIVEL = 18;

export function criarDirigivel(mensagem) {
  const grupo = new THREE.Group();

  const corpo = new THREE.Mesh(
    new THREE.SphereGeometry(6.7, 20, 16),
    new THREE.MeshLambertMaterial({ color: 0xe4e7ee })
  );
  corpo.scale.set(2.4, 1, 1);
  grupo.add(corpo);

  for (const [dy, dz, rot] of [[3.5, 0, 0], [-3.5, 0, Math.PI], [0, 3.5, -Math.PI / 2], [0, -3.5, Math.PI / 2]]) {
    const bar = new THREE.Mesh(geoBarbatana, matBarbatana);
    bar.position.set(-14.4, dy, dz);
    bar.rotation.z = rot;
    bar.scale.set(0.6, 1, 0.5);
    grupo.add(bar);
  }

  const gondola = new THREE.Mesh(geoGondola, matGondola);
  gondola.position.y = -5.6;
  grupo.add(gondola);

  const cabo = new THREE.Mesh(geoCabo, matCabo);
  cabo.position.y = -9.6;
  grupo.add(cabo);

  // placa/flanela pendurada embaixo do dirigível, na vertical (como um estandarte) para ficar legível
  const matBanner = new THREE.MeshBasicMaterial({ map: criarTexturaBanner(mensagem), side: THREE.DoubleSide });
  const placa = new THREE.Mesh(geoBanner, matBanner);
  placa.position.y = -16.1;
  grupo.add(placa);
  grupo.userData.placa = placa;

  grupo.userData.mensagem = mensagem;
  grupo.traverse((obj) => {
    if (obj.isMesh) obj.userData.mensagem = mensagem;
  });

  return grupo;
}
