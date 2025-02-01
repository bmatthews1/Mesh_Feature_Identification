import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const modelPath = '/data_dump_copy/colored_glb.glb';

console.log("test");

let gltfMeshes = [];
const loader = new GLTFLoader();

let loadModel = () => {
    loader.load(modelPath, gltf => {
        gltf.scene.traverse(child => {
            if (!child.isMesh) return;

            const mat = child.material;
            gltfMeshes.push({
                id : child.id,
                normals : child.geometry.attributes.normal.array,
                positions : child.geometry.attributes.position.array,
                color : ["r", "g", "b"].map(e => child.material.color[e])
            });
        });
        console.log(gltfMeshes);
    });
}

loadModel();