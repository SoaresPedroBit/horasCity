import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { ConstrutorCidade } from './construtor.js';
import { TooltipCidade } from './tooltip.js';

export const LIMITES_MAPA = { RAIO: 230, ALTURA: 130 };

export class CenaCidade {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1020);
    this.scene.fog = new THREE.Fog(0x0b1020, 120, 420);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.controls = new MapControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 300;

    this.construtor = new ConstrutorCidade(this.renderer);
    this.tooltip = new TooltipCidade('tooltip');

    this.grupoPredios = null;
    this.grupoRuas = null;
    this.prediosPorId = new Map();
    this.colisores = [];
    this.outdoors = [];
    this.vooCamera = null;
    this.totalParticipantes = 0;

    this._montarCenario();
    this._escutarRedimensionamento();
  }

  _montarCenario() {
    this.scene.add(new THREE.HemisphereLight(0x8899cc, 0x223344, 1.1));
    const sol = new THREE.DirectionalLight(0xfff2d8, 1.4);
    sol.position.set(80, 120, 40);
    this.scene.add(sol);

    const chao = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshLambertMaterial({ color: 0x141a26 })
    );
    chao.rotation.x = -Math.PI / 2;
    chao.position.y = -0.05;
    this.scene.add(chao);

    const parede = new THREE.Mesh(
      new THREE.CylinderGeometry(LIMITES_MAPA.RAIO, LIMITES_MAPA.RAIO, LIMITES_MAPA.ALTURA, 72, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5ad0e0, transparent: true, opacity: 0.06, side: THREE.BackSide, depthWrite: false })
    );
    parede.position.y = LIMITES_MAPA.ALTURA / 2;

    const anel = new THREE.Mesh(
      new THREE.RingGeometry(LIMITES_MAPA.RAIO - 2, LIMITES_MAPA.RAIO, 72),
      new THREE.MeshBasicMaterial({ color: 0x5ad0e0, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    anel.rotation.x = -Math.PI / 2;
    anel.position.y = 0.2;

    this.scene.add(parede, anel);
  }

  construir(participantes) {
    this.totalParticipantes = participantes.length;
    if (this.grupoPredios) this.scene.remove(this.grupoPredios);
    if (this.grupoRuas) this.scene.remove(this.grupoRuas);
    this.outdoors.forEach(o => o.userData.textura.dispose());

    const res = this.construtor.gerarMalhas(participantes);
    this.grupoPredios = res.grupoPredios;
    this.grupoRuas = res.grupoRuas;
    this.prediosPorId = res.prediosPorId;
    this.colisores = res.colisores;
    this.outdoors = res.outdoors;

    this.scene.add(this.grupoPredios, this.grupoRuas);
  }

  posicaoGeral() {
    const anel = Math.max(2, Math.ceil(Math.sqrt(Math.max(this.totalParticipantes, 1)) / 2));
    const dist = Math.max(60, anel * 24 + 40);
    return {
      camera: new THREE.Vector3(dist * 0.85, dist * 0.75, dist * 0.85),
      alvo: new THREE.Vector3(0, 0, 0),
    };
  }

  irParaVisaoGeral() {
    const g = this.posicaoGeral();
    this.vooCamera = {
      origemCam: this.camera.position.clone(),
      origemAlvo: this.controls.target.clone(),
      alvoCam: g.camera,
      alvoCtrl: g.alvo,
      t: 0,
    };
  }

  focarNoPredio(id) {
    const predio = this.prediosPorId.get(id);
    if (!predio) return;
    const p = predio.position;
    this.vooCamera = {
      origemCam: this.camera.position.clone(),
      origemAlvo: this.controls.target.clone(),
      alvoCam: new THREE.Vector3(p.x + 28, p.y + 24, p.z + 28),
      alvoCtrl: new THREE.Vector3(p.x, p.y, p.z),
      t: 0,
    };
  }

  atualizarCameraOrbital() {
    if (this.vooCamera) {
      this.vooCamera.t = Math.min(1, this.vooCamera.t + 0.02);
      const e = 1 - Math.pow(1 - this.vooCamera.t, 3);
      this.camera.position.lerpVectors(this.vooCamera.origemCam, this.vooCamera.alvoCam, e);
      this.controls.target.lerpVectors(this.vooCamera.origemAlvo, this.vooCamera.alvoCtrl, e);
      if (this.vooCamera.t >= 1) this.vooCamera = null;
    }
    this.controls.update();

    const raioAlvo = Math.hypot(this.controls.target.x, this.controls.target.z);
    if (raioAlvo > LIMITES_MAPA.RAIO) {
      const fator = LIMITES_MAPA.RAIO / raioAlvo;
      this.controls.target.x *= fator;
      this.controls.target.z *= fator;
    }

    if (this.grupoPredios) this.tooltip.atualizar(this.camera, this.grupoPredios);
  }

  orientarOutdoors() {
    for (const o of this.outdoors) {
      o.rotation.y = Math.atan2(this.camera.position.x - o.position.x, this.camera.position.z - o.position.z);
    }
  }

  _escutarRedimensionamento() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
}