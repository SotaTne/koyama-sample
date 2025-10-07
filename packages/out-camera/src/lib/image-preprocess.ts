"use client";

import type { Mat } from "@techstark/opencv-js";
import { CV2 } from "../types/type";

interface PreprocessOptions {
  /** ガウシアンブラーによるノイズ除去 */
  denoise?: boolean | { ksize?: number; sigma?: number };
  /** CLAHE によるコントラスト強調 */
  clahe?: boolean | { clipLimit?: number; tileGridSize?: number };
}

export class ImagePreprocessor {
  cv: CV2;
  src: Mat | null = null;
  tmp: Mat | null = null;

  constructor(cv: CV2) {
    this.cv = cv;
  }

  /**
   * 画像前処理を一括実行（推奨）
   * @param canvas 入力画像のCanvas
   * @param options 前処理オプション
   * @returns 処理済みのMat（PaddleOCRに渡せる形式）
   */
  execute(canvas: HTMLCanvasElement, options?: PreprocessOptions): Mat {
    // 1. Canvas → Mat 変換
    this.initFromCanvas(canvas);

    // 2. ノイズ除去（オプション）
    const denoiseOpt = options?.denoise;
    if (denoiseOpt !== false) {
      if (typeof denoiseOpt === "object") {
        this.denoiseGaussian(denoiseOpt.ksize, denoiseOpt.sigma);
      } else {
        this.denoiseGaussian(); // デフォルト値
      }
    }

    // 3. CLAHE（オプション）
    const claheOpt = options?.clahe;
    if (claheOpt !== false) {
      if (typeof claheOpt === "object") {
        this.enhanceLumaCLAHE(claheOpt.clipLimit, claheOpt.tileGridSize);
      } else {
        this.enhanceLumaCLAHE(); // デフォルト値
      }
    }

    // 4. 処理済みMatを返す
    return this.getMat();
  }

  /** Canvas → Mat (RGBA→BGR) 変換 */
  initFromCanvas(canvas: HTMLCanvasElement) {
    this.cleanup();
    const rgba = this.cv.imread(canvas);
    this.src = new this.cv.Mat();
    this.cv.cvtColor(rgba, this.src, this.cv.COLOR_RGBA2BGR);
    rgba.delete();
    this.tmp = new this.cv.Mat();
  }

  /** 軽いノイズ除去（GaussianBlur） */
  denoiseGaussian(ksize = 3, sigma = 0.8) {
    if (!this.src) throw new Error("src is null");
    const k = ksize % 2 === 1 ? ksize : ksize + 1; // 偶数を避ける
    this.cv.GaussianBlur(this.src, this.tmp!, new this.cv.Size(k, k), sigma);
    this.swap();
  }

  /** 輝度のみCLAHE（色相を維持） */
  enhanceLumaCLAHE(clipLimit = 2.0, tileGridSize = 8) {
    if (!this.src) throw new Error("src is null");

    const ycrcb = new this.cv.Mat();
    const channels = new this.cv.MatVector();
    let y: Mat | null = null;
    let cr: Mat | null = null;
    let cb: Mat | null = null;
    let clahe: any = null;
    let merged: Mat | null = null;
    let mergedVec: any = null;

    try {
      this.cv.cvtColor(this.src, ycrcb, this.cv.COLOR_BGR2YCrCb);
      this.cv.split(ycrcb, channels);

      y = channels.get(0).clone();
      cr = channels.get(1).clone();
      cb = channels.get(2).clone();

      clahe = new this.cv.CLAHE(clipLimit, new this.cv.Size(tileGridSize, tileGridSize));
      clahe.apply(y, y);

      merged = new this.cv.Mat();
      mergedVec = new this.cv.MatVector();
      mergedVec.push_back(y);
      mergedVec.push_back(cr);
      mergedVec.push_back(cb);
      this.cv.merge(mergedVec, merged);

      this.cv.cvtColor(merged, this.tmp!, this.cv.COLOR_YCrCb2BGR);
      this.swap();
    } finally {
      // すべてのリソースを確実にクリーンアップ
      try { ycrcb?.delete(); } catch {}
      try { channels?.delete(); } catch {}
      try { y?.delete(); } catch {}
      try { cr?.delete(); } catch {}
      try { cb?.delete(); } catch {}
      try { clahe?.delete(); } catch {}
      try { merged?.delete(); } catch {}
      try { mergedVec?.delete(); } catch {}
    }
  }

  /** Matを返す（PaddleOCR にそのまま渡せる形式） */
  getMat(): Mat {
    if (!this.src) throw new Error("src is null");
    return this.src;
  }

  /** デバッグ出力（Canvas に表示） */
  imshow(canvas: HTMLCanvasElement) {
    if (!this.src) throw new Error("src is null");
    this.cv.imshow(canvas, this.src);
  }

  /** メモリ解放 */
  cleanup() {
    try { this.src?.delete(); } catch {}
    try { this.tmp?.delete(); } catch {}
    this.src = null;
    this.tmp = null;
  }

  /** tmp → src を反映 */
  private swap() {
    if (!this.src || !this.tmp) throw new Error("Mat not initialized");
    const old = this.src;
    this.src = this.tmp;
    this.tmp = new this.cv.Mat();
    old.delete();
  }
}

// ===========================
// 使用例
// ===========================

/*
// 1. デフォルト設定で実行（推奨）
const preprocessor = new ImagePreprocessor(cv);
const mat = preprocessor.execute(canvas);

// 2. パラメータをカスタマイズ
const mat = preprocessor.execute(canvas, {
  denoise: { ksize: 5, sigma: 1.0 },
  clahe: { clipLimit: 3.0, tileGridSize: 16 }
});

// 3. 一部の処理をスキップ
const mat = preprocessor.execute(canvas, {
  denoise: true,
  clahe: false  // CLAHEをスキップ
});

// 4. すべてスキップ（変換のみ）
const mat = preprocessor.execute(canvas, {
  denoise: false,
  clahe: false
});

// 5. 従来の方式も引き続き使用可能
preprocessor.initFromCanvas(canvas);
preprocessor.denoiseGaussian(3, 0.8);
preprocessor.enhanceLumaCLAHE(2.0, 8);
const mat = preprocessor.getMat();

// 6. デバッグ表示
preprocessor.execute(canvas);
preprocessor.imshow(debugCanvas);

// 7. 使用後は必ずクリーンアップ
preprocessor.cleanup();
*/