import type cvReadyPromise from "@techstark/opencv-js";
import type * as ort from "onnxruntime-web";
import type { ONNXPaddleOCR } from "onnx-ocr-js";
import type { ReactNode } from "react";

export type CV2 = Awaited<typeof cvReadyPromise>;
export type ORT = typeof ort;
export type TextSystem = Awaited<ReturnType<ONNXPaddleOCR["init"]>>;
export type Point = [number, number];
export type Box = [Point, Point, Point, Point];
export type OCRResult = [Box, [string, number]];

export interface ClientImageProviderProps {
  children: ReactNode;
  /** モデルファイルのパス設定 */
  modelPaths?: {
    det_model_path: string;
    cls_model_path: string;
    rec_model_path: string;
    rec_char_dict_path: string;
  };
  onnx_wasm_path?: string;
  /** カスタムローディング表示 */
  loadingComponent?: ReactNode;
  /** カスタムエラー表示 */
  errorComponent?: (error: Error) => ReactNode;
}
