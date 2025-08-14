declare module 'opencv-react' {
  interface OpenCvInstance {
    loaded: boolean;
    cv: any; 
  }

  interface OpenCvProviderProps {
    openCvVersion?: string;
    openCvPath?: string;
    children: React.ReactNode;
  }

  export const OpenCvContext: React.Context<OpenCvInstance>;
  
  export const OpenCvConsumer: React.Consumer<OpenCvInstance>;
  
  export const OpenCvProvider: React.FC<OpenCvProviderProps>;
  
  export function useOpenCv(): OpenCvInstance;
}