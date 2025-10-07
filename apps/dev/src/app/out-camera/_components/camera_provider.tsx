"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

import { WebGLCanvasCamera } from "@kyosan-map/out-camera/components/scalable-video";
import { useImageRecognizer } from "@kyosan-map/out-camera/hooks/recognizer-hook";
import { findNearestOCRBox } from "@kyosan-map/out-camera/functions/box_distance";
import { ImageActionProvider } from "@kyosan-map/out-camera/components/image-action-provider";
import type { OCRResult, Point } from "@kyosan-map/out-camera/types/type";

/**
 * ==========================================
 * 内部カメラコンポーネント
 * ==========================================
 */
function CameraInner() {
  const recognizer = useImageRecognizer();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<OCRResult[] | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /** 🚀 カメラ開始 */
  const startCamera = useCallback(async () => {
    console.log("[startCamera] called");
    if (isStarting || isRunning) return;

    try {
      setIsStarting(true);
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      console.log("[startCamera] stream obtained:", s);
      streamRef.current = s;
      setStream(s);
      setIsRunning(true);
    } catch (err) {
      console.error("[startCamera] failed:", err);
      alert("カメラの起動に失敗しました。権限を確認してください。");
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, isRunning]);

  /** 🛑 カメラ停止 */
  const stopCamera = useCallback(() => {
    console.log("[stopCamera] called");
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsRunning(false);
  }, []);

  /** 🚫 unmount時もストリームを維持（iOS Safari対策） */
  useEffect(() => {
    console.log("[CameraInner] mount");
    return () => {
      console.log("[CameraInner] unmount (stream preserved)");
      // 🔥 stream は停止しない
    };
  }, []);

  /** 👆 タップ時のOCR処理 */
  const handleTap = useCallback(
    async (payload: { x: number; y: number; imageData: ImageData }) => {
      console.log("[handleTap] payload:", payload);

      if (!recognizer) {
        console.error("[handleTap] recognizer not ready");
        alert(
          "OCR がまだ初期化されていません。少し待ってから再試行してください。"
        );
        return;
      }

      try {
        console.log("[handleTap] OCR start");
        const resultsRaw = await recognizer.run(payload.imageData);

        const results: OCRResult[] = resultsRaw[0]! as unknown as OCRResult[];
        console.log("[handleTap] OCR results:", results);
        setLastResult(results);

        if (!results || results.length === 0) {
          alert("文字が検出されませんでした。");
          return;
        }

        const tap: Point = [payload.x, payload.y];
        const nearest = findNearestOCRBox(tap, results);
        console.log("[handleTap] nearest:", nearest);

        if (!nearest) {
          alert("適切な領域が見つかりませんでした。");
          return;
        }

        const text = nearest.text.trim();
        const ok = window.confirm(`OCR結果は「${text}」ですか？`);
        alert(
          ok ? "ありがとうございます！" : "別の領域をタップしてみてください。"
        );
      } catch (err) {
        console.error("[handleTap] error:", err);
        alert("OCR 実行中にエラーが発生しました。");
      }
    },
    [recognizer]
  );

  // --------------------------------------
  // ✅ JSX
  // --------------------------------------
  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Out-Camera OCR</h1>
        <div className="flex gap-2">
          <button
            onClick={startCamera}
            disabled={isStarting || isRunning}
            className={`px-4 py-2 rounded ${
              isStarting || isRunning
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isStarting ? "起動中..." : "カメラ開始"}
          </button>
          <button
            onClick={stopCamera}
            disabled={!isRunning}
            className={`px-4 py-2 rounded ${
              !isRunning
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
          >
            カメラ停止
          </button>
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-600">
        <div>Recognizer: {recognizer ? "✅ ready" : "⏳ loading..."}</div>
        <div>Camera: {isRunning ? "📷 起動中" : "⏸ 停止中"}</div>
      </div>

      {stream ? (
        <WebGLCanvasCamera
          stream={stream}
          width={500}
          height={500}
          onTap={handleTap}
          className="w-full h-auto"
        />
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-400">
          カメラを開始してください
        </div>
      )}

      <div className="mt-4">
        <details className="bg-gray-50 rounded-md p-3">
          <summary className="cursor-pointer select-none">
            デバッグ: 直近の OCR 結果
          </summary>
          <pre className="mt-2 text-xs whitespace-pre-wrap break-words">
            {lastResult
              ? JSON.stringify(lastResult, null, 2)
              : "（まだありません）"}
          </pre>
        </details>
      </div>
    </div>
  );
}

/**
 * ==========================================
 * 親コンポーネント（Providerを維持）
 * ==========================================
 */
export function CameraProvider() {
  console.log("[CameraProvider] mount");

  const modelPaths = useMemo(
    () => ({
      det_model_path: "https://ocr-file-server.pages.dev/ppocrv5/det/det.ort",
      cls_model_path: "https://ocr-file-server.pages.dev/ppocrv5/cls/cls.ort",
      rec_model_path: "https://ocr-file-server.pages.dev/ppocrv5/rec/rec.ort",
      rec_char_dict_path:
        "https://ocr-file-server.pages.dev/ppocrv5/ppocrv5_dict.txt",
    }),
    []
  );
  const onnx_wasm_path = useMemo(
    () => "https://ocr-file-server.pages.dev/ort/",
    []
  );

  return (
    <ImageActionProvider
      modelPaths={modelPaths}
      onnx_wasm_path={onnx_wasm_path}
      loadingComponent={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
            <div className="text-gray-700">
              OCR を初期化中です…（初回のみ時間がかかります）
            </div>
          </div>
        </div>
      }
      errorComponent={(error) => (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md p-4 bg-white rounded-lg shadow border">
            <h2 className="text-lg font-semibold text-rose-600 mb-2">
              初期化エラー
            </h2>
            <p className="text-gray-700 mb-3">{error.message}</p>
            <button
              className="px-3 py-2 bg-rose-600 text-white rounded hover:bg-rose-700"
              onClick={() => window.location.reload()}
            >
              リロード
            </button>
          </div>
        </div>
      )}
    >
      {/* ✅ Provider 内に残す */}
      <CameraInner />
    </ImageActionProvider>
  );
}
