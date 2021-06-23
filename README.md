# PaintGL
PaintGL, a realtime PBR 3D painting web-app with built-in support for pressure-sensitive input (ie wacom tablets).  
Written on the spring of 2018 using [regl](https://github.com/regl-project/regl) as an expolaration of the limits of webgl (1) on desktop devices.  
It was not designed (or tested) for mobile devices, so it _might_ work on high-end tablets but don't count on it.
(the source [big-pile of mess] was never intended to be made open-source as this was a personal test)

[**Live demo page here**](http://www.nassosyian.net/webgl/paintgl/)  

![preview](https://raw.githubusercontent.com/nassosyian/PaintGL/master/img/preview.jpg)

## Installation

>		npm install  

## Start

>		npm run serve  

## Build  

>		npm run build

## Notes  

* Includes modified code from [Pressure.js](https://github.com/stuyam/pressure), [ThreeJS loaders](https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/FBXLoader.js), [3d-view](https://github.com/mikolalysenko/3d-view), [filtered-vector](https://github.com/mikolalysenko/filtered-vector), [orbit-camera-controller](https://github.com/mikolalysenko/orbit-camera-controller), [canvas-to-image](https://github.com/kaxi1993/canvas-to-image), [UPNG](https://github.com/photopea/UPNG.js)

* Starting from regl@1.3.4 a breaking change was introduced that prevents initialising a framebuffer with multiple color-buffer and depth-buffer, so do not update the library.
