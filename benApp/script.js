import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WGLB} from './webgl_boilerplate.js';
import {vec3} from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/+esm'

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
                    isPocket : false,
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

    //TODO replace this function with async await
    let checkGLReadyState = () => {
        if (allFilesAreLoaded()){
            console.log("all files loaded");
            findPockets(gltfMeshes);
            console.log(gltfMeshes);
            WGLB.startGL(gltfMeshes);
            WGLB.setModelInfo(modelRadius, modelCenter);
        }
    }

//-- Raycasting Model Features ----------------------------
    //TODO remove vec3 class for speed
    //see https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
    let rayTriangleIntersection = (rayOrigin, rayDirection, v0, v1, v2) => {
        const EPSILON = 0.0000001;

        // Find vectors for two edges sharing v0
        const edge1 = vec3.subtract(vec3.create(), v1, v0);
        const edge2 = vec3.subtract(vec3.create(), v2, v0);
      
        // Calculate determinant
        const pvec = vec3.cross(vec3.create(), rayDirection, edge2);
        const det = vec3.dot(edge1, pvec);
      
        // Check if ray and triangle are parallel
        if (Math.abs(det) < EPSILON) return null;
      
        const invDet = 1 / det;
      
        // Calculate distance from v0 to ray origin
        const tvec = vec3.subtract(vec3.create(), rayOrigin, v0);
      
        // Calculate barycentric coordinate u
        const u = vec3.dot(tvec, pvec) * invDet;
        if (u < 0 || u > 1) return null;
      
        // Calculate barycentric coordinate v
        const qvec = vec3.cross(vec3.create(), tvec, edge1);
        const v = vec3.dot(rayDirection, qvec) * invDet;
        if (v < 0 || u + v > 1) return null;
      
        // Calculate intersection distance
        const t = vec3.dot(edge2, qvec) * invDet;
      
        // Check if intersection is behind ray origin
        if (t < 0) return null;
      
        // Calculate intersection point
        const intersectionPoint = vec3.create();
        vec3.add(intersectionPoint, rayOrigin, vec3.scale(vec3.create(), rayDirection, t));
      
        return {t, intersectionPoint, u, v};
    }

    //TODO rename to origin points
    let createRayDetectionGrid = (modelCenter, modelRadius, pointsPerSide=100) => {
        let xRays = [];
        let zRays = [];
        for (let i = 0; i < pointsPerSide; i++){
            let iNorm = (i/pointsPerSide-0.5)*2;
            for (let j = 0; j < pointsPerSide; j++){
                let jNorm = (j/pointsPerSide-0.5)*2;

                if (Math.hypot(iNorm, jNorm) > 1) continue;
                let xRay = vec3.fromValues(
                    modelCenter[0] - modelRadius, 
                    modelCenter[1] + iNorm*modelRadius, 
                    modelCenter[2] + jNorm*modelRadius
                );
                let zRay = vec3.fromValues(
                    modelCenter[0] + iNorm*modelRadius, 
                    modelCenter[1] + jNorm*modelRadius,
                    modelCenter[2] - modelRadius
                );
                xRays.push(xRay);
                zRays.push(zRay);
            }
        }
        return {xRays, zRays};
    }

    let getTrianglesFromGLTFMeshes = (gltfMeshes) => {
        let triangles = [];
        for (let child of gltfMeshes){
            for (let i = 0; i < child.faces.length; i += 3){
                let indexes = child.faces.slice(i, i+3);
                let points = indexes.map(i => child.positions.slice(i*3, i*3+3)).map(p => vec3.fromValues(...p));
                //TODO replace this with normals extracted from the triangle points
                let norms  = indexes.map(i => child.normals.slice(i*3, i*3+3)).map(n => vec3.fromValues(...n));
                let normal = vec3.scaleAndAdd(
                    vec3.create(), 
                    vec3.add(vec3.create(), norms[0], norms[1]), 
                    norms[2], 1/3
                );
                triangles.push({
                    points,
                    normal,
                    idx : child.idx,
                    id : child.id,
                    isPocket : false,
                });
            }
        }
        return triangles;
    }

    let findPockets = (gltfMeshes) => {
        let triangles = getTrianglesFromGLTFMeshes(gltfMeshes);
        let {xRays, zRays} = createRayDetectionGrid(modelCenter, modelRadius, 500); //TODO add these to the model object
        let [xDir, zDir] = [vec3.fromValues(1, 0, 0), vec3.fromValues(0, 0, 1)];

        let sampleTriangles = [...triangles];

        let castRays = (rays, dir) => {
            for (let ray of rays){
                let hits = [];
                for (let i = 0; i < sampleTriangles.length; i++){
                    let tri = sampleTriangles[i];
                    let hitInfo = rayTriangleIntersection(ray, dir, tri.points[0], tri.points[1], tri.points[2]);
                    if (hitInfo){
                        // TODO - this optimization is not working. Why?
                        // sampleTriangles.splice(i, 1);
                        // i--;
                        hits.push({tri, hitInfo});
                    }
                }
                if (hits.length <= 2) continue;
                let getDist = hit => vec3.distance(ray, hit.hitInfo.intersectionPoint);
                hits = hits.sort((a, b) => getDist(a)-getDist(b));
                hits.slice(1, hits.length-1).map(hit => hit.tri.isPocket = true);
            }
        }

        castRays(xRays, xDir);
        castRays(zRays, zDir);

        for (let tri of triangles.filter(tri => tri.isPocket)) gltfMeshes[tri.idx].isPocket = true;
        for (let mesh of gltfMeshes.filter(mesh => mesh.isPocket)) mesh.color = [0, 0, 1];
        
    }

loadData();