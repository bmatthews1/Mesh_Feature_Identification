import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import { WGLB } from './webgl_boilerplate.js';

//-- Globals ----------------------------------------------
    //-- File Path Constants:
        const dataFolder = '/data_dump_copy';
        const modelPath = `${dataFolder}/colored_glb.glb`;
        const jsonFiles = ["adjacency_graph", "adjacency_graph_edge_metadata", "entity_geometry_info", "rgb_id_to_entity_id_map"];

    //-- GLTF:
        const loader = new GLTFLoader();

    //-- Math Constants:
        const PI = Math.PI;
        const TAU = Math.PI*2;
        const MAXVAL = Number.MAX_VALUE;

    //-- Data Containers:
        let gltfMeshes = [];
        let modelBounds = [MAXVAL, MAXVAL, MAXVAL, -MAXVAL, -MAXVAL, -MAXVAL]; //xyz min, xyz max
        let modelRadius = 0;
        let modelCenter = [0, 0, 0];
        let jsonData = {};
    
    //-- Data Accessors:
        const xyzSwizzle = ['x', 'y', 'z'];

//-- Utils ------------------------------------------------
    let emptyFn = () => {};

//-- Data Loader Helper Functions -------------------------
    let modelLoaded = false;
    let filesLoaded = 0;

    let loadModel = (path) => {
        loader.load(path, gltf => {
            let idx = 0;
            let offset = 0;

            gltf.scene.traverse(child => {
                if (!child.isMesh) return;
                if (idx == 0) console.log(child);

                let geom = child.geometry;
                let attributes = geom.attributes;

                // retrieve geometry, id, and color information from gltf data
                let meshProxy = {
                    id : child.id,
                    normals : [...attributes.normal.array],
                    positions : [...attributes.position.array],
                    faces : [...geom.index.array],
                    color : ["r", "g", "b"].map(e => child.material.color[e]),
                    idx : idx,
                    bounds : [
                        ...xyzSwizzle.map(e => geom.boundingBox.min[e]),
                        ...xyzSwizzle.map(e => geom.boundingBox.max[e]),
                    ],
                    name: child.name,
                    offset : offset,
                };

                gltfMeshes.push(meshProxy);
                idx++;
                offset += child.geometry.attributes.position.array.length/3;
                
                for (let i = 0; i < 6; i++){
                    let fn = i < 3 ? Math.min : Math.max;
                    modelBounds[i] = fn(modelBounds[i], meshProxy.bounds[i]);
                };
            });
            console.log(gltfMeshes);
            console.log(modelBounds);
            modelRadius = Math.hypot(modelBounds[3]-modelBounds[0], modelBounds[4]-modelBounds[1], modelBounds[5]-modelBounds[2])/2;
            modelCenter = [
                (modelBounds[3]+modelBounds[0])/2, 
                (modelBounds[4]+modelBounds[1])/2,
                (modelBounds[5]+modelBounds[2])/2,
            ];
            console.log(modelRadius);
            console.log(modelCenter);
            modelLoaded = true;
            checkGLReadyState();
        });
    }

    let loadJSON = (filePath, success=emptyFn, err=emptyFn) => {
        fetch(filePath)
        .then(response => response.json())
        .then(success)
        .catch(err);
    }

    let loadData = () => {
        loadModel(modelPath);
        for (let file of jsonFiles){
            loadJSON(`${dataFolder}/${file}.json`, data => {
                jsonData[file] = data;
                filesLoaded++;
                checkGLReadyState();
            });
        }
    }

    let allFilesAreLoaded = () => {
        console.log(modelLoaded, filesLoaded);
        return modelLoaded && filesLoaded == 4;
    }

    let checkGLReadyState = () => {
        if (allFilesAreLoaded()){
            console.log("all files loaded");
            WGLB.startGL(gltfMeshes);
            WGLB.setModelInfo(modelRadius, modelCenter);
        }
    }

loadData();