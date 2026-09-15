import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(new URL("three/examples/jsm/libs/draco/", import.meta.url).href);

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

export function loadGLTF(url: string): Promise<GLTF> {
  return gltfLoader.loadAsync(url);
}