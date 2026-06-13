# 重構計畫 · Solar System

把目前的單一 `index.html`（~3700 行）重構成可擴展的模組架構。
**目標:把「加一顆星球要改 6 個散落的地方」降到「加 2–3 個檔案」。**

> 狀態:📋 規劃中（尚未動工）
> 決議方向:**Vite + vanilla TypeScript + 資料驅動內容 + 單檔輸出**

---

## 1. 為什麼要重構

| 現況痛點 | 具體問題 |
|---|---|
| 3700+ 行單檔 | 找東西、改東西都要捲半天,難協作 |
| **加一顆星球要改 6 處** | HTML 內容、shader、`PLANET_CONFIG`、`KF` 運鏡、`*FX` 群組、nav 按鈕 |
| 內容寫死在 HTML | 章節文字跟 markup 綁死,改文案 = 改結構 |
| shader 是內嵌字串 | 沒語法高亮、難重用、難 debug |
| 無 build | 沒有壓縮、tree-shaking、模組邊界 |

核心問題不是「檔案大」,而是**新增內容的成本太高、改動點太分散**。

---

## 2. 決議:技術方向

**Vite + 模組化 vanilla TypeScript,不導入 UI 框架。**

- ✅ 保留現有的 Three.js 場景與所有 GLSL shader（只搬家、不改寫）
- ✅ 加 build step:模組邊界、壓縮、HMR
- ✅ **星球註冊表 + 內容資料化**:加星球 = 加 1 config + 1 shader + 1 內容檔
- ✅ 全 TypeScript:config / 內容 / shader uniform 有型別保護
- ✅ 仍是純靜態輸出,部署到 GitHub Pages / Vercel;另外保留單檔可攜版本

**為什麼不用 React + R3F?**
這專案核心是命令式的 3D 場景、自訂 render loop、滾動驅動運鏡。改寫成宣告式 R3F 是大工程卻沒對等好處,反而會跟現有的 imperative 邏輯打架。框架只在「要加大量 UI / 路由 / 複雜狀態」時才划算,而本專案是「3D canvas + overlay UI」,不需要。

---

## 3. 目標檔案結構

```
solar-system/
├─ index.html              # 精簡 HTML 殼（掛載點 + importmap）
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ src/
│  ├─ main.ts              # 進入點：組裝一切
│  ├─ types.ts             # ★ 全域型別（PlanetConfig / Section / Landmark…）
│  ├─ core/
│  │  ├─ renderer.ts       # renderer / scene / camera / clock
│  │  ├─ loop.ts           # 主 rAF 迴圈、模式分派
│  │  └─ background.ts     # 星空、銀河帶、亮星
│  ├─ shaders/
│  │  ├─ noise.glsl.ts     # NOISE_GLSL 共用
│  │  ├─ surfaces.glsl.ts  # 各天體 SURF 高度函式
│  │  ├─ vertex.ts         # makeVertex / bumpGLSL
│  │  └─ planets/
│  │     ├─ mars.glsl.ts
│  │     ├─ earth.glsl.ts
│  │     ├─ moon.glsl.ts
│  │     └─ sun.glsl.ts
│  ├─ planets/
│  │  ├─ registry.ts       # ★ 所有星球的中央註冊表（資料驅動核心）
│  │  ├─ factory.ts        # 依 config 生材質/衛星/FX
│  │  └─ fx/
│  │     ├─ marsFX.ts      # 沙塵暴、探測器、流星
│  │     ├─ earthFX.ts     # 極光、衛星群
│  │     ├─ moonFX.ts      # 阿波羅著陸點
│  │     └─ sunFX.ts       # 日冕、日珥、內行星
│  ├─ scenes/
│  │  ├─ planetScene.ts    # 行星頁 3D 場景 + 運鏡
│  │  └─ solarSystem.ts    # 太陽系首頁（八大行星、軌道、互動）
│  ├─ ui/
│  │  ├─ nav.ts            # 星球切換 + 轉場 fader + 滾動記憶
│  │  ├─ flightpath.ts     # 太空梭航道導覽
│  │  ├─ calculator.ts     # 個人檔案換算器
│  │  ├─ focusCard.ts      # 首頁聚焦卡
│  │  └─ hud.ts            # HUD 座標 / 進度
│  ├─ content/
│  │  ├─ mars.ts           # 火星章節內容（純資料）
│  │  ├─ earth.ts
│  │  ├─ moon.ts
│  │  ├─ sun.ts
│  │  └─ render.ts         # 把內容資料 → DOM（樣板）
│  ├─ data/
│  │  ├─ landmarks.ts      # 地標 pin 資料
│  │  └─ facts.ts          # 數據（重力、軌道週期…）
│  └─ styles/
│     ├─ base.css
│     ├─ themes.css        # 各星球 CSS 變數主題
│     ├─ hud.css
│     ├─ flightpath.css
│     └─ content.css
```

---

## 4. 資料驅動的核心（最大的擴展紅利）

### 4.1 星球註冊表 `registry.ts`

每顆星球一個物件,所有 UI / 場景都迭代它。**加金星 = 在陣列裡多一個物件。**

```ts
import { marsShader } from '../shaders/planets/mars.glsl';
import { marsFX } from './fx/marsFX';
import marsContent from '../content/mars';
import { marsLandmarks } from '../data/landmarks';

export const PLANETS: PlanetConfig[] = [
  {
    key: 'mars', zh: '火星', en: 'MARS',
    theme: 'mars',                    // 對應 CSS 主題 class
    shader: marsShader,
    surfaces: { height: MARS_SURF, displace: 0.05, bump: 5 },
    satellites: 'duo',                // phobos + deimos
    fx: marsFX,
    keyframes: KF_MARS,
    landmarks: marsLandmarks,
    content: marsContent,
    brand: 'MARS//MISSION',
    system: 'ARES SYSTEM · 4TH PLANET',
  },
  // earth, moon, sun…
];
```

### 4.2 章節內容資料化 + 型別

把寫死的 HTML 換成資料。章節用 **discriminated union**,TS 強制每種 type 都被渲染處理:

```ts
// types.ts
export type Section =
  | { type: 'stats';      kicker: string; title: string; lead?: string; stats: Stat[] }
  | { type: 'features';   kicker: string; title: string; align: 'left'|'right'; items: Feature[] }
  | { type: 'story';      label: string;  title: string; quote: string; paras: string[] }
  | { type: 'timeline';   kicker: string; title: string; lead?: string; events: TimeEvent[] }
  | { type: 'moons';      kicker: string; title: string; lead: string; cards: MoonCard[] }
  | { type: 'phases';     kicker: string; title: string; lead: string }
  | { type: 'challenges'; kicker: string; title: string; sub: string; items: Challenge[] }
  | { type: 'hero-end';   kicker: string; title: string; sub: string; sign: string };

export interface PlanetContent {
  hero: { eyebrow: string; title: string; sub: string };
  sections: Section[];
}
```

```ts
// content/mars.ts
const mars: PlanetContent = {
  hero: { eyebrow: 'THE RED PLANET · 距離地球 225,000,000 KM', title: '火星', sub: '…' },
  sections: [
    { type: 'stats', kicker: '01 / PLANETARY DATA', title: '行星檔案',
      lead: '火星是太陽系第四顆行星…',
      stats: [['6779','KM','赤道直徑'], ['687','天','公轉一年'], /* … */] },
    { type: 'features', kicker: '02 / GEOGRAPHY', title: '極端地貌', align: 'right',
      items: [{ zh:'奧林帕斯山', en:'OLYMPUS MONS', body:'…' }, /* … */] },
    { type: 'story', label: 'MISSION FILE · 2012-08-06', title: '恐怖七分鐘',
      quote: '…', paras: ['…','…'] },
    // …
  ],
};
export default mars;
```

```ts
// content/render.ts — 認得 type → 產生 DOM；漏一種 type 編譯不過
export function renderSection(s: Section): HTMLElement {
  switch (s.type) {
    case 'stats':      return renderStats(s);
    case 'features':   return renderFeatures(s);
    case 'story':      return renderStory(s);
    case 'timeline':   return renderTimeline(s);
    case 'moons':      return renderMoons(s);
    case 'phases':     return renderPhases(s);
    case 'challenges': return renderChallenges(s);
    case 'hero-end':   return renderHeroEnd(s);
    // default: const _exhaustive: never = s;  // ← TS 保證窮盡
  }
}
```

> **這一步把「改文案要動 markup」「加章節要複製貼上 HTML」徹底解決。**
> 加新版型 = 加一個 `type` case,加章節 = 加一個資料物件。

---

## 5. 單檔輸出設定

兩種 build 並存:

```jsonc
// package.json
"scripts": {
  "dev": "vite",
  "build": "vite build",                       // → dist/ 一般分塊靜態（部署 Pages / Vercel）
  "build:single": "vite build --mode single",  // → vite-plugin-singlefile，全內聯單檔
  "preview": "vite preview"
}
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: '/solar-system/',                       // GitHub Pages 專案站路徑（部署 Vercel 可設 '/'）
  plugins: mode === 'single' ? [viteSingleFile()] : [],
}));
```

- 一般 `build` → `dist/`,部署到 GitHub Pages / Vercel。
- `build:single` → 一個全內聯的 `index.html`,雙擊就能開、方便分享。

---

## 6. 施工順序（每個 phase 都保持可運作）

| Phase | 內容 | 風險 | 驗證 |
|---|---|---|---|
| **0 · 搭骨架** | `npm create vite@latest`（vanilla-ts）、裝 `three` + `@types/three` + `vite-plugin-singlefile`、把現有 `<style>`→css、`<script>`→`main.ts` 原封搬入、設 base 與 singlefile | 低（純搬家） | dev / build 跑起來,四星球 + 首頁與現在一模一樣 |
| **1 · 拆 JS 模組** | 機械式拆 `core / shaders / scenes / ui`,純搬移、不改邏輯 | 低 | 行為不變 |
| **2 · 內容資料化** | 抽 `content/*.ts` + `render.ts`,定義 `Section` 型別,逐星球比對搬遷 | 中 | 逐星球逐章節截圖比對 |
| **3 · 星球註冊表** | 收斂散落的 config/KF/FX 進 `registry.ts`,nav / flightpath / focus 改迭代 registry | 中 | 切換、運鏡、導覽不變 |
| **4 · 選配** | ESLint / Prettier、`.glsl` 型別宣告、基本 smoke test | 低 | — |

> 紅利主要在 **Phase 2–3**。若只想最小投入,做完 **Phase 0–1**(純拆檔)已大幅好找好改。
> 建議在分支或 git worktree 上進行,不動 `main` 上能跑的版本。

---

## 7. 取捨與風險

- ➖ 失去「直接 `file://` 開單檔」的極簡性 → 改用 `npm run dev`;但可用 `build:single` 補回可攜單檔。
- ➖ 多了 `node_modules` / build 流程的維護成本。
- ➖ Phase 2–3 搬內容/收斂 config 時需逐星球仔細比對,避免遺漏。
- ➕ 換來:新增星球 / 章節成本從「改 6 處」降到「加 2–3 個檔」,且 TS 在重構與擴展時擋錯。

---

## 8. 動工前檢查清單

- [ ] 在新分支或 worktree 上進行
- [ ] Phase 0 完成後,先 commit 一個「可運作的 Vite 骨架」存檔點
- [ ] 每個 phase 結束用 preview 截圖驗證四星球 + 首頁無退化
- [ ] `base` 路徑對齊實際部署位置（Pages 專案站 vs Vercel 根目錄）
- [ ] 確認 `vite-plugin-singlefile` 輸出的單檔在 `file://` 下可正常開啟（含 CDN 載入的 Three.js / 字體需有網路）
