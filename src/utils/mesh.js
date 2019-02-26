'use strict'

// const ObjParser = require('webgl-obj-loader');
const axios = require('axios');
// const ObjParser = require('../loaders/OBJ/index');
import ObjParser from '../loaders/OBJ/index';
// const FBXParser = require('../loaders/FBX/index');
import FBXParser from '../loaders/FBX/index';
const mat4 = require('gl-mat4');
const cross = require('gl-vec3').cross;
const vecLerp = require('gl-vec3').lerp;
// const createCamera = require('3d-view');
import createCamera from './3d-view/view'
// const geoCenter = require('geo-center');
// const calcBoundingBox = require('vertices-bounding-box');
// const rescaleVertices = require('rescale-vertices');
const triangulate = require('geom-triangulate');
// const AmbientOcclusion = require('geo-ambient-occlusion');
const sizeof = require('object-sizeof');
const defaults = require('lodash.defaultsdeep')
const tform = require('geo-3d-transform-mat4')
const {createDrawMeshToBuffers} = require('../utils/drawMeshToBuffers')
const {createDrawLayersToBuffers} = require('../utils/drawLayersToBuffers')
const {createDrawMeshUV} = require('../utils/drawMeshUV')
const {creatExtractMeshTexture} = require('../utils/extractMeshTexture')
const {createDrawMeshWorldPos} = require('../utils/drawMeshWorldPos')
const {creatFillMeshTexture} = require('../utils/fillMeshTexture')
const {creatMergeTextures} = require('../utils/mergeTextures')
const {createConvertBumpToNormalTexture} = require('../utils/convertBumpToNormalTexture')
import packingFuncsGLSL from '../../shaders/packing.glsl'
import DataTexture from '../classes/DataTexture';

// const calcVertextNormals = require("normals").vertexNormals;



function readFile(fileObj) 
{
	log(fileObj);
	return new Promise( (resolve, reject) => 
	{
		if (!fileObj)
		{
			reject("no file selected");
			return;
		}
		const file = fileObj;//fileList[0];
		var reader = new FileReader();
		this.processingMeshFile = true;

		reader.onerror = (e) =>
		{
			log(e.error);
			this.processingMeshFile = false;
			reject(e.error);
		};

		// this.readState = 0;
		// reader.onerror = (e)=>{ this.readState = 0; this.error = e.error; }
		// if (file.name.toLowerCase().indexOf('.obj') > -1)
		if (file.name.toLowerCase().indexOf('.fbx') > -1)
		{
			_vm_.$emit('showLoading', {msg: 'loading: "'+file.name+'"...'} );
			reader.onload = (e) =>
			{
				// log('.obj file');
				log('.fbx file');
				// log(e.target.result);
				// this.parseObjFile(e.target.result)
				this.parseFbxFile(e.target.result)
					.then(()=>{

						// this.fileData = e.target.result;
						// this.readState = 0;
		
						// this.$emit('file-changed', this.fileData);
						this.processingMeshFile = false;
						resolve();
						_vm_.$emit('hideLoading');
					})
			};
			setTimeout(() => {
				reader.readAsArrayBuffer(file);
				// reader.readAsText(file);
			}, 50);
		}
		else
		{
			reader.onload = (e) =>
			{
				log('not an .obj file');
				log(e.target.result);
				this.processingMeshFile = false;
				reject('not an .obj file');
			};
			reader.readAsDataURL(file);
		}
	} )
	
}

function readUrlFile(url)
{
	// logfunc();

	var fileName = url.substring(url.lastIndexOf('/')+1);
	_vm_.$emit('showLoading', {msg: `downloading: "${fileName}"...`});


	axios.get(url, {
			responseType: 'arraybuffer',
			onDownloadProgress: (e) => {
				// log(e);
				_vm_.$emit('showLoading', {progress: Math.floor(100*(e.loaded/e.total))});
			}
		})
		.then((response)=>
		{
			// _vm_.$emit('hideLoading');
			_vm_.$emit('showLoading', {msg: `reading: "${fileName}"...`});
			// log(response);
			log('.fbx file');
			// log(e.target.result);
			// this.parseObjFile(e.target.result)
			this.parseFbxFile(response.data)
				.then(()=>{

					// this.fileData = e.target.result;
					// this.readState = 0;
	
					// this.$emit('file-changed', this.fileData);
					this.processingMeshFile = false;
					// resolve();
					_vm_.$emit('hideLoading');
				})
		})
		.catch((error)=>
		{
			console.error(error);
		})
}


function parseFbxFile(data) 
{
	return new Promise( (resolve, reject)=>
	{
		if (data)
		{
			// log(data);
			var scene = null;
			var removedCount = 0;
			try
			{
				scene = (new FBXParser).parse(data, '');
				var fileSceneGeomCount = scene.geometries ? scene.geometries.size : 0;
				// for (var [key, value] in scene.geometries.entries())
				scene.geometries && scene.geometries.forEach( (value, key) =>
				{
					if (!value || !value.uvs || value.uvs.length==0)
					{
						scene.geometries.delete(key);
						removedCount++;
					}
					else
					{
						value.name = value.name || key;
						value.vertices = tform(value.vertices, value.preTransform.elements);
					}
				})
				if (removedCount)
					log('Removed '+removedCount+' objects with no UVs...');

				this.stopDrawUpdates();
				this.oldSceneGeom = this.sceneGeom;
				this.sceneGeom = scene.geometries;

				if (!this.sceneGeom || this.sceneGeom.size == 0)
				{
					this.createGeomLayers([]);
					if (fileSceneGeomCount > 0)
					{
						_vm_.$emit('show-message', {title: 'File error', text: 'No geometry found with UV coordinates.\nIt must have UVs to load.'});
					}
					else
					{
						_vm_.$emit('show-message', {title: 'File error', text: 'No mesh geometry found in file'})
					}
					window._vm_.$emit('objectParsed');
					resolve();
				}
				else
				{
					// log(scene);

					// if (typeof this.updateMesh!='function')	debugger;

					// this.objMesh = scene.geometries.values().next().value;
					this.updateMesh()
						.then(()=>{
							window._vm_.$emit('objectParsed');
							resolve();
						})

				}

			} 
			catch (error) 
			{
				console.error(error);
				reject(error);
				return;
			}

		}
		else
		{
			reject();
		}
	} )
	
}

function parseObjFile(data) 
{
	return new Promise( (resolve, reject)=>
	{
		// this.objFileData = data;
		if (data)
		{
			// log(data);
			this.objMesh = new ObjParser.Mesh(data);
			log(this.objMesh);
			this.updateMesh(this.objMesh)
				.then(()=>{
					window._vm_.$emit('objectParsed');
					resolve();
				})
		}
		else
		{
			reject();
		}
} )
	
}


// function calcAmbientOcclusion()
// {
// 	return new Promise( (resolve)=>
// 	{

// 		this.stopDrawUpdates();

// 		_vm_.$emit('showLoading', {msg: 'calculating (vertex) Ambient-Occlusion... '});
// 		var aoSampler = [];
// 		const totalSampleCount = this.aoSampleCount;// * this.sceneGeomArray.length;
// 		const perGeoSampleCount = Math.round(this.aoSampleCount / this.sceneGeomArray.length);// * this.sceneGeomArray.length;
// 		var sampleCount = 0;

// 		var lastPromise = null;
// 		// var promiseStack = [];

// 		this.sceneGeomArray.forEach((geo, i)=>
// 		{
// 			var prom = () => new Promise( (resolveProm)=> {
// 				var sampler = new AmbientOcclusion(geo.vertices, {
// 													resolution: this.aoRes,
// 													bias: this.aoBias,
// 													cells: geo.indeces,
// 													regl: this.regl
// 												})
// 				log('starting AO for geom '+i+'...')
// 				var currentSampleCount = 0;
// 				var tick = this.regl.frame( ()=>{
		
// 					var percent = 0;
// 					sampler.sample();
// 					sampleCount++;
// 					currentSampleCount++;

// 					// log('calculating AO: "'+percent+'"%...');
// 					percent = ((sampleCount+1) / totalSampleCount)*100;
// 					_vm_.$emit('progress', percent);
// 					// i++;
		
// 					if (currentSampleCount >= perGeoSampleCount)
// 					{
// 						tick.cancel();
// 						tick = null;
		
// 						const ao = sampler.report();
// 						geo.aoBuffer = this.regl.buffer(ao);
// 						// geo.aoBuffer = (ao);
// 						sampler.dispose();
// 						sampler = null;

// 						log('...finishing AO for geom '+i)
						
// 						resolveProm();
// 					}
// 				} ); // end tick
// 			} ); // end Promise

// 			// promiseStack.push(prom);

// 			if (lastPromise)
// 			{
// 				lastPromise = lastPromise.then( ()=>{ return prom(); } )
// 			}
// 			else
// 			{
// 				lastPromise = prom();
// 			}
// 			// lastPromise = prom;
// 		})

// 		// promiseStack[0]()
// 		// 	.then(()=>promiseStack[1]())

// 		// if (lastPromise)
// 		{
// 			lastPromise.then( ()=>
// 			{ 
// 				// _vm_.$emit('hideLoading');
				
// 				_vm_.$emit('progress', 0);
// 				this.startDrawUpdates();
// 				resolve();
// 			 } )
// 		}


// 	} )
	
// }

const DEFAULT_NORMALS_EPSILON = 1e-6;
const DEFAULT_FACE_EPSILON = 1e-6;

//Estimate the vertex normals of a mesh
// Assumes that all faces are triangles
// Parameters: vtxIndeces [flat integer array with vertex index per triangle]
function calcVertexNormals(vtxIndeces, positions, specifiedEpsilon) 
{
	// log('faces['+faces.length+'] size '+sizeof(faces));
	log('vtxIndeces['+vtxIndeces.length+'] size '+sizeof(vtxIndeces));
	log('positions['+positions.length+'] size '+sizeof(positions));
	
	//============ PER FACE NORMALS ===============

	// const faceCount  = Math.floor(faces.length / 3);
	// const indexCount = (vtxIndeces.length);
	
	var epsilon   = specifiedEpsilon === void(0) ? DEFAULT_FACE_EPSILON : specifiedEpsilon;

	var pos = new Array(3);
	var d01 = new Array(3);
	var d21 = new Array(3);
	// var n = new Array(3);
	if (Array.isArray(positions[0]))
	{
		var normals   = (new Array(positions.length)).fill(null);
		for(var i = 0; i < vtxIndeces.length; i += 3 ) 
		{
			// var f = vtxIndeces[i];
			// var pos = new Array(3);
			for(var j = 0; j < 3; ++j) 
				pos[j] = positions[vtxIndeces[ i + j ]];

			// var d01 = new Array(3);
			// var d21 = new Array(3);
			for(var j = 0; j < 3; ++j) 
			{
				d01[j] = pos[1][j] - pos[0][j];
				// d21[j] = pos[2][j] - pos[0][j];
				d21[j] = pos[2][j] - pos[1][j];
			}

			let n = cross(new Array(3), d01, d21)
			// let n = new Array(3);
			// var l = 0.0;
			// for(var j = 0; j < 3; ++j) 
			// {
			// 	var u = (j+1) % 3;
			// 	var v = (j+2) % 3;
			// 	n[j] = d01[u] * d21[v] - d01[v] * d21[u];
			// 	l += n[j] * n[j];
			// }
			// if(l > epsilon) 
			// {
			// 	l = 1.0 / Math.sqrt(l);
			// } 
			// else 
			// {
			// 	l = 0.0;
			// }
			// for(var j=0; j<3; ++j) 
			// {
			// 	n[j] *= l;
			// }
			for(var j = 0; j < 3; ++j)
			{
				if (normals[vtxIndeces[ i + j ]] !== null)
				{
					var prevN = normals[vtxIndeces[ i + j ]];
					normals[vtxIndeces[ i + j ]] = vecLerp([0,0,0], prevN, n, 0.5);
				}
				else
					normals[vtxIndeces[ i + j ]] = n;
			}
		}
	}
	else
	{
		var normals   = (new Array(Math.ceil(positions.length / 3))).fill(null);
		for (var i = 0; i < vtxIndeces.length; i += 3 ) 
		{
			// var f = vtxIndeces[i];
			// var pos = new Array(3);
			for (var j = 0; j < 3; ++j) 
			{
				pos[j] = new Array(3);
				var idx = vtxIndeces[ i + j ]*3;
				for (var k = 0; k < 3; ++k)
				{
					pos[j][k] = positions[idx + k];
				}
			}

			// var d01 = new Array(3);
			// var d21 = new Array(3);
			for(var j = 0; j < 3; ++j) 
			{
				d01[j] = pos[1][j] - pos[0][j];
				// d21[j] = pos[2][j] - pos[0][j];
				d21[j] = pos[2][j] - pos[1][j];
			}

			let n = cross(new Array(3), d01, d21)
			for(var j = 0; j < 3; ++j)
			{
				if (normals[vtxIndeces[ i + j ]] !== null)
				{
					var prevN = normals[vtxIndeces[ i + j ]];
					normals[vtxIndeces[ i + j ]] = vecLerp([0,0,0], prevN, n, 0.5);
				}
				else
					normals[vtxIndeces[ i + j ]] = n;
			}
		}
	}
	var result = new Float32Array(normals.length*3);
	for (var i = 0, j = 0; i < result.length; i+=3, j++)
	{
		result[i + 0] = normals[j][0];
		result[i + 1] = normals[j][1];
		result[i + 2] = normals[j][2];
	}
	// log(normals);
	// return normals;
	return result;


}

function calcBoundingBoxFromFlatArray(position)
{
	if(position.length === 0) 
	{
		return null;
	}

	var min = [Infinity, Infinity, Infinity];
	var max = [-Infinity, -Infinity, -Infinity];

	for (var k = 0; k < position.length; k += 3)
	{
		max[0] = position[k+0] > max[0] ? position[k+0] : max[0];
		max[1] = position[k+1] > max[1] ? position[k+1] : max[1];
		max[2] = position[k+2] > max[2] ? position[k+2] : max[2];

		min[0] = position[k+0] < min[0] ? position[k+0] : min[0];
		min[1] = position[k+1] < min[1] ? position[k+1] : min[1];
		min[2] = position[k+2] < min[2] ? position[k+2] : min[2];
	}

	return [min, max];
}


function geoCenter (positions, opts) 
{
	// Set some defaults.
	opts = opts || {}
	opts = defaults(opts, {
	  center: [0, 0, 0]
	})
  
	// positions = geoconv.convert(positions, geoconv.ARRAY_OF_ARRAYS)
	// Calculate the bounding box.
	var bb = calcBoundingBoxFromFlatArray(positions)
  
	// Translate the geometry center to the origin.
	var _translate = [
	  -0.5 * (bb[0][0] + bb[1][0]) + opts.center[0],
	  -0.5 * (bb[0][1] + bb[1][1]) + opts.center[1],
	  -0.5 * (bb[0][2] + bb[1][2]) + opts.center[2]
	]
	var translate = mat4.create()
	mat4.translate(translate, translate, _translate)
	var centered = tform(positions, translate)
  
	return centered
}

function rescaleVertices(positions, targetBounds, sourceBounds) 
{
	sourceBounds = sourceBounds || boundingBox(positions);
  
	var dimensions = 3;
	var sourceSpans = new Array(dimensions);
	var targetSpans = new Array(dimensions);
  
	for(var i=0; i<dimensions; i++) 
	{
		sourceSpans[i] = sourceBounds[1][i] - sourceBounds[0][i];
		targetSpans[i] = targetBounds[1][i] - targetBounds[0][i];
	}
  
	for (var k = 0; k < positions.length; k += 3)
	{
		positions[k+0] = (positions[k+0] - sourceBounds[0][0]) / sourceSpans[0] * targetSpans[0] + targetBounds[0][0];
		positions[k+1] = (positions[k+1] - sourceBounds[0][1]) / sourceSpans[1] * targetSpans[1] + targetBounds[0][1];
		positions[k+2] = (positions[k+2] - sourceBounds[0][2]) / sourceSpans[2] * targetSpans[2] + targetBounds[0][2];
	}

	return positions;
}

function updateMesh(mesh) 
{
	log('mesh changed');
		// log(newVal);

	// log(this.regl);

	this.stopDrawUpdates();

	return new Promise( (resolve)=>
	{
		// if (this.tick)
		// {
		// 	this.tick.cancel();
		// 	this.tick = null;
		// }
		// if (this.drawCall)
		// {
		// 	// this.drawCall.destroy();
		// 	this.drawCall = null;
		// }

		// free up old resources
		if (this.oldSceneGeom)
		{
			this.oldSceneGeom.forEach((geo) => 
			{
				// geo.indecesBuffer && geo.indecesBuffer.destroy();
				geo.verticesBuffer && geo.verticesBuffer.destroy();
				geo.normalsBuffer && geo.normalsBuffer.destroy();
				geo.uvsBuffer && geo.uvsBuffer.destroy();
				geo.aoBuffer && geo.aoBuffer.destroy();

				geo.colorTex && geo.colorTex.destroy();
				geo.normalTex && geo.normalTex.destroy();
				geo.metallicTex && geo.metallicTex.destroy();
				geo.roughnessTex && geo.roughnessTex.destroy();
				geo.emissiveTex && geo.emissiveTex.destroy();
			});
			this.oldSceneGeom = null;
		}

		
		if (!this.drawMeshToBuffers)
		{
			this.drawMeshToBuffers = createDrawMeshToBuffers(this);

			this.drawLayersToBuffers = createDrawLayersToBuffers(this);

			this.drawMeshUV = createDrawMeshUV(this)

			this.drawMeshWorldPos = createDrawMeshWorldPos(this)

			this.extractMeshTexture = creatExtractMeshTexture(this)
			
			this.fillMeshTexture = creatFillMeshTexture(this)

			this.mergeTextures = creatMergeTextures(this)

			this.convertBumpToNormalTexture = createConvertBumpToNormalTexture(this)
		}

		// this.resizePaintSurf(this.getActiveChannelDimension())

		var maxBBox = null;
		this.sceneGeom.forEach((geo, key) => 
		{

			if (!geo)
			{
				this.sceneGeom.delete(key)
				return;
			}

			geo.indeces = new Uint32Array(geo.indeces);
			geo.vertices = new Float32Array(geo.vertices);
			
			// var bbox = calcBoundingBox(geo.vertices);
			var bbox = calcBoundingBoxFromFlatArray(geo.vertices);
			geo.bbox = bbox;
			if (maxBBox==null)
				maxBBox = bbox;
			else
			{
				maxBBox[0][0] = Math.min(maxBBox[0][0], bbox[0][0]);
				maxBBox[1][0] = Math.max(maxBBox[1][0], bbox[1][0]);
				maxBBox[0][1] = Math.min(maxBBox[0][1], bbox[0][1]);
				maxBBox[1][1] = Math.max(maxBBox[1][1], bbox[1][1]);
				maxBBox[0][2] = Math.min(maxBBox[0][2], bbox[0][2]);
				maxBBox[1][2] = Math.max(maxBBox[1][2], bbox[1][2]);
			}
		});

		var center = [
					maxBBox[0][0] + 0.5*(maxBBox[1][0]-maxBBox[0][0]),
					maxBBox[0][1] + 0.5*(maxBBox[1][1]-maxBBox[0][1]),
					maxBBox[0][2] + 0.5*(maxBBox[1][2]-maxBBox[0][2])
				];
		var dim = maxBBox[1][0] - maxBBox[0][0];
		dim = Math.max(dim, maxBBox[1][1] - maxBBox[0][1]);
		dim = Math.max(dim, maxBBox[1][2] - maxBBox[0][2]);
		// var scale = 0.7 / (dim);
		var scale = 20 / (dim);
		var tempFbo = this.regl.framebuffer();
		var tempTex = this.regl.texture();

		const dilate = () =>
		{
			tempTex({copy: true, format:tempTex.format, type:tempTex.type})
			this.dilateTexture({ texture: tempTex})//, geoMaskTex: tempTex, useGeoMask: false })
			tempTex({copy: true, format:tempTex.format, type:tempTex.type})
			this.dilateTexture({ texture: tempTex})//, geoMaskTex: tempTex, useGeoMask: false })
		}

		const extractDataTexFrom = (tex, options) =>
		{
			var dataTex = new DataTexture(options);

			if (tempFbo)	tempFbo.destroy();
			// WARNING: you cannot change the type of a framebuffer in-place.
			tempFbo = this.regl.framebuffer({
			// tempFbo({
				...options,
				color: tex,
				depth: false,
				stencil: false,
			});

			// readFromFBO(regl, fbo)
			dataTex.readFromFBO(this.regl, tempFbo)

			return dataTex;
		}

		const addLayer = (channel, dataTex) =>
		{
			var texIdx = this.layerDataCount;
			dataTex.texIdx = texIdx;
			dataTex.channel = channel;
			this.createLayerData();
			this.setLayerData({
							index: texIdx, 
							data: dataTex, 
							channel: channel
						});
			var layer = {
					vddlid: new Date().getTime(), 
					label: 'layer0', 
					textureIdx: texIdx, 
					layerUUID: new Date().getTime(), 
					opacity: 100,
					selected: true, 
					visible: true,
					editingLabel: false,
					mode: 'normal'
				};
			this.setChannelLayers({channel: channel, layers: [layer]});
		}

		var nameList = [];
		var regexp = /([^a-z0-9#!&\$\*]+)/gi;
		this.sceneGeom.forEach((geo) => 
		{ 
			var name = (geo.name+'').replace(regexp, ' ').trim();
			var suffix = '';
			var count = 1;
			while (nameList.indexOf(name+suffix) > -1)
			{
				count++;
				suffix = ' '+count;
			}
			nameList.push(name+suffix);
			geo.name = name+suffix;
		})
		log(nameList)
		this.createGeomLayers(nameList)
		this.sceneGeomArray = [ ...this.sceneGeom.values() ];
		
		var fbo = this.regl.framebuffer({
			width: this.getActiveChannelDimension(),
			height: this.getActiveChannelDimension(),
			colorFormat: 'rgba',
			colorType: 'uint8',
			depthStencil: false,
			// mag: 'linear',
			// min: 'mipmap',
			// wrap: 'clamp'
		})

		// this.sceneGeom.forEach((geo) => {
		this.sceneGeomArray.forEach((geo, i) => 
		{
			// geo.vertices = geoCenter(geo.vertices, { center: center /*[0,0,0]*/ });
			var bbox = calcBoundingBoxFromFlatArray(geo.vertices);
			bbox[0][0] *= scale;
			bbox[1][0] *= scale;
			bbox[0][1] *= scale;
			bbox[1][1] *= scale;
			bbox[0][2] *= scale;
			bbox[1][2] *= scale;
			geo.vertices = rescaleVertices(geo.vertices, bbox, geo.bbox);
			geo.bbox = bbox;
			
			if (!geo.normals || geo.normals.length==0)
				geo.normals = calcVertexNormals(geo.indeces, geo.vertices);
			// log(geo)
			// geo.indecesBuffer = /* this.regl.buffer */( new Uint32Array(geo.indeces) );
			geo.indeces = /* this.regl.buffer */( new Uint32Array(geo.indeces) );
			geo.verticesBuffer = this.regl.buffer (  new Float32Array (geo.vertices) );
			geo.normalsBuffer = this.regl.buffer ( new Float32Array (geo.normals) );
			// 
			for (let j = 0; j < geo.uvs.length; j++)	geo.uvs[j] %= 1.0;
			geo.uvsBuffer = this.regl.buffer ( new Float32Array (geo.uvs) );
			// geo.texture = null;
			geo.ao = null;

			var dataTex = null;

			fbo.use( ()=>
			{
				this.regl.clear({ depth: 1, color: [1, 1, 1, 0] })
				geo.fillColor = [1, 1, 1, 1]
				this.fillMeshTexture([geo])
				dilate();
				geo.colorTex = this.regl.texture( {
					copy: true,
					width: this.getActiveChannelDimension(),
					height: this.getActiveChannelDimension(),
					format: 'rgba',
					type: 'uint8',
					mag: 'linear',
					min: 'mipmap',
					wrap: 'clamp'
				});

				// this.regl.clear({ depth: 1, color: [0.5, 0.5, 1.0, 1] })
				// geo.fillColor = [0.5, 0.5, 1.0, 1]
				// this.fillMeshTexture([geo])
				// dilate();
				geo.normalTex = this.regl.texture( 
					// {
					// 	// copy: true,
					// 	width: this.getActiveChannelDimension(),
					// 	height: this.getActiveChannelDimension(),
					// 	format: 'rgba',
					// 	// data: (new Float32Array(this.getActiveChannelDimension()*this.getActiveChannelDimension()))
					// 	// type: 'uint16', // cannot read from uint16 framebuffers
					// 	type: 'float',
					// 	mag: 'linear',
					// 	min: 'linear',
					// 	// min: 'mipmap',
					// 	wrap: 'clamp',
					// }
				);
				let dTex = new DataTexture({
						width: this.getActiveChannelDimension(),
						height: this.getActiveChannelDimension(),
						format:'rgba',
						type: 'float'
				});
				dTex.alloc(true);
				dTex.writeToTexture(geo.normalTex, 
					{
						width: this.getActiveChannelDimension(),
						height: this.getActiveChannelDimension(),
						format: 'rgba',
						// data: (new Float32Array(this.getActiveChannelDimension()*this.getActiveChannelDimension()))
						// type: 'uint16', // cannot read from uint16 framebuffers
						type: 'float',
						mag: 'linear',
						min: 'linear',
						// min: 'mipmap',
						wrap: 'clamp',
					})
				dTex = null;


				this.regl.clear({ depth: 1, color: [0, 0, 0, 0] })
				geo.fillColor = [0, 0, 0, 1]
				this.fillMeshTexture([geo])
				dilate();
				geo.metallicTex = this.regl.texture( {
					copy: true,
					width: this.getActiveChannelDimension(),
					height: this.getActiveChannelDimension(),
					format: 'rgba',
					type: 'uint8',
					mag: 'linear',
					min: 'mipmap',
					wrap: 'clamp'
				});

				this.regl.clear({ depth: 1, color: [1, 1, 1, 0] })
				geo.fillColor = [1, 1, 1, 1]
				this.fillMeshTexture([geo])
				dilate();
				geo.roughnessTex = this.regl.texture( {
					copy: true,
					width: this.getActiveChannelDimension(),
					height: this.getActiveChannelDimension(),
					format: 'rgba',
					type: 'uint8',
					mag: 'linear',
					min: 'mipmap',
					wrap: 'clamp'
				});


				this.regl.clear({ depth: 1, color: [0, 0, 0, 0] })
				geo.fillColor = [0, 0, 0, 1]
				this.fillMeshTexture([geo])
				dilate();
				geo.emissiveTex = this.regl.texture( {
					copy: true,
					width: this.getActiveChannelDimension(),
					height: this.getActiveChannelDimension(),
					format: 'rgba',
					type: 'uint8',
					mag: 'linear',
					min: 'mipmap',
					wrap: 'clamp'
				});


				this.regl.clear({ depth: 1, color: [0, 0, 0, 0] })
			} )

			this.setActiveGeomIdx(i);
			
			addLayer('color', extractDataTexFrom(geo.colorTex, 
			{
				width: this.getActiveChannelDimension(),
				height: this.getActiveChannelDimension(),
				// colorFormat: 'rgba',
				// colorType: 'uint8',
			}))

			addLayer('normal', extractDataTexFrom(geo.normalTex, 
			{
				width: this.getActiveChannelDimension(),
				height: this.getActiveChannelDimension(),
				type: 'float',
				format: 'rgba',
				colorFormat: 'rgba',
				colorType: 'float',
				// // type: 'uint16', // cannot read from uint16 framebuffers
			}))

			addLayer('metallic', extractDataTexFrom(geo.metallicTex, 
			{
				width: this.getActiveChannelDimension(),
				height: this.getActiveChannelDimension(),
				// colorFormat: 'rgba',
				// colorType: 'uint8',
			}))

			addLayer('roughness', extractDataTexFrom(geo.roughnessTex, 
			{
				width: this.getActiveChannelDimension(),
				height: this.getActiveChannelDimension(),
				// colorFormat: 'rgba',
				// colorType: 'uint8',
			}))

			addLayer('emissive', extractDataTexFrom(geo.emissiveTex, 
			{
				width: this.getActiveChannelDimension(),
				height: this.getActiveChannelDimension(),
				// colorFormat: 'rgba',
				// colorType: 'uint8',
			}))


			// geo.texture.naturalWidth = domImg.naturalWidth;
			// geo.texture.naturalHeight = domImg.naturalHeight;
		});

		fbo.destroy();	fbo = null;
		tempFbo.destroy();
		this.setActiveGeomIdx(0); 
		log('this.sceneGeomArray ', this.sceneGeomArray);

		// this.meshVertices = geoCenter(mesh.vertices, { center: center /*[0,0,0]*/ });
		// var srcBBox = calcBoundingBox(this.meshVertices);
		// this.meshBBox = [	
		// 					[scale*srcBBox[0][0], scale*srcBBox[0][1], scale*srcBBox[0][2]], 
		// 					[scale*srcBBox[1][0], scale*srcBBox[1][1], scale*srcBBox[1][2]], 
		// 				];
		// this.meshVertices = rescaleVertices(this.meshVertices, this.meshBBox, srcBBox)
		// // this.meshElements = triangulate(mesh.indices);
		// this.meshElements = (mesh.indeces);
		// // if (!mesh.normals)
		// 	this.meshVertexNormals = calcVertexNormals(this.meshElements, this.meshVertices);
		// // else
		// // 	this.meshVertexNormals = mesh.vertexNormals;
		// // log(this.meshVertexNormals);
		// this.meshUvs = mesh.uvs;
		// // log(mesh);

		// if (!this.camera)
		{
			// const center =  [ 0, 0, 0]
			// 	// 0.5*(this.meshBBox[0][0] + this.meshBBox[1][0]),
			// 	// 0.5*(this.meshBBox[0][1] + this.meshBBox[1][1]),
			// 	// 0.5*(this.meshBBox[0][2] + this.meshBBox[1][2]) ]
			// const cntr = [center[0]*0.5, center[1]*0.5, center[2]*0.5];
			const cntr = [0, center[1]*scale, 0];
			this.camera = createCamera({
				center: cntr,//center,
				//   eye: [0, 0, this.meshBBox[1][2]],
				eye: [0, center[1]*scale, 30],
				//   eye: center,
				distanceLimits: [this.zNear, this.zFar]
			})
			this.camera.setMode(this.viewerMode);
		}

		this.setMeshLoaded(true);
		this.$nextTick(()=>
		{
			this.setActiveGeomIdx(0);
		})
		
		// this.calcAmbientOcclusion()
		// 	.then( ()=>{
				this.refreshMesh = true;
				this.startDrawUpdates();
				_vm_.$emit('progress', 0);
				resolve();
			// } )


		// this.tick = this.regl.frame(() => {
		// 				this.regl.clear({
		// 					depth: 1,
		// 					color: [0, 0, 0, 1]
		// 				})

		// 				this.drawCall()
		// 			})
	}); // Promise
}

function meshBindEvents()
{
	_vm_.$on('viewerFOV', (payload)=>{ this.viewerFov = payload; this.refreshMesh = true; })
	_vm_.$on('viewerMode', (payload)=>{ this.viewerMode = payload; this.camera && this.camera.setMode(this.viewerMode); })
	_vm_.$on('viewerFlipX', (payload)=>{ this.viewerFlipX = payload })
	_vm_.$on('viewerFlipY', (payload)=>{ this.viewerFlipY = payload })
	_vm_.$on('viewerAO', (payload)=>{ this.aoOpacity = payload; this.refreshMesh = true; })
	_vm_.$on('viewerAL', (v)=>{ this.iblAmbientOpacity = [v, v, v, v]; this.refreshMesh = true; })
}


export default {
	// createCamera,
	readFile,
	readUrlFile,
	parseObjFile,
	parseFbxFile,
	updateMesh,
	// calcAmbientOcclusion,
	meshBindEvents
}