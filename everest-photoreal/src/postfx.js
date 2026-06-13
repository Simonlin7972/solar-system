import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 後製鏈：場景 → DOF(景深) → Bloom(輝光) → Output(ACES 色調映射 + sRGB)
export function setupPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bokeh = new BokehPass(scene, camera, {
    focus: 1600.0,
    aperture: 0.00018,
    maxblur: 0.006,
  });
  composer.addPass(bokeh);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.18, 0.4, 0.9
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  return { composer, bokeh, bloom };
}
