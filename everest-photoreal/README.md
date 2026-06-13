# 聖母峰 · 照片級地形 PoC

用 **Vite + Three.js** 做的照片級聖母峰場景 proof-of-concept，示範從「程序化」升級到「真實資產 + 進階渲染管線」的完整做法。

![pipeline](real DEM → HDRI IBL → PBR → ACES + Bloom + DOF)

## 用了什麼技術

| 技術 | 做法 | 來源 |
|---|---|---|
| **真實地形 DEM** | 直接抓聖母峰座標的 Terrarium 高程瓦片（z13, 5×5），解碼 `elev=(R*256+G+B/256)−32768`，建成網格 | AWS Open Data（Mapzen/SRTM，公有領域） |
| **真實衛星影像 albedo** | 同座標的 ESRI World Imagery 瓦片（z14, 10×10），與 DEM 像素級對齊的 UV，當地形真實色彩 | ESRI World Imagery |
| **HDRI 環境光（IBL）** | RGBELoader 載入 HDR → PMREM → `scene.environment` + 可見天空 | Poly Haven（CC0） |
| **PBR 材質** | albedo=衛星影像；2K 掃描法線/粗糙度提供高頻細節；雪/岩差異依**衛星亮度**判斷（亮=雪→更平滑）；`onBeforeCompile` 注入，全程 MeshStandardMaterial | Poly Haven（CC0） |
| **CSM 級聯陰影** | 3 cascade，近處銳利、遠處仍有陰影，山體自我投影 | three addons（csm） |
| **色調映射** | ACES Filmic + 曝光控制 | — |
| **後製** | EffectComposer：景深(BokehPass) → 輝光(UnrealBloomPass) → OutputPass | three addons |
| **大氣 / 運鏡** | 指數霧（高空大氣透視）+ OrbitControls 自動環繞、可拖曳 | three addons |

## 執行

```bash
npm install
npm run dev      # → http://localhost:5174
npm run build    # → dist/
```

## 資產

`public/` 內的資產為下載快取（皆可重新下載）：
- `hdri/` — Poly Haven HDRI（CC0）
- `tex/` — Poly Haven PBR 貼圖（CC0）
- `dem/` — AWS Terrarium 高程瓦片（公有領域）

## 可再強化的方向

已做：真實衛星 albedo、2K 掃描細節材質、CSM 級聯陰影。再往上：
- 更高 zoom 的衛星影像（z16+）讓極近距離也清晰
- Quixel Megascans 4K/8K 掃描材質 + 位移貼圖（parallax/tessellation）
- SSAO/GTAO、SSR、體積雲與大氣散射
- `three-gpu-pathtracer` 做離線級靜態鏡頭
- WebGPU + TSL
