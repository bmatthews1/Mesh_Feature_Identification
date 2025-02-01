import './model.css';

import * as React from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { Canvas} from '@react-three/fiber';
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from 'three-stdlib';
import { Suspense} from "react";


const Model = () => {

    const gltf = useLoader(GLTFLoader, "./colored_glb.glb");
    const material = new THREE.ShaderMaterial({
        vertexShader : `
            attribute vec3 vColor;

            varying vec3 color;

            void main(){
                color = vColor;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader : `
            varying vec3 color;

            void main(){
                gl_FragColor = vec4(color, 1);
            }
        `,
    });
    gltf.scene.traverse(child => {
        if (child.type !== 'Mesh') return;

        const meshElement = child as THREE.Mesh;
        const mat         = meshElement.material as THREE.MeshStandardMaterial;
        let col = ["r", "g", "b"].map(e => mat.color[e]);

        let colors = new Float32Array(meshElement.geometry.attributes.position.count * 3).map((e, i) => col[i%3]);
        meshElement.geometry.setAttribute('vColor', new THREE.BufferAttribute(colors, 3));

        meshElement.material = material;
    });

    return <primitive object={gltf.scene} scale={0.4}/>;
};

export default function App() {

    return (
        <div className="App">
            <Canvas>
                <Suspense fallback={null}>
                    <Model/>
                    <OrbitControls/>
                </Suspense>
            </Canvas>
        </div>
    );
}

// interface ModelEntity {
//     bufferGeometry: THREE.BufferGeometry;
//     color: string;
// }

// export const Model = (): JSX.Element => {
//     const [modelEnts, setModelEnts] = React.useState<ModelEntity[]>([]);

//     React.useEffect(() => {
//         new GLTFLoader().load('./colored_glb.glb', gltf => {
//             const newModuleEntities: ModelEntity[] = [];
//             gltf.scene.traverse(element => {
//                 if (element.type !== 'Mesh') return;

//                 const meshElement = element as THREE.Mesh;
//                 const mat         = meshElement.material as THREE.MeshStandardMaterial;

//                 let col = ["r", "g", "b"].map(e => Math.floor(mat.color[e]*256));

//                 console.log(`rgb(${col[0]}, ${col[1]}, ${col[2]})`);
//                 newModuleEntities.push({
//                     bufferGeometry: meshElement.geometry as THREE.BufferGeometry,
//                     color: `rgb(${col[0]}, ${col[1]}, ${col[2]})`,
//                 });
//             });
//             setModelEnts(newModuleEntities);
//         });

//     }, [])

//     return (
//         <div className="canvas-container">
//             <Canvas camera={{ position: [0, 0, 300] }} >
//                 <ambientLight />
//                 <OrbitControls makeDefault />
//                 <group>
//                     {
//                         modelEnts.map((ent, index) => (
//                             <mesh
//                                 geometry={ent.bufferGeometry}
//                                 key={index}
//                             >
//                                 <meshStandardMaterial color={ent.color} />
//                             </mesh>
//                         ))
//                     }
//                 </group>
//             </Canvas>
//         </div>
//     )
// };