"use client"

import isMobile from "ismobilejs";

export function isUseOutCamera():boolean {
  // 外カメを使う条件
  // 1. デバイスが外カメ対応している
  // 2. モバイルである
  // 3. ズームが有効である
  const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
  const isMobileDevice = isMobile(window.navigator).any;
  const isOutCameraSupported = 
    supportedConstraints.facingMode && 
    "zoom" in supportedConstraints && 
    !!supportedConstraints.zoom &&
    isMobileDevice;

  return isOutCameraSupported ?? false;
}

export function isUseInCamera():boolean {
  // 1. デバイスがスケーラブルカメラに対応している
  // 2. ズームが有効である
  const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
  const isScalableCameraSupported = 
    "zoom" in supportedConstraints && 
    !!supportedConstraints.zoom && 
    supportedConstraints.facingMode

  return isScalableCameraSupported ?? false
}