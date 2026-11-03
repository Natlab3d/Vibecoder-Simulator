import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface InteractiveTarget {
  id: 'desk' | 'coffee' | 'fridge' | 'window' | 'sofa' | 'bed' | 'door';
  name: string;
  actionText: string;
  position: THREE.Vector3;
  distance: number;
}

export interface WorldView {
  hour: number;
  online: boolean;
  headline: string;
  detail: string;
  progress: number | null;
  gear: string[];
}

const SEAT = new THREE.Vector3(0, 1.35, -2.05);

export class WorldScene {
  private container: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private frameId: number = 0;
  private isSoftwareGl: boolean = false;
  private cleanups: (() => void)[] = [];

  // Player / 1st Person State
  public playerPos = new THREE.Vector3(0, 1.65, 1.2);
  public playerYaw = 0;
  public playerPitch = 0;
  private moveSpeed = 4.0;
  private keysHeld: Record<string, boolean> = {};

  private monitorCtx!: CanvasRenderingContext2D;
  private monitorTexture!: THREE.CanvasTexture;
  private monitorKey = '';
  private routerLedMesh!: THREE.Mesh;
  private coffeeSteamParticles!: THREE.Points;
  private secondMonitor!: THREE.Group;
  private ergoChair!: THREE.Group;
  private plainChair!: THREE.Group;
  private workstationTower!: THREE.Group;
  private espressoUpgrade!: THREE.Group;
  private coffeeBodyMat!: THREE.MeshStandardMaterial;
  private memoryFoamUpgrade!: THREE.Group;

  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private skylineMat!: THREE.MeshBasicMaterial;
  private skylineCanvas!: HTMLCanvasElement;
  private skylineCtx!: CanvasRenderingContext2D;
  private skylineTexture!: THREE.CanvasTexture;
  private lastSkylinePeriod: string = '';

  // When focused the player sits at the desk and the laptop UI opens
  public isFocused: boolean = false;
  public canMove: boolean = true;

  // Raycasting / Proximity
  public nearestTarget: InteractiveTarget | null = null;
  private targets: { id: InteractiveTarget['id']; name: string; actionText: string; position: THREE.Vector3 }[] = [
    { id: 'desk', name: 'Your Desk', actionText: 'Sit Down and Work', position: new THREE.Vector3(0, 1.0, -3.2) },
    { id: 'coffee', name: 'Coffee Corner', actionText: 'Make Coffee', position: new THREE.Vector3(3.7, 1.0, -2.85) },
    { id: 'fridge', name: 'Kitchen', actionText: 'Cook and Eat', position: new THREE.Vector3(3.8, 1.0, -4.0) },
    { id: 'window', name: 'City View', actionText: 'Take a Break', position: new THREE.Vector3(0, 1.5, 4.0) },
    { id: 'sofa', name: 'Sofa', actionText: 'Take a Nap', position: new THREE.Vector3(-2.4, 0.8, 2.2) },
    { id: 'bed', name: 'Bed', actionText: 'Go to Sleep', position: new THREE.Vector3(-3.3, 0.8, -3.0) },
    { id: 'door', name: 'Front Door', actionText: 'Take a Day Off', position: new THREE.Vector3(-4.1, 1.0, -0.2) },
  ];

  // Callbacks
  private onInteractCallback?: (targetId: InteractiveTarget['id']) => void;
  private onToggleFocusCallback?: () => void;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.detectSoftwareGl();
    this.initThree();
    this.setupLightingAndEnvironment();
    this.buildApartmentWorld();
    this.scene.add(this.camera);
    this.setupInputHandlers();
    this.startLoop();
  }

  private detectSoftwareGl() {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) {
        this.isSoftwareGl = true;
        return;
      }
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      this.isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      this.isSoftwareGl = true;
    }
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f111a);
    this.scene.fog = new THREE.FogExp2(0x0f111a, 0.045);

    const w = Math.max(1, this.container.clientWidth || 800);
    const h = Math.max(1, this.container.clientHeight || 700);
    const aspect = w / h;
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.05, 100);
    this.camera.position.copy(this.playerPos);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  private setupLightingAndEnvironment() {
    // Studio Environment map using PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTexture;
    pmremGenerator.dispose();

    // Warm Key Light from Desk Lamp & Window
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    keyLight.position.set(-2, 4, -2);
    keyLight.castShadow = !this.isSoftwareGl;
    if (keyLight.shadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.keyLight = keyLight;
    this.scene.add(keyLight);

    // Cool Sky & Ground Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0x3a6073, 0x16222f, 0.9);
    hemiLight.position.set(0, 5, 0);
    this.hemiLight = hemiLight;
    this.scene.add(hemiLight);

    // Warm Interior Accent lights
    const deskSpot = new THREE.PointLight(0xffaa55, 1.8, 6);
    deskSpot.position.set(0, 2.2, -3.2);
    this.scene.add(deskSpot);

    const neonWindowLight = new THREE.PointLight(0x00d2ff, 1.5, 9);
    neonWindowLight.position.set(0, 2.5, 4.2);
    this.scene.add(neonWindowLight);
  }

  // --- Procedural Textures ---
  private createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Rich dark walnut herringbone pattern
    ctx.fillStyle = '#221a16';
    ctx.fillRect(0, 0, 512, 512);

    const plankH = 32;
    const plankW = 128;
    for (let y = 0; y < 512; y += plankH) {
      for (let x = 0; x < 512; x += plankW) {
        const offset = (Math.floor(y / plankH) % 2) * (plankW / 2);
        const px = (x + offset) % 512;
        const shade = Math.floor(35 + (Math.sin(px * 12 + y * 7) * 8));
        ctx.fillStyle = `rgb(${shade + 8}, ${shade + 2}, ${shade - 5})`;
        ctx.fillRect(px, y, plankW - 2, plankH - 2);

        // Wood grain
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let g = 0; g < 4; g++) {
          ctx.fillRect(px + g * 30, y, 1, plankH - 2);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  private renderCitySkyline(hour: number) {
    const ctx = this.skylineCtx;
    ctx.clearRect(0, 0, 1024, 512);
    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    const isNight = hour < 5 || hour >= 21;
    const isDawn = hour >= 5 && hour < 9;
    const isDay = hour >= 9 && hour < 17;
    const isSunset = hour >= 17 && hour < 21;

    if (isNight) {
      grad.addColorStop(0, '#02040a');
      grad.addColorStop(0.5, '#080d1a');
      grad.addColorStop(0.85, '#0f172a');
      grad.addColorStop(1, '#1e293b');
    } else if (isDawn) {
      grad.addColorStop(0, '#110c28');
      grad.addColorStop(0.4, '#3b0764');
      grad.addColorStop(0.7, '#be185d');
      grad.addColorStop(0.9, '#f97316');
      grad.addColorStop(1, '#fde047');
    } else if (isSunset) {
      grad.addColorStop(0, '#1e1035');
      grad.addColorStop(0.4, '#6b21a8');
      grad.addColorStop(0.7, '#c026d3');
      grad.addColorStop(0.85, '#ea580c');
      grad.addColorStop(1, '#facc15');
    } else {
      // Crisp daylight
      grad.addColorStop(0, '#1e40af');
      grad.addColorStop(0.4, '#3b82f6');
      grad.addColorStop(0.75, '#60a5fa');
      grad.addColorStop(1, '#bfdbfe');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Celestial bodies
    if (isNight) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(820, 90, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#080d1a';
      ctx.beginPath();
      ctx.arc(828, 86, 19, 0, Math.PI * 2);
      ctx.fill();
    } else if (isDay) {
      const sunGrad = ctx.createRadialGradient(720, 100, 10, 720, 100, 60);
      sunGrad.addColorStop(0, 'rgba(255, 255, 240, 1)');
      sunGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.4)');
      sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(720, 100, 60, 0, Math.PI * 2);
      ctx.fill();
    } else if (isSunset || isDawn) {
      const sunGrad = ctx.createRadialGradient(680, 260, 10, 680, 260, 70);
      sunGrad.addColorStop(0, 'rgba(255, 237, 213, 0.9)');
      sunGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.35)');
      sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(680, 260, 70, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant buildings & skyscrapers
    const buildingCount = 42;
    for (let i = 0; i < buildingCount; i++) {
      const x = i * 25 - 20;
      const w = 20 + Math.sin(i * 3) * 12;
      const h = 180 + Math.cos(i * 5) * 140;
      const y = 512 - h;

      ctx.fillStyle = isDay ? '#1e293b' : '#0a0d1a';
      ctx.fillRect(x, y, w, h);

      // Skyscraper antenna lights
      if (!isDay) {
        ctx.fillStyle = i % 3 === 0 ? '#ff3366' : '#00ffff';
        ctx.fillRect(x + w / 2 - 1, y - 10, 2, 10);
        ctx.beginPath();
        ctx.arc(x + w / 2, y - 10, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Windows
      if (isNight || isSunset || isDawn) {
        const alpha = isNight ? 0.85 : 0.45;
        ctx.fillStyle = i % 2 === 0 ? `rgba(254, 240, 138, ${alpha})` : `rgba(186, 230, 253, ${alpha})`;
        for (let wy = y + 15; wy < 512 - 20; wy += 14) {
          for (let wx = x + 3; wx < x + w - 4; wx += 6) {
            if (Math.sin(wx * 3 + wy * 7) > 0.15) {
              ctx.fillRect(wx, wy, 3, 5);
            }
          }
        }
      }
    }
  }

  private createCitySkylineTexture(): THREE.CanvasTexture {
    this.skylineCanvas = document.createElement('canvas');
    this.skylineCanvas.width = 1024;
    this.skylineCanvas.height = 512;
    this.skylineCtx = this.skylineCanvas.getContext('2d')!;
    this.renderCitySkyline(9);

    this.skylineTexture = new THREE.CanvasTexture(this.skylineCanvas);
    this.skylineTexture.colorSpace = THREE.SRGBColorSpace;
    return this.skylineTexture;
  }

  private buildApartmentWorld() {
    const roomW = 9.0;
    const roomD = 9.0;
    const roomH = 3.6;

    // --- 1. Floor ---
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createWoodFloorTexture(),
      roughness: 0.35,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    // --- 2. Ceiling ---
    const ceilingGeo = new THREE.PlaneGeometry(roomW, roomD);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x181a24,
      roughness: 0.8,
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomH;
    this.scene.add(ceiling);

    // --- 3. Walls ---
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e2230,
      roughness: 0.6,
      metalness: 0.05,
    });

    // North Wall (Desk Wall)
    const northWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
    northWall.position.set(0, roomH / 2, -roomD / 2);
    northWall.receiveShadow = !this.isSoftwareGl;
    this.scene.add(northWall);

    // West Wall
    const westWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
    westWall.rotation.y = Math.PI / 2;
    westWall.position.set(-roomW / 2, roomH / 2, 0);
    westWall.receiveShadow = !this.isSoftwareGl;
    this.scene.add(westWall);

    // East Wall
    const eastWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
    eastWall.rotation.y = -Math.PI / 2;
    eastWall.position.set(roomW / 2, roomH / 2, 0);
    eastWall.receiveShadow = !this.isSoftwareGl;
    this.scene.add(eastWall);

    // South Wall: Huge Panoramic Window overlooking City Skyline
    this.buildPanoramicWindow(roomW, roomH, roomD);

    // --- 4. Furniture & Stations ---
    this.buildDeveloperDesk();
    this.buildCoffeeStation();
    this.buildFridge();
    this.buildWifiStation();
    this.buildCozyCorner();
    this.buildBed();
    this.buildChairs();
    this.buildPosters();
    this.buildFrontDoor();
    this.buildIndoorPlant();
  }

  private buildPanoramicWindow(roomW: number, roomH: number, roomD: number) {
    const windowGroup = new THREE.Group();

    // Window frame border
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111319, roughness: 0.3, metalness: 0.8 });
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.2, 0.2), frameMat);
    topBar.position.set(0, roomH - 0.1, roomD / 2);
    windowGroup.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.3, 0.3), frameMat);
    bottomBar.position.set(0, 0.15, roomD / 2);
    windowGroup.add(bottomBar);

    // Vertical Mullions
    for (let x = -3; x <= 3; x += 2) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.1, roomH, 0.15), frameMat);
      mullion.position.set(x, roomH / 2, roomD / 2);
      windowGroup.add(mullion);
    }

    // Glass with slight reflection and transparency
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x99ccff,
      roughness: 0.05,
      metalness: 0.1,
      transmission: this.isSoftwareGl ? 0 : 0.85,
      transparent: true,
      opacity: this.isSoftwareGl ? 0.35 : 0.7,
      ior: 1.5,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(roomW - 0.2, roomH - 0.4), glassMat);
    glass.rotation.y = Math.PI;
    glass.position.set(0, roomH / 2, roomD / 2 - 0.02);
    windowGroup.add(glass);

    // Backdrop City Skyline Plane outside the window
    this.skylineMat = new THREE.MeshBasicMaterial({
      map: this.createCitySkylineTexture(),
      fog: false,
    });
    const skyline = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), this.skylineMat);
    skyline.rotation.y = Math.PI;
    skyline.position.set(0, 4.5, roomD / 2 + 3.5);
    windowGroup.add(skyline);

    this.scene.add(windowGroup);
  }

  private buildDeveloperDesk() {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(0, 0, -3.4);

    // Desk Top (Dark solid wood)
    const topMat = new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.4, metalness: 0.1 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.0), topMat);
    top.position.y = 0.75;
    top.castShadow = !this.isSoftwareGl;
    top.receiveShadow = !this.isSoftwareGl;
    deskGroup.add(top);

    // Metal chamfered legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.3, metalness: 0.8 });
    const legPositions = [
      [-1.1, 0.375, -0.4],
      [1.1, 0.375, -0.4],
      [-1.1, 0.375, 0.4],
      [1.1, 0.375, 0.4],
    ];
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), legMat);
      leg.position.set(x, y, z);
      leg.castShadow = !this.isSoftwareGl;
      deskGroup.add(leg);
    });

    // Dual External Ultrawide Monitors
    const monitorArmMat = new THREE.MeshStandardMaterial({ color: 0x181a20, metalness: 0.85, roughness: 0.2 });
    const monitorArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), monitorArmMat);
    monitorArm.position.set(0, 1.0, -0.35);
    deskGroup.add(monitorArm);

    // Main Curved Ultrawide Display
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.3, metalness: 0.7 });
    const monitorBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.04), bezelMat);
    monitorBody.position.set(0, 1.25, -0.3);
    deskGroup.add(monitorBody);

    // Live desk screen: shows what your agent is doing right now
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 768;
    screenCanvas.height = 310;
    this.monitorCtx = screenCanvas.getContext('2d')!;
    this.monitorTexture = new THREE.CanvasTexture(screenCanvas);
    this.monitorTexture.colorSpace = THREE.SRGBColorSpace;
    this.monitorTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.26, 0.51),
      new THREE.MeshBasicMaterial({ map: this.monitorTexture })
    );
    screenMesh.position.set(0, 1.25, -0.27);
    deskGroup.add(screenMesh);

    // Second monitor, appears when you buy it
    this.secondMonitor = new THREE.Group();
    const secondBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.03), bezelMat);
    this.secondMonitor.add(secondBody);
    const secondScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.38),
      new THREE.MeshBasicMaterial({ color: 0x0f2a3d })
    );
    secondScreen.position.z = 0.017;
    this.secondMonitor.add(secondScreen);
    this.secondMonitor.position.set(1.0, 1.2, -0.22);
    this.secondMonitor.rotation.y = -0.35;
    this.secondMonitor.visible = false;
    deskGroup.add(this.secondMonitor);

    // Ergonomic Mechanical Keyboard on Desk Pad
    const padMat = new THREE.MeshStandardMaterial({ color: 0x131722, roughness: 0.8 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.01, 0.45), padMat);
    pad.position.set(0, 0.795, 0.05);
    deskGroup.add(pad);

    const deskKb = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.02, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x2c3140, roughness: 0.4 })
    );
    deskKb.position.set(-0.15, 0.81, 0.05);
    deskGroup.add(deskKb);

    // RGB Desk Lamp with Warm Glow
    const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), monitorArmMat);
    lampArm.position.set(-1.0, 1.0, -0.2);
    lampArm.rotation.z = 0.25;
    deskGroup.add(lampArm);

    const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.08), bezelMat);
    lampHead.position.set(-0.85, 1.25, -0.2);
    deskGroup.add(lampHead);

    // Silicon Pro Workstation tower (visible when 'workstation' gear is owned)
    this.workstationTower = new THREE.Group();
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.88, roughness: 0.22 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.42), chassisMat);
    chassis.position.set(-0.95, 1.01, 0.14);
    chassis.castShadow = !this.isSoftwareGl;
    this.workstationTower.add(chassis);
    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.34, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    ledStrip.position.set(-0.89, 1.01, 0.352);
    this.workstationTower.add(ledStrip);
    this.workstationTower.visible = false;
    deskGroup.add(this.workstationTower);

    this.scene.add(deskGroup);
  }

  private buildCoffeeStation() {
    const coffeeGroup = new THREE.Group();
    coffeeGroup.position.set(4.0, 0, -2.85);

    // Cabinet Table
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x2a221b, roughness: 0.5 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.4), cabMat);
    cab.position.y = 0.45;
    cab.castShadow = !this.isSoftwareGl;
    cab.receiveShadow = !this.isSoftwareGl;
    coffeeGroup.add(cab);

    // --- Microwave (At z = -0.35, right next to the kitchen fridge at z = -4.0) ---
    const microwaveGroup = new THREE.Group();
    microwaveGroup.position.set(0, 0.9, -0.35);
    microwaveGroup.rotation.y = -Math.PI / 2; // Faces into room (-X)

    const microMat = new THREE.MeshStandardMaterial({ color: 0x181a22, roughness: 0.35, metalness: 0.7 });
    const microBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.36), microMat);
    microBody.position.y = 0.15;
    microBody.castShadow = !this.isSoftwareGl;
    microwaveGroup.add(microBody);

    // Tinted Door Window
    const microGlassMat = new THREE.MeshStandardMaterial({ color: 0x111625, roughness: 0.1, metalness: 0.9 });
    const microGlass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.01), microGlassMat);
    microGlass.position.set(-0.06, 0.15, 0.185);
    microwaveGroup.add(microGlass);

    // Control panel with green digital clock
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0f1117, roughness: 0.4 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.01), panelMat);
    panel.position.set(0.14, 0.15, 0.185);
    microwaveGroup.add(panel);

    const clockDisplay = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.025, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    clockDisplay.position.set(0.14, 0.21, 0.188);
    microwaveGroup.add(clockDisplay);

    // Chrome handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.14, 0.02), handleMat);
    handle.position.set(0.07, 0.15, 0.195);
    microwaveGroup.add(handle);

    coffeeGroup.add(microwaveGroup);

    // --- Coffee Machine (At z = +0.32, turned 90 deg facing into room) ---
    const espressoGroup = new THREE.Group();
    espressoGroup.position.set(0, 0.9, 0.32);
    espressoGroup.rotation.y = -Math.PI / 2; // Faces into room (-X)

    this.coffeeBodyMat = new THREE.MeshStandardMaterial({ color: 0x3b404e, metalness: 0.45, roughness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dbe2, metalness: 0.95, roughness: 0.12 });
    const coffeeBody = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.35), this.coffeeBodyMat);
    coffeeBody.position.y = 0.2;
    coffeeBody.castShadow = !this.isSoftwareGl;
    espressoGroup.add(coffeeBody);

    const groupHead = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), chromeMat);
    groupHead.position.set(0, 0.14, 0.21);
    espressoGroup.add(groupHead);

    const portafilterHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), cabMat);
    portafilterHandle.rotation.x = Math.PI / 2;
    portafilterHandle.position.set(0, 0.12, 0.30);
    espressoGroup.add(portafilterHandle);

    // Pro Espresso Machine upgrade details (visible when 'espresso' gear is owned)
    this.espressoUpgrade = new THREE.Group();
    const gauge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.02, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0, 0.3, 0.18);
    this.espressoUpgrade.add(gauge);
    const hopper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.06, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.2 })
    );
    hopper.position.set(0, 0.46, 0);
    this.espressoUpgrade.add(hopper);
    this.espressoUpgrade.visible = false;
    espressoGroup.add(this.espressoUpgrade);

    const cupMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.06, 12), cupMat);
    cup.position.set(0, 0.04, 0.21);
    espressoGroup.add(cup);

    // Coffee Steam Particles
    const particleCount = 18;
    const pGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      posArr[i * 3] = (Math.random() - 0.5) * 0.05;
      posArr[i * 3 + 1] = 0.08 + Math.random() * 0.20;
      posArr[i * 3 + 2] = 0.22 + (Math.random() - 0.5) * 0.04;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.045,
      transparent: true,
      opacity: 0.65,
    });
    this.coffeeSteamParticles = new THREE.Points(pGeo, pMat);
    espressoGroup.add(this.coffeeSteamParticles);

    coffeeGroup.add(espressoGroup);
    this.scene.add(coffeeGroup);
  }

  private buildWifiStation() {
    const wifiGroup = new THREE.Group();
    // Position near east wall, rotated 90 degrees so it sticks out gracefully into the room
    wifiGroup.position.set(4.25, 1.25, 2.2);
    wifiGroup.rotation.y = Math.PI / 2;

    // Wall Floating Shelf
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.3, metalness: 0.7 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.42), shelfMat);
    shelf.castShadow = !this.isSoftwareGl;
    wifiGroup.add(shelf);

    // High-Tech Router Body
    const routerBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f1118, roughness: 0.4, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.22), routerBodyMat);
    body.position.y = 0.05;
    wifiGroup.add(body);

    // 4 Angled Antennas
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, metalness: 0.8, roughness: 0.3 });
    const antOffsets = [
      [-0.14, -0.09, -0.2],
      [-0.05, -0.09, -0.1],
      [0.05, -0.09, 0.1],
      [0.14, -0.09, 0.2],
    ];
    antOffsets.forEach(([x, z, rotZ]) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.25, 8), antennaMat);
      ant.position.set(x, 0.18, z);
      ant.rotation.z = rotZ;
      wifiGroup.add(ant);
    });

    // Glowing Status LED on Router
    this.routerLedMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    this.routerLedMesh.position.set(0, 0.085, 0.1);
    wifiGroup.add(this.routerLedMesh);

    this.scene.add(wifiGroup);
  }


  private buildCozyCorner() {
    const cornerGroup = new THREE.Group();
    cornerGroup.position.set(-2.4, 0, 2.2);

    // Modern Freelancer Lounge Sofa
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0x223048, roughness: 0.85 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.8), fabricMat);
    seat.position.y = 0.25;
    seat.castShadow = !this.isSoftwareGl;
    cornerGroup.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.2), fabricMat);
    backrest.position.set(0, 0.55, -0.32);
    backrest.castShadow = !this.isSoftwareGl;
    cornerGroup.add(backrest);

    // Floor Area Rug
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x161b26, roughness: 0.95 });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, 0.4);
    rug.receiveShadow = !this.isSoftwareGl;
    cornerGroup.add(rug);

    this.scene.add(cornerGroup);
  }

  private buildFridge() {
    const group = new THREE.Group();
    group.position.set(4.0, 0, -4.0);
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.75, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.8), steel);
    body.position.y = 0.95;
    body.castShadow = !this.isSoftwareGl;
    group.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0x20242c, metalness: 0.8 }));
    handle.position.set(-0.42, 1.2, 0.28);
    group.add(handle);
    this.scene.add(group);
  }

  private buildBed() {
    const group = new THREE.Group();
    group.position.set(-3.55, 0, -3.35);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a221b, roughness: 0.6 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 2.2), frameMat);
    frame.position.y = 0.15;
    frame.castShadow = !this.isSoftwareGl;
    group.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 2.1), new THREE.MeshStandardMaterial({ color: 0xd8d9df, roughness: 0.9 }));
    mattress.position.y = 0.42;
    group.add(mattress);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 1.3), new THREE.MeshStandardMaterial({ color: 0x2f4a6b, roughness: 0.95 }));
    blanket.position.set(0, 0.56, 0.38);
    group.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: 0xf0f0f4, roughness: 0.9 }));
    pillow.position.set(0, 0.6, -0.76);
    group.add(pillow);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.08), frameMat);
    head.position.set(0, 0.5, -1.1);
    group.add(head);

    // Memory Foam Mattress upgrade (visible when 'mattress' gear is owned)
    this.memoryFoamUpgrade = new THREE.Group();
    const topper = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.09, 2.12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 })
    );
    topper.position.set(0, 0.56, 0);
    this.memoryFoamUpgrade.add(topper);
    const luxDuvet = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.12, 1.32),
      new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.85 })
    );
    luxDuvet.position.set(0, 0.63, 0.38);
    this.memoryFoamUpgrade.add(luxDuvet);
    const bolster = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.16, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 })
    );
    bolster.position.set(0, 0.68, -0.45);
    this.memoryFoamUpgrade.add(bolster);
    this.memoryFoamUpgrade.visible = false;
    group.add(this.memoryFoamUpgrade);
    this.scene.add(group);
  }

  private buildChairs() {
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x20242e, roughness: 0.7 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.7, roughness: 0.3 });
    const make = (back: number, width: number, color: THREE.MeshStandardMaterial) => {
      const group = new THREE.Group();
      group.position.set(0, 0, -2.05);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, width), color);
      seat.position.y = 0.5;
      group.add(seat);
      const rest = new THREE.Mesh(new THREE.BoxGeometry(width, back, 0.07), color);
      rest.position.set(0, 0.54 + back / 2, width / 2);
      group.add(rest);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 8), legMat);
      pole.position.y = 0.25;
      group.add(pole);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12), legMat);
      base.position.y = 0.03;
      group.add(base);
      this.scene.add(group);
      return group;
    };
    this.plainChair = make(0.4, 0.46, seatMat);
    this.ergoChair = make(0.82, 0.54, new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.55 }));
    this.ergoChair.visible = false;
  }

  private buildPosters() {
    const posterMat1 = new THREE.MeshBasicMaterial({
      map: this.createPosterTexture('ATTENTION IS ALL YOU NEED', '#6366f1', 'Vaswani et al. 2017 · Transformer Architecture'),
    });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), posterMat1);
    p1.rotation.y = Math.PI / 2;
    p1.position.set(-4.48, 2.2, 2.2);
    this.scene.add(p1);

    const posterMat2 = new THREE.MeshBasicMaterial({
      map: this.createPosterTexture('DON\'T OVERFIT', '#ec4899', 'Keep prompting, stay general, benchmark often.'),
    });
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), posterMat2);
    p2.position.set(2.4, 2.2, -4.48);
    this.scene.add(p2);
  }

  private buildFrontDoor() {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-4.46, 0, -0.2);
    doorGroup.rotation.y = Math.PI / 2;

    // Outer door frame (dark metallic trim)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x12151e, roughness: 0.35, metalness: 0.7 });
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.25, 0.08), frameMat);
    leftPost.position.set(-0.52, 1.125, 0);
    doorGroup.add(leftPost);

    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.25, 0.08), frameMat);
    rightPost.position.set(0.52, 1.125, 0);
    doorGroup.add(rightPost);

    const topLintel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 0.08), frameMat);
    topLintel.position.set(0, 2.21, 0);
    doorGroup.add(topLintel);

    // Solid apartment door slab (warm dark walnut / slate wood)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2c221c, roughness: 0.5, metalness: 0.1 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.16, 0.045), doorMat);
    slab.position.set(0, 1.08, 0);
    slab.castShadow = !this.isSoftwareGl;
    doorGroup.add(slab);

    // Subtle recessed architectural panels on the door
    const insetMat = new THREE.MeshStandardMaterial({ color: 0x221a15, roughness: 0.6 });
    const upperPanel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.052), insetMat);
    upperPanel.position.set(0, 1.52, 0);
    doorGroup.add(upperPanel);

    const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.052), insetMat);
    lowerPanel.position.set(0, 0.62, 0);
    doorGroup.add(lowerPanel);

    // Brushed chrome door handle + deadbolt thumbturn
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd4d8e0, metalness: 0.9, roughness: 0.2 });
    const escutcheon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.06), chromeMat);
    escutcheon.position.set(-0.36, 1.02, 0.01);
    doorGroup.add(escutcheon);

    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.025), chromeMat);
    lever.position.set(-0.32, 1.0, 0.045);
    doorGroup.add(lever);

    const peephole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12), chromeMat);
    peephole.rotation.x = Math.PI / 2;
    peephole.position.set(0, 1.55, 0.005);
    doorGroup.add(peephole);

    // Doormat on the floor inside the entrance
    const matGeo = new THREE.BoxGeometry(1.05, 0.012, 0.6);
    const matMat = new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.95 });
    const doormat = new THREE.Mesh(matGeo, matMat);
    doormat.position.set(0, 0.006, 0.36);
    doorGroup.add(doormat);

    this.scene.add(doorGroup);
  }

  private buildIndoorPlant() {
    const plantGroup = new THREE.Group();
    plantGroup.position.set(3.85, 0, 3.85);

    // Matte slate-terracotta planter pot
    const potMat = new THREE.MeshStandardMaterial({ color: 0x2b303c, roughness: 0.7, metalness: 0.1 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.42, 16), potMat);
    pot.position.y = 0.21;
    pot.castShadow = !this.isSoftwareGl;
    pot.receiveShadow = !this.isSoftwareGl;
    plantGroup.add(pot);

    // Soil rim
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 });
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), soilMat);
    soil.position.y = 0.415;
    plantGroup.add(soil);

    // Woody stems
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3b2d22, roughness: 0.8 });
    const stems: [number, number, number, number, number][] = [
      [0, 0.72, 0, 0.65, 0],
      [-0.05, 0.64, 0.04, 0.48, 0.18],
      [0.05, 0.66, -0.04, 0.52, -0.16],
    ];
    stems.forEach(([x, y, z, h, tilt]) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, h, 8), stemMat);
      s.position.set(x, y, z);
      s.rotation.z = tilt;
      plantGroup.add(s);
    });

    // Lush layered foliage clusters (Ficus / Monstera style)
    const leafDark = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.65 });
    const leafMid = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    const leafBright = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 });
    const clusters: [number, number, number, number, THREE.MeshStandardMaterial][] = [
      [0, 1.05, 0, 0.22, leafMid],
      [-0.14, 0.88, 0.1, 0.18, leafDark],
      [0.14, 0.92, -0.08, 0.19, leafDark],
      [-0.08, 1.18, -0.09, 0.16, leafBright],
      [0.11, 1.14, 0.11, 0.17, leafMid],
      [0, 0.76, 0.14, 0.15, leafDark],
      [0, 1.28, 0, 0.13, leafBright],
    ];
    clusters.forEach(([x, y, z, r, mat]) => {
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), mat);
      leaf.scale.set(1.15, 0.78, 1.15);
      leaf.position.set(x, y, z);
      leaf.castShadow = !this.isSoftwareGl;
      plantGroup.add(leaf);
    });

    this.scene.add(plantGroup);
  }

  private createPosterTexture(title: string, accentColor: string, subtitle: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 700;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f121d';
    ctx.fillRect(0, 0, 512, 700);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, 472, 660);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(title, 40, 110, 430);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText(subtitle, 40, 150, 430);

    // Futuristic diagram graphic
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(40, 220, 432, 380);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(256, 410, 50 + i * 35, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }



  // --- Input Handlers & First Person Navigation ---
  private setupInputHandlers() {
    const listen = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(type, fn);
      this.cleanups.push(() => window.removeEventListener(type, fn));
    };
    const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');

    listen('keydown', (e) => {
      if (typing()) return;
      this.keysHeld[e.code] = true;
      if (e.code === 'KeyE' && !e.repeat && !this.isFocused && this.canMove && this.nearestTarget && this.onInteractCallback) {
        this.onInteractCallback(this.nearestTarget.id);
      }
      if ((e.code === 'Tab' || e.code === 'Space') && !e.repeat && this.onToggleFocusCallback) {
        e.preventDefault();
        this.onToggleFocusCallback();
      }
    });
    listen('keyup', (e) => {
      this.keysHeld[e.code] = false;
    });
    listen('blur', () => {
      this.keysHeld = {};
    });

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onPointerDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('.interactive-ui')) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    this.container.addEventListener('mousedown', onPointerDown);
    this.cleanups.push(() => this.container.removeEventListener('mousedown', onPointerDown));

    listen('mousemove', (e) => {
      if (!isDragging || this.isFocused || !this.canMove) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      const sens = 0.0035;
      this.playerYaw -= dx * sens;
      this.playerPitch = Math.max(-1.2, Math.min(1.2, this.playerPitch - dy * sens));
    });
    listen('mouseup', () => {
      isDragging = false;
    });
    listen('resize', this.onWindowResize);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.onWindowResize());
      ro.observe(this.container);
      this.cleanups.push(() => ro.disconnect());
    }
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public setInteractCallback(cb: (targetId: InteractiveTarget['id']) => void) {
    this.onInteractCallback = cb;
  }

  public setToggleFocusCallback(cb: () => void) {
    this.onToggleFocusCallback = cb;
  }

  // --- Things in the room that react to the game ---
  public updateWorld(view: WorldView) {
    const ctx = this.monitorCtx;
    const percent = view.progress === null ? -1 : Math.round(view.progress * 100);
    const key = `${view.headline}|${view.detail}|${percent}|${view.online}`;
    if (key !== this.monitorKey) {
      this.monitorKey = key;
      ctx.fillStyle = '#0a0d16';
      ctx.fillRect(0, 0, 768, 310);
      if (view.online && !view.detail && view.progress === null) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '28px sans-serif';
        ctx.fillText(view.headline.slice(0, 48), 36, 160);
      } else {
        ctx.fillStyle = view.online ? '#10b981' : '#ef4444';
        ctx.font = 'bold 30px monospace';
        ctx.fillText(view.online ? 'AGENT CONSOLE // ONLINE' : 'AGENT CONSOLE // OFFLINE', 28, 54);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 30px monospace';
        ctx.fillText(view.headline.slice(0, 40), 28, 120);
        ctx.fillStyle = '#7dd3fc';
        ctx.font = '26px monospace';
        ctx.fillText(view.detail.slice(0, 46), 28, 166);
        if (view.progress !== null) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(28, 210, 712, 34);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(28, 210, 712 * view.progress, 34);
        }
      }
      this.monitorTexture.needsUpdate = true;
    }

    const led = this.routerLedMesh.material as THREE.MeshBasicMaterial;
    led.color.setHex(view.online ? 0x10b981 : 0xef4444);

    this.secondMonitor.visible = view.gear.includes('monitor');
    this.ergoChair.visible = view.gear.includes('chair');
    this.plainChair.visible = !this.ergoChair.visible;
    this.workstationTower.visible = view.gear.includes('workstation');
    const hasEspresso = view.gear.includes('espresso');
    this.espressoUpgrade.visible = hasEspresso;
    this.coffeeBodyMat.color.setHex(hasEspresso ? 0xd8dbe2 : 0x3b404e);
    this.coffeeBodyMat.metalness = hasEspresso ? 0.95 : 0.45;
    this.coffeeBodyMat.roughness = hasEspresso ? 0.12 : 0.4;
    this.memoryFoamUpgrade.visible = view.gear.includes('mattress');

    const period = view.hour < 5 || view.hour >= 21 ? 'night' : view.hour < 9 ? 'dawn' : view.hour < 17 ? 'day' : 'sunset';
    if (period !== this.lastSkylinePeriod) {
      this.lastSkylinePeriod = period;
      this.renderCitySkyline(view.hour);
      if (this.skylineTexture) this.skylineTexture.needsUpdate = true;
    }

    const day = Math.max(0, Math.sin(((view.hour - 6) / 13) * Math.PI));
    this.hemiLight.intensity = 0.55 + day * 0.9;
    this.keyLight.intensity = 0.8 + day * 0.9;
    this.skylineMat.color.setRGB(0.7 + day * 0.3, 0.7 + day * 0.3, 0.7 + day * 0.3);
  }

  // --- Main Simulation & Render Loop ---
  private startLoop() {
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamp dt to prevent tunneling

      this.updateSimulation(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number) {
    // 1. First-Person Movement (when not fully focused on typing)
    if (!this.isFocused && this.canMove) {
      const forward = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw)).normalize();

      const moveDir = new THREE.Vector3(0, 0, 0);
      if (this.keysHeld['KeyW'] || this.keysHeld['ArrowUp']) moveDir.add(forward);
      if (this.keysHeld['KeyS'] || this.keysHeld['ArrowDown']) moveDir.sub(forward);
      if (this.keysHeld['KeyA'] || this.keysHeld['ArrowLeft']) moveDir.sub(right);
      if (this.keysHeld['KeyD'] || this.keysHeld['ArrowRight']) moveDir.add(right);

      if (moveDir.lengthSq() > 0.001) {
        moveDir.normalize();
        const sprint = this.keysHeld['ShiftLeft'] || this.keysHeld['ShiftRight'] ? 1.6 : 1.0;
        this.playerPos.addScaledVector(moveDir, this.moveSpeed * sprint * dt);

        // Clamp player within apartment bounds
        this.playerPos.x = Math.max(-3.8, Math.min(3.8, this.playerPos.x));
        this.playerPos.z = Math.max(-3.8, Math.min(3.8, this.playerPos.z));
      }
    }

    // Sit down at the desk while the laptop is open
    if (this.isFocused) {
      this.playerPos.x = THREE.MathUtils.damp(this.playerPos.x, SEAT.x, 7, dt);
      this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, SEAT.y, 7, dt);
      this.playerPos.z = THREE.MathUtils.damp(this.playerPos.z, SEAT.z, 7, dt);
      this.playerYaw = THREE.MathUtils.damp(this.playerYaw, 0, 7, dt);
      this.playerPitch = THREE.MathUtils.damp(this.playerPitch, -0.05, 7, dt);
    } else {
      this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, 1.65, 7, dt);
    }

    this.camera.position.copy(this.playerPos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.playerYaw;
    this.camera.rotation.x = this.playerPitch;

    // 3. Coffee steam animation
    if (this.coffeeSteamParticles) {
      const pos = this.coffeeSteamParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * 0.08;
        if (y > 0.28) y = 0.08;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // 4. Interactive Target Detection (Nearest appliance / prop within 2.2m)
    let closest: InteractiveTarget | null = null;
    let minDist = 1.8;

    for (const t of this.targets) {
      const dist = this.playerPos.distanceTo(t.position);
      if (dist < minDist) {
        minDist = dist;
        closest = { ...t, distance: dist };
      }
    }
    this.nearestTarget = closest;
  }

  public dispose() {
    if (this.isSoftwareGl) {
      clearTimeout(this.frameId);
    } else {
      cancelAnimationFrame(this.frameId);
    }
    this.cleanups.forEach((fn) => fn());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
