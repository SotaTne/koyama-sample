import { ImageActionProvider } from "@kyosan-map/out-camera/components/image-action-provider";
import { CameraProvider } from "./_components/camera_provider";

export default function Page(){
  return (
    <ImageActionProvider>
      <CameraProvider/>
    </ImageActionProvider>
    // <div>
    //   out camera page
    // </div>
  )
}