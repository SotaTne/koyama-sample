"use client";

import { useState, useEffect, useMemo } from "react";
import { ImagePreprocessContext } from "../contexts/preprocess-context";
import { ImageRecognizerContext } from "../contexts/recognizer-context";
import { ImagePreprocessor } from "../lib/image-preprocess";
import { Recognizer } from "../lib/recognizer";
/// @ts-ignore
import { useOpenCv } from "opencv-react";
import { ClientImageProviderProps } from "../types/type";

// デフォルトのモデルパス
const DEFAULT_MODEL_PATHS = {
  det_model_path: "/models/ppocrv5/det/det.onnx",
  cls_model_path: "/models/ppocrv5/cls/cls.onnx",
  rec_model_path: "/models/ppocrv5/rec/rec.onnx",
  rec_char_dict_path: "/models/ppocrv5/ppocrv5_dict.txt",
};

const DEFAULT_ONNX_WASM_PATH = "/ort-wasm-simd-threaded.jsep.wasm";

export function ClientImageProvider({
  children,
  modelPaths = DEFAULT_MODEL_PATHS,
  loadingComponent,
  onnx_wasm_path = DEFAULT_ONNX_WASM_PATH,
  errorComponent,
}: ClientImageProviderProps) {
  const [preprocessor, setPreprocessor] = useState<ImagePreprocessor | null>(
    null
  );
  const [recognizer, setRecognizer] = useState<Recognizer | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loadingState, setLoadingState] = useState<string>("Initializing...");

  const { cv, loaded: cvLoaded } = useOpenCv();

  // modelPathsを安定化（参照の変化を防ぐ）
  const stablePaths = useMemo(
    () => modelPaths,
    [
      modelPaths.det_model_path,
      modelPaths.cls_model_path,
      modelPaths.rec_model_path,
      modelPaths.rec_char_dict_path,
      onnx_wasm_path,
    ]
  );

  useEffect(() => {
    if (!cvLoaded || !cv) return;

    let isMounted = true;

    const initialize = async () => {
      console.time("[ClientImageProvider] Full Initialization Time");
      try {
        // 1. ImagePreprocessor の初期化
        setLoadingState("Initializing image preprocessor...");
        const preprocessorInstance = new ImagePreprocessor(cv);

        if (!isMounted) return;
        setPreprocessor(preprocessorInstance);

        // 2. Recognizer の初期化（モデルロード）
        setLoadingState("Loading OCR models...");
        console.time("[ClientImageProvider] Recognizer Initialization Time");
        const result = await Recognizer.create({
          det_model_path: stablePaths.det_model_path,
          cls_model_path: stablePaths.cls_model_path,
          rec_model_path: stablePaths.rec_model_path,
          rec_char_dict_path: stablePaths.rec_char_dict_path,
          onnx_wasm_path,
          cv,
        });
        console.timeEnd("[ClientImageProvider] Recognizer Initialization Time");

        if (!isMounted) return;
        setRecognizer(result);
        setLoadingState("Ready");
      } catch (err) {
        console.error("Failed to initialize image processing:", err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
      console.timeEnd("[ClientImageProvider] Full Initialization Time");
    };

    initialize();

    return () => {
      isMounted = false;
      if (preprocessor) {
        preprocessor.cleanup();
      }
    };
  }, [cv, cvLoaded, stablePaths]);

  // エラー表示
  if (error) {
    if (errorComponent) {
      return <>{errorComponent(error)}</>;
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-600 mb-2">初期化エラー</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            リロード
          </button>
        </div>
      </div>
    );
  }

  // ローディング表示
  if (!preprocessor || !recognizer || !cv) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-lg font-medium text-gray-700">{loadingState}</p>
          <p className="text-sm text-gray-500 mt-2">
            初回読み込みには時間がかかる場合があります
          </p>
        </div>
      </div>
    );
  }

  return (
    <ImagePreprocessContext value={preprocessor}>
      <ImageRecognizerContext value={recognizer}>
        {children}
      </ImageRecognizerContext>
    </ImagePreprocessContext>
  );
}

// ===========================
// 使用例
// ===========================

/*
// 1. 基本的な使い方（デフォルト設定）
function App() {
  return (
    <ClientImageProvider>
      <YourApp />
    </ClientImageProvider>
  );
}

// 2. カスタムモデルパス
function App() {
  return (
    <ClientImageProvider
      modelPaths={{
        det_model_path: "/custom/det.onnx",
        cls_model_path: "/custom/cls.onnx",
        rec_model_path: "/custom/rec.onnx",
        rec_char_dict_path: "/custom/dict.txt",
      }}
    >
      <YourApp />
    </ClientImageProvider>
  );
}

// 3. カスタムローディング表示
function App() {
  return (
    <ClientImageProvider
      loadingComponent={
        <div className="custom-loading">
          <h1>Loading OCR...</h1>
        </div>
      }
    >
      <YourApp />
    </ClientImageProvider>
  );
}

// 4. カスタムエラー表示
function App() {
  return (
    <ClientImageProvider
      errorComponent={(error) => (
        <div className="custom-error">
          <h1>エラーが発生しました</h1>
          <p>{error.message}</p>
        </div>
      )}
    >
      <YourApp />
    </ClientImageProvider>
  );
}

// 5. 環境変数からパスを取得
function App() {
  const modelPaths = {
    det_model_path: process.env.NEXT_PUBLIC_DET_MODEL_PATH || "/models/det.onnx",
    cls_model_path: process.env.NEXT_PUBLIC_CLS_MODEL_PATH || "/models/cls.onnx",
    rec_model_path: process.env.NEXT_PUBLIC_REC_MODEL_PATH || "/models/rec.onnx",
    rec_char_dict_path: process.env.NEXT_PUBLIC_DICT_PATH || "/models/dict.txt",
  };

  return (
    <ClientImageProvider modelPaths={modelPaths}>
      <YourApp />
    </ClientImageProvider>
  );
}

// 6. コンテキストの使用（正しい使い方）
import { useContext } from "react";
import { useOpenCv } from "opencv-react";

function YourComponent() {
  const preprocessor = useContext(ImagePreprocessContext);
  const { recognizer, textSystem } = useContext(ImageRecognizerContext);
  const { cv } = useOpenCv();

  const handleOCR = async (canvas: HTMLCanvasElement) => {
    try {
      // 前処理
      const mat = preprocessor.execute(canvas);
      
      // OCR実行
      const results = await Recognizer.run(recognizer, textSystem, mat, cv);
      
      // クリーンアップ
      preprocessor.cleanup();
      
      console.log("OCR Results:", results);
      return results;
    } catch (error) {
      console.error("OCR failed:", error);
      throw error;
    }
  };

  return <button onClick={() => handleOCR(myCanvas)}>OCR実行</button>;
}

// 7. InteractiveCameraViewとの統合
function CameraPage() {
  const preprocessor = useContext(ImagePreprocessContext);
  const { recognizer, textSystem } = useContext(ImageRecognizerContext);
  const { cv } = useOpenCv();
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(setStream)
      .catch(console.error);
  }, []);

  const handleCapture = async (data: { x: number; y: number; canvas: HTMLCanvasElement }) => {
    try {
      // 前処理
      const mat = preprocessor.execute(data.canvas, {
        denoise: true,
        clahe: true
      });
      
      // OCR実行
      const results = await Recognizer.run(recognizer, textSystem, mat, cv);
      
      console.log(`タップ座標: (${data.x}, ${data.y})`);
      console.log("認識結果:", results);
      
      // クリーンアップ
      preprocessor.cleanup();
    } catch (error) {
      console.error("OCR処理エラー:", error);
    }
  };

  if (!stream) return <div>カメラ起動中...</div>;

  return (
    <InteractiveCameraView
      stream={stream}
      width={640}
      height={480}
      onTap={handleCapture}
    />
  );
}
*/
