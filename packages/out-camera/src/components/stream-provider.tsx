import { ReactNode } from "react";
import { StreamClientProvider } from "../_components/stream-client-provider";

export function StreamProvider({children}: { children: ReactNode }) {
  // video => canvasを提供するコンポーネント

  return (
    <StreamClientProvider option={{video:{
      
    }}}>
      {children}
    </StreamClientProvider>
  );
}
