"use client"

import type cvReadyPromise from "@techstark/opencv-js";
import type { Mat } from "@techstark/opencv-js";

export class ImagePreprocessor {
  cv: Awaited<typeof cvReadyPromise>;
  src: Mat;
  dst: Mat;

  constructor(cv: Awaited<typeof cvReadyPromise>) {
    window.cv = cv as any;
    this.cv = cv;
    this.src = new cv.Mat();
    this.dst = new cv.Mat();  // cv から呼び出し
  }

  init(canvas: HTMLCanvasElement){
    this.src.delete(); // 既存の Mat を削除
    this.src = this.cv.imread(canvas);
  }

  private advanceStep(){
    const newSrc = this.dst;
    this.dst = new this.cv.Mat();
    this.src.delete();
    this.src = newSrc;
  }

  cleanup() {
    this.src.delete();
    this.dst.delete();
  }

  // ガウスぼかし
  gaussianBlur(){
    this.cv.GaussianBlur(
      this.src,
      this.dst,
      new this.cv.Size(3, 3),
      1.5
    );
    this.advanceStep();
  }

  // グレースケール
  toGrayscale() {
    this.cv.cvtColor(this.src, this.dst, this.cv.COLOR_RGBA2GRAY);
    this.advanceStep();
  }

  // 適応的閾値処理
  adaptiveThreshold() {
    this.cv.adaptiveThreshold(
      this.src,
      this.dst,
      255,
      this.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      this.cv.THRESH_BINARY,
      11,
      2
    );
    this.advanceStep();
  }

  // 反転処理
  invert() {
    this.cv.bitwise_not(this.src, this.dst);
    this.advanceStep();
  }

  process(inputCanvas:HTMLCanvasElement,outputCanvas: HTMLCanvasElement){
    this.init(inputCanvas)
    this.gaussianBlur();
    this.toGrayscale();
    this.adaptiveThreshold();
    this.invert();
    this.showResult(outputCanvas);
    this.cleanup();
  }

  // 結果のCanvasへの表示
  showResult(outputCanvas: HTMLCanvasElement) {
    this.cv.imshow(outputCanvas, this.src);
  }
}