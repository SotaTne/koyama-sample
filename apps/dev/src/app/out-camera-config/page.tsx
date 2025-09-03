"use client"

import { useEffect, useState } from "react";
import { isUseInCamera, isUseOutCamera } from "@kyosan-map/out-camera/lib/camera-options";

export default function Page() {
  const [isInCamera, setIsInCamera] = useState(false);
  const [isOutCamera, setIsOutCamera] = useState(false);

  useEffect(() => {
    setIsInCamera(isUseInCamera());
    setIsOutCamera(isUseOutCamera());
  }, []);

  return (
    <div>
      <h1>isInCamera(PC) {isInCamera ? "Yes" : "No"}</h1>
      <h1>isOutCamera(Mobile) {isOutCamera ? "Yes" : "No"}</h1>
    </div>
  );
}