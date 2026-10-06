import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { configureKtx2Support } from '../lib/ktx2-loader'

const useGLTFKTX2 = (path: string): ReturnType<typeof useGLTF> => {
  const gl = useThree((state) => state.gl)

  // AppFront: Draco tự host (`public/draco/`); mặc định của drei là gstatic, CSP chặn (FIX-380).
  return useGLTF(path, '/draco/', true, (loader) => {
    configureKtx2Support(loader, gl)
    loader.setMeshoptDecoder(MeshoptDecoder)
  })
}

export { useGLTFKTX2 }
