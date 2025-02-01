import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

//-- Globals ----------------------------------------------
    //-- File Path Constants:
        const dataFolder = '/data_dump_copy';
        const modelPath = `${dataFolder}/colored_glb.glb`;
        const jsonFiles = ["adjacency_graph", "adjacency_graph_edge_metadata", "entity_geometry_info", "rgb_id_to_entity_id_map"];

    //-- Three.js:
        const loader = new GLTFLoader();

    //-- Data Containers:
        let gltfMeshes = [];
        let jsonData = {};

//-- Utils ------------------------------------------------
    let emptyFn = () => {};

//-- Data Loader Helper Functions -------------------------
    let modelLoaded = false;
    let filesLoaded = 0;

    let loadModel = (path) => {
        loader.load(path, gltf => {
            gltf.scene.traverse(child => {
                if (!child.isMesh) return;

                //retrieve geometry, id, and color information
                gltfMeshes.push({
                    id : child.id,
                    normals : child.geometry.attributes.normal.array,
                    positions : child.geometry.attributes.position.array,
                    color : ["r", "g", "b"].map(e => child.material.color[e])
                });
            });
            console.log(gltfMeshes);
            modelLoaded = true;
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
            });
        }
    }

    let areFilesLoaded = () => {
        return modelLoaded && filesLoaded == 4;
    }

loadData();