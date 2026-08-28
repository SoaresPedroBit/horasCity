import * as THREE from 'three';

// Modelo do avião: homenagem ao Dodo do GTA San Andreas, montado com
// primitivas — asa alta de envergadura curta (a marca registrada dele),
// fuselagem roliça, hélice no nariz, deriva alta e trem de pouso fixo.
// Livery branca com faixa vermelha.
//
// Convenção: o nariz aponta para -Z, que é a direção "para frente" usada
// pelo controle de voo em main.js.
//
// Contrato esperado por main.js:
//   - exporta criarAviao(), que devolve o Group do modelo;
//   - o Group tem rotation.order = 'YXZ' (o voo aplica pitch/yaw/roll nessa
//     ordem; sem isso a atitude do avião sai errada nas curvas);
//   - o Group expõe userData.helice, um Group girado no eixo Z a cada quadro.
export function criarAviao() {
  const modelGroup = new THREE.Group();

  // Peças que giram junto com a hélice. O Group fica na ponta do nariz e é
  // girado no eixo Z por main.js; as peças entram com posição relativa a ele.
  const helice = new THREE.Group();
  helice.position.set(-0.215, 0.046, -1.454);

  const part_1 = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.14, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_1.position.set(-0.326, 0.884, 0.073);
  part_1.rotation.set(-0.001, 0.006, -0.017);
  part_1.scale.set(0.624, 0.518, 0.824);
  part_1.name = "asa_principal_7";
  modelGroup.add(part_1);

  const part_2 = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1, 4, 16),
    new THREE.MeshStandardMaterial({ color: 0xbe1919, roughness: 0.5, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_2.position.set(-0.218, 0.493, 0.017);
  part_2.rotation.set(0.011, 0.025, -0.016);
  part_2.scale.set(0.956, 0.414, 1.229);
  part_2.name = "capsule_10";
  modelGroup.add(part_2);

  const part_3 = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1, 4, 16),
    new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_3.position.set(-0.226, 0.078, 0.000);
  part_3.rotation.set(-0.001, -0.014, 0.008);
  part_3.scale.set(0.989, 0.486, 2.249);
  part_3.name = "capsule_11";
  modelGroup.add(part_3);

  const part_4 = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.5, 32),
    new THREE.MeshStandardMaterial({ color: 0xbe1919, roughness: 0.5, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_4.position.set(-0.219, 0.541, 1.823);
  part_4.rotation.set(1.153, 0.000, 0.000);
  part_4.scale.set(0.660, 1.466, 0.837);
  part_4.name = "cone_13";
  modelGroup.add(part_4);

  const part_5 = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_5.position.set(-0.214, 0.786, 2.837);
  part_5.rotation.set(0.000, 0.000, 0.000);
  part_5.scale.set(1.480, 0.072, 0.614);
  part_5.name = "box_14";
  modelGroup.add(part_5);

  const part_6 = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xbe1919, roughness: 0.5, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_6.position.set(-0.216, 1.014, 2.834);
  part_6.rotation.set(0.000, 0.000, 0.000);
  part_6.scale.set(0.045, 0.564, 0.605);
  part_6.name = "box_15";
  modelGroup.add(part_6);

  const part_7 = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1, 4, 16),
    new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_7.position.set(-0.224, 0.024, -0.431);
  part_7.rotation.set(1.552, 0.000, -0.006);
  part_7.scale.set(0.950, 1.000, 0.954);
  part_7.name = "capsule_17";
  modelGroup.add(part_7);

  // part_8 e part_9 entram na hélice em vez do corpo. As posições abaixo são
  // relativas ao Group (que está em -0.215, 0.046, -1.454), de modo que em
  // repouso as peças ficam exatamente onde estavam no modelo original.
  const part_8 = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.55, 16),
    new THREE.MeshStandardMaterial({ color: 0xbe1919, roughness: 0.5, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_8.position.set(0.000, 0.000, -0.120);
  part_8.rotation.set(-1.571, 0.000, 0.000);
  part_8.scale.set(0.700, 0.700, 0.700);
  part_8.name = "helice_spinner_19";
  helice.add(part_8);

  const part_9 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.4, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xF1C232, roughness: 0.8, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_9.position.set(0.000, 0.000, 0.000);
  part_9.rotation.set(0.000, 0.000, 0.750);
  part_9.scale.set(0.850, 0.850, 0.850);
  part_9.name = "helice_pa_20";
  helice.add(part_9);

  modelGroup.add(helice);

  const part_10 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_10.position.set(-0.210, -0.350, 1.128);
  part_10.rotation.set(-0.442, -0.211, -0.002);
  part_10.scale.set(1.000, 1.000, 1.000);
  part_10.name = "haste_cauda_21";
  modelGroup.add(part_10);

  const part_11 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.8, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_11.position.set(-0.215, -0.470, 1.228);
  part_11.rotation.set(0.000, 0.000, 1.571);
  part_11.scale.set(1.000, 1.000, 1.000);
  part_11.name = "roda_cauda_22";
  modelGroup.add(part_11);

  const part_12 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_12.position.set(-0.620, -0.220, -0.200);
  part_12.rotation.set(0.000, 0.000, 2.538);
  part_12.scale.set(1.000, 1.000, 1.000);
  part_12.name = "haste_prin_esq_23";
  modelGroup.add(part_12);

  const part_13 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.8, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_13.position.set(-0.950, -0.650, -0.200);
  part_13.rotation.set(0.000, 0.000, 1.571);
  part_13.scale.set(1.000, 1.000, 1.000);
  part_13.name = "roda_prin_esq_24";
  modelGroup.add(part_13);

  const part_14 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_14.position.set(0.180, -0.267, -0.200);
  part_14.rotation.set(0.000, 0.000, 0.676);
  part_14.scale.set(1.000, 1.000, 1.000);
  part_14.name = "haste_prin_dir_25";
  modelGroup.add(part_14);

  const part_15 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.8, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 1 })
  );
  part_15.position.set(0.510, -0.650, -0.200);
  part_15.rotation.set(0.000, 0.000, 1.571);
  part_15.scale.set(1.000, 1.000, 1.000);
  part_15.name = "roda_prin_dir_26";
  modelGroup.add(part_15);

  modelGroup.rotation.order = 'YXZ';
  modelGroup.userData.helice = helice;
  return modelGroup;
}
