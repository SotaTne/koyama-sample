"use client"

import type cvReadyPromise from "@techstark/opencv-js";
import type { Mat } from "@techstark/opencv-js";

export class ImagePreprocessor {
  cv: Awaited<typeof cvReadyPromise>;
  src: Mat | null = null;
  dst: Mat | null = null;

  constructor(cv: Awaited<typeof cvReadyPromise>) {
    window.cv = cv as any;
    this.cv = cv;
  }

  // 画像のリサイズ
  resize(scale: number = 2.0) {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    const width = Math.round(this.src.cols * scale);
    const height = Math.round(this.src.rows * scale);
    
    this.cv.resize(
      this.src,
      this.dst,
      new this.cv.Size(width, height),
      0,
      0,
      this.cv.INTER_LINEAR
    );
    this.advanceStep();
  }

  // 最小サイズの確保
  ensureMinimumSize(minWidth: number = 100, minHeight: number = 100) {
    if (!this.src) {
      throw new Error('Source Mat not initialized');
    }
    
    const currentWidth = this.src.cols;
    const currentHeight = this.src.rows;
    
    // サイズが小さすぎる場合はリサイズ
    if (currentWidth < minWidth || currentHeight < minHeight) {
      const scaleX = minWidth / currentWidth;
      const scaleY = minHeight / currentHeight;
      const scale = Math.max(scaleX, scaleY, 2.0); // 最低でも2倍に
      
      console.log(`Image too small (${currentWidth}x${currentHeight}), scaling by ${scale}x`);
      this.resize(scale);
    }
  }

  // デバッグ用：画像サイズを表示
  logImageSize(label: string = '') {
    if (!this.src) {
      console.log(`${label} Image not initialized`);
      return;
    }
    console.log(`${label} Image size: ${this.src.cols}x${this.src.rows}, channels: ${this.src.channels()}`);
  }

  init(canvas: HTMLCanvasElement) {
    try {
      // 既存のMatを安全に削除
      this.cleanup();
      
      // 新しいMatを作成
      this.src = this.cv.imread(canvas);
      this.dst = new this.cv.Mat();
      
      // 初期サイズをログ出力
      this.logImageSize('Initial');
      
      // 最小サイズを確保
      this.ensureMinimumSize(200, 200);
      
    } catch (error) {
      console.error('Error in init:', error);
      throw error;
    }
  }

  private advanceStep() {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    // srcを一時保存
    const tempSrc = this.src;
    
    // dstをsrcに移動
    this.src = this.dst;
    
    // 新しいdstを作成
    this.dst = new this.cv.Mat();
    
    // 古いsrcを削除
    tempSrc.delete();
  }

  cleanup() {
    try {
      if (this.src && !this.src.isDeleted()) {
        this.src.delete();
      }
    } catch (error) {
      console.error('Error deleting src Mat:', error);
    }
    
    try {
      if (this.dst && !this.dst.isDeleted()) {
        this.dst.delete();
      }
    } catch (error) {
      console.error('Error deleting dst Mat:', error);
    }
    
    this.src = null;
    this.dst = null;
  }

  // パラメータ付きガウスぼかし
  gaussianBlur(ksize: number = 3, sigma: number = 1.0) {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    this.cv.GaussianBlur(
      this.src,
      this.dst,
      new this.cv.Size(ksize, ksize),
      sigma
    );
    this.advanceStep();
  }

  // 中央値ぼかし
  medianBlur(ksize: number = 3) {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    this.cv.medianBlur(this.src, this.dst, ksize);
    this.advanceStep();
  }

  // グレースケール変換
  toGrayscale() {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    // 既にグレースケールの場合はスキップ
    if (this.src.channels() === 1) {
      this.src.copyTo(this.dst);
    } else {
      this.cv.cvtColor(this.src, this.dst, this.cv.COLOR_RGBA2GRAY);
    }
    this.advanceStep();
  }

  // 適応的閾値処理（パラメータ調整可能）
  adaptiveThreshold(blockSize: number = 21, C: number = 10) {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    this.cv.adaptiveThreshold(
      this.src,
      this.dst,
      255,
      this.cv.ADAPTIVE_THRESH_GAUSSIAN_C, // または MEAN_C
      this.cv.THRESH_BINARY,
      blockSize,
      C
    );
    this.advanceStep();
  }

  // 二値化処理
  binarize() {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }

    this.cv.threshold(
      this.src,
      this.dst,
      0,
      255,
      this.cv.THRESH_BINARY | this.cv.THRESH_OTSU
    );
    this.advanceStep();
  }

  equalizeHist(){
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }

    this.cv.equalizeHist(this.src, this.dst);
    this.advanceStep();
  }

  // 反転処理
  invert() {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    this.cv.bitwise_not(this.src, this.dst);
    this.advanceStep();
  }

  // スケルトン化の実装
  skeletonize() {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }

    // Step 1: binを正しく初期化
    const bin = this.src.clone(); // ←これが抜けていました

    // Step 2: 小さいノイズ除去
    const noiseKernel = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(2, 2));
    this.cv.morphologyEx(bin, bin, this.cv.MORPH_OPEN, noiseKernel);

    // Step 3: 空のスケルトン画像を作成
    const skel = this.cv.Mat.zeros(this.src.rows, this.src.cols, this.cv.CV_8UC1);
    const temp = new this.cv.Mat();
    const eroded = new this.cv.Mat();
    const opened = new this.cv.Mat();

    // Step 4: カーネル作成
    const kernel = this.cv.getStructuringElement(this.cv.MORPH_CROSS, new this.cv.Size(3, 3)); // CROSSに戻す

    // Step 5: 作業用のコピー
    const workImg = bin.clone();

    let loopCount = 0;
    const maxLoops = 1000;

    while (true) {
      // Opening操作
      this.cv.morphologyEx(workImg, opened, this.cv.MORPH_OPEN, kernel);

      // 元画像からopenedを減算
      this.cv.subtract(workImg, opened, temp);

      // スケルトンに追加
      this.cv.bitwise_or(skel, temp, skel);

      // 元画像を侵食
      this.cv.erode(workImg, eroded, kernel);
      eroded.copyTo(workImg);

      loopCount++;
      if (this.cv.countNonZero(workImg) === 0 || loopCount > maxLoops) {
        break;
      }
    }

    // 結果をdstにコピー
    skel.copyTo(this.dst);

    // メモリ解放
    bin.delete();
    noiseKernel.delete();
    skel.delete();
    temp.delete();
    eroded.delete();
    opened.delete();
    kernel.delete();
    workImg.delete();

    this.advanceStep();
  }

  // 膨張処理の実装
  dilate(kernelSize: number = 3, iterations: number = 1) {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }

    // カーネルを作成（矩形型）
    const kernel = this.cv.getStructuringElement(
      this.cv.MORPH_RECT, 
      new this.cv.Size(kernelSize, kernelSize)
    );

    // 膨張処理を実行
    this.cv.dilate(
      this.src,
      this.dst,
      kernel,
      new this.cv.Point(-1, -1), // アンカーポイント（デフォルト）
      iterations,                // 反復回数
      this.cv.BORDER_CONSTANT,   // ボーダータイプ
      new this.cv.Scalar()       // ボーダー値
    );

    // メモリ解放
    kernel.delete();
    
    this.advanceStep();
  }


  // モルフォロジー演算（クロージング - 文字の穴を埋める）
  morphClose(kernelSize: number = 2) {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    const kernel = this.cv.getStructuringElement(
      this.cv.MORPH_RECT,
      new this.cv.Size(kernelSize, kernelSize)
    );
    
    this.cv.morphologyEx(
      this.src,
      this.dst,
      this.cv.MORPH_CLOSE,
      kernel
    );
    
    kernel.delete();
    this.advanceStep();
  }

  // モルフォロジー演算（オープニング - ノイズ除去）
  morphOpen(kernelSize: number = 2) {
    if (!this.src || !this.dst) {
      throw new Error('Mat objects not initialized');
    }
    
    const kernel = this.cv.getStructuringElement(
      this.cv.MORPH_RECT,
      new this.cv.Size(kernelSize, kernelSize)
    );
    
    this.cv.morphologyEx(
      this.src,
      this.dst,
      this.cv.MORPH_OPEN,
      kernel
    );
    
    kernel.delete();
    this.advanceStep();
  }

  // モルフォロジー処理を組み込んだ処理
  processWithMorphology(inputCanvas: HTMLCanvasElement, outputCanvas: HTMLCanvasElement, options?: { scale?: number }) {
    try {
      this.init(inputCanvas);
      if (!this.src) {
        throw new Error('Source Mat not initialized');
      }
      
      // オプションでスケーリング
      if (options?.scale && options.scale !== 1.0) {
        this.resize(options.scale);
        this.logImageSize('After scaling');
      }

      const imageArea = this.src.rows * this.src.cols;
  
      let blockSize, C, blurKernel;
      if (imageArea < 50000) {        // 小さい画像
        blockSize = 15; C = 3; blurKernel = 3;
      } else if (imageArea < 200000) { // 中サイズ画像  
        blockSize = 25; C = 4; blurKernel = 5; // 現在の設定
      } else {                        // 大きい画像
        blockSize = 35; C = 5; blurKernel = 7;
      }
      
      // 初期処理
      this.toGrayscale();

      // エッジ平滑化
      this.gaussianBlur(blurKernel, 1.4);

      // コントラスト強調
      //this.equalizeHist();

      // 二値化

      this.adaptiveThreshold(blockSize, C);

      this.medianBlur(3);


      // this.skeletonize();           // スケルトン化

      // this.dilate(5);

      // console.log("skeletonization completed");
      // this.showResult(outputCanvas);
      // return;

      // モルフォロジー処理（ノイズ除去と文字の改善）
      this.morphOpen(1);   // 小さなノイズを除去
      this.morphClose(1);  // 文字の穴を埋める

      // エッジ平滑化
      // this.invert();
            
      // 最終サイズをチェック
      this.logImageSize('Final');
      
      this.showResult(outputCanvas);
    } catch (error) {
      console.error('Error in processWithMorphology:', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  // 結果のCanvasへの表示
  showResult(outputCanvas: HTMLCanvasElement) {
    if (!this.src) {
      throw new Error('Source Mat not initialized');
    }
    
    this.cv.imshow(outputCanvas, this.src);
  }
}