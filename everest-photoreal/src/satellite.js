import * as THREE from 'three';

// 衛星瓦片：z14，與 DEM（z13 5×5）覆蓋完全相同的地理範圍
const Z = 14, X0 = 12144, Y0 = 6860, NX = 10, NY = 10, TILE = 256;

function loadTile(x, y) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`sat ${x}/${y}`));
    img.src = `/sat/${x}_${y}.jpg`;
  });
}

// 組成真實衛星影像鑲嵌圖 → 地形 albedo（與 DEM 同一 UV 對齊）
export async function loadSatelliteTexture(maxAniso = 8, onProgress) {
  const W = NX * TILE, H = NY * TILE;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  let done = 0;
  for (let cx = 0; cx < NX; cx++) {
    for (let cy = 0; cy < NY; cy++) {
      const img = await loadTile(X0 + cx, Y0 + cy);
      ctx.drawImage(img, cx * TILE, cy * TILE);
      done++;
      onProgress?.(done / (NX * NY));
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;            // 與 DEM 取樣的 (u,v) 對齊
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}
