import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { configureKtx2Support } from '../lib/ktx2-loader'

// AppFront (FIX-380): đổi luôn MẶC ĐỊNH Draco của drei từ gstatic (CSP chặn) sang
// `/draco/` tự host, để một lời gọi mới `useGLTF(p, true)` ở bất cứ đâu cũng không
// rơi về gstatic. Biến ấy là của module `drei/core/Gltf`, dùng chung toàn gói.
useGLTF.setDecoderPath('/draco/')

const useGLTFKTX2 = (path: string): ReturnType<typeof useGLTF> => {
  const gl = useThree((state) => state.gl)

  // AppFront: Draco tự host (`public/draco/`); mặc định của drei là gstatic, CSP chặn (FIX-380).
  return useGLTF(path, '/draco/', true, (loader) => {
    configureKtx2Support(loader, gl)
    loader.setMeshoptDecoder(MeshoptDecoder)
  })
}

export { useGLTFKTX2 }
