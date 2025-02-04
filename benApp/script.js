import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WGLB} from './webgl_boilerplate.js';

const DEBUG = false;

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
        const rgbSwizzle = ['r', 'g', 'b'];

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
                if (DEBUG && idx == 0) console.log(child);

                let geom = child.geometry;
                let attributes = geom.attributes;

                // retrieve geometry, id, and color information from gltf data
                let meshProxy = {
                    id : child.id, //gltf group id (currently unused)
                    normals : [...attributes.normal.array],
                    positions : [...attributes.position.array],
                    faces : [...geom.index.array],
                    color : rgbSwizzle.map(e => child.material.color[e]),
                    idx : idx, //the index that will correspond to the adjacency information
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
            if (DEBUG) console.log(gltfMeshes);
            if (DEBUG) console.log(modelBounds);
            modelRadius = Math.hypot(modelBounds[3]-modelBounds[0], modelBounds[4]-modelBounds[1], modelBounds[5]-modelBounds[2])/2;
            modelCenter = [
                (modelBounds[3]+modelBounds[0])/2, 
                (modelBounds[4]+modelBounds[1])/2,
                (modelBounds[5]+modelBounds[2])/2,
            ];
            if (DEBUG) console.log(modelRadius);
            if (DEBUG) console.log(modelCenter);
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
        if (DEBUG) console.log(modelLoaded, filesLoaded);
        return modelLoaded && filesLoaded == 4;
    }

    //TODO replace this function with async await
    let checkGLReadyState = () => {
        if (allFilesAreLoaded()){
            console.log("all files loaded");
            
            //gather meta-data about the meshes
            assignMeshGroupAdjacency(gltfMeshes);
            findPockets(gltfMeshes);

            getPocketMetaData(gltfMeshes);

            if (DEBUG) console.log(gltfMeshes);
            
            WGLB.populateControls();
            WGLB.startGL(gltfMeshes);
            WGLB.setModelInfo(modelRadius, modelCenter);
        }
    }

//-- Raycasting Model Features ----------------------------
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
        if (Math.abs(det) < epsilon || Math.abs(dot(normal, rayDirection)) < 0.1) {
            return null; // Ray is parallel to the triangle
        }
    
        // Calculate the distance from ray origin to plane
        let inv_det = 1.0 / det;
        let s = sub(rayOrigin, v0);
        let u = inv_det * dot(s, ray_cross_e2);
        if (u < 0.0 || u > 1.0){
            return null; //Triangle is coplanar to ray
        }

        let s_cross_e1 = cross(s, edge1);
        let v = inv_det * dot(rayDirection, s_cross_e1);
        if (v < 0.0 || v > 1.0){
            return null; //Triangle is coplanar to ray
        } 
    
        // Calculate the intersection point
        let t = inv_det * dot(edge2, s_cross_e1);
        let intersectionPoint = add(rayOrigin, smult(rayDirection, t));
    
        // Check if the intersection point is inside the triangle
        if (t > epsilon) {
            return { intersectionPoint, dist: t };
        } else {
            return null;
        }
    }
    
    //helper vec3 math functions
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
    
    let isPointInsideTriangle = (p, a, b, c) => {
        const epsilon = 0.005;
        const v0 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const v1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v2 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      
        // Compute dot products
        const dot00 = dot(v0, v0);
        const dot01 = dot(v0, v1);
        const dot02 = dot(v0, v2);
        const dot11 = dot(v1, v1);
        const dot12 = dot(v1, v2);
      
        // Compute barycentric coordinates
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
      
        // Check if point is strictly inside triangle
        return (u > epsilon) && (v > epsilon) && (u + v < 1-epsilon*2);
    }

    let createRayOriginPoints = (triangles) => {
        let xRays = [];
        let zRays = [];
        for (let tri of triangles){
            xRays.push([modelCenter[0] - modelRadius, tri.center[1], tri.center[2]]);
            zRays.push([tri.center[0], tri.center[1], modelCenter[2] - modelRadius]);
        }
        return {xRays, zRays};
    }

    let getTrianglesFromGLTFMeshes = (gltfMeshes) => {
        let triangles = [];
        for (let child of gltfMeshes){
            for (let i = 0; i < child.faces.length; i += 3){
                let indexes = child.faces.slice(i, i+3);
                let points = indexes.map(i => child.positions.slice(i*3, i*3+3));
                let center = points.reduce((acc, cur) => acc.map((e, i) => e+cur[i]), [0, 0, 0]).map(i => i/3);
                triangles.push({
                    points,
                    center,
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

        if (DEBUG) console.log("total triangles before removal: " + triangles.length);

        //remove degenerate triangles (triangles with one or more shared vertice)
        let epsilon = 0.000001;
        let isClose = (v1, v2) => Math.abs(v1-v2) < epsilon;
        let pEqual = (p1, p2) => isClose(p1[0], p2[0]) && isClose(p1[1], p2[1]) && isClose(p1[2], p2[2]);
        triangles = triangles.filter(tri => 
            !((pEqual(tri.points[0], tri.points[1])) ||
              (pEqual(tri.points[1], tri.points[2])) ||
              (pEqual(tri.points[0], tri.points[2])))
        );

        if (DEBUG) console.log("total triangles after removal: " + triangles.length);

        //get ray origin points
        let {xRays, zRays} = createRayOriginPoints(triangles); //TODO add these to the gl draw to visualize
        let [xDir, zDir] = [[1, 0, 0], [0, 0, 1]];

        //perform the raycasting
        let castRays = (rays, dir) => {
            for (let ray of rays){
                let hits = [];
                for (let tri of triangles){
                    //get hit information from ray intersection
                    let hitInfo = rayTriangleIntersection(ray, dir, ...tri.points);
                    if (hitInfo && isPointInsideTriangle(hitInfo.intersectionPoint, ...tri.points)){
                        hits.push({tri, hitInfo});
                    }
                }
                if (hits.length <= 2) continue; //no pockets

                //mark all inner hits as pockets
                hits = hits.sort((a, b) => b.hitInfo.dist-a.hitInfo.dist);
                hits.slice(1, hits.length-1).map(hit => hit.tri.isPocket = true);
            }
        }

        castRays(xRays, xDir);
        castRays(zRays, zDir);

        //mark groups that contain triangles flagged as pockets as pockets themselves
        for (let tri of triangles.filter(tri => tri.isPocket)) gltfMeshes[tri.idx].isPocket = true;

        //check for groups that are surrounded by pocket groups
        for (let mesh of gltfMeshes){
            if (mesh.isPocket) continue;

            //check if all adjacent groups are pockets
            let allAdjacentArePockets = true;
            for (let idx of mesh.adjacency){
                allAdjacentArePockets &= gltfMeshes[idx].isPocket;
                if (!allAdjacentArePockets) break;
            }

            //if they are, mark this group as a pocket as well
            if (allAdjacentArePockets) mesh.isPocket = true;
        }
    }

//-- Building Group Information ---------------------------
    let assignMeshGroupAdjacency = (gltfMeshes) => {
        for (let mesh of gltfMeshes){
            if (mesh.isPocket) continue;

            //adjacency file reports index stating from 1, we use staring from 0
            mesh.adjacency = jsonData.adjacency_graph[mesh.idx+1].map(i => parseInt(i)-1);
        }
    }

    let getPocketMetaData = (gltfMeshes) => {
        let pockets = [];
        let makePocket = (name, meshes) => ({name, meshes});

        //setup default mesh flag
        for (let mesh of gltfMeshes) mesh.partOfGroup = false;

        //recursive function to traverse through mesh adjacencies
        let getAllConnectedMeshes = mesh => {
            let connections = [];
            for (let idx of mesh.adjacency){
                let mesh2 = gltfMeshes[idx];
                if (!mesh2.partOfGroup && mesh2.isPocket){
                    mesh2.partOfGroup = true;
                    connections.push(mesh2, ...getAllConnectedMeshes(mesh2));
                }
            }
            return connections;
        }

        //gather connected meshes and store in pocket array
        for (let mesh of gltfMeshes){
            if (!mesh.partOfGroup && mesh.isPocket){
                let meshes = [mesh, ...getAllConnectedMeshes(mesh)];
                pockets.push(makePocket("Pocket_" + pockets.length, meshes));
            }
        }

        if (DEBUG) console.log(pockets);
        return pockets
    }

loadData();