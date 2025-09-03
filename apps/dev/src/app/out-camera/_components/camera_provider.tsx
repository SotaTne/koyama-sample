"use client"

import { useImagePreprocessor } from '@kyosan-map/out-camera/hooks/preprocess-hook';
import { useImageRecognizer } from '@kyosan-map/out-camera/hooks/recognizer-hook';
import { useStream } from '@kyosan-map/out-camera/hooks/stream-hook';
import { useRef, useEffect, useState, useCallback } from 'react';

export function CameraProvider() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
  const imagePreprocess = useImagePreprocessor();
  const imageRecognizer = useImageRecognizer();
  const stream = useStream();

  // カメラストリームの開始
  const startCamera = useCallback(async () => {
    if (isStreaming) return; // 既に起動中の場合は何もしない
    
    try {
      // 既存のストリームがあれば停止
      stopCamera();
      
      // スマホの場合は背面カメラを優先
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' }, // 背面カメラを優先
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // loadedmetadata イベントを待ってから play を呼ぶ
        const playPromise = new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          
          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.play()
              .then(() => resolve())
              .catch(reject);
          };
          
          if (video.readyState >= 1) {
            // 既にメタデータが読み込まれている場合
            video.play().then(() => resolve()).catch(reject);
          } else {
            video.addEventListener('loadedmetadata', onLoadedMetadata);
          }
        });
        
        await playPromise;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('カメラへのアクセスに失敗しました。カメラの許可を確認してください。');
    }
  }, [isStreaming]);

  // カメラストリームの停止
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // コンポーネントマウント時にカメラを開始
  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      if (mounted) {
        await startCamera();
      }
    };
    
    initCamera();

    // クリーンアップ関数
    return () => {
      mounted = false;
      stopCamera();
    };
  }, []); // 依存配列を空にして初回のみ実行

  const handleVideoClick = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !canvasRef.current || !isStreaming  || !resultCanvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const resultCanvas = resultCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const resultCtx = resultCanvas.getContext('2d');

      if (!ctx || !resultCtx) throw new Error('Canvas context not available');

      // タップ位置の計算
      const rect = video.getBoundingClientRect();
      const scaleX = video.videoWidth / rect.width;
      const scaleY = video.videoHeight / rect.height;
      
      const tapX = (event.clientX - rect.left) * scaleX;
      const tapY = (event.clientY - rect.top) * scaleY;
      
      setTapPosition({ x: Math.round(tapX), y: Math.round(tapY) });

      // キャンバスサイズをビデオサイズに合わせる
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      resultCanvas.width = video.videoWidth;
      resultCanvas.height = video.videoHeight;

      // ビデオフレームをキャンバスに描画
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      //imagePreprocess.processOptimized(canvas,resultCanvas);
      //imagePreprocess.processNone(canvas,resultCanvas);
      imagePreprocess.processWithMorphology(canvas, resultCanvas);

      if (resultCanvas && imageRecognizer) {
        imageRecognizer.process(resultCanvas).then((result)=>{
          console.log('認識結果"""')
          result.forEach((block, index)=>{
            console.log(`Block ${index}:`, JSON.stringify(block.bbox,null,2));
            console.log(`Block ${index}:`, block.text);
        })
        console.log('"""')
        
        console.log('タップ位置:', JSON.stringify(tapPosition,null,2));
        console.log('キャンバスサイズ:', { width: canvas.width, height: canvas.height });
        console.log('キャンバス作成完了');
      })
    }


    } catch (err) {
      console.error('Video click processing error:', err);
      setError('画像キャプチャに失敗しました。');
    }
  }, [isStreaming]);

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="relative">
        <video
          ref={videoRef}
          className="w-full h-auto border rounded-lg"
          playsInline
          muted
          autoPlay
          onClick={handleVideoClick}
        />

        <h2 className="mt-4 text-lg font-semibold">
          Scan Canvas
        </h2>
        <canvas ref={canvasRef} className="w-full h-auto border rounded-lg" />
        <h2>
          Result Canvas
        </h2>
        <canvas ref={resultCanvasRef} className="w-full h-auto border rounded-lg" />

        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <p className="text-gray-500">カメラを起動中...</p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={startCamera}
          disabled={isStreaming}
          className={`px-4 py-2 rounded ${
            isStreaming 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          カメラ開始
        </button>
        
        <button
          onClick={stopCamera}
          disabled={!isStreaming}
          className={`px-4 py-2 rounded ${
            !isStreaming 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          カメラ停止
        </button>
      </div>

      <div className="mt-2 text-sm text-gray-600">
        ステータス: {isStreaming ? 'カメラ起動中' : 'カメラ停止中'}
      </div>
    </div>
  );
}