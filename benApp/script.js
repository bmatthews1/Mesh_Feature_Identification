import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WGLB} from './webgl_boilerplate.js';

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
        const epsilon = 0.000001;

        // Calculate the triangle's normal
        let edge1 = sub(v1, v0);
        let edge2 = sub(v2, v0);
    
        let ray_cross_e2 = cross(rayDirection, edge2);
        let normal = normalize(cross(edge1, edge2));
    
        // Check if ray is parallel to the triangle
        let det = dot(edge1, ray_cross_e2);
        if (Math.abs(det) < epsilon || Math.abs(dot(rayDirection, normal)) < epsilon) {
            return null; // Ray is parallel to the triangle
        }
    
        // Calculate the distance from ray origin to plane
        let inv_det = 1.0 / det;
        let s = sub(rayOrigin, v0);
        let u = inv_det * dot(s, ray_cross_e2);
        if (u < 0.0 || u > 1.0){
            return null; // Triangle is behind the ray
        }

        let s_cross_e1 = cross(s, edge1);
        let v = inv_det * dot(rayDirection, s_cross_e1);
        if (v < 0.0 || v > 1.0){
            return null; // Triangle is behind the ray
        } 
    
        // Calculate the intersection point
        let t = inv_det * dot(edge2, s_cross_e1);
        let intersectionPoint = add(rayOrigin, smult(rayDirection, t));
    
        // Check if the intersection point is inside the triangle
        if (t > epsilon) {
            return { point: intersectionPoint, dist: t };
        } else {
            return null;
        }
    }
    
    let add   = (v1, v2) => [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v2[2]];
    let sub   = (v1, v2) => [v1[0]-v2[0], v1[1]-v2[1], v1[2]-v2[2]];
    let dot   = (v1, v2) => v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    let smult = (v, s) => [v[0]*s, v[1]*s, v[2]*s];
    let cross = (v1, v2) => [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
    ];
    let normalize = (v) => smult(v, 1/Math.hypot(...v));
    

    //TODO rename to origin points
    let createRayDetectionGrid = (triangles) => {
        let xRays = [];
        let zRays = [];
        for (let tri of triangles){
            let center = tri.points.reduce((acc, cur) => acc.map((e, i) => e+cur[i]), [0, 0, 0]).map(i => i/3);
            xRays.push([modelCenter[0] - modelRadius, center[1], center[2]]);
            zRays.push([center[0], center[1], modelCenter[2] - modelRadius]);
        }
        // for (let i = 0; i < pointsPerSide; i++){
        //     let iNorm = (i/pointsPerSide-0.5)*2;
        //     for (let j = 0; j < pointsPerSide; j++){
        //         let jNorm = (j/pointsPerSide-0.5)*2;

        //         if (Math.hypot(iNorm, jNorm) > 1) continue;
        //         let xRay = [
        //             modelCenter[0] - modelRadius, 
        //             modelCenter[1] + iNorm*modelRadius, 
        //             modelCenter[2] + jNorm*modelRadius
        //         ];
        //         let zRay = [
        //             modelCenter[0] + iNorm*modelRadius, 
        //             modelCenter[1] + jNorm*modelRadius,
        //             modelCenter[2] - modelRadius
        //         ];
        //         xRays.push(xRay);
        //         zRays.push(zRay);
        //     }
        // }
        return {xRays, zRays};
    }

    let getTrianglesFromGLTFMeshes = (gltfMeshes) => {
        let triangles = [];
        for (let child of gltfMeshes){
            for (let i = 0; i < child.faces.length; i += 3){
                let indexes = child.faces.slice(i, i+3);
                let points = indexes.map(i => child.positions.slice(i*3, i*3+3));
                //TODO replace this with normals extracted from the triangle points
                //XXX
                let norms  = indexes.map(i => child.normals.slice(i*3, i*3+3));
                let normal = norms.reduce((acc, cur) => acc.map((e, i) => e+cur[i]), [0, 0, 0]).map(i => i/3);
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

        //remove malformed triangles >_<
        let epsilon = 0.000001;
        let isClose = (v1, v2) => Math.abs(v1-v2) < epsilon;
        let pEqual = (p1, p2) => isClose(p1[0], p2[0]) && isClose(p1[1], p2[1]) && isClose(p1[2], p2[2]);
        triangles = triangles.filter(tri => 
            !(pEqual(tri.points[0], tri.points[1])) &&
            !(pEqual(tri.points[1], tri.points[2])) &&
            !(pEqual(tri.points[0], tri.points[2]))
        );

        //XXX failed attempt to find similar triangles
        // let tEqual = (t1, t2) => {
        //     if (t1.points == undefined) return false; //???? why is this needed
        //     // console.log(t1, t2);
        //     // console.log(t1.points);
        //     for (let i = 0; i < 3; i++){
        //         let equal = true;
        //         for (let j = 0; j < 3; j++){
        //             equal &= tEqual(t1.points[i], t2.points[(i+j)%3])
        //         }
        //         if (equal) return true;
        //     }
        //     return false;
        // }

        // console.log(triangles);
        // let totalSimilar = 0;
        // //remove identical triangles
        // for (let i = 0; i < triangles.length; i++){
        //     let t1 = triangles[i];
        //     for (let j = i+1; j < triangles.length; j++){
        //         let t2 = triangles[j];
        //         if (tEqual(t1, t2)){
        //             triangles.splice(j, 1);
        //             console.log(t2);
        //             totalSimilar++;
        //             j--;
        //         }
        //     }
        // }

        console.log(triangles);
        let {xRays, zRays} = createRayDetectionGrid(triangles); //TODO add these to the model object
        let [xDir, zDir] = [[1, 0, 0], [0, 0, 1]];

        let sampleTriangles = [...triangles];
        for (let tri of triangles){
            if (pEqual(tri.points[0], tri.points[1])) {console.log(tri); continue;}
            if (pEqual(tri.points[1], tri.points[2])) {console.log(tri); continue;}
            if (pEqual(tri.points[0], tri.points[2])) {console.log(tri); continue;}
        }

        console.log(xRays.length);

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
                hits = hits.sort((a, b) => b.hitInfo.dist-a.hitInfo.dist);
                hits.map(hit => hit.tri.isPocket = true);
            }
        }

        // castRays(xRays, xDir);
        castRays(zRays, zDir);

        for (let tri of triangles.filter(tri => tri.isPocket)) gltfMeshes[tri.idx].isPocket = true;
        for (let mesh of gltfMeshes.filter(mesh => mesh.isPocket)) mesh.color = [0, 0, 1];
        
    }

loadData();