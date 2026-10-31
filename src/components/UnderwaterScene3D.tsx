import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AppStep } from '../types';

interface UnderwaterScene3DProps {
  step: AppStep;
  progress: number; // 0 to 1 during STILLNESS step
  thoughtTriggerCount: number;
  reducedMotion: boolean;
  onDepthChange?: (depthMeters: number) => void;
}

export const UnderwaterScene3D: React.FC<UnderwaterScene3DProps> = ({
  step,
  progress,
  thoughtTriggerCount,
  reducedMotion,
  onDepthChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Mutable refs to pass props safely into the render loop without re-instantiating WebGL
  const stepRef = useRef<AppStep>(step);
  stepRef.current = step;
  const progressRef = useRef<number>(progress);
  progressRef.current = progress;
  const thoughtTriggerRef = useRef<number>(thoughtTriggerCount);
  thoughtTriggerRef.current = thoughtTriggerCount;
  const prevTriggerCountRef = useRef<number>(thoughtTriggerCount);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const onDepthChangeRef = useRef(onDepthChange);
  onDepthChangeRef.current = onDepthChange;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const fogColor = new THREE.Color(0x021124);
    scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.016);

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 900);
    // Observer starts submerged near the surface (Y = -12, Z = 16), tilted gently up toward the sun rays
    camera.position.set(0, -12, 16);
    camera.lookAt(0, -2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // 2. Realistic Multi-Strand Crepuscular Sun Rays (Natural Slender God Rays)
    // In real water, light doesn't enter as a stage spotlight cone.
    // Instead, waves split sunlight into dozens of slender, fluttering, intertwined ribbons and filaments.
    const rayGroup = new THREE.Group();
    const rayMeshes: THREE.Mesh[] = [];
    const rayMaterials: THREE.ShaderMaterial[] = [];

    // Ray cluster centers (natural bundles formed by primary wave facets)
    const clusterCenters = [
      { x: -3.5, z: -1.5, angleX: 0.12, angleZ: 0.08 },
      { x: 1.2, z: -3.0, angleX: 0.06, angleZ: -0.10 },
      { x: 4.0, z: 1.0, angleX: -0.09, angleZ: -0.07 },
      { x: -1.0, z: 3.5, angleX: -0.05, angleZ: 0.11 },
    ];

    const totalRays = 42; // Dozens of delicate, distinct strands
    for (let i = 0; i < totalRays; i++) {
      const cluster = clusterCenters[i % clusterCenters.length];
      const subOffsetRadius = Math.random() * 4.5 + 0.3;
      const subAngle = Math.random() * Math.PI * 2;
      const originX = cluster.x + Math.cos(subAngle) * subOffsetRadius;
      const originZ = cluster.z + Math.sin(subAngle) * subOffsetRadius;

      // Slender ribbon dimensions:
      // Narrow at top (0.2 ~ 0.6 units), expanding gently down into the water (2.2 ~ 5.5 units)
      const topWidth = 0.25 + Math.random() * 0.55;
      const bottomWidth = 2.4 + Math.random() * 3.8;
      const rayLength = 95 + Math.random() * 35; // Extends down to Y ~ -110

      // Create a vertical ribbon plane with subdivisions for organic waving
      const segsY = 28;
      const ribbonGeo = new THREE.PlaneGeometry(1, rayLength, 4, segsY);
      // Extend top to Y = +4.5 (above wave crests) so it pierces through the water surface with no cut-off
      ribbonGeo.translate(0, -rayLength / 2 + 4.5, 0);

      // Modify vertex X coordinates so it tapers naturally from topWidth to bottomWidth
      const posAttr = ribbonGeo.attributes.position;
      for (let v = 0; v < posAttr.count; v++) {
        const y = posAttr.getY(v);
        const t = Math.max(0, Math.min(1, (4.5 - y) / rayLength));
        const currentWidth = THREE.MathUtils.lerp(topWidth, bottomWidth, t);
        posAttr.setX(v, posAttr.getX(v) * currentWidth);
      }
      ribbonGeo.computeVertexNormals();

      const rayMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.22 },
          uOffset: { value: Math.random() * 20 },
          uFlickerSpeed: { value: 0.4 + Math.random() * 0.4 },
          uWidthScale: { value: 0.8 + Math.random() * 0.4 },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uOffset;
          uniform float uFlickerSpeed;
          varying vec2 vUv;
          varying float vY;
          varying float vDistX;
          void main() {
            vUv = uv;
            vY = position.y;
            vDistX = position.x;
            vec3 pos = position;

            // Organic wave sway: light rays flutter and bend gently with underwater currents
            float depthFactor = clamp(-pos.y * 0.015, 0.0, 1.2);
            float swayX = sin(uTime * uFlickerSpeed + uOffset + pos.y * 0.035) * depthFactor * 1.4;
            float swayZ = cos(uTime * (uFlickerSpeed * 0.85) + uOffset + pos.y * 0.028) * depthFactor * 1.1;
            pos.x += swayX;
            pos.z += swayZ;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uOpacity;
          uniform float uOffset;
          uniform float uFlickerSpeed;
          varying vec2 vUv;
          varying float vY;
          varying float vDistX;

          void main() {
            // 1. Soft transverse Gaussian-like falloff across ribbon width (no hard edges)
            float edgeDist = abs(vUv.x - 0.5) * 2.0; // 0 at center, 1 at edge
            float crossFade = pow(clamp(1.0 - edgeDist, 0.0, 1.0), 1.8);

            // 2. Smooth vertical entrance at the water surface (ELIMINATES ANY CUT-OFF AT THE TOP)
            // Rays feather in smoothly from 0.0 at Y = +4.2 to 1.0 at Y = +0.5
            float topFade = smoothstep(4.2, 0.5, vY);

            // 3. Fine caustic filament striations inside the ray (splitting into multiple strands)
            float striation = sin(vUv.x * 18.0 + uOffset + sin(vY * 0.15 + uTime * 0.7)) * 0.25 + 0.75;
            float microFlicker = sin(uTime * 1.2 + uOffset * 3.0 + vY * 0.08) * 0.15 + 0.85;

            // 4. Beer-Lambert water extinction with depth:
            float depthExtinction = clamp(1.0 - (-vY / 115.0), 0.0, 1.0);
            depthExtinction = pow(depthExtinction, 1.6);

            // Ocean color gradient: pale sunlit turquoise/cyan near surface to serene deep azure
            vec3 shallowColor = vec3(0.72, 0.92, 1.0);
            vec3 deepColor = vec3(0.25, 0.65, 0.95);
            vec3 rayColor = mix(deepColor, shallowColor, depthExtinction);

            float alpha = uOpacity * crossFade * topFade * striation * microFlicker * depthExtinction;
            gl_FragColor = vec4(rayColor, alpha);
          }
        `,
      });

      const rayMesh = new THREE.Mesh(ribbonGeo, rayMat);
      rayMesh.position.set(originX, 0, originZ);

      // Natural radiating tilt: rays angle outwards from the sun epicenter
      const tiltX = cluster.angleX + (Math.random() - 0.5) * 0.08;
      const tiltZ = cluster.angleZ + (Math.random() - 0.5) * 0.08;
      const twistY = Math.random() * Math.PI * 2;
      rayMesh.rotation.set(tiltX, twistY, tiltZ);

      rayGroup.add(rayMesh);
      rayMeshes.push(rayMesh);
      rayMaterials.push(rayMat);
    }
    scene.add(rayGroup);

    // 3. Physical Undulating Ocean Surface (Looking up from below water)
    // Dense subdivided grid to render real rolling ocean swells, wave crests, and fluid refractions
    const surfaceSize = 360;
    const surfaceGeo = new THREE.PlaneGeometry(surfaceSize, surfaceSize, 96, 96);
    surfaceGeo.rotateX(Math.PI / 2); // Lay horizontal at Y = 0

    const surfaceMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.88 },
        uCameraPos: { value: new THREE.Vector3(0, -12, 16) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float dist = length(pos.xz);

          // 3-Harmonic physical ocean swell waves
          // Wave 1: broad oceanic rolling swell
          float k1 = 0.052;
          float w1 = uTime * 0.52;
          float phase1 = pos.x * k1 * 0.85 + pos.z * k1 * 0.55 + w1;

          // Wave 2: transverse wind chop
          float k2 = 0.12;
          float w2 = uTime * 0.72;
          float phase2 = -pos.x * k2 * 0.55 + pos.z * k2 * 0.85 + w2;

          // Wave 3: capillary liquid ripple
          float k3 = 0.26;
          float w3 = uTime * 1.05;
          float phase3 = pos.x * k3 * 0.9 - pos.z * k3 * 0.45 + w3;

          // Dynamic wave height
          float h1 = sin(phase1) * 1.35;
          float h2 = sin(phase2) * 0.65;
          float h3 = sin(phase3) * 0.35;
          pos.y += h1 + h2 + h3;

          // Subtle ocean horizon downward curvature
          pos.y -= pow(dist * 0.011, 2.0) * 1.5;

          // Analytical normal computation of the wave slopes
          float dYdx = cos(phase1) * 1.35 * k1 * 0.85 - cos(phase2) * 0.65 * k2 * 0.55 + cos(phase3) * 0.35 * k3 * 0.9;
          float dYdz = cos(phase1) * 1.35 * k1 * 0.55 + cos(phase2) * 0.65 * k2 * 0.85 - cos(phase3) * 0.35 * k3 * 0.45;
          vWaveNormal = normalize(vec3(-dYdx, -1.0, -dYdz));

          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uCameraPos;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;

        void main() {
          float distFromCenter = length(vWorldPos.xz);

          // Snell's Window: Optical circle through the undulating surface (fades to 0 at perimeter)
          float snellWindow = smoothstep(230.0, 35.0, distFromCenter);

          vec3 viewDir = normalize(uCameraPos - vWorldPos);
          vec3 N = normalize(vWaveNormal);

          // Fresnel reflectance of the water-air interface from below
          float cosTheta = clamp(dot(viewDir, -N), 0.0, 1.0);
          float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 3.5);

          // Wave slope & crest shading (물결의 굴곡과 마루가 뚜렷하게 보이도록 음영 형성)
          float waveSlope = clamp(N.x * 0.45 + N.z * 0.45 + 0.5, 0.0, 1.0);
          float waveCrestHighlight = pow(waveSlope, 4.0);

          // Sunlight refraction through the wave facets
          vec3 sunDir = normalize(vec3(0.05, -1.0, 0.05));
          float sunFacetRefract = pow(clamp(dot(N, sunDir), 0.0, 1.0), 10.0);

          // Fine dynamic caustic webbing anchored to the wave slopes
          vec2 p1 = vUv * 48.0 + N.xz * 2.0;
          float c1 = sin(p1.x + sin(p1.y + uTime * 0.68)) * 0.5 + 0.5;
          float c2 = cos(p1.y + cos(p1.x + uTime * 0.5)) * 0.5 + 0.5;
          float caustic = pow((c1 + c2) * 0.5, 3.0);

          // Sun center glow
          float sunGlow = exp(-distFromCenter * 0.04);

          // Oceanic palette: deep calm water body to bright liquid ripple crests
          vec3 deepWater = vec3(0.012, 0.065, 0.15);
          vec3 rippleHighlight = vec3(0.78, 0.91, 0.98);
          vec3 sunColor = vec3(0.92, 0.96, 1.0);

          // Composite liquid wave appearance
          vec3 surfaceColor = deepWater;
          surfaceColor = mix(surfaceColor, rippleHighlight, waveCrestHighlight * 0.45 + caustic * 0.35);
          surfaceColor += sunColor * (sunFacetRefract * 0.55 + sunGlow * 0.45 + fresnel * 0.15);

          float alpha = uOpacity * (0.22 + waveCrestHighlight * 0.35 + caustic * 0.4 + sunGlow * 0.45) * snellWindow;
          gl_FragColor = vec4(surfaceColor, clamp(alpha, 0.0, 1.0));
        }
      `,
    });

    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.position.y = 0;
    scene.add(surfaceMesh);

    // Floating surface micro-bubbles (수면 바로 아래 떠 있는 투명한 물방울들)
    // Instantly grounds the observer as physically looking up through water at the liquid surface
    const bubbleCount = 45;
    const bubbleGeo = new THREE.BufferGeometry();
    const bubblePos = new Float32Array(bubbleCount * 3);
    const bubbleScales = new Float32Array(bubbleCount);
    for (let i = 0; i < bubbleCount; i++) {
      bubblePos[i * 3 + 0] = (Math.random() - 0.5) * 55;
      bubblePos[i * 3 + 1] = -Math.random() * 2.2 - 0.6; // Y = -0.6 ~ -2.8
      bubblePos[i * 3 + 2] = (Math.random() - 0.5) * 55;
      bubbleScales[i] = Math.random() * 1.8 + 0.8;
    }
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
    bubbleGeo.setAttribute('scale', new THREE.BufferAttribute(bubbleScales, 1));

    const bubbleMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.35 },
      },
      vertexShader: `
        attribute float scale;
        uniform float uTime;
        void main() {
          vec3 pos = position;
          pos.x += sin(uTime * 0.4 + pos.z * 0.1) * 0.35;
          pos.z += cos(uTime * 0.35 + pos.x * 0.1) * 0.35;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (scale * 90.0) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float d = length(coord);
          if (d > 0.5) discard;
          // Soft ring bubble with translucent center
          float ring = smoothstep(0.48, 0.4, d) * smoothstep(0.2, 0.38, d);
          float glow = pow(1.0 - d * 2.0, 2.0) * 0.25;
          gl_FragColor = vec4(0.85, 0.94, 1.0, (ring * 0.7 + glow) * uOpacity);
        }
      `,
    });
    const bubbleMesh = new THREE.Points(bubbleGeo, bubbleMat);
    scene.add(bubbleMesh);

    // 4. Natural 3D Marine Snow & Turbidity Motes
    const snowCount = 1200;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    const snowScales = new Float32Array(snowCount);
    const snowPhases = new Float32Array(snowCount);

    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3 + 0] = (Math.random() - 0.5) * 160;
      snowPositions[i * 3 + 1] = -Math.random() * 320;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 160;
      snowScales[i] = Math.random() * 1.6 + 0.5;
      snowPhases[i] = Math.random() * Math.PI * 2;
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    snowGeo.setAttribute('scale', new THREE.BufferAttribute(snowScales, 1));
    snowGeo.setAttribute('phase', new THREE.BufferAttribute(snowPhases, 1));

    const snowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCameraY: { value: -12 },
        uAlpha: { value: 0.32 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uCameraY;
        attribute float scale;
        attribute float phase;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          pos.x += sin(uTime * 0.18 + phase) * 0.5;
          pos.z += cos(uTime * 0.22 + phase) * 0.5;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = scale * (170.0 / -mvPosition.z);

          float dist = length(mvPosition.xyz);
          vAlpha = clamp(1.0 - (dist / 135.0), 0.0, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        varying float vAlpha;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float d = length(coord);
          if (d > 0.5) discard;
          float circleAlpha = smoothstep(0.5, 0.1, d);
          gl_FragColor = vec4(0.72, 0.88, 1.0, uAlpha * vAlpha * circleAlpha);
        }
      `,
    });

    const snowMesh = new THREE.Points(snowGeo, snowMat);
    scene.add(snowMesh);

    // 5. 3D Thought Dissolution Particles (Luminous dispersing motes)
    const thoughtMax = 280;
    const thoughtGeo = new THREE.BufferGeometry();
    const thoughtPos = new Float32Array(thoughtMax * 3);
    const thoughtVel = new Float32Array(thoughtMax * 3);
    const thoughtLife = new Float32Array(thoughtMax);
    const thoughtScales = new Float32Array(thoughtMax);
    let activeThoughtCount = 0;
    let thoughtReleaseTime = -999;

    thoughtGeo.setAttribute('position', new THREE.BufferAttribute(thoughtPos, 3));
    thoughtGeo.setAttribute('scale', new THREE.BufferAttribute(thoughtScales, 1));

    const thoughtMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float scale;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (scale * 240.0) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float d = length(coord);
          if (d > 0.5) discard;
          float core = smoothstep(0.48, 0.08, d);
          float halo = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.2);
          // Crisp clear aquatic starlight droplet (clean bright core, gentle luminous aura)
          vec3 sparkColor = mix(vec3(0.78, 0.90, 1.0), vec3(1.0, 1.0, 1.0), core * 0.75);
          float alpha = (core * 0.65 + halo * 0.3) * 0.6;
          gl_FragColor = vec4(sparkColor, alpha);
        }
      `,
    });

    const thoughtMesh = new THREE.Points(thoughtGeo, thoughtMat);
    thoughtMesh.frustumCulled = false;
    scene.add(thoughtMesh);

    const spawnThoughtsAtCamera = (elapsedTime: number) => {
      thoughtReleaseTime = elapsedTime;
      const spawnZ = camera.position.z - 7.5;
      const spawnY = camera.position.y + 0.3;
      const spawnX = camera.position.x;

      for (let i = 0; i < thoughtMax; i++) {
        thoughtPos[i * 3 + 0] = spawnX + (Math.random() - 0.5) * 3.6;
        thoughtPos[i * 3 + 1] = spawnY + (Math.random() - 0.5) * 2.0;
        thoughtPos[i * 3 + 2] = spawnZ + (Math.random() - 0.5) * 3.6;

        // Vivid radial spiral burst outwards in 360 degrees
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI * 0.9;
        const speed = Math.random() * 0.22 + 0.08;

        thoughtVel[i * 3 + 0] = Math.cos(theta) * Math.cos(phi) * speed;
        thoughtVel[i * 3 + 1] = Math.sin(phi) * speed + 0.035;
        thoughtVel[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * speed;

        thoughtLife[i] = 1.0;
        thoughtScales[i] = Math.random() * 1.6 + 0.9;
      }
      activeThoughtCount = thoughtMax;
      thoughtGeo.attributes.position.needsUpdate = true;
      thoughtGeo.attributes.scale.needsUpdate = true;
    };

    // 6. Natural Ocean Lights
    const ambientLight = new THREE.AmbientLight(0x051d38, 0.75);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xa5d8ff, 1.6);
    sunLight.position.set(0, 45, 0);
    sunLight.target.position.set(0, -90, 0);
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 7. Animation Loop with Real Physical Depth Descent
    let targetCameraY = -12;
    let currentCameraY = -12;
    const clock = new THREE.Clock();
    let frameId = 0;

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const currentStep = stepRef.current;
      const currentProgress = progressRef.current;
      const isMotionReduced = reducedMotionRef.current;
      const motionRate = isMotionReduced ? 0.2 : 1.0;

      // Handle thought release trigger
      if (thoughtTriggerRef.current > prevTriggerCountRef.current) {
        prevTriggerCountRef.current = thoughtTriggerRef.current;
        spawnThoughtsAtCamera(elapsed);
      }

      // 8. Physical Depth Calculation
      // If thoughts were just released (< 1.6s ago), hold at surface so user watches particles disperse!
      const timeSinceRelease = elapsed - thoughtReleaseTime;
      const isHoldingAtSurface = timeSinceRelease < 1.6;

      if (currentStep === 'SURFACE' || isHoldingAtSurface) {
        targetCameraY = -12;
      } else if (currentStep === 'DESCENT') {
        targetCameraY = -45;
      } else if (currentStep === 'STILLNESS') {
        targetCameraY = -45 - currentProgress * 175; // down to -220
      } else if (currentStep === 'COMPLETED') {
        targetCameraY = -220;
      }

      const dampFactor = currentStep === 'DESCENT' ? (isHoldingAtSurface ? 0.2 : 0.85) : 0.55;
      currentCameraY = THREE.MathUtils.damp(currentCameraY, targetCameraY, dampFactor, dt);
      camera.position.y = currentCameraY;

      // Gentle natural breathing sway of the observer
      const swayX = Math.sin(elapsed * 0.28 * motionRate) * 0.7;
      const swayZ = Math.cos(elapsed * 0.22 * motionRate) * 0.5;
      camera.position.x = swayX;
      camera.position.z = 16 + swayZ;

      // Camera looks gently upward toward the receding surface rays when shallow,
      // leveling out to calm forward contemplation as it sinks into the deep abyss.
      const lookUpTargetY = currentCameraY + Math.max(1.5, 12 * (1 - Math.abs(currentCameraY) / 220));
      camera.lookAt(swayX * 0.3, lookUpTargetY, 0);

      // Report depth to React UI
      if (onDepthChangeRef.current) {
        const computedMeters = Math.round(15 + ((-currentCameraY - 12) / 208) * 1185);
        onDepthChangeRef.current(computedMeters);
      }

      // 9. True 3D Light Absorption & Extinction with Depth (Beer-Lambert law)
      const depthRatio = Math.min(1.0, Math.max(0.0, (-currentCameraY - 12) / 165.0));

      // Surface water ceiling fades out smoothly as depth increases
      surfaceMat.uniforms.uTime.value = elapsed * motionRate;
      surfaceMat.uniforms.uOpacity.value = Math.max(0.0, Math.pow(1.0 - depthRatio, 1.8) * 0.88);
      surfaceMat.uniforms.uCameraPos.value.copy(camera.position);

      bubbleMat.uniforms.uTime.value = elapsed * motionRate;
      bubbleMat.uniforms.uOpacity.value = Math.max(0.0, (1.0 - depthRatio * 1.5) * 0.35);

      // Slender crepuscular rays fade out gracefully into the dark oceanic depth
      const rayAlpha = Math.max(0.0, Math.pow(1.0 - depthRatio, 2.0) * 0.26);
      for (const mat of rayMaterials) {
        mat.uniforms.uTime.value = elapsed * motionRate;
        mat.uniforms.uOpacity.value = rayAlpha;
      }

      sunLight.intensity = Math.max(0.02, (1.0 - depthRatio) * 1.6);
      ambientLight.intensity = Math.max(0.1, 0.75 * (1.0 - depthRatio * 0.75));

      // Dynamic Fog shifts from rich ocean blue to quiet midnight oceanic black
      const fogT = Math.min(1.0, depthRatio * 1.25);
      fogColor.setRGB(
        THREE.MathUtils.lerp(0.012, 0.002, fogT),
        THREE.MathUtils.lerp(0.065, 0.009, fogT),
        THREE.MathUtils.lerp(0.145, 0.018, fogT)
      );
      if (scene.fog) {
        (scene.fog as THREE.FogExp2).color.copy(fogColor);
        (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.016, 0.03, fogT);
      }
      renderer.setClearColor(fogColor);

      // 10. Marine Snow Update
      snowMat.uniforms.uTime.value = elapsed * motionRate;
      snowMat.uniforms.uCameraY.value = currentCameraY;
      snowMat.uniforms.uAlpha.value = Math.max(0.1, 0.32 * (1.0 - depthRatio * 0.5));

      const positions = snowGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < snowCount; i++) {
        const py = positions[i * 3 + 1];
        if (py > currentCameraY + 28) {
          positions[i * 3 + 1] = currentCameraY - 140 - Math.random() * 20;
        } else if (py < currentCameraY - 160) {
          positions[i * 3 + 1] = currentCameraY + 24 + Math.random() * 10;
        }
      }
      snowGeo.attributes.position.needsUpdate = true;

      // 11. Thought Release Particles Update
      if (activeThoughtCount > 0) {
        const tPositions = thoughtGeo.attributes.position.array as Float32Array;
        let stillAlive = 0;
        for (let i = 0; i < thoughtMax; i++) {
          if (thoughtLife[i] > 0) {
            thoughtLife[i] -= dt * 0.24;
            tPositions[i * 3 + 0] += thoughtVel[i * 3 + 0] * dt * 42 * motionRate;
            tPositions[i * 3 + 1] += (thoughtVel[i * 3 + 1] + 0.015) * dt * 42 * motionRate;
            tPositions[i * 3 + 2] += thoughtVel[i * 3 + 2] * dt * 42 * motionRate;

            thoughtVel[i * 3 + 0] *= 0.965;
            thoughtVel[i * 3 + 1] *= 0.965;
            thoughtVel[i * 3 + 2] *= 0.965;

            thoughtScales[i] = Math.min(2.8, thoughtScales[i] + dt * 0.6);

            if (thoughtLife[i] > 0) stillAlive++;
          }
        }
        activeThoughtCount = stillAlive;
        thoughtGeo.attributes.position.needsUpdate = true;
        thoughtGeo.attributes.scale.needsUpdate = true;
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    // 12. Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);

      surfaceGeo.dispose();
      surfaceMat.dispose();

      for (const mesh of rayMeshes) {
        mesh.geometry.dispose();
      }
      for (const mat of rayMaterials) {
        mat.dispose();
      }

      snowGeo.dispose();
      snowMat.dispose();

      thoughtGeo.dispose();
      thoughtMat.dispose();

      bubbleGeo.dispose();
      bubbleMat.dispose();

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    />
  );
};
