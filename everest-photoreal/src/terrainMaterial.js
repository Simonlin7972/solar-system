import * as THREE from 'three';

const texLoader = new THREE.TextureLoader();
function load(url, repeat) {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

// albedo = 真實衛星影像；高頻細節 = 2K 掃描法線/粗糙度；
// 雪/岩材質差異直接從衛星亮度推（亮=雪→較平滑）。全程 MeshStandard → 自帶 IBL/陰影/CSM。
// 回傳 { material, inject }：inject 供 CSM 串接 onBeforeCompile 之後再套用。
export function makeTerrainMaterial(satTexture) {
  const TILE = 60;
  const rockNor = load('/tex/rock_nor_gl_2k.jpg', TILE);
  const rockRough = load('/tex/rock_rough_2k.jpg', TILE);
  const snowNor = load('/tex/snow_nor_gl_2k.jpg', TILE);
  const snowRough = load('/tex/snow_rough_2k.jpg', TILE);

  const material = new THREE.MeshStandardMaterial({
    map: satTexture,           // 真實衛星 albedo（UV 0..1）
    normalMap: rockNor,        // 高頻細節法線（平鋪，提供 vNormalMapUv）
    roughnessMap: rockRough,
    metalness: 0.0,
    roughness: 1.0,
    envMapIntensity: 1.0,
    normalScale: new THREE.Vector2(0.7, 0.7),
  });

  const uniforms = {
    snowNormalMap: { value: snowNor },
    snowRoughMap: { value: snowRough },
  };

  const inject = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        `#include <common>
         uniform sampler2D snowNormalMap; uniform sampler2D snowRoughMap;
         float gSnowF;`)
      .replace('#include <map_fragment>',
        `#include <map_fragment>
         float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
         gSnowF = smoothstep(0.46, 0.74, luma);          // 亮 = 雪
         diffuseColor.rgb *= mix(1.0, 1.04, gSnowF);`)
      .replace('#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float snowR = texture2D(snowRoughMap, vNormalMapUv).g;
         roughnessFactor = mix(roughnessFactor, snowR * 0.8, gSnowF);`)
      .replace('#include <normal_fragment_maps>',
        `mat3 tbnTerr = getTangentFrame(-vViewPosition, normal, vNormalMapUv);
         vec3 rockN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
         vec3 snowN = texture2D(snowNormalMap, vNormalMapUv).xyz * 2.0 - 1.0;
         vec3 mapN = mix(rockN, snowN, gSnowF);
         mapN.xy *= normalScale * mix(1.0, 0.45, gSnowF);  // 雪面更平滑
         normal = normalize(tbnTerr * mapN);`);
  };

  return { material, inject };
}
