# Feature Detection Project

This is a project for the Hadrian feature detection programming assignment. In this assignment, the task was to identify "pockets" inside of a 3D model (presented as gltf mesh data).

For this implementation, I chose to create the app in native javascript/webgl. The only external libraries used on this project were the [gltfLoader](https://github.com/johh/three-gltf-loader) from the Three.js addons library (for parsing the gltf file) and the Matrix4x4 implementation from [glMatrix](https://glmatrix.net/) (for computing projection and modelview matrices). All other code was written by hand.

All of the project files for my implementation live in the "app" folder. The original data files for the project have been placed in the "app/data_dump_copy" directory. My notes on the project live under the "notes" directory, and contain my thoughts and observations about the problem as I was trying to tackle it.

## Project Structure:
    --- app
        |--- data_dump_copy: provided files from Hadrian
        |   |--- ...
        |--- index.html : main page
        |--- racast_detection.js  : main javascript entrypoint, model loading, and feature detection
        |--- server.js : static_html file server for hosting the app and serving project files
        |--- webgl_boilerplate.js : model rasterizer and shader written in native webgl 

## How to Run the App:

This app requires node.js to be installed in order to run. With node.js installed, cd into the "app" directory and run the following command to launch the file server:
`node server.js`

You can then navigate to:
`http://localhost:8000/`
in a browser of your choice to view the app.

## App UI Overview and Controls:

The app UI is split into three areas, (1.) pocket reporting on the left, (2.) a model display in the center, and (3.) rendering controls in the upper right. Launching the app wil automatically load the file and perform the raycasting pocket detection algorithm, which will then also populate the "Identified Pockets" section on the left.

1. The text for each pocket inside of the pocket reporting area may be clicked on to expand a list of all the sub-meshes/groups that comprise the listed pocket.

2. The model display offers basic camera controls such as tumbling and zoom which can be used by clicking and dragging the mouse across the surface of the canvas, or by using the scroll wheel.

3. Finally the rendering controls on the top left allow for toggling the various render modes. These are fairly self explanatory but are provided below for completeness:
    - **showLighting**: toggles headlight lighting/shading on the model
    - **showIndexColors**: toggles rendering the faces with vertex color information (retrieved from the gltf model group color information)
    - **highlightPockets**: toggles showing the identified pockets by highlighting them in yellow

## Implementation Notes:

For the implementation of this app, I chose to use a raycast hit detection system to cast rays through the model and identified pockets based on how many intersection points were reported. More details on this approach can be found in the "notes/notes.txt" file.

To do this, I made an implementation of the [Möller–Trumbore ray-triangle intersection algorithm](https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm) as well as a mechanism to spawn rays based on the radius of the bounds of the model.

My first implementation of this algorithm spawned rays in a dense grid along the X and Z axis' to pass them through the model. However, this required a dense sampling of rays (~500000) and was too slow for realtime performance. (this version of the app can be found in commit: `4ae3258a` - however, be fore-warned that it can take upwards of 50s to render the first image)

My second implementation of this algorithm was to use the centroid of each triangle as the starting point for the ray. I then reprojected those ray points back along the X or Z axis so that they were outside of the model.

This was much much faster, but I ran into issues where rays that brushed along the edges of some triangles were causing false detections and falsy flagging mesh groups as pockets. In order to get around this, I created a thresholding system where each intersection point is first tested to see if it is strictly within the face of the hit triangle to remove ray-edge collisions. This threshold value is very sensitive however, and is likely model-size dependant, so it should be refactored if this project is to be continued.

Additionally, when analyzing the triangle data I found 12 degenerate triangles in the model (triangles with two or more shared points). These triangles were removed from the triangle list prior to performing the ray casting.

## Other notes:

For this app, I chose to implement the 3D rendering in native webgl. To accomplish this, I wrote a boilerplate webgl renderer that consumes the gltf mesh data and rasterizes the model to the screen using a simple shader. I found that this provided more direct control over the rendering pipeline than I would have had if I were to use Three.js.







