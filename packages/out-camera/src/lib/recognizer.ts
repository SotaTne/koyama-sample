"use client";

import { ONNXPaddleOCR } from "onnx-ocr-js";
import * as ort from "onnxruntime-web";
import type { CV2, OCRResult, TextSystem } from "../types/type";
import type { Mat } from "@techstark/opencv-js";

/**
 * ONNXRuntime + OpenCV.js を使った PaddleOCR ラッパークラス
 * - IndexedDB キャッシュ
 * - textSystem / cv を内部で管理
 * - self-contained に OCR 実行
 */
export class Recognizer {
  private ocr: ONNXPaddleOCR;
  private cv: CV2 | null = null;
  private textSystem: TextSystem | null = null;
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private constructor(ocr: ONNXPaddleOCR, cv: CV2, textSystem: TextSystem) {
    this.ocr = ocr;
    this.cv = cv;
    this.textSystem = textSystem;
  }

  /** IndexedDB データベースを初期化（共通化） */
  private static async openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("onnx-ocr-cache", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("resources")) {
          db.createObjectStore("resources");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    this.dbPromise.catch(() => {
      this.dbPromise = null;
    });

    return this.dbPromise;
  }

  /** URL を正規化してキャッシュキー生成 */
  private static normalizeUrl(url: string | URL): string {
    try {
      return new URL(url, window.location.href).toString();
    } catch {
      return String(url);
    }
  }

  /** IndexedDB 経由でリソース取得（キャッシュ付き） */
  private static async fetchResource(
    url: string | URL,
    type: "binary"
  ): Promise<Uint8Array>;
  private static async fetchResource(
    url: string | URL,
    type: "text"
  ): Promise<string>;
  private static async fetchResource(
    url: string | URL,
    type: "binary" | "text"
  ): Promise<Uint8Array | string> {
    const normalizedUrl = this.normalizeUrl(url);
    const cacheKey = normalizedUrl;

    try {
      const db = await this.openDB();
      const cached = await new Promise<any>((resolve) => {
        const tx = db.transaction("resources", "readonly");
        const store = tx.objectStore("resources");
        const req = store.get(cacheKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });

      if (cached) {
        if (type === "binary" && cached instanceof ArrayBuffer) {
          console.log(`📦 Cache hit: ${normalizedUrl}`);
          return new Uint8Array(cached);
        } else if (type === "text" && typeof cached === "string") {
          console.log(`📦 Cache hit: ${normalizedUrl}`);
          return cached;
        }
        console.warn(
          `⚠️ Cached data type mismatch for ${cacheKey}, refetching`
        );
      }

      console.log(`🌐 Fetching ${normalizedUrl}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${normalizedUrl}`);

      let data: Uint8Array | string;
      if (type === "binary") {
        const buffer = await res.arrayBuffer();
        data = new Uint8Array(buffer);
      } else {
        data = await res.text();
      }

      try {
        const tx = db.transaction("resources", "readwrite");
        const store = tx.objectStore("resources");
        store.put(
          type === "binary" ? (data as Uint8Array).buffer : data,
          cacheKey
        );
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn(`⚠️ Failed to cache ${cacheKey}:`, err);
      }

      return data;
    } catch (err) {
      console.warn(
        `⚠️ IndexedDB unavailable, fetching directly: ${normalizedUrl}`
      );
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${normalizedUrl}`);
      return type === "binary"
        ? new Uint8Array(await res.arrayBuffer())
        : await res.text();
    }
  }

  /** OCR モデル初期化 */
  static async create({
    det_model_path,
    cls_model_path,
    rec_model_path,
    rec_char_dict_path,
    onnx_wasm_path,
    cv,
  }: {
    det_model_path: string | URL;
    cls_model_path: string | URL;
    rec_model_path: string | URL;
    rec_char_dict_path: string | URL;
    onnx_wasm_path: string | URL;
    cv: CV2;
  }): Promise<Recognizer> {
    console.log("📦 Initializing OCR models (with IndexedDB cache)");
    console.time("OCR Init");

    const [detModel, clsModel, recModel, charset] = await Promise.all([
      this.fetchResource(det_model_path, "binary"),
      this.fetchResource(cls_model_path, "binary"),
      this.fetchResource(rec_model_path, "binary"),
      this.fetchResource(rec_char_dict_path, "text"),
    ]);

    const ocr = new ONNXPaddleOCR({ use_angle_cls: true });
    ort.env.wasm.wasmPaths = String(onnx_wasm_path);
    // 何秒かかっているか計測する
    console.log("start onnxruntime-web");
    const textSystem = await ocr.init({
      cv,
      ort,
      det_model_array_buffer: detModel,
      cls_model_array_buffer: clsModel,
      rec_model_array_buffer: recModel,
      rec_char_dict: charset,
    });
    console.log("end onnxruntime-web");

    console.timeEnd("OCR Init");
    console.log("✅ OCR initialized successfully");

    return new Recognizer(ocr, cv, textSystem);
  }

  /** OCR 実行（内部 textSystem / cv を使用） */
  async run(input: HTMLCanvasElement | HTMLImageElement | Mat | ImageData) {
    if (!this.ocr) throw new Error("Recognizer not initialized (ocr missing)");
    if (!this.textSystem)
      throw new Error("Recognizer not initialized (textSystem missing)");
    if (!this.cv) throw new Error("Recognizer not initialized (cv missing)");

    console.time("🧠 OCR Run");

    const cv = this.cv;
    const textSystem = this.textSystem;
    let mat: Mat | null = null;
    let mat3ch: Mat | null = null;
    let shouldDeleteMat = false;

    try {
      const isInputMat = input && typeof (input as any).channels === "function";
      const isBitmap =
        input &&
        typeof (input as ImageData).height === "number" &&
        (input as ImageData).data instanceof Uint8ClampedArray;
      if (isInputMat) {
        mat = input as Mat;
        shouldDeleteMat = false;
      } else if (isBitmap) {
        mat = cv.matFromImageData(input as ImageData);
        shouldDeleteMat = true;
      } else {
        mat = cv.imread(input as HTMLCanvasElement | HTMLImageElement);
        shouldDeleteMat = true;
      }

      mat3ch = new cv.Mat();
      if (mat.channels() === 4) {
        cv.cvtColor(mat, mat3ch, cv.COLOR_RGBA2BGR);
      } else {
        mat.copyTo(mat3ch);
      }

      const results: OCRResult[] = await this.ocr.ocr(
        textSystem,
        mat3ch,
        true,
        true,
        true
      );
      console.timeEnd("🧠 OCR Run");
      console.log("📄 OCR Results:", results);
      return results;
    } catch (err) {
      console.error("❌ OCR run failed:", err);
      throw err;
    } finally {
      try {
        mat3ch?.delete();
      } catch {}
      if (shouldDeleteMat && mat) {
        try {
          mat.delete();
        } catch {}
      }
    }
  }

  /** キャッシュクリア */
  static async clearCache(): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction("resources", "readwrite");
      const store = tx.objectStore("resources");
      store.clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      console.log("✅ Cache cleared");
    } catch (err) {
      console.warn("⚠️ Failed to clear cache:", err);
    }
  }
}
