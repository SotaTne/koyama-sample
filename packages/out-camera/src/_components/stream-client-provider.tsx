"use client"

import { ReactNode, useEffect, useState, useRef } from "react";
import { isUseOutCamera, isUseInCamera } from "../lib/camera-options";
import { StreamContext } from "../contexts/stream-context";

interface ExtraMediaTrackConstraints extends MediaStreamConstraints {
  video: Omit<MediaTrackConstraints, 'facingMode'>,

}

export function StreamClientProvider({children,option}: { children: ReactNode, option:ExtraMediaTrackConstraints  }) {
  const [useableMobileOutCamera, setUsableMobileOutCamera] = useState<null|boolean>(null);
  const [useableInCamera, setUsableInCamera] = useState<null|boolean>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null); // 現在のstreamを追跡

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setUsableInCamera(isUseInCamera());
    setUsableMobileOutCamera(isUseOutCamera());
  }, []);

  useEffect(() => {
    if (useableInCamera === null || useableMobileOutCamera === null) return;
    if (!navigator.mediaDevices?.getUserMedia) return;

    // 既存のstreamをクリーンアップ
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach(track => track.stop());
      currentStreamRef.current = null;
      setStream(null);
    }

    const constraints: MediaStreamConstraints = {
      ...option,
      video: { facingMode: useableMobileOutCamera ? "environment" : "user" }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(newStream => {
        const [track] = newStream.getVideoTracks();
        
        // zoom制約の適用（一度だけ）
        const caps = track?.getCapabilities?.();
        if (caps && "zoom" in caps && caps.zoom) {
          track?.applyConstraints({ advanced: [{ zoom: 1 }] } as any)
            .catch(error => console.warn("Failed to apply zoom constraint:", error));
        }
        
        currentStreamRef.current = newStream;
        setStream(newStream);
      })
      .catch(error => {
        console.error("Error accessing media devices.", error);
        setStream(null);
      });

    // クリーンアップ関数
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
        currentStreamRef.current = null;
      }
    };
  }, [useableInCamera, useableMobileOutCamera]);

  // コンポーネントのアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (!stream) return null;

  return (
    <StreamContext value={stream}>
      {children}
    </StreamContext>
  );
}