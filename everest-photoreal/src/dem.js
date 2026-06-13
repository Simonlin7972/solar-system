import * as THREE from 'three';

// 下載的 Terrarium 瓦片範圍（聖母峰，zoom 13，5×5）
const Z = 13, X0 = 6072, Y0 = 3430, NX = 5, NY = 5, TILE = 256;
const EVEREST_LAT = 27.9881;

function loadTile(x, y) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`tile ${x}/${y}`));
    img.src = `/dem/${x}_${y}.png`;
  });
}

// 從真實高程瓦片建立聖母峰地形網格
export async function buildEverestTerrain(onProgress) {
  const W = NX * TILE, H = NY * TILE;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let done = 0;
  for (let cx = 0; cx < NX; cx++) {
    for (let cy = 0; cy < NY; cy++) {
      const img = await loadTile(X0 + cx, Y0 + cy);
      ctx.drawImage(img, cx * TILE, cy * TILE);
      done++;
      onProgress?.(done / (NX * NY) * 0.6);
    }
  }

  // 解碼 Terrarium 高程：elev = (R*256 + G + B/256) − 32768（公尺）
  const data = ctx.getImageData(0, 0, W, H).data;
  const elev = new Float32Array(W * H);
  let minE = Infinity, maxE = -Infinity;
  for (let i = 0; i < W * H; i++) {
    const e = (data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256) - 32768;
    elev[i] = e;
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
  }

  // 世界尺度：真實水平比例 + 適度垂直誇張
  const tileM = 40075016 * Math.cos(EVEREST_LAT * Math.PI / 180) / Math.pow(2, Z);
  const groundWidthM = NX * tileM;        // 地面實際寬度（公尺）
  const SIZE = 4000;                       // 世界單位寬度
  const hScale = SIZE / groundWidthM;
  const VEX = 1.45;                        // 垂直誇張（地形視覺化慣例）
  const vScale = hScale * VEX;

  const aspect = H / W;
  const segX = 639, segZ = Math.round(segX * aspect);
  const geo = new THREE.PlaneGeometry(SIZE, SIZE * aspect, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  const bil = (u, v) => {
    const fx = u * (W - 1), fy = v * (H - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const a = elev[y0 * W + x0], b = elev[y0 * W + x1], c = elev[y1 * W + x0], d = elev[y1 * W + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  const sumW = SIZE, sumH = SIZE * aspect;
  const uvAttr = geo.attributes.uv;
  let summit = new THREE.Vector3(0, -Infinity, 0);
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / sumW + 0.5;
    const v = pos.getZ(i) / sumH + 0.5;
    const y = (bil(u, v) - minE) * vScale;
    pos.setY(i, y);
    uvAttr.setXY(i, u, v);   // 與衛星影像鑲嵌圖對齊的 UV
    if (y > summit.y) summit.set(pos.getX(i), y, pos.getZ(i));
  }
  uvAttr.needsUpdate = true;
  geo.computeVertexNormals();
  onProgress?.(0.7);

  return { geo, summit, SIZE, snowlineY: (6200 - minE) * vScale };
}
