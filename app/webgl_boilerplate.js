import {mat4} from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/+esm'
const DEBUG = false;

//See https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial

//-- Controls ------------------------------
    let controlsParams = {
        showLighting : true,
        showIndexColors : false,
        highlightPockets : true,
    }

    //this code populates the controls div in the index.html file
    //it is done this way to provide easier visibility for the code in this file
    let populateControls = () => {
        let controls = document.getElementById("controls");

        //helper function
        let addCheckBox = (name) => {
            let div = document.createElement("div");
            let label = document.createElement("label");
            label.innerHTML = name + ": ";
            let checkBox = document.createElement("input");
            checkBox.setAttribute("type", "checkbox");
            checkBox.onclick = evt => {
                controlsParams[name] = checkBox.checked;
            }
            div.appendChild(label);
            div.appendChild(checkBox);
            controls.appendChild(div);
            checkBox.checked = controlsParams[name];
        }

        //add controls
        addCheckBox("showLighting");
        addCheckBox("showIndexColors");
        addCheckBox("highlightPockets");
    };

//-- Globals -------------------------------
    //TODO strip all of this info out  and put is into the Mesh class
    let modelInfo = {
        modelRadius : 0,
        modelCenter : [0, 0, 0],
    }

    let setModelInfo = (modelRadius, modelCenter) => {
        Object.assign(modelInfo, {modelRadius, modelCenter});
    }

//-- Math Utils ----------------------------
    let clamp   = (v, mn, mx) => Math.min(Math.max(v, mn), mx);

//-- Model Classes -------------------------
    //TODO add conversion for gltfProxy
    class GLTFProxy{
        constructor(gltf){
            this.children = [];

        }
    }

    //TODO add mesh implementation
    class Mesh{
        constructor(verts, normals, faces, colors){
            Object.assign(this, {verts, normals, faces, colors});
            this.bounds = [];
            this.center = [];
            this.radius = [];
        }
    }

//-- Shader Code ---------------------------
    // TODO - create automated attribute binding
    // TODO - create automated uniform definitions

    let shaderHeader = `#version 300 es
        precision highp float;
    `;

    let varying = `
        varying vec4 color;
        varying vec3 normal;
        varying float pocket;
    `;

    const vert = `${shaderHeader}
        in vec4 aVertexPosition;
        in vec4 aVertexColor;
        in vec3 aVertexNormal;
        in float aVertexPocket;

        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uNormalMatrix;

        ${varying.replaceAll("varying", "out")}

        void main() {
            // position
            vec4 pos = aVertexPosition;
            gl_Position = uProjectionMatrix * uModelViewMatrix * pos;

            // colors
            color = aVertexColor;

            // normals
            normal = (uNormalMatrix * vec4(aVertexNormal, 1.0)).xyz;

            //pocketInfo
            pocket = aVertexPocket;
        }
    `;

    const frag = `${shaderHeader}
        ${varying.replaceAll("varying", "in")}

        uniform float showIndexColors;
        uniform float showLighting;
        uniform float highlightPockets;
        uniform float time;
        uniform vec2  resolution;

        out vec4 fragColor;

        void main() {
            highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
            highp vec3 directionalLightColor = vec3(1, 1, 1);
            highp vec3 directionalVector = normalize(vec3(0.0, 0.0, 0.5));

            float dirAmt = clamp(dot(normal, directionalVector), 0.0, 1.0);
            float lightAmt = ambientLight.x + pow(dirAmt, 1.2)*(1.0-ambientLight.x);

            vec3 col = vec3(0.6);
            if (showIndexColors != 0.0) col = color.rgb;
            if (highlightPockets != 0.0 && pocket != 0.0) col = mix(col, vec3(1, 1, 0), 0.7);
            if (showLighting != 0.0) col *= lightAmt;

            fragColor = vec4(col, 1.0);
        }
    `

//-- Progs and Shaders ---------------------
    let loadShader = (gl, type, src) => {
        let shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!(gl.getShaderParameter(shader, gl.COMPILE_STATUS) || gl.getShaderInfoLog(shader))){
            console.log(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`);
            gl.deleteShader(shader);
            return;
        }
        return shader;
    }

    let createShaderProgram = (gl, vert, frag) => {
        let vertShader = loadShader(gl, gl.VERTEX_SHADER, vert);
        let fragShader = loadShader(gl, gl.FRAGMENT_SHADER, frag);

        let shaderProg = gl.createProgram();
        gl.attachShader(shaderProg, vertShader);
        gl.attachShader(shaderProg, fragShader);
        gl.linkProgram(shaderProg);

        if (!gl.getProgramParameter(shaderProg, gl.LINK_STATUS)) {
            console.log(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
            return;
        }

        return shaderProg;
    }

    // TODO associate attribute locations with their data sources (buffers)
    let createProg = (gl, shaderProg) => {
        return {
            program: shaderProg,
            attribLocations: {
                vertexPosition   : gl.getAttribLocation(shaderProg, "aVertexPosition"),
                vertexNormal     : gl.getAttribLocation(shaderProg, "aVertexNormal"),
                vertexColor      : gl.getAttribLocation(shaderProg, "aVertexColor"),
            },
            uniformLocations: {
                projectionMatrix : gl.getUniformLocation(shaderProg, "uProjectionMatrix"),
                modelViewMatrix  : gl.getUniformLocation(shaderProg, "uModelViewMatrix"),
                normalMatrix     : gl.getUniformLocation(shaderProg, "uNormalMatrix"),
                showIndexColors  : gl.getUniformLocation(shaderProg, "showIndexColors"),
                // uSampler         : gl.getUniformLocation(shaderProg, "uSampler"),
            },
        };
    }

//-- Buffer Creation -----------------------
    let createDataBuffer = (gl, data, glType, arrayType) => {
        let buffer = gl.createBuffer();
        gl.bindBuffer(glType, buffer);
        gl.bufferData(glType, new arrayType(data), gl.STATIC_DRAW);
        return buffer;
    }

    let createBuffers = (gl, verts, faces, normals, colors, pockets) => {
        const positionBuffer     = createDataBuffer(gl, verts  , gl.ARRAY_BUFFER        , Float32Array);
        const indexBuffer        = createDataBuffer(gl, faces  , gl.ELEMENT_ARRAY_BUFFER, Uint16Array);
        const normalBuffer       = createDataBuffer(gl, normals, gl.ARRAY_BUFFER        , Float32Array);
        const colorBuffer        = createDataBuffer(gl, colors , gl.ARRAY_BUFFER        , Float32Array);
        const pocketBuffer       = createDataBuffer(gl, pockets, gl.ARRAY_BUFFER        , Float32Array);

        return {
            position     : positionBuffer,
            indices      : indexBuffer,
            normal       : normalBuffer,
            color        : colorBuffer,
            pocket       : pocketBuffer,
        };
    }

//-- Initialization ------------------------
    let initGLContext = () => {
        // get gl context
        let canvas = document.createElement("canvas");
        let gl = canvas.getContext("webgl2");
        if (!gl) return;
        
        // handle resizing
        let [width, height] = [0, 0];
        let resize = evt => {
            [width, height] = [window.innerWidth, window.innerHeight];
            [canvas.width, canvas.height] = [width, height];
            gl.viewport(0, 0, width, height);
        }
        window.addEventListener("resize", resize);
        resize();
        document.body.appendChild(canvas);

        return gl;
    }

//-- Draw Setup ----------------------------
    let setVertexAttribute = (gl, attribute, location, numComponents, type=gl.FLOAT, normalize=false, stride=0, offset=0) => {
        // if (location == -1) return; //TODO add error handling here
        gl.bindBuffer(gl.ARRAY_BUFFER, attribute);
        gl.vertexAttribPointer(location, numComponents, type, normalize, stride, offset);
        gl.enableVertexAttribArray(location);
    }

//-- Camera --------------------------------
    let rotX = Math.PI*.25;
    let rotY = -Math.PI*.75;
    let dRotX = 0;
    let dRotY = 0;
    let aspect = 1.0;
    let zoom   = 1.0;
    const fov  = Math.PI*.25;
    const near = 0.1;
    const far  = 10000.0;

    let updateCamera = (gl) => {
        rotX += dRotX;
        rotY += dRotY;
        rotX = clamp(rotX, -Math.PI/2, Math.PI/2);
        dRotX *= .95;
        dRotY *= .95;
        aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
    }

    let getMatricies = (gl) => {
        // helper functions
        let translate = (mat, trs)       => mat4.translate(mat, mat, trs);
        let rotate    = (mat, amt, axis) => mat4.rotate(mat, mat, amt, axis);
        let scale     = (mat, s)         => mat4.scale(mat, mat, s);

        updateCamera(gl);

        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, fov, aspect, near, far);

        // Set the drawing position to the "identity" point, which is the center of the scene.
        const modelViewMatrix = mat4.create();
        translate(modelViewMatrix, [0, 0, -modelInfo.modelRadius*2]);

        // rotate(modelViewMatrix, rotZ, [0, 0, 1]);
        rotate(modelViewMatrix, rotX, [1, 0, 0]);
        rotate(modelViewMatrix, rotY, [0, 1, 0]);

        let s = zoom;
        scale(modelViewMatrix, [s, s, s]);
        translate(modelViewMatrix, modelInfo.modelCenter.map(i => -i));

        //create a normals matrix
        const normalMatrix = mat4.create();
        rotate(normalMatrix, rotX, [1, 0, 0]);
        rotate(normalMatrix, rotY, [0, 1, 0]);

        return {projectionMatrix, modelViewMatrix, normalMatrix};
    }

//-- Drawing -------------------------------
    let clearCanvas = (gl) => {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
        gl.clearDepth(1.0); // Clear everything
        gl.enable(gl.DEPTH_TEST); // Enable depth testing
        gl.depthFunc(gl.LEQUAL); // Near things obscure far things

        // Clear the canvas before we start drawing on it.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    let drawScene = (gl, programInfo, buffers, numElements, shaderProg) => {
        clearCanvas(gl);
        let {projectionMatrix, modelViewMatrix, normalMatrix} = getMatricies(gl);

        // set vertex attributes
        setVertexAttribute(gl, buffers.position    , programInfo.attribLocations.vertexPosition, 3);
        setVertexAttribute(gl, buffers.normal      , programInfo.attribLocations.vertexNormal  , 3);
        setVertexAttribute(gl, buffers.color       , programInfo.attribLocations.vertexColor   , 4);
        setVertexAttribute(gl, buffers.pocket      , gl.getAttribLocation(shaderProg, "aVertexPocket"), 1);

        // Tell WebGL which indices to use to index the vertices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        
        // Tell WebGL to use our program when drawing
        gl.useProgram(programInfo.program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);
        gl.uniform1f(gl.getUniformLocation(shaderProg, "showIndexColors" ), controlsParams.showIndexColors  ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(shaderProg, "showLighting"    ), controlsParams.showLighting     ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(shaderProg, "highlightPockets"), controlsParams.highlightPockets ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(shaderProg, "time"), performance.now()/1000);
        gl.uniform2f(gl.getUniformLocation(shaderProg, "resolution"), gl.canvas.width, gl.canvas.height);

        {
            const vertexCount = numElements; //TODO refactor this so that gl calls and setup are part of a 'Mesh' class
            const type = gl.UNSIGNED_SHORT;
            const offset = 0;
            gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
        }
    }

    let draw = (gl, shaderProg, programInfo, buffers, numElements) => {
        gl.clearColor(0.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        drawScene(gl, programInfo, buffers, numElements, shaderProg);
    }

//-- Window Load ---------------------------
    //helper function to redraw the canvas every frame (~60fps)
    let autoLoop = (f, ...function_args) => {
        let temp = () => {
            f(...function_args);
            requestAnimationFrame(temp);
        }
        requestAnimationFrame(temp);
    }

    let startGL = (gltfMeshes) => {
        let gl = initGLContext();

        let shaderProg  = createShaderProgram(gl, vert, frag);
        let programInfo = createProg(gl, shaderProg);

        //TODO move to "addModel" function
        //retrieve gltf information
        let verts   = gltfMeshes.map(e => e.positions).flat();
        let normals = gltfMeshes.map(e => e.normals).flat();
        let faces   = gltfMeshes.map(e => e.faces.map(f => f + e.offset)).flat();
        let colors  = gltfMeshes.map(e => (new Array(e.positions.length/3)).fill(0).map(p => [...e.color, 1])).flat().flat();
        let pockets = gltfMeshes.map(e => (new Array(e.positions.length/3).fill(0).map(p => e.isPocket ? 1 : 0))).flat();

        if (DEBUG) console.log(verts, normals, faces, colors, pockets);

        let buffers = createBuffers(gl, verts, faces, normals, colors, pockets);

        // Flip image pixels into the bottom-to-top order that WebGL expects.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        autoLoop(draw, gl, shaderProg, programInfo, buffers, faces.length);
    }

//-- Input Events ----------------------------
    let mouseIsDown = false;
    let mouseX, mouseY;
    
    onpointerdown = evt => {
        mouseIsDown = true;
        [dRotX, dRotY] = [0, 0];
        [mouseX, mouseY] = [evt.clientX, evt.clientY];
    }

    onpointermove = evt => {
        [mouseX, mouseY] = [evt.clientX, evt.clientY];
        if (mouseIsDown){
            dRotX += evt.movementY/1500;
            dRotY += evt.movementX/1500;
        }
    }

    onpointerup = evt => {
        mouseIsDown = false;
    }

    onwheel = evt => {
        if (evt.deltaY < 0) zoom /= .95;
        if (evt.deltaY > 0) zoom *= .95;
    }

//-- Export Functionality ---------------------------
    let WGLB = {
        startGL,
        setModelInfo,
        populateControls,
    }
    export {WGLB}