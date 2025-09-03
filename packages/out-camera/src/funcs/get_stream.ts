"use client"

export function getStream(){
  // 外カメを優先的に取得
  // それが失敗した場合は内カメを取得
  navigator.mediaDevices.getDisplayMedia({
    video: {
      facingMode: "environment"
    }
  });
}