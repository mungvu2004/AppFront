import type { Group } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const SITE_FLAG_MODEL_BASE64 = [
  'Z2xURgIAAADgAwAAAAMAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6ImdsVEYtVHJhbnNmb3JtIHY0LjMuMCIsInZlcnNpb24i',
  'OiIyLjAifSwiYWNjZXNzb3JzIjpbeyJ0eXBlIjoiU0NBTEFSIiwiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjE2OH0seyJ0',
  'eXBlIjoiVkVDMyIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjozMCwibWF4IjpbMC4wMDY3MzM3MTM2NzE1NjUwNTYsMC4w',
  'MDYyNDAyODE3NDIwNjYxNDUsMC4wMDAzNDc5ODc2MDMxNjMzNDY2NV0sIm1pbiI6Wy0wLjAwMDMwMTM2NjExODk0NzA0NCwtMC4w',
  'MDAzNDc5ODc2MDMxNjMzNDY2NSwtMC4wMDAzNDc5ODc4NjUwOTc4MjA3Nl19XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwi',
  'Ynl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6MTkzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjE5M31dLCJtZXNoZXMiOlt7',
  'InByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjF9LCJtb2RlIjo0LCJpbmRpY2VzIjowLCJleHRlbnNpb25z',
  'Ijp7IktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uIjp7ImJ1ZmZlclZpZXciOjAsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjB9',
  'fX19XX1dLCJub2RlcyI6W3sic2NhbGUiOlsxMDAsMTAwLDEwMF0sIm1lc2giOjB9XSwic2NlbmVzIjpbeyJub2RlcyI6WzBdfV0s',
  'InNjZW5lIjowLCJleHRlbnNpb25zVXNlZCI6WyJLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbiJdLCJleHRlbnNpb25zUmVxdWly',
  'ZWQiOlsiS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24iXX0gICDEAAAAQklOAERSQUNPAgIBAQAAAB44ADcDAA7f6qkv1VVRZfUo',
  '1qKKAgEBEAH/AAABAAkDAAACAQEBAA0DEREXaQaJCEUEiQg1EwsuVMV2v4nwGqm5Tl7xigAAAFMDACwAZQAcaFlXAMoAAJS7Umpl',
  'CAIAyqteasnAqAAAAEt9IJaxqKVWGb4CAIBXSq0MAKDUyQAA/CcAQABAmVEBAADA1KdWGV4BKPOK/1QGgAWQDAAAAAD/DwAArQCe',
  'uRtytrkkcra5h4bmOwwAAAA=',
].join('')

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

const SITE_FLAG_MODEL_BUFFER = decodeBase64ToArrayBuffer(SITE_FLAG_MODEL_BASE64)

let dracoLoader: DRACOLoader | undefined
let gltfPromise: Promise<GLTF> | undefined
let gltfResult: GLTF | undefined
let gltfError: unknown

// three.js FileLoader nay luôn `fetch()` cả data: URI (không còn nhánh giải trực
// tiếp như bản cũ) — nên truyền `data:model/gltf-binary` cho `useGLTF` kích CSP
// `connect-src` dù không request nào rời máy. Mẫu đã có sẵn dạng base64 trong mã
// nên giải ArrayBuffer rồi gọi `GLTFLoader.parse()` thẳng, không qua FileLoader.
function loadSiteFlagGltf(decoderPath: string): Promise<GLTF> {
  if (!gltfPromise) {
    const loader = new GLTFLoader()
    dracoLoader ??= new DRACOLoader()
    dracoLoader.setDecoderPath(decoderPath)
    loader.setDRACOLoader(dracoLoader)
    gltfPromise = new Promise<GLTF>((resolve, reject) => {
      loader.parse(SITE_FLAG_MODEL_BUFFER, '', resolve, reject)
    })
  }
  return gltfPromise
}

/** Gốc Suspense thủ công — cùng khuôn `useLoader`/`useGLTF` dùng (ném promise lúc đang chờ). */
export function useSiteFlagScene(decoderPath: string): Group {
  if (gltfError !== undefined) throw gltfError
  if (!gltfResult) {
    throw loadSiteFlagGltf(decoderPath).then(
      (gltf) => {
        gltfResult = gltf
      },
      (error: unknown) => {
        gltfError = error
      },
    )
  }
  return gltfResult.scene
}
