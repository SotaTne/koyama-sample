import { ImageActionProvider } from "@kyosan-map/out-camera/components/image-action-provider";
import {CameraProvider} from "./_components/camera_provider";
import { StreamProvider } from "@kyosan-map/out-camera/components/stream-provider";

export default function Page(){
  return (
    <ImageActionProvider>
      <StreamProvider>
        <CameraProvider/>
      </StreamProvider>
    </ImageActionProvider>
    // <div>
    //   out camera page
    // </div>
  )
}