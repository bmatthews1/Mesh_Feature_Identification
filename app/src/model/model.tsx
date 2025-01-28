import './model.css';

import * as React from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { GLTFLoader } from 'three-stdlib';

interface ModelEntity {
    bufferGeometry: THREE.BufferGeometry;
    color: string;
}

export const Model = (): JSX.Element => {
    const [modelEnts, setModelEnts] = React.useState<ModelEntity[]>([]);

    React.useEffect(() => {
        new GLTFLoader().load('./colored_glb.glb', gltf => {
            const newModuleEntities: ModelEntity[] = [];
            gltf.scene.traverse(element => {
                if (element.type !== 'Mesh') return;

                const meshElement = element as THREE.Mesh;
                newModuleEntities.push({
                    bufferGeometry: meshElement.geometry as THREE.BufferGeometry,
                    color: 'rgb(120, 120, 120)',
                });
            });
            setModelEnts(newModuleEntities);
        });

    }, [])

    return (
        <div className="canvas-container">
            <Canvas camera={{ position: [0, 0, 300] }} >
                <ambientLight />
                <OrbitControls makeDefault />
                <group>
                    {
                        modelEnts.map((ent, index) => (
                            <mesh
                                geometry={ent.bufferGeometry}
                                key={index}
                            >
                                <meshStandardMaterial color={ent.color} />
                            </mesh>
                        ))
                    }
                </group>
            </Canvas>
        </div>
    )
};