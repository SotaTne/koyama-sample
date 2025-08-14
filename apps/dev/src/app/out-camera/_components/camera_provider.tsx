"use client"
import { useRef, useEffect, useState, useCallback, use } from 'react';
import { useImagePreprocessor } from "@kyosan-map/out-camera/hooks/preprocess-hook";
import { useImageRecognizer } from "@kyosan-map/out-camera/hooks/recognizer-hook";
import { Recognizer } from '@kyosan-map/out-camera/lib/recognizer';

export function CameraProvider() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imagePreprocessor = useImagePreprocessor();
  const imageRecognizer = useImageRecognizer();


  // // カメラストリームの開始
  // const startCamera = useCallback(() => {
  //   try {
  //     // スマホの場合は背面カメラを優先
  //     const constraints: MediaStreamConstraints = {
  //       video: {
  //         facingMode: { ideal: 'environment' }, // 背面カメラを優先
  //         width: { ideal: 1280 },
  //         height: { ideal: 720 }
  //       },
  //       audio: false
  //     };

  //     const stream = use(navigator.mediaDevices.getUserMedia(constraints));

  //     if (videoRef.current) {
  //       videoRef.current.srcObject = stream;
  //       videoRef.current.play();
  //       setIsStreaming(true);
  //       setError(null);
  //     }
  //   } catch (err) {
  //     console.error('Camera access error:', err);
  //     setError('カメラへのアクセスに失敗しました。');
  //   }
  // }, []);

  // // カメラストリームの停止
  // const stopCamera = useCallback(() => {
  //   if (videoRef.current?.srcObject) {
  //     const stream = videoRef.current.srcObject as MediaStream;
  //     stream.getTracks().forEach(track => track.stop());
  //     videoRef.current.srcObject = null;
  //   }
  //   setIsStreaming(false);
  // }, []);

  // // 画像キャプチャと処理
  // const captureAndProcess = useCallback(async () => {
  //   if (!videoRef.current || !canvasRef.current || !isStreaming) return;
    
  //   try {
  //     const video = videoRef.current;
  //     const canvas = canvasRef.current;
  //     const ctx = canvas.getContext('2d');
      
  //     if (!ctx) throw new Error('Canvas context not available');

  //     // キャンバスサイズをビデオサイズに合わせる
  //     canvas.width = video.videoWidth;
  //     canvas.height = video.videoHeight;

  //     // ビデオフレームをキャンバスに描画
  //     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  //     // 画像前処理の実行
  //     if (imagePreprocessor) {
  //       imagePreprocessor.process(canvas, canvas);
  //     }

  //     // テキスト認識の実行
  //     if (imageRecognizer) {
  //       const recognizedText = use(imageRecognizer.process(canvas));
  //       console.log('認識されたテキスト:', recognizedText);
  //     }

  //   } catch (err) {
  //     console.error('Image processing error:', err);
  //     setError('画像処理に失敗しました。');
  //   }
  // }, [isStreaming, imagePreprocessor, imageRecognizer]);

  // // コンポーネントマウント時にカメラを開始
  // useEffect(() => {
  //   startCamera();

  //   // クリーンアップ関数
  //   return () => {
  //     stopCamera();
  //   };
  // }, [startCamera, stopCamera]);

  // return (
  //   <div>
  //     <video
  //       ref={videoRef}
  //       width="100%"
  //       height="auto"
  //       onClick={captureAndProcess}
  //       playsInline
  //       muted
  //     />
      
  //     <canvas ref={canvasRef} style={{ display: 'none' }} />
      
  //     {error && <div>{error}</div>}
  //   </div>
  // );
  return <div>
    sample
  </div>
}