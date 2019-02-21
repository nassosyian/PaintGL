<template lang="pug">
.canvas-wrapper(:class="[activeToolName, {dragover: canvasDragover}]" ref="canvaswrapper" )
	canvas.flex.column.align-stretch(:id="canvasID" :width="VIEWER_WIDTH_POT" :height="VIEWER_HEIGHT_POT" :style="cursorStyle" ref="canvas" v-shortkey.push="{uv:['`'], n:['n'], t:['t'], c:['c']}" @shortkey="toggleDrawUVMap")
	svg(v-if="showPressureCircle==true" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" :width="VIEWER_WIDTH" :height="VIEWER_HEIGHT" :viewBox="'0 0 ' + VIEWER_WIDTH + ' ' + VIEWER_HEIGHT" :style="'enable-background:new 0 0 ' + VIEWER_WIDTH + ' ' + VIEWER_HEIGHT" xml:space="preserve")
		circle(stroke="grey" fill="none"  :cx="cursorCircleX" :cy="cursorCircleY" :r="cursorCircleRadius")
	slot
	.active-geom-name(v-if="sceneGeomArray.length > 1") {{activeGeomName}}

	v-dialog(v-model="showBrushDialog" max-width="940px" scrollable transition--="none")
		v-card.brush-dialog(:class="{disabled: !showBrushDialog}")
			v-toolbar(card dark)
				v-toolbar-title Brush Images
				v-spacer
				v-toolbar-items
				v-btn(dark flat @click="(e)=>$refs.brushStampDropArea.openFileDialog(e)") Load
				v-btn(icon @click="showBrushDialog = false" dark): v-icon close
			drop-file.flex.column.align-stretch.brushStampDropArea( :enableClick="false" ref="brushStampDropArea" types=".png,.jpg" eventname="droppedBrushStamp" )
				v-card-text
					v-container(fluid grid-list-md)
						v-layout(row wrap)
							v-card.thumbnail(width="200px" v-for="stamp in loadedBrushStamps" :key="stamp.date")
								v-card-media(:src="stamp.img.src" @click="(e)=>{selectBrushStamp(e); showBrushDialog = false;}" contain  height="200px"      			:class="{selected: stamp.selected}")
							.drop-img-thumbnail( )

	v-dialog(v-model="showStrokePresetsDialog" max-width="1080px" scrollable transition--="none")
		v-card.brush-dialog(:class="{disabled: !showStrokePresetsDialog}")
			v-toolbar(card dark)
				v-toolbar-title Brush Stroke Presets
				v-spacer
				v-toolbar-items
				v-btn(dark flat @click="saveCurrentStrokePreset()") Save current
				v-btn(icon @click="showStrokePresetsDialog = false" dark): v-icon close
			v-card-text
				v-container(fluid grid-list-md)
					v-layout(row wrap)
						v-card.thumbnail(width="320" v-for="(item, index) in strokePresetThumbs" :key="index")
							v-card-media(:src="item.imgSrc" @click="(e)=>{selectBrushStrokePreset(e); showStrokePresetsDialog = false;}" contain width="320px" height="140px"  :class="{selected: item.selected}")

</template>


<script>


//=========================================================================
//			*WARNING*
//============================
//	starting from regl@1.3.4 
//	initialising a framebuffer with multiple color-buffer and depth-buffer
//	results in error (this.meshDestFbo, line 1205)
//=========================================================================



import { mapState, mapMutations, mapGetters } from 'vuex'
import DataTexture from '../classes/DataTexture';
import ToolBrush from '../classes/ToolBrush'
import ToolEraser from '../classes/ToolEraser'
import ToolSmear from '../classes/ToolSmear'
import ToolStamp from '../classes/ToolStamp'
import ToolRoller from '../classes/ToolRoller'
import ToolColorPicker from '../classes/ToolColorPicker'
import ToolOrbit from '../classes/ToolOrbit'
// import read from 'read-file'
const rAF = require('animation-frame')();
const REGL = require('regl')
import Pressure from '../pressure/src/pressure.js';
const mat4 = require('gl-mat4')
const divByte = 1.0 / 255.0;
const glsl = require('glslify');
const PNG = require('pngjs').PNG;

// import brushVert from '../../shaders/brush-stroke.vert.glsl'
// import brushFrag from '../../shaders/brush-stroke.frag.glsl'
import unwrapUVVert from '../../shaders/unwrap-uv.vert.glsl';
import compositeStrokeVert from '../../shaders/composite-strokes.vert.glsl';
import compositeStrokeFrag from '../../shaders/composite-strokes.frag.glsl';
import pbrFrag from '../../shaders/pbr.frag.glsl';
import dilateFrag from '../../shaders/dilate.frag.glsl';
import midpointDepthFrag from '../../shaders/midpoint-depth.frag.glsl';

import ssaoFrag from '../../shaders/ssao.frag.glsl'
import drawTextureFrag from '../../shaders/draw-texture.frag.glsl'
import drawTextureUnpremultFrag from '../../shaders/draw-texture-unpremult.frag.glsl'

// import canvasToImage from 'canvas-to-image'
import canvasToImage from '../utils/canvas-to-image.js'
import meshFunctions from '../utils/mesh.js'
import spotlightFunctions from '../utils/spotlight-methods.js'
// import { easeInOutQuad } from 'easing-functions';




let assetsOnLoadCallbacks = [];
let assetsLoaded = false;

function genProps(baseProp, baseVal, replacePattern, replacements, count, countPattern)
{
	var obj = {};
	var regexp = new RegExp(replacePattern, "g");
	var indexRegexp = new RegExp(countPattern, "g");
	for (var i = 0; i < count; i++)
	{
		replacements.forEach(str => {
			obj[baseProp.replace(regexp, str).replace(indexRegexp, ''+i)] = {
						type: 'image', 
						src: baseVal.replace(regexp, str).replace(indexRegexp, ''+i)
					}
		});
	}

	// log(JSON.stringify(obj));
	return obj;
}
function getProps(obj, baseProp, replacePattern, replacements, to, countPattern)
{
	var regexp = new RegExp(replacePattern, "g");
	var indexRegexp = new RegExp(countPattern, "g");
	var ret = [];
	for (var i = 0; i < to; i++)
	{
		replacements.forEach(str => {
			ret.push( obj[baseProp.replace(regexp, str).replace(indexRegexp, ''+i)] )
		});
	}

	return ret;
}


const sides = [ 'right', 'left', 'top', 'bottom', 'front', 'back', ];


export default {
	name: 'paint-surface-2d',
	// only the children inside 'provider' are reactive, not itself
	// inject: ['provider'], //  this is inheritted from the parent WebGL component
	props: {
		canvasID: {
			type: String,
			default: 'paintcanvas'
		},
		// width: {
		// 	// type: Number,
		// 	default: 800
		// },
		// height: {
		// 	// type: Number,
		// 	default: 800
		// },
		extentions: {
			default: ''
		}
	},
	data () {
		return {
			initiated: false,
			regl: null,
			rAF: rAF,
			tick: null,
			canvasDragover: false,
			// width: 0,
			// height: 0,

			BUFFER_DIMENSION: 4096 >> 1,
			VIEWER_WIDTH: 1024,
			VIEWER_HEIGHT: 1024,
			VIEWER_WIDTH_POT: 1024,
			VIEWER_HEIGHT_POT: 1024,

			_uvMapScale: [0, 0], // this is used in Brush Stroke Preview

			// canvasWidthMult: 1,
			// canvasHeightMult: 1,
			// canvasScreenAspect: 1,

			showBrushDialog: false,
			showStrokePresetsDialog: false,
			strokePresetThumbs: [],
			// loadedBrushStamps: [],
			// activeBrushStampIdx: 0,
			brushPresets: [],
			brushStrokePreviewCurve: { y: new Int16Array(280), force: new Float32Array(280)},

			showingUVMap: false,

			oldSceneGeom: null,
			sceneGeom: null,
			sceneGeomArray: [],

			activeGeom: [],

			meshVertices: [],
			meshElements: [],
			meshVertexNormals: [],
			meshUvs: [],
			meshAO: [],
			meshTexture: null,

			cullFace: false,
			drawMeshToBuffers: null,
			drawLayersToBuffers: null,
			drawMeshWorldPos: null,
			drawMeshUV: null,
			extractMeshTexture: null,
			refreshMesh: false,
			tickMesh: null,

			aoRes: 512,
			aoBias: 0.01,
			aoSampleCount: 512,

			aoOpacity: 1,
			iblAmbientOpacity: [1, 1, 1, 1],
			
			viewerFov: Math.PI / 4,
			zNear: 1e-6,//0.001,
			zFar: 100,
			viewerMode: 'orbit',
			viewerFlipX: false,
			viewerFlipY: false,

			camera: null,
			// drawCall: null,

			tools: {
				'color-picker': null, 
				'brush': null, 
				'smear': null, 
				'eraser': null, 
				'stamp': null,
				'orbit': null,
			},
			activeTool: null,
			pointerStyle: null,
			circleCursor: {
				cx: 0,
				cy: 0,
				r: 0
			},
			isStrokeActive: false,
			showPressureCircle: false,

			paintSurfTextures: [null],// null],
			paintSurfFbos: [null],//, null],
			tempTex: null,
			tempTex2: null,
			tempFbo: null,
			meshUVTex: null,
			meshTempFbo: null,
			meshDepthTexLess: null,
			meshDepthTexGreater: null,
			meshDepthTexMidpoint: null,
			meshDestFbo: null,
			meshWorldPosFbo: null,
			overlayDestFbo: null,

			paintState: 0,
			compositeStroke: null,
			drawTexture: null,
			drawTextureUnpremult: null,
			dilateTexture: null,
			drawUnwrapedUV: null,
			// dilateFbo: null,

			// We use viewer-normals, viewer-baseColor, viewer-metallic, viewer-roughness, viewer-emisiveColor buffers
			viewerBaseColorTex: null,
			viewerExtraTex: null,
			viewerOverlayTex: null,
			viewerWorldPos: null,
			viewerGeomNTex: null,
			viewerGeomTTex: null,
			viewerNormalTex: null,
			viewerMetallicTex: null,
			viewerRoughnessTex: null,
			viewerEmissiveColorTex: null,

			resizeableViewerFbo: [],

			aoTex: null,
			aoFbo: null,
			calcAO: null,

			diffuseEnvCubeTex: null,
			environmentCubeTex: null,
			specularEnvCubeTex: null,
			brdfLUTTex: null,

			brushTexture: null,
			lastMousePos: null,
			currentMousePos: null,
		}
	}
	,watch: {
		activeToolName(newValue, oldValue) 
		{
			log('activeTool: '+newValue);
			if (this.tools[newValue])
			{
				var color = this.brushColor.slice();
				this.activeTool && this.activeTool.deactivate(this);
				this.activeTool = this.tools[newValue]
				this.activeTool.brushTexture = this.brushTexture;
				this.activeTool && this.activeTool.activate(this);
				if (oldValue=='color-picker')
				{
					this.setPickedColor({
											r: color[0]*255, 
											g: color[1]*255, 
											b: color[2]*255, 
											a: color[3]
										})
				}
				_vm_.$emit('switch-tab', 'tab-tool');
			}
			else
				log('no tool found for '+newValue)
		}

		,activeGeomIdx(newValue)
		{
			this.activeGeom = [newValue];
		}

		,strokePresets(newValue)
		{
			this.calcStrokePresetThumbs(newValue);
		}

		,activeChannelLayers(newValue)
		{
			log('getActiveChannelLayers change: ', newValue);
		}

	}
	,computed: 
	{
		activeGeomName() { return this.sceneGeom ? this.sceneGeomArray[this.activeGeomIdx].name : ''},

		loadedBrushStamps: {get() {return this.$store.state.loadedBrushStamps;}, set(val) {this.setLoadedBrushStamps(val);}},

		activeBrushStampIdx: 
		{
			get() 
			{
				return this.$store.state.activeBrushStampIdx;
			}, 

			set(newValue)
			{
				this.setActiveBrushStampIdx(newValue);
				
				var stamp = this.loadedBrushStamps[newValue];
				if (!stamp)	return;

				this.loadedBrushStamps.forEach(b => b.selected = false);
				stamp.selected = true;
				var img = stamp.img;

				if (!this.brushTexture)	this.brushTexture = this.regl.texture();

				this.brushTexture( {
					// data: domImg,
					data: img,
					// mipmap: true,
					// minFilter: 'mipmap',
					width: img.naturalWidth,
					height: img.naturalHeight,
					mipmap: 'nice',
					mag: 'linear',
					min: 'mipmap',
					// min: 'linear mipmap linear',
					// wrap: 'repeat'
				});
				this.brushTexture.naturalWidth = img.naturalWidth;
				this.brushTexture.naturalHeight = img.naturalHeight;
				if (this.activeTool) this.activeTool.brushTexture = this.brushTexture;

				this.drawBrushStrokePreview(document.getElementById('paint-stroke-preview'));

				log('activeBrushStampIdx: '+newValue);
			}
		},
		
		canvasScreenAspect() { return this.VIEWER_WIDTH / this.VIEWER_HEIGHT;},
		canvasWidthMult() { return this.regl._gl.drawingBufferWidth / this.VIEWER_WIDTH; },
		canvasHeightMult() { return this.regl._gl.drawingBufferHeight / this.VIEWER_HEIGHT; },
		cursorStyle() 
		{
			if (this.pointerStyle)
				return { cursor: this.pointerStyle };
			else
				return {};
		},
		cursorCircleX() { return this.circleCursor.cx},
		cursorCircleY() { return this.circleCursor.cy},
		cursorCircleRadius() { return this.circleCursor.r},
		...mapState(['meshLoaded', 'channelList', 'channelListClear', 'activeGeomIdx', 'activeChannelLayers', 'activeToolName', 'brushColor', 'brushStampOpacity', 'strokePresets', 'activeStrokePreset', 'lightDirection', 'currentChannelSolo', /* 'loadedBrushStamps', 'activeBrushStampIdx', *//* , 'textureDim' */]),
		...mapGetters([
						// 'undoAction'
						// ,'redoAction'
						'currentAction'
						,'undoPaintActionCount'
						,'undoActionCount'
						,'redoActionCount'
						,'getNextRedoAction'
						,'getPrevUndoAction'
						,'getBrushState'
						,'brushStampOpacity'
						,'brushSize'
						,'brushGap'
						,'brushAlign'
						,'brushOffset'
						,'brushRotation'
						,'brushHue'
						,'brushSaturation'
						,'brushLuminance'
						,'brushPressureFlow'
						,'brushPressureOpacity'
						,'brushPressureSize'
						,'brushPressureGap'
						,'brushPressureOffset'
						,'brushPressureAlign'
						,'brushPressureRotation'
						,'brushPressureHue'
						,'brushPressureSaturation'
						,'brushPressureLuminance'
						,'activeChannel'
						,'getActiveChannelIndex'
						,'getActiveChannelDimension'
						,'getActiveChannelTextureName'
						,'getActiveChannelClearColor'
						,'getChannelMaxDimension'
						,'getLayerData'
						,'activeChannelLayers'
						,'activeChannelSelectedLayer'
						,'layerDataCount'
						,'getGeomChannelLayersWithFilter'
						,'getGeomChannelRefresh'
						,'activeBrushStamp'
						,'channelDimension'
					])
	}
	// ,created()
	// {
	// 	log('created')
		
	// }
	,mounted() 
	{
		log('mounted PaintSurface2D');


		this.initStore()

		const calcWrapperDimension = () =>
		{
			if (!this.$refs.canvaswrapper)
				return;
			var rect = this.$refs.canvaswrapper.getBoundingClientRect();
			this.VIEWER_WIDTH = ( Math.round(rect.width) );
			this.VIEWER_HEIGHT = ( Math.round(rect.height) );
			var potWidth = pow2ceil( this.VIEWER_WIDTH );
			var potHeight = pow2ceil( this.VIEWER_HEIGHT );
			if (potWidth!=this.VIEWER_WIDTH_POT || potHeight!=this.VIEWER_HEIGHT_POT)
			{
				this.VIEWER_WIDTH_POT = potWidth;
				this.VIEWER_HEIGHT_POT = potHeight;
				this.onViewerResize();
			}

			log(`canvaswrapper ${this.VIEWER_WIDTH_POT} ${this.VIEWER_HEIGHT_POT}`);
			this.refreshMesh = true;
		}

		calcWrapperDimension()
		window.addEventListener('resize', calcWrapperDimension);

		
		var exts = ['angle_instanced_arrays', 
					'oes_element_index_uint',
					'EXT_frag_depth',
					'OES_standard_derivatives',
					'EXT_shader_texture_lod',
					'WEBGL_draw_buffers', 
					'OES_texture_half_float', 
					'OES_texture_float',
					'oes_texture_float_linear',
					'WEBGL_depth_texture',
					// 'OES_element_index_uint',
					];
		var miscExts = this.extentions.split(' ').filter((item) => item.length > 0);
		exts = miscExts instanceof Array && miscExts.length > 0 ? exts.concat(miscExts) : exts;
		log(exts);
		this.regl = REGL( { 
				canvas: this.$refs.canvas,
				extensions: exts,
				attributes: {
					alpha: true,
					preserveDrawingBuffer: true,
					premultipliedAlpha: false
				},
				onDone: (err, regl) => {
					
					if (err)
					{
						var el = document.getElementById('nowebgl');
						el.style.display = 'flex';
						if (navigator.userAgent.indexOf(' Edge/') > -1)
						{
							el.style.color = '';
						}
						var app = document.getElementById('app');
						app.style.display = 'none';
						// if (console.error) console.error(err)
						// else 
						log(err);
					}
					else
					{
						regl._gl.getExtension('EXT_frag_depth');
						setTimeout(()=>{
							this.init();
						}, 0)
					}
					log('regl done!');
					// this.regl = regl;
				}
			});

		_vm_.$on('registerUndoAction', (payload)=>
		{
			this.clearRedoActions()
			if (this.currentAction)
			{
				this.pushUndoAction(this.currentAction)
			}
			else if (payload)
			{
				this.pushUndoAction(payload)
			}
			this.setCurrentAction(null)
		})
		_vm_.$on('registerCurrentAction', (payload)=>
		{
			// this.clearRedoActions()
			// this.pushRedoAction(payload)
			this.setCurrentAction(payload)
		})
		// log(this.regl)

		if (this.regl && this.regl._gl)
		{
			require('resl')({
				manifest: {
					'uv_helper': {
						type: 'image',
						// src: require('../../assets/uv_helper.jpg')
						src: _baseUrl+'assets/uv_helper.jpg'
					},

					'brush-hard-round': {
						type: 'image',
						src: _baseUrl+'assets/hard-round.png'
					},
					'brush-soft-round': {
						type: 'image',
						src: _baseUrl+'assets/soft-round.png'
					},
					'brush-hard-blured-round': {
						type: 'image',
						src: _baseUrl+'assets/hard-blured-round.png'
					},
					'brush-square': {
						type: 'image',
						src: _baseUrl+'assets/square.png'
					},
					'brush-chalk1': {
						type: 'image',
						src: _baseUrl+'assets/chalk-1.png'
					},

					
					'brush1': {
						type: 'image',
						// src: require('../../assets/brush-1.png')
						src: _baseUrl+'assets/brush-1.png'
					},
					'brush2': {
						type: 'image',
						// src: require('../../assets/brush-2.png')
						src: _baseUrl+'assets/brush-2.png'
					},


					'brush-bristle1': {
						type: 'image',
						src: _baseUrl+'assets/bristle-1.png'
					},
					'brush-bristle2': {
						type: 'image',
						src: _baseUrl+'assets/bristle-2.png'
					},
					'brush-bristle3': {
						type: 'image',
						src: _baseUrl+'assets/bristle-3.png'
					},
					'brush-bristle4': {
						type: 'image',
						src: _baseUrl+'assets/bristle-4.png'
					},
					'brush-bristle5': {
						type: 'image',
						src: _baseUrl+'assets/bristle-5.png'
					},


					'brush-spatter1': {
						type: 'image',
						src: _baseUrl+'assets/spatter-1.png'
					},
					'brush-spatter2': {
						type: 'image',
						src: _baseUrl+'assets/spatter-2.png'
					},
					'brush-spatter3': {
						type: 'image',
						src: _baseUrl+'assets/spatter-3.png'
					},
					'brush-spatter4': {
						type: 'image',
						src: _baseUrl+'assets/spatter-4.png'
					},
					'brush-spatter5': {
						type: 'image',
						src: _baseUrl+'assets/spatter-5.png'
					},
					'brush-spatter6': {
						type: 'image',
						src: _baseUrl+'assets/spatter-6.png'
					},
					'brush-spatter7': {
						type: 'image',
						src: _baseUrl+'assets/spatter-7.png'
					},
					'brush-spatter8': {
						type: 'image',
						src: _baseUrl+'assets/spatter-8.png'
					},
					'brush-spatter9': {
						type: 'image',
						src: _baseUrl+'assets/spatter-9.png'
					},
					'brush-sponge': {
						type: 'image',
						src: _baseUrl+'assets/sponge.png'
					},
					'brush-sparks': {
						type: 'image',
						src: _baseUrl+'assets/sparks.png'
					},
					'brush-crackle': {
						type: 'image',
						src: _baseUrl+'assets/crackle.png'
					},




					'brdfLUT': {
						type: 'image',
						src: _baseUrl+'img/textures/brdfLUT.png'
					},
					...genProps('diffuse_side_count', _baseUrl+'img/textures/papermill/diffuse/diffuse_side_count.jpg', 'side', sides, 1, 'count'),
					// ...genProps('environment_side_count', 'img/textures/papermill/environment/environment_side_count.jpg', 'side', sides, 1, 'count'),
					// ...genProps('specular_side_count', 'img/textures/papermill/specular/specular_side_count.jpg', 'side', sides, 10, 'count'),
					...genProps('specular_side_count', _baseUrl+'img/textures/papermill/specular/specular_side_count.jpg', 'side', sides, 1, 'count'),
				},
				// Once the assets are done loading, then we can use them within our
				// application
				onDone: (assets) => 
				{
					log('assets loaded!');
					log(assets);
					var child = null;

					this.loadedBrushStamps.push({name: "uv_helper", img: assets.uv_helper, selected: false, date: 0})
					for (name in assets)
					{
						if ( name.indexOf('brush') > -1 )
						{
							this.loadedBrushStamps.push({name, img: assets[name], selected: false, date: this.loadedBrushStamps.length});
						}
					}
					this.activeBrushStampIdx = 10;//0;


					assetsLoaded = true;

					for (var i = 0; i < assetsOnLoadCallbacks.length; i++)
						assetsOnLoadCallbacks[i] && assetsOnLoadCallbacks[i].call(null, assets);

					this.brdfLUTTex = this.regl.texture({
						data: assets.brdfLUT,
						mipmap: 'nice',
						min: 'mipmap',
						mag: 'linear'
					})
					var list = [];
					// this.diffuseEnvCubeTex = this.regl.cube(...getProps(assets, 'diffuse_side_count', 'side', sides, 1, 'count'))
					sides.forEach((side)=>{
						var opt = {
								width: assets['diffuse_'+side+'_0'].naturalWidth, 
								height: assets['diffuse_'+side+'_0'].naturalHeight, 
								mipmap: 'nice', min: 'mipmap', mag: 'linear', data: null
							};
						opt.data = assets['diffuse_'+side+'_0'];
						list.push(opt);
					})
					this.diffuseEnvCubeTex = this.regl.cube(...list);
					
					// this.environmentCubeTex = this.regl.cube(...getProps(assets, 'environment_side_count', 'side', sides, 1, 'count'))
					list = [];
					sides.forEach((side)=>{
						var opt = {
								width: assets['specular_'+side+'_0'].naturalWidth, 
								height: assets['specular_'+side+'_0'].naturalHeight, 
								mipmap: 'nice', min: 'mipmap', mag: 'linear', data: null
							};
						opt.data = assets['specular_'+side+'_0'];
						list.push(opt);
					})
					this.specularEnvCubeTex = this.regl.cube(...list);


					this.calcStrokePresetThumbs(this.strokePresets)
				},

				// As assets are preloaded the progress callback gets fired
				onProgress: (progress, message) => {
					log('Progress: '+(progress * 100) + '%');
					// document.body.innerHTML =
					// 	'<b>' + (progress * 100) + '% loaded</b>: ' + message
				},

				onError: (err) => {
					console.error(err)
				}
			})			
		}
	}
	,destroyed () 
	{
		this.brushTexture && this.brushTexture.destroy(); this.brushTexture = null;
		this.activeTool = null;
		for (var key in this.tools)
		{
			this.tools[key].destroy()
			this.tools[key] = null;
			// this.activeTool.destroy();
		}
		// this.activeTool.texture && this.activeTool.texture.destroy();
		this.activeTool = null;
		this.regl.destroy();
	}


	,methods: 
	{
		init() 
		{ 
			log('PaintSurface2D init');

			log(`${this.regl._gl.drawingBufferWidth} ${this.regl._gl.drawingBufferHeight}`)
			log(`MAX_TEXTURE_SIZE: ${this.regl._gl.getParameter(this.regl._gl.MAX_TEXTURE_SIZE)} `)
			log(`MAX_TEXTURE_IMAGE_UNITS: ${this.regl._gl.getParameter(this.regl._gl.MAX_TEXTURE_IMAGE_UNITS)} `)
			log(`MAX_VERTEX_TEXTURE_IMAGE_UNITS: ${this.regl._gl.getParameter(this.regl._gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)} `)
			log(`MAX_COMBINED_TEXTURE_IMAGE_UNITS: ${this.regl._gl.getParameter(this.regl._gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)} `)
			log(`MAX_COLOR_ATTACHMENTS_WEBGL: ${this.regl._gl.getParameter(this.regl._gl.getExtension('WEBGL_draw_buffers').MAX_COLOR_ATTACHMENTS_WEBGL)} `)
			log(`MAX_DRAW_BUFFERS_WEBGL: ${this.regl._gl.getParameter(this.regl._gl.getExtension('WEBGL_draw_buffers').MAX_DRAW_BUFFERS_WEBGL)} `)
			// const box = this.$refs.canvas.getBoundingClientRect();
			// this.canvasWidthMult = this.regl._gl.drawingBufferWidth / box.width;
			// this.canvasHeightMult = this.regl._gl.drawingBufferHeight / box.height;
			// this.canvasScreenAspect = box.width / box.height;

			// this.regl.clear({
			// 					depth: 0,
			// 					color: [0, 1, 1, 1]
			// 				})

			function easeInOutQuad(t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t }
			const checkFbo = () =>
			{
				var fboError = this.regl._gl.checkFramebufferStatus(this.regl._gl.FRAMEBUFFER);
				if (fboError != this.regl._gl.FRAMEBUFFER_COMPLETE)
					console.error('framebuffer error: ', fboError)
			}

			const div_len = 1.0 / this.brushStrokePreviewCurve.y.length;
			this.brushStrokePreviewCurve.y.forEach( (_, i)=> {
				var t = i*div_len;
				var pi = t * (Math.PI*2);
				var y = Math.round( Math.sin(pi) * 20 );
				this.brushStrokePreviewCurve.y[i] = y;
				t = t*2.0 - 1.0;
				t = 1.0 - Math.abs(t);
				this.brushStrokePreviewCurve.force[i] = easeInOutQuad(t);
			} );

			this.paintSurfTextures = this.paintSurfTextures.map((_, i) => 
										this.regl.texture({
											width: this.VIEWER_WIDTH_POT,
											height: this.VIEWER_HEIGHT_POT,
											// width: this.BUFFER_DIMENSION,
											// height: this.BUFFER_DIMENSION,
											// mipmap: 'nice', 
											mag: 'linear', 
											// min:'mipmap',
											min:'linear',
											type: i==0 ? 'float' : 'uint8',
											// type: 'half float'
											// wrap: 'mirror'
											wrap: 'clamp'
										})
			);
			this.activeBufferTex = this.paintSurfTextures[0];//(this.paintState)];

			this.paintSurfFbos = this.paintSurfTextures.map((item) => 
			{
				var fbo = this.regl.framebuffer({
					width: this.VIEWER_WIDTH_POT,
					height: this.VIEWER_HEIGHT_POT,
					color: item,
					// depthStencil: false
				})
				// if (fbo.width != fbo.color[0].width)	debugger
				checkFbo()
				return fbo;
			});

			// this.dilateFbo = this.regl.framebuffer({
			// 							width: 4,
			// 							height: 4,
			// 							colorFormat: 'rgba',
			// 							depth: false,
			// 							stencil: false,
			// 						});

			this.viewerBaseColorTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerOverlayTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerExtraTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})
			this.extraBufferTex = this.viewerExtraTex;
			this.extraChannelType = 0;

			this.viewerGeomNTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerGeomTTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerNormalTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerMetallicTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerRoughnessTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerEmissiveColorTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerWorldPos = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				type: 'float'
			})

			this.meshWorldPosFbo = this.regl.framebuffer({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: [
					this.viewerWorldPos,
					this.viewerGeomNTex,
					this.viewerGeomTTex,
					this.viewerNormalTex,
				],
				depth: true,
				stencil: false,
			})
			checkFbo()
			this.resizeableViewerFbo.push(this.meshWorldPosFbo)

			this.aoTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.aoFbo = this.regl.framebuffer({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: this.aoTex,
				depthStencil: false,
			})
			checkFbo()
			this.resizeableViewerFbo.push(this.aoFbo)
			

			this.meshUVTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				type: 'float'
			})

			this.meshTempFbo = this.regl.framebuffer({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: this.meshUVTex,
			})
			checkFbo()
			this.resizeableViewerFbo.push(this.meshTempFbo)
			

			this.tempTex = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				type: 'uint8'
			})

			this.tempTex2 = this.regl.texture({
				width: 2,
				height: 2,
				format: 'rgba',
				type: 'uint8'
			})

			this.tempFbo = this.regl.framebuffer({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: this.tempTex,
				depth: false,
				stencil: false,
			})
			checkFbo()
			this.resizeableViewerFbo.push(this.tempFbo)
			

			this.meshDepthTexLess = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'depth',
				type: 'uint32'
			})

			this.meshDepthTexGreater = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'depth',
				type: 'uint32'
			})

			this.meshDepthTexMidpoint = this.regl.texture({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'depth',
				type: 'uint32'
			})

			this.meshDestFbo = this.regl.framebuffer({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: [
					this.viewerBaseColorTex,
					// this.viewerGeomNTex,
					// this.viewerGeomTTex,
					// this.viewerNormalTex,
					this.viewerMetallicTex,
					this.viewerRoughnessTex,
					this.viewerEmissiveColorTex,
				],
				depth: this.meshDepthTexLess,
				depthTexture: true,
				stencil: false
			})
			checkFbo()
			this.resizeableViewerFbo.push(this.meshDestFbo)
			

			this.overlayDestFbo = this.regl.framebuffer({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: [
					this.paintSurfTextures[0],
					this.viewerOverlayTex,
				],
				depth: this.meshDepthTexLess,
				depthTexture: true,
				stencil: false,
			})
			checkFbo()

			rAF.request( (time) => {
				this.paintSurfFbos[0].use(() => this.regl.clear({ depth: 1, color: [1, 1, 1, 0] })	);
				// this.paintSurfFbos[1].use(() => this.regl.clear({ depth: 1, color: [1, 1, 1, 1] })	);
				this.meshDestFbo.use(() => this.regl.clear({ depth: 1, color: [0, 0, 0, 0] })	);
			});

			this.calcMidpointDepth = this.regl({
				vert: compositeStrokeVert,
				frag: midpointDepthFrag,
				attributes: {
					position: [ -4, -4, 4, -4, 0, 4 ]
				},
				count: 3,
				uniforms: {
					depthLess: () => (this.meshDepthTexLess),
					depthGreater: () => (this.meshDepthTexGreater),
				},
				depth: {
					enable: true
				},
				stencil: {
					enable: false,
				},
			})

			this.drawTexture = this.regl({
				vert: compositeStrokeVert,
				frag: drawTextureFrag,
				attributes: {
					position: [ -4, -4, 4, -4, 0, 4 ]
				},
				count: 3,
				uniforms: {
					tex: this.regl.prop('texture'),
					showGrid: (_, props) => (typeof props.showGrid)=='undefined' ? false : props.showGrid,
					showOpacity: (_, props) => (typeof props.showOpacity)=='undefined' ? true : props.showOpacity,
					opacity: (context, props) => (typeof props.opacity)=='undefined' ? 1.0 : props.opacity,
				},
				depth: {
					enable: false
				},
				stencil: {
					enable: false,
				},
			})

			this.drawTextureUnpremult = this.regl({
				vert: compositeStrokeVert,
				frag: drawTextureUnpremultFrag,
				attributes: {
					position: [ -4, -4, 4, -4, 0, 4 ]
				},
				count: 3,
				uniforms: {
					tex: this.regl.prop('texture'),
					showGrid: (_, props) => (typeof props.showGrid)=='undefined' ? false : props.showGrid,
					showOpacity: (_, props) => (typeof props.showOpacity)=='undefined' ? true : props.showOpacity,
					opacity: (context, props) => (typeof props.opacity)=='undefined' ? 1.0 : props.opacity,
				},
				depth: {
					enable: false
				},
				stencil: {
					enable: false,
				},
			})

			this.calcAO = this.regl({
				vert: compositeStrokeVert,
				frag: ssaoFrag,
				attributes: {
					position: [ -4, -4, 4, -4, 0, 4 ]
				},
				count: 3,
				depth: { enable: false 	},
				stencil: { enable: false, },
				uniforms: {
					radius: 32>>1,
					aoClamp: 0.25,
					size: [512, 512],
					tDepth: this.regl.this('meshDepthTexLess'),
					cameraNear: () => this.zNear,
					cameraFar: () => this.zFar,
					logDepthBufFC: () => (2.0 / Math.log2(this.zFar + 1.0)),
					model: mat4.identity([]),
					view: ({tick}) => {
							return this.camera.computedMatrix
						},
					projection: ({viewportWidth, viewportHeight}) =>
									mat4
									.perspective([],
										this.viewerFov,
										this.canvasScreenAspect,
										this.zNear, this.zFar)
				}
			})

			this.dilateTexture = this.regl({
				vert: compositeStrokeVert,
				frag: dilateFrag,
				attributes: {
					position: [ -4, -4, 4, -4, 0, 4 ]
				},
				count: 3,
				uniforms: {
					tex: this.regl.prop('texture'),
					step: ({framebufferWidth, framebufferHeight}) => [1.0/framebufferWidth, 1.0/framebufferHeight],
					geoMaskTex: (context, props) => props.geoMaskTex ? props.geoMaskTex : props.texture,
					useGeoMask: (context, props) => !!props.geoMaskTex,
				},
				depth: { enable: false 	},
				stencil: { enable: false, },
			})

			this.drawUnwrapedUV = this.regl({
				vert: unwrapUVVert,
				frag: `
					void main() {
						gl_FragColor = vec4(1.0);
					}
				`,
				attributes: {
					// position: [ -4, -4, 4, -4, 0, 4 ],
					uv: this.regl.prop('uvsBuffer'),
				},
				elements: this.regl.prop('indeces'),
				uniforms: {
					color: (context, props) => props.color ? props.color : [1, 1, 1, 1],
				},
				depth: { enable: false 	},
				stencil: { enable: false, },
			})

			this.compositeStroke = this.regl({
				vert: compositeStrokeVert,
				frag: pbrFrag, //compositeStrokeFrag,
				attributes: {
					position: [ -4, -4, 4, -4, 0, 4 ] 
				},
				count: 3,
				uniforms: {
					activeBufferTex: this.regl.this('activeBufferTex'),
					// extraBufferTex: () => this.viewerExtraTex,
					extraBufferTex: this.regl.this('viewerExtraTex'),
					overlayBufferTex: this.regl.this('viewerOverlayTex'),
					channelType: () => this.getActiveChannelIndex(),
					extraChannelType: this.regl.this('extraChannelType'),
					colorTex: () => this.viewerBaseColorTex,
					geoWorldPosTex: () => this.viewerWorldPos,
					geoNormalTex: () => this.viewerGeomNTex,
					geoTangentTex: () => this.viewerGeomTTex,
					normalTex: () => this.viewerNormalTex,
					metallicTex: () => this.viewerMetallicTex,
					roughnessTex: () => this.viewerRoughnessTex,
					emissiveTex: () => this.viewerEmissiveColorTex,
					// depthTex: this.regl.this('meshDepthTexLess'),
					aoTex: () => (this.aoTex),
					aoScale: this.regl.this('aoOpacity'),

					pixelStep: ({framebufferWidth, framebufferHeight}) => [1.0/framebufferWidth, 1.0/framebufferHeight],

					u_DiffuseEnvSampler: () => this.diffuseEnvCubeTex,
					u_SpecularEnvSampler: () => this.specularEnvCubeTex,
					u_brdfLUT: () => this.brdfLUTTex,

					u_Camera: ()=>{this.flushCamera(); var c = this.camera ? this.camera.computedEye : [0,0,0]; /* log(c); */ return c; },
					// u_Camera: ()=> [0,0,0] ,
					// u_LightDirection: () => [0.0, 1.0, 0.0],
					u_LightDirection: () => this.lightDirection,
					u_LightColor: () => [1.0, 1.0, 1.0],

					u_BaseColorFactor: [1.0, 1.0, 1.0, 1.0],
					u_MetallicRoughnessValues: [1.0, 1.0],

					u_ScaleDiffBaseMR: ()=>[0, 1.0 - this.iblAmbientOpacity[1], 0, 0,],//[1.0,1.0,1.0,1.0],
					u_ScaleFGDSpec: [0, 0, 0, 0,],//[1.0,1.0,1.0,1.0],
					u_ScaleIBLAmbient: () => this.iblAmbientOpacity, //[1,1,1,1,],//[1.0,1.0,1.0,1.0],

				},
				depth: {
					enable: false
				},
				stencil: {
					enable: false,
				},
			})


			this.tools.orbit = new ToolOrbit(this);
			this.tools['color-picker'] = new ToolColorPicker(this);
			this.tools.brush = new ToolBrush(this);
			this.tools.eraser = new ToolEraser(this);
			this.tools.smear = new ToolSmear(this);
			this.tools.stamp = new ToolStamp(this);
			this.tools.roller = new ToolRoller(this);

			this.activeTool = this.tools.orbit;
			this.activeTool && this.activeTool.activate(this);

			this.startDrawUpdates()

			this.bindEvents();
			this.initiated = true;
		},

		calcStrokePresetThumbs(newValue)
		{
			if (!this.initiated)	return;
			newValue = newValue || this.strokePresets;
			log('calcStrokePresetThumbs')

			// store current brush presets
			var brush_stampOpacity = this.brushStampOpacity;
			var brush_size = this.brushSize;
			var brush_gap = this.brushGap;
			var brush_offset = this.brushOffset;
			var brush_align = this.brushAlign;
			var brush_rotation = this.brushRotation;
			var brush_hue = this.brushHue;
			var brush_saturation = this.brushSaturation;
			var brush_luminance = this.brushLuminance;
			var brush_pressure_flow = this.brushPressureFlow;
			var brush_pressure_opacity = this.brushPressureOpacity;
			var brush_pressure_size = this.brushPressureSize;
			var brush_pressure_gap = this.brushPressureGap;
			var brush_pressure_offset = this.brushPressureOffset;
			var brush_pressure_align = this.brushPressureAlign;
			var brush_pressure_rotation = this.brushPressureRotation;
			var brush_pressure_hue = this.brushPressureHue;
			var brush_pressure_saturation = this.brushPressureSaturation;
			var brush_pressure_luminance = this.brushPressureLuminance;

			var canvas = document.createElement('canvas');
			canvas.width = 320;
			canvas.height = 140;

			for (var i = this.strokePresetThumbs.length; i < newValue.length; i++)
			{
				let preset = newValue[i];
				this.setBrushStampOpacity( preset.stampOpacity );
				this.setBrushSize( preset.size );
				this.setBrushGap( preset.gap );
				this.setBrushOffset( preset.offset );
				this.setBrushAlign( preset.align );
				this.setBrushRotation( preset.rotation );
				this.setBrushHue( preset.hue );
				this.setBrushSaturation( preset.saturation );
				this.setBrushLuminance( preset.luminance );
				this.setBrushPressureFlow( preset.pressure.flow );
				this.setBrushPressureOpacity( preset.pressure.opacity );
				this.setBrushPressureSize( preset.pressure.size );
				this.setBrushPressureGap( preset.pressure.gap );
				this.setBrushPressureOffset( preset.pressure.offset );
				this.setBrushPressureAlign( preset.pressure.align );
				this.setBrushPressureRotation( preset.pressure.rotation );
				this.setBrushPressureHue( preset.pressure.hue );
				this.setBrushPressureSaturation( preset.pressure.saturation );
				this.setBrushPressureLuminance( preset.pressure.luminance );

				this.drawBrushStrokePreview(canvas);

				let dataUrl = canvas.toDataURL();
				this.strokePresetThumbs.push({
					name: preset.name,
					imgSrc: dataUrl,
					selected: false,
				})
			}

			canvas = null;

			// Restore state
			this.setBrushStampOpacity( brush_stampOpacity );
			this.setBrushSize( brush_size );
			this.setBrushGap( brush_gap );
			this.setBrushOffset( brush_offset );
			this.setBrushAlign( brush_align );
			this.setBrushRotation( brush_rotation );
			this.setBrushHue( brush_hue );
			this.setBrushSaturation( brush_saturation );
			this.setBrushLuminance( brush_luminance );
			this.setBrushPressureFlow( brush_pressure_flow ? 0 : null );
			this.setBrushPressureOpacity( brush_pressure_opacity ? 0 : null );
			this.setBrushPressureSize( brush_pressure_size ? 0 : null );
			this.setBrushPressureGap( brush_pressure_gap ? 0 : null );
			this.setBrushPressureOffset( brush_pressure_offset ? 0 : null );
			this.setBrushPressureAlign( brush_pressure_align ? 0 : null );
			this.setBrushPressureRotation( brush_pressure_rotation ? 0 : null );
			this.setBrushPressureHue( brush_pressure_hue ? 0 : null );
			this.setBrushPressureSaturation( brush_pressure_saturation ? 0 : null );
			this.setBrushPressureLuminance( brush_pressure_luminance ? 0 : null );
		},

		readBrushStampFile(file) 
		{
			log('readBrushStampFile ', file)

			const activateBrush = (dataTex, img) =>
			{
				this.activeBrushStampIdx = this.loadedBrushStamps.length;
				this.loadedBrushStamps.push({name: dataTex.label, img, dataTex, selected: false, date: new Date().getTime()});
			}

			var dataTex = new DataTexture();
			if (file.name.toLowerCase().indexOf('.jpg') > -1 || file.name.toLowerCase().indexOf('.jpeg') > -1 || file.name.toLowerCase().indexOf('.png') > -1)
			{
				var reader  = new FileReader();
				var img = new Image();

				img.onload = function(e)
				{
					var potSize = pow2ceil(Math.max(img.naturalWidth, img.naturalHeight) );
					dataTex.label = file.name;

					if (file.name.toLowerCase().indexOf('.png') > -1)
					{
						dataTex.readFromPNGFile(file)
							.then( () =>
							{
								log(`loaded texture "${file.name}"`);
								if (dataTex.width != dataTex.potSize || 
									dataTex.height != dataTex.potSize)
								{
									var potSize = this.getActiveChannelDimension();

									this.resizeDataTexture( {dataTex: dataTex, radius: potSize} );
									activateBrush(dataTex, img);
								}
							})
							.catch( (error)=>{
								log(`Error loading texture "${file.name}": ${error}`);
							} );
					}
					else
					{
						this.resizeDataTexture( {dataTex: dataTex, radius: potSize, image: img} );
						activateBrush(dataTex, img);
					}
					// resolve(dataTex);
				}

				img.onerror = function (e)
				{
					log(e.error);
				};

				reader.onerror = function (e) 
				{
					log(e.error);
				};

				reader.onload = function(e) 
				{
					// log(e.target.result);
					img.src = e.target.result;
				};
				reader.readAsDataURL(file);
			}

		},

		selectBrushStamp(e)
		{
			// logfunc();
			// log(e);
			var node = e.target.parentNode.parentNode;
			var idx = Array.from(node.parentNode.children).indexOf(node);
			// log('index: '+idx);
			this.activeBrushStampIdx = idx;
		},

		selectBrushStrokePreset(e)
		{
			// logfunc();
			// log(e);
			var node = e.target.parentNode.parentNode;
			var idx = Array.from(node.parentNode.children).indexOf(node);
			// log('index: '+idx);
			this.setActiveStrokePreset(idx);
		},


		drawBrushStrokePreview(canvas)
		{

			if (!this.initiated)
				return;

			// log('drawBrushStrokePreview')
			var ctx = canvas.getContext('2d');
			if (!ctx)
			{
				log('ERROR: canvas is not supported by this browser');
				return;
			}
			
			
			this.tempTex({
				width: canvas.width,
				height: canvas.height,
				format: 'rgba',
				type: 'uint8'
			});

			var fbo = this.regl.framebuffer({
				width: canvas.width,
				height: canvas.height,
				color: this.tempTex,
				depth: false,
				stencil: false,
			})

			// setPickedColor
			var tool = this.tools.brush;

			if (!tool.brushTexture)
				tool.brushTexture = this.brushTexture;

			var prev = {
				brushColor: this.brushColor,
				lastMousePos: Object.assign({}, this.lastMousePos),
				currentMousePos: Object.assign({}, this.currentMousePos),
				scaleMult: tool.scaleMult
			};
			

			tool.scaleMult = 0.2;
			tool.strokeGapOverflow = 0;
			this.setPickedColor({r:255, g:255, b:255, a: 1.0})
			this._uvMapScale = [1, 1];

			// brushStrokePreviewCurve


			var spanWidth = 280;
			var spanHeight = 100;
			var xStart = (canvas.width - spanWidth) >> 1;

			fbo.use(() => {
				this.regl.clear({
								// depth: 0,
								color: [1, 1, 1, 0]
								// color: [0, 1, 1, 0.5]
							})
			})
			

			// var tick = this.regl.frame( (ctx) => {
				// log(this.brushStrokePreviewCurve)
				// this.tempFbo.use(() => {
				fbo.use(() => {
				
					tool.aspect = [1, 1];
					for (var i = 1; i < this.brushStrokePreviewCurve.y.length; i++)
					{
						this.lastMousePos.x = xStart + (i - 1)*1;
						this.lastMousePos.y = 70 + this.brushStrokePreviewCurve.y[i - 1];
						this.lastMousePos.force = this.brushStrokePreviewCurve.force[i - 1];

						this.currentMousePos.x = xStart + i*1;
						this.currentMousePos.y = 70 + this.brushStrokePreviewCurve.y[i];
						this.currentMousePos.force = this.brushStrokePreviewCurve.force[i];

						tool.calcBrushBuffers(this, 1, 1, Math.abs(this.lastMousePos.y - this.currentMousePos.y))
						tool.draw()
					} // for end

				});
				
				var dataTex = new DataTexture();
				dataTex.readFromFBO(this.regl, this.tempFbo);
				// fbo.destroy();
				// tex.destroy();

				dataTex.drawToCanvas2D(ctx);

				// Restore prev values
				tool.scaleMult = prev.scaleMult;
				this.setPickedColor({r:prev.brushColor[0]*255, 
									g:prev.brushColor[1]*255, 
									b:prev.brushColor[2]*255, 
									a: prev.brushColor[3]})
				// this.canvasWidthMult = prev.canvasWidthMult;
				// this.canvasHeightMult = prev.canvasHeightMult;
				// this.uvMapWidthMult = undefined;
				// this.uvMapWidthMult = undefined;
				this._uvMapScale = [undefined, undefined];

				this.lastMousePos = prev.lastMousePos;
				this.currentMousePos = prev.currentMousePos;
				//=====================

			// 	tick.cancel();
			// } );

			fbo.destroy();

		},

		getCurrentTexClearColor() 
		{
			var clearClr = [0, 0, 0, 0];
			switch (this.getActiveChannelIndex()) 
			{
				case 1: // Metallic
					clearClr = [0, 0, 0, 0]; 
					break;
				case 2: // Roughness
					clearClr = [1, 1, 1, 0]; 
					break;
				case 3: // Normal
					clearClr = [0, 0, 0, 0]; 
					break;
				case 4: // Emissive
					clearClr = [0, 0, 0, 0]; 
					break;

				default:
				case 5: // AO
				case 0: // Color
					// // clearClr *MUST* be black, otherwise the dilate color will be wrong
					clearClr = [0, 0, 0, 0]; 
					break; // Color
			}
			return clearClr;
		},

		startDrawUpdates()
		{
			if (!this.tick)
				this.tick = this.regl.frame( (ctx) => { this.drawCanvas(); })
		},

		stopDrawUpdates()
		{
			if (this.tick)
			{
				this.tick.cancel();
				this.tick = null;
			}
		},

		toggleDrawUVMap(evt)
		{
			// if (this.tick)	return;
			
			if (this.drawMeshToBuffers)
			{
				if (!this.showingUVMap)
				{
					// log('drawUVMap')
					this.tick.cancel();
					// TODO: remove "meshTexture"
					switch (evt.srcKey) {
						case 'uv':
							this.drawTexture({texture: this.sceneGeomArray[this.activeGeomIdx][this.getActiveChannelTextureName()], showGrid: false, showOpacity: false});
							break;
						case 'n':
							this.drawTexture({texture: this.viewerGeomNTex, showGrid: false, showOpacity: false});
							break;
						case 't':
							this.drawTexture({texture: this.viewerGeomTTex, showGrid: false, showOpacity: false});
							break;
						case 'c':
							this.drawTexture({texture: this.viewerBaseColorTex, showGrid: false, showOpacity: false});
							break;
						default:
							break;
					}
					this.showingUVMap = true;
				}
				else
				{
					this.showingUVMap = false;
					this.refreshMesh = true;
					this.tick = this.regl.frame( (ctx) => { this.drawCanvas(); })
				}
			}
		},

		flushCamera()
		{
			if (!this.camera)	return null;
			
			const now = (new Date).getTime();
			this.camera.flush( now );
			this.camera.recalcMatrix( now );

			return this.camera.computedMatrix;
		},

		drawCanvas()
		{
			// if (this.tick)	return;

			this.flushCamera();

			this.extraChannelType = (this.activeToolName == 'eraser') ? 1 : 0;

			// log('drawCanvas')
			if (this.drawMeshToBuffers && this.refreshMesh)
			{
				// log('drawCanvas: drawMeshToBuffers')

				this.meshWorldPosFbo.use( ()=> {
					this.regl.clear({depth: 1, color: [1, 1, 1, 1]/* [0,0,0,0] */});
					this.drawMeshWorldPos(this.sceneGeomArray)
				} )


				if (this.activeToolName != 'color-picker' && this.activeToolName != 'orbit')
				{
					const indices = this.activeGeom.length > 0 ? this.activeGeom.slice() : (Array(this.sceneGeomArray.length)).fill(0).map( (_,i) => i );

					this.overlayDestFbo.use( () => this.regl.clear({ depth: 1, 
																	// color: [0, 0, 0, 0] 
																	color: this.getActiveChannelClearColor()
																}) );

					indices.forEach((geomIdx) => 
					{
						var geo = this.sceneGeomArray[geomIdx];
						var channel = this.activeChannel;
						var texture = channel + 'Tex';
						var clearClr = this.channelListClear[ this.channelList.indexOf(channel) ];

						if (channel=='normal')
						{
							log(`${channel} type: ${geo[texture].type}`);
							if (geo[texture].type.indexOf('int') > -1)
								debugger;
						}

						this.tempTex({
									width: geo[texture].width,
									height: geo[texture].height,
									format: geo[texture].format,
									type: geo[texture].type
								})

						this.tempTex2({
									width: geo[texture].width,
									height: geo[texture].height,
									format: geo[texture].format,
									type: geo[texture].type
								})

						this.separateLayersToTextures(geomIdx, channel, 
												geo[texture], 
												this.activeToolName=='eraser' ? this.tempTex : null , 
												this.tempTex2);
						this.overlayDestFbo.use( ()=>{
							this.regl.clear({color: this.getActiveChannelClearColor()});
							this.drawLayersToBuffers({
								verticesBuffer: geo.verticesBuffer,
								normalsBuffer: geo.normalsBuffer,
								uvsBuffer: geo.uvsBuffer,
								indeces: geo.indeces,
								layer0: this.tempTex,
								layer1: this.tempTex2,
								layer2: this.tempTex2,
								layer3: this.tempTex2,
								layer4: this.tempTex2,
								layer5: this.tempTex2,
								layerCount: 2,
								opacity: [1, 1, 1, 1, 1, 1, 1, 1, 1]
							})
						} )

					});

					this.tempTex({
								width: 2,
								height: 2,
								// format: 'rgba',
								// type: 'uint8'
							})

					this.tempTex2({
								width: 2,
								height: 2,
								// format: 'rgba',
								// type: 'uint8'
							})

				}


				this.meshDestFbo.use(() => {
					this.regl.clear({
									depth: 1,
									color: [0, 0, 0, 0]
								})
					this.drawMeshToBuffers(this.sceneGeomArray)
				});
				if (this.currentChannelSolo==false)
					this.aoFbo.use( ()=> {
						this.regl.clear({depth:1, color: [1,1,1,1]})
						this.calcAO()
					} )

			}
			this.refreshMesh = false;
			if (this.meshLoaded && this.camera)
			{
				if (this.currentChannelSolo)
				{
					var opt = {texture: null, showOpacity: false};
					switch(this.activeChannel)
					{
						default:
						case 'color': opt.texture = this.viewerBaseColorTex; break;
						case 'metallic': opt.texture = this.viewerMetallicTex; break;
						case 'roughness': opt.texture = this.viewerRoughnessTex; break;
						// case 'normal': opt.texture = this.viewerGeomNTex; break;
						case 'normal': opt.texture = this.viewerNormalTex; break;
						case 'emissive': opt.texture = this.viewerEmissiveColorTex; break;
					}
					this.drawTexture(opt)
				}
				else
					this.compositeStroke();
			}
		},


		resizeDataTexture(options)
		{
			var radius = options.radius;
			var dataTex = options.dataTex;
			var img = options.image || null;
			var flipY = options.flipY || false;

			if (img)
				this.tempTex2({
					width: dataTex.width,
					height: dataTex.height,
					data: img,
					flipY: true
					})
			else
				this.tempTex2({
						width: dataTex.width,
						height: dataTex.height,
						format: dataTex.format,
						type: dataTex.type,
						data: dataTex.data,
						flipY: flipY
					})

			this.tempTex({
					width: radius,
					height: radius,
					format: dataTex.format,
					type: dataTex.type
				})
			this.tempFbo({
				width: radius,
				height: radius,
				color: this.tempTex,
				depth: false, stencil: false,
			})

			// dataTex.writeToTexture(this.tempTex2);
			this.tempFbo.use(()=>{
				this.drawTexture({texture: this.tempTex2, showGrid: false})
			});
			dataTex.readFromFBO(this.regl, this.tempFbo);

			this.tempTex2({
					width: 2,
					height: 2,
					// format: dataTex.format,
					type: 'uint8'
				})

		},

		onChangeActiveChannel(newChannel)
		{
			log('onChangeActiveChannel ', newChannel)

			// this.resizePaintSurf(this.getActiveChannelDimension())
		},

		bakePaint(index)
		{
			this.tools.orbit.bakePaint(this);
		},

		redrawTextureLayers(layerIdx)
		{
			log(`redrawTextureLayers(${layerIdx})`)
			// logfunc()

			// Refresh layers in case the order has changed
			const indeces = this.activeGeom.length > 0 ? this.activeGeom.slice() : (Array(this.sceneGeomArray.length)).fill(0).map( (_,i) => i );

			indeces.forEach( (idx) =>
			{
				var geo = this.sceneGeomArray[idx];
				
				var texture = this.getActiveChannelTextureName();
				this.combineLayersToTexture(idx, this.activeChannel, geo[texture]);//, tempFbo)
			})
			this.refreshMesh = true;

		},

		onSelectedLayer(index)
		{
			var list = this.activeChannelLayers;
			var layer = list[index];
			// log('onSelectedLayer ', index, ' ', layer.label)
			var dataTex = this.getLayerData(layer.textureIdx);
			// log(dataTex)


			// TODO: calc layers below and overlay above the current layer


			// TODO: Refresh layers in case the order has changed
			this.redrawTextureLayers(index);

		},

		mergeLayers(geomIdx, channel, all)
		{
			// logfunc()
			log('mergeLayers');
			geomIdx = (typeof geomIdx == 'undefined') ? this.activeGeomIdx : geomIdx;
			var geo = this.sceneGeomArray[geomIdx];
			if (typeof channel == 'number')
				channel = this.channelList[channel];
			channel = (typeof channel == 'undefined') ? this.activeChannel : channel;

			var selector = all ? ()=>true : (l => l.selected);

			var layerList = this.getGeomChannelLayersWithFilter(geomIdx, channel, selector);
			if (!layerList.length)
			{
				log('error: no layers found');
				return;
			}

			var layer = layerList[layerList.length-1];
			var dataTex = this.getLayerData(layer.textureIdx);
			var opt = {
				width: dataTex.width,
				height: dataTex.height,
				format: dataTex.format,
				type: dataTex.type,
			};
			var fbo = this.regl.framebuffer({
								depthStencil: false,
								...opt
							});

			var texList = Array(6).fill(0).map( (_, i) => this.regl.texture() );
			var opacity = new Array(9).fill(1.0);
			layerList.forEach((l, i)=>{
				opacity[layerList.length - (i+1)] = l.opacity*0.01; 
				var dataTex = this.getLayerData(l.textureIdx);
				var tex = texList[layerList.length - (i+1)];
				dataTex.writeToTexture(tex);
			});
			while (texList.length < 6)	texList.push(texList[0]);

			fbo.use( ()=>
			{
				this.mergeTextures({
										layer0: texList[0], 
										layer1: texList[1], 
										layer2: texList[2], 
										layer3: texList[3], 
										layer4: texList[4], 
										layer5: texList[5], 
										layerCount: layerList.length,
										opacity, 
									});
				texList.forEach( (tx) => { if (!tx.destroyed) { tx.destroy(); tx.destroyed = true; } });

			})
			layer = layerList[layerList.length-1];
			dataTex = this.getLayerData(layer.textureIdx);
			dataTex.readFromFBO(this.regl, fbo);
			fbo.destroy();

			this.refreshMesh = true;
		},

		combineLayersToTexture(geomIdx, channel, texture, fbo)
		{
			log(`combineLayersToTexture(${geomIdx}, ${channel}, ${texture.type})`)
			// logfunc()
			var geo = this.sceneGeomArray[geomIdx];
			if (typeof channel == 'number')
				channel = this.channelList[channel];
			channel = (typeof channel == 'undefined') ? this.activeChannel : channel;
			var destroyFbo = !fbo;
			fbo = (typeof fbo == 'undefined') ? this.regl.framebuffer() : fbo;

			var layers = this.getGeomChannelLayersWithFilter(geomIdx, channel, l => l.visible);
			var opacity = new Array(9).fill(1.0);
			var layerNames = new Array(layers.length).fill('');
			layers.forEach( (l, i) => { opacity[i] = l.opacity * 0.01; layerNames[layers.length - (i+1)] = l.label; } )
			layers = layers.map( (l, i) => { 
						opacity[layers.length - (i+1)] = l.opacity*0.01; 
						return this.getLayerData(l.textureIdx); 
					} );

			// log('order: ', JSON.stringify(layerNames))
			// log('opacity: ', JSON.stringify(opacity))

			var tex = Array(6).fill(0).map( (_, i) => this.regl.texture() );
			layers.forEach( (l, i) => {
				l.writeToTexture(tex[layers.length - (i+1)]);
			} );


			if (destroyFbo)
			{
				fbo({
					width: texture.width,
					height: texture.height,
					colorFormat: texture.format,
					colorType: texture.type,
					depthTexture: false
				})
			}

			var geoMaskTex = this.regl.texture({
										width: texture.width,
										height: texture.height,
										format: 'rgba',
										type: 'uint8'
									});
			{
				let tempFbo = this.regl.framebuffer({
									width: texture.width,
									height: texture.height,
									color: geoMaskTex,
									depthTexture: false
								})

				tempFbo.use( ()=>{
					// this.regl.clear({ color: [0, 0, 0, 0] })
					this.regl.clear({ color: this.getActiveChannelClearColor() })
					this.drawUnwrapedUV(geo)
				} )

				tempFbo.destroy();
			}

			fbo.use( ()=>
			{

				for (let i = 0; i < layers.length; i++)
				{
					this.regl.clear({ depth: 1, color: this.getActiveChannelClearColor() })
					this.dilateTexture({ texture: tex[i], geoMaskTex: geoMaskTex})
					tex[i]({copy: true, mag: 'linear', min:'linear', format:tex[i].format, type:tex[i].type})

					this.regl.clear({ depth: 1, color: this.getActiveChannelClearColor() })
					this.dilateTexture({ texture: tex[i], geoMaskTex: geoMaskTex})
					tex[i]({copy: true, mag: 'linear', min:'linear', format:tex[i].format, type:tex[i].type})
				}

				this.regl.clear({ depth: 1, color: this.getActiveChannelClearColor() })
				// this.regl.clear({ depth: 1, color: clearClr })
				if (layers.length > 1)
					this.mergeTextures({
											layer0: tex[0], 
											layer1: tex[1], 
											layer2: tex[2], 
											layer3: tex[3], 
											layer4: tex[4], 
											layer5: tex[5], 
											layerCount: layers.length,
											opacity, 
										});
				else
					this.drawTexture({texture: tex[0], showGrid: false})
				tex.forEach( (tx) => tx.destroy() );
				
				texture({copy: true, mag: 'linear', min:'linear', format:texture.format, type:texture.type})
				// texture({copy: true, mipmap: 'nice', mag: 'linear', min:'mipmap'})	
			})
			
			if (destroyFbo)	fbo.destroy();
			geoMaskTex.destroy();
			
			this.refreshMesh = true;
			
		},

		separateLayersToTextures(geomIdx, channel, belowTex, activeTex, aboveTex, fbo)
		{
			// *here* is the place where the alpha get added multiple times.

			// log(`ignoring... separateLayersToTextures(${geomIdx}, ${channel})`)
			// return;

			log(`separateLayersToTextures(${geomIdx}, ${channel})`)
			// logfunc()
			var geo = this.sceneGeomArray[geomIdx];
			if (typeof channel == 'number')
				channel = this.channelList[channel];
			channel = (typeof channel == 'undefined') ? this.activeChannel : channel;
			var destroyFbo = !fbo;
			fbo = (typeof fbo == 'undefined') ? this.regl.framebuffer() : fbo;

			var layers = this.getGeomChannelLayersWithFilter(geomIdx, channel);
			var below = [];
			var active = [];
			var above = [];
			var level = 1;
			layers.forEach( (l, i) => { 
				if (level==1)
				{
					if (l.selected)
						level--;

					if (l.visible)
					{
						if (l.selected==false)
							above.push(l);
						else
							active.push(l);
					}
				}
				else
				{
					if (l.visible)
						below.push(l);
				}
			});
			above.reverse();
			below.reverse();
			if (!activeTex && active.length)
			{
				if (active[0])
					below.push(active[0])
				active = [];
			}
			var tex = Array(6).fill(0).map( (_, i) => this.regl.texture() );
			var geoMaskTex = this.regl.texture({
											width: belowTex.width,
											height: belowTex.height,
											format: 'rgba',
											type: 'uint8'
										});

			if (destroyFbo)
			{
				fbo({
					width: belowTex.width,
					height: belowTex.height,
					// color: geoMaskTex,
					colorFormat: 'rgba',
					colorType: 'uint8',
					depthTexture: false
				})

				fbo.use( ()=>{
					// this.regl.clear({ color: this.getActiveChannelClearColor() })
					this.regl.clear({ color: [0,0,0,0] })
					this.drawUnwrapedUV(geo)
					geoMaskTex({copy: true, width: belowTex.width, height: belowTex.height, format: 'rgba', type: 'uint8'});
				} )
			}
			else
			{
				fbo.use( ()=>{
					// this.regl.clear({ color: this.getActiveChannelClearColor() });
					this.regl.clear({ color: [0,0,0,0] })
					this.drawUnwrapedUV(geo);
					geoMaskTex({copy: true, width: belowTex.width, height: belowTex.height, format: 'rgba', type: 'uint8'});
				} )
			}


			const mergeTex = (list, outputTex) =>
			{
				if (list.length < 1) return;

				var opacity = new Array(9).fill(1.0);
				list = list.map( (l, i) => { 
							opacity[i] = l.opacity*0.01; 
							return this.getLayerData(l.textureIdx); 
						} );

				list.forEach( (l, i) => {
					l.writeToTexture(tex[i]);
				} );

				if (destroyFbo)
				{
					fbo({
						width: outputTex.width,
						height: outputTex.height,
						colorFormat: outputTex.format,
						colorType: outputTex.type=='float32' ? 'float' : outputTex.type,
						depthTexture: false
					})
				}

				fbo.use( ()=>
				{
					for (let i = 0; i < list.length; i++)
					{
						this.regl.clear({ depth: 1, color: this.getActiveChannelClearColor() })
						this.dilateTexture({ texture: tex[i], geoMaskTex: geoMaskTex})
						tex[i]({copy: true, mag: 'linear', min:'linear', format:tex[i].format, type:tex[i].type})

						this.regl.clear({ depth: 1, color: this.getActiveChannelClearColor() })
						this.dilateTexture({ texture: tex[i], geoMaskTex: geoMaskTex})
						tex[i]({copy: true, mag: 'linear', min:'linear', format:tex[i].format, type:tex[i].type})
					}

					this.regl.clear({ depth: 1, color: this.getActiveChannelClearColor() })
					if (list.length > 1)
						this.mergeTextures({
												layer0: tex[0], 
												layer1: tex[1], 
												layer2: tex[2], 
												layer3: tex[3], 
												layer4: tex[4], 
												layer5: tex[5], 
												layerCount: list.length,
												// opacity0: opacity.slice(0, 3), 
												// opacity1: opacity.slice(3, 6), 
												opacity, 
											});
					else
						this.drawTexture({texture: tex[0], showGrid: false, opacity: opacity[0]})
					
					outputTex({copy: true, mag: 'linear', min:'linear', format:outputTex.format, type:outputTex.type})
					// outputTex({copy: true, mipmap: 'nice', mag: 'linear', min:'mipmap'})	
				})


			};	//	function mergeTex()


			if (below.length > 0 && belowTex)
			{
				log('below.length: ', below.length)
				mergeTex(below, belowTex)

			}

			if (active.length > 0 && activeTex)
			{
				log('active.length: ', active.length)
				mergeTex(active, activeTex)
			}

			if (above.length > 0 && aboveTex)
			{
				log('above.length: ', above.length)
				mergeTex(above, aboveTex)
			}


			if (destroyFbo)	fbo.destroy();
			geoMaskTex.destroy();
			tex.forEach( (tx) => tx.destroy() );
			
			// this.refreshMesh = true;
		},

		resizeTextures(payload)
		{
			log('resizeTextures ',payload)
			// logfunc()
			if (!this.initiated)
			{
				log('resizeTextures: not initiated')
				return;
			}

			const newDIM = payload.value;

			log('changing '+this.getActiveChannelTextureName()+' resolution to '+newDIM);

			var surfTex = this.regl.texture();
			var fbo = this.regl.framebuffer();

			// dilate (twice) the texture to prevent those black gaps at the seams on lower resolutions
			this.sceneGeomArray.forEach((geo) => 
			{
				// texList.forEach((tex)=> {
					// let tex = texMap[this.activeChannel];
					let tex = this.getActiveChannelTextureName();
					surfTex({
						width: this.getActiveChannelDimension(),
						height: this.getActiveChannelDimension(),
						format: geo[tex].format,
						type: geo[tex].type,
					});
					fbo({
						width: this.getActiveChannelDimension(),
						height: this.getActiveChannelDimension(),
						color: surfTex,
						depthStencil: false
					})
					fbo.use( ()=>
					{
						var isFloat = geo[tex].format.indexOf('float') > -1;
						for (var i = 0; i < 2; i++)
						{
							this.regl.clear({ color: this.getActiveChannelClearColor() })
							this.dilateTexture({ texture: geo[tex]})//, geoMaskTex: geo[tex], useGeoMask: false })
							geo[tex]({copy: true, mipmap: isFloat ? undefined : 'nice', mag: 'linear', min: isFloat ? 'linear' : 'mipmap', format:geo[tex].format, type:geo[tex].type})
						}
					} )
				// })
			})

			this.sceneGeomArray.forEach((geo) => 
			{
				// texList.forEach((tex)=> {
					// let tex = texMap[this.activeChannel];
					let tex = this.getActiveChannelTextureName();
					surfTex({
						width: newDIM,
						height: newDIM,
						format: geo[tex].format,
						type: geo[tex].type,
					});
					fbo({
						width: newDIM,
						height: newDIM,
						color: surfTex,
						depthStencil: false
					})
					fbo.use( ()=>
					{
						var isFloat = geo[tex].format.indexOf('float') > -1;
						this.regl.clear({depth:1, color: [1,1,1,1]})
						this.drawTexture({ texture: geo[tex], showGrid: false })
						geo[tex]( {
								width: newDIM,
								height: newDIM,
								mipmap: isFloat ? undefined : 'nice',
								mag: 'linear',
								min: isFloat ? 'linear' : 'mipmap',
								// min: 'linear',
								// wrap: 'clamp'
								wrap: 'mirror'
							});
						geo[tex]({copy: true, mipmap: isFloat ? undefined : 'nice', mag: 'linear', min: isFloat ? 'linear' :'mipmap', format:geo[tex].format, type:geo[tex].type})
					})
				// })
			})

			// this.$nextTick( ()=>{
				// this.refreshMesh = true;
				// this.drawCanvas();

				this.refreshMesh = true;
				this.drawCanvas()

			// } )
			

			fbo.destroy();
			surfTex.destroy();

		},

		resizeCanvasFBO(width, height)
		{
			if (!this.initiated)
				return;

			this.$refs.canvas.width = width;
			this.$refs.canvas.height = height;
			this.VIEWER_WIDTH = width;
			this.VIEWER_HEIGHT = height;
			this.VIEWER_WIDTH_POT = pow2ceil( width );
			this.VIEWER_HEIGHT_POT = pow2ceil( height );

			this.paintSurfTextures = this.paintSurfTextures.map((tex, i) => 
							tex({
								width: this.VIEWER_WIDTH_POT,
								height: this.VIEWER_HEIGHT_POT,
								mag: 'linear', 
								min:'linear',
								type: i==0 ? 'float' : 'uint8',
								wrap: 'clamp'
							})
			);

			this.paintSurfFbos = this.paintSurfTextures.map((item, i) => 
			{
				this.paintSurfFbos[i]({
					width: this.VIEWER_WIDTH_POT,
					height: this.VIEWER_HEIGHT_POT,
					color: item,
					// depthStencil: false
				})
				
				// checkFbo()
				return this.paintSurfFbos[i];
			});

		},

		onViewerResize()
		{
			if (!this.initiated)
				return;

			// Resize using the given REGL .resize method gives errors.

			const checkFbo = ()=>
			{
				var fboError = this.regl._gl.checkFramebufferStatus(this.regl._gl.FRAMEBUFFER);
				if (fboError != this.regl._gl.FRAMEBUFFER_COMPLETE)
					console.error('framebuffer error: ', fboError)
			};

			this.paintSurfTextures = this.paintSurfTextures.map((tex, i) => 
										tex({
											width: this.VIEWER_WIDTH_POT,
											height: this.VIEWER_HEIGHT_POT,
											mag: 'linear', 
											min:'linear',
											type: i==0 ? 'float' : 'uint8',
											wrap: 'clamp'
										})
			);
			this.activeBufferTex = this.paintSurfTextures[0];//(this.paintState)];

			this.paintSurfFbos = this.paintSurfTextures.map((item, i) => 
			{
				this.paintSurfFbos[i]({
					width: this.VIEWER_WIDTH_POT,
					height: this.VIEWER_HEIGHT_POT,
					color: item,
					// depthStencil: false
				})
				
				checkFbo()
				return this.paintSurfFbos[i];
			});

			this.viewerBaseColorTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerOverlayTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerExtraTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerGeomNTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerGeomTTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerNormalTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'linear',
				type: 'float'
			})

			this.viewerMetallicTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerRoughnessTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerEmissiveColorTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.viewerWorldPos({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				type: 'float'
			})

			this.meshWorldPosFbo({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: [
					this.viewerWorldPos,
					this.viewerGeomNTex,
					this.viewerGeomTTex,
					this.viewerNormalTex,
				],
				depth: true,
				stencil: false,
			})
			checkFbo()

			this.aoTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				mag: 'linear',
				min: 'mipmap',
				type: 'uint8'
			})

			this.aoFbo
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: this.aoTex,
				depthStencil: false,
			})
			checkFbo()

			this.meshUVTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				type: 'float'
			})

			this.meshTempFbo
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: this.meshUVTex,
			})
			checkFbo()

			this.tempTex
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'rgba',
				type: 'uint8'
			})

			this.tempFbo
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: this.tempTex,
				depth: false,
				stencil: false,
			})
			checkFbo()

			this.meshDepthTexLess
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'depth',
				type: 'uint32'
			})

			this.meshDepthTexGreater
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'depth',
				type: 'uint32'
			})

			this.meshDepthTexMidpoint
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				format: 'depth',
				type: 'uint32'
			})

			this.meshDestFbo
			({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: [
					this.viewerBaseColorTex,
					// this.viewerGeomNTex,
					// this.viewerGeomTTex,
					// this.viewerNormalTex,
					this.viewerMetallicTex,
					this.viewerRoughnessTex,
					this.viewerEmissiveColorTex,
				],
				depth: this.meshDepthTexLess,
				depthTexture: true,
				stencil: false
			})
			checkFbo()

			this.overlayDestFbo({
				width: this.VIEWER_WIDTH_POT,
				height: this.VIEWER_HEIGHT_POT,
				color: [
					this.paintSurfTextures[0],
					this.viewerOverlayTex,
				],
				depth: this.meshDepthTexLess,
				depthTexture: true,
				stencil: false,
			})
			checkFbo()

			this.updateMesh = true;
			this.drawCanvas()
		},

		strokeMove(e)
		{
			this.activeTool && this.activeTool.strokeMove(this, e);
		},
		strokeBegin() 
		{
			this.showPressureCircle = true;
			this.isStrokeActive = true;
			this.activeTool && this.activeTool.strokeBegin(this);
		},
		strokeEnd() 
		{
			this.activeTool && this.activeTool.strokeEnd(this);
			this.isStrokeActive = false;
			this.showPressureCircle = false;
		},
		bindEvents() 
		{
			_vm_.$on('dropped', this.readFile);
			_vm_.$on('droppedBrushStamp', this.readBrushStampFile);
			_vm_.$on('open-url-file', this.readUrlFile);
			_vm_.$on('resizeTextures', this.resizeTextures);
			_vm_.$on('changeActiveChannel', this.onChangeActiveChannel);
			_vm_.$on('resizeDataTex', this.resizeDataTexture);

			_vm_.$on('reordered-texture-layer', (idx)=> 
			{
				this.tools.orbit.bakePaint(this);
				this.redrawTextureLayers(idx);
			})
			_vm_.$on('will-select-texture-layer', this.bakePaint)
			_vm_.$on('selected-texture-layer', this.onSelectedLayer)
			_vm_.$on('merge-selected-texture-layers', this.mergeLayers)
			_vm_.$on('show-brush-image-dialog', _ => {this.showBrushDialog = true});
			_vm_.$on('show-brush-stroke-preset-dialog', _ => {this.showStrokePresetsDialog = true});
			_vm_.$on('update-brush-stroke-preview', this.drawBrushStrokePreview);

			this.lastMousePos = {
						clientX: 0,
						clientY: 0,
						x: 0,
						y: 0,
						force: 0
					}
			this.currentMousePos = {
						clientX: 0,
						clientY: 0,
						x: 0,
						y: 0,
						force: 0
					}

			const strokeStart = (e) =>
			{
				// log('strokeStart')
				const box = this.$refs.canvas.getBoundingClientRect();
				this.lastMousePos = {
					clientX: (e.clientX || e.touches[0].clientX),
					clientY: (e.clientY || e.touches[0].clientY) - box.y,
					x: (e.clientX || e.touches[0].clientX) - box.x,
					y: this.VIEWER_HEIGHT - ((e.clientY || e.touches[0].clientY) - box.y),
					force: 0
					}
				this.lastMousePos.x *= this.canvasWidthMult;
				this.lastMousePos.y *= this.canvasHeightMult;

				this.strokeBegin()

				e && e.preventDefault();
				e && e.stopPropagation();
			};

			const strokeEnd = (e) =>
			{
				// log('strokeEnd')

				this.flushCamera();
				
				if (e && (e.type=="mouseout" || e.type=="mouseleave"))
					e.buttons && this.strokeEnd();
				else
					this.strokeEnd();

				e && e.preventDefault();
				e && e.stopPropagation();
			};

			const strokeMove = (e, force, isFake) =>
			{
				e && e.preventDefault();
				e && e.stopPropagation();
				// log('handler strokeMove')
				const box = this.$refs.canvas.getBoundingClientRect();

				var pos = {
					clientX: (e.clientX || (e.touches ? e.touches[0].clientX : e.clientX)),
					clientY: (e.clientY || (e.touches ? e.touches[0].clientY: e.clientY)) - box.y,
					x: (e.clientX || (e.touches ? e.touches[0].clientX : e.clientX)) - box.x,
					y: this.VIEWER_HEIGHT - ((e.clientY || (e.touches ? e.touches[0].clientY : e.clientY) ) - box.y),
					force: force || 1.0
				};
				pos.x *= this.canvasWidthMult;
				pos.y *= this.canvasHeightMult;
				// log(pos);
				this.lastMousePos = this.currentMousePos;
				this.currentMousePos = pos;
				this.flushCamera();
				this.activeTool && this.activeTool.onPointerMove(this, e);
				if (e.buttons & 1)
				{
					// log(`strokeMove ${pos.x} ${pos.y}`);
					this.strokeMove(e);
				}
			}

			this.$refs.canvas.addEventListener('touchstart', strokeStart)
			this.$refs.canvas.addEventListener('touchend',strokeEnd)
			this.$refs.canvas.addEventListener('touchcancel',strokeEnd)

			this.$refs.canvas.addEventListener('mousedown', strokeStart)
			this.$refs.canvas.addEventListener('mouseup',strokeEnd)
			this.$refs.canvas.addEventListener('mouseout',strokeEnd)
			this.$refs.canvas.addEventListener('click', (e)=>{e.preventDefault(); e.stopPropagation()})
			this.$refs.canvas.addEventListener('mouseleave',strokeEnd)
			this.$refs.canvas.addEventListener('mousemove', (e) => {
				strokeMove(e, 0.5, false);
			})

			if (this.meshBindEvents)
				this.meshBindEvents()

			if (this.bindSpotlightEvents)
				this.bindSpotlightEvents()

			Pressure.set('#'+this.canvasID, 
			{
				start: (event, isPollyfill) =>
				{
					// this is called on force start
					// log('start');
					// log(event);

					const box = this.$refs.canvas.getBoundingClientRect();
					var pos = {
						clientX: (event.clientX || event.touches[0].clientX),
						clientY: (event.clientY || event.touches[0].clientY) - box.y,
						x: event.clientX - box.x,
						y: this.VIEWER_HEIGHT - (event.clientY - box.y),
						force: 0
					}
					pos.x *= this.canvasWidthMult;
					pos.y *= this.canvasHeightMult;
					this.lastMousePos = pos;
					strokeStart(event)
				},
				end: () =>
				{
					// log('end');
					// this is called on force end
					strokeEnd();
				},
				startDeepPress: (event, isPollyfill) =>
				{
					// this is called on "force click" / "deep press", aka once the force is greater than 0.5
				},
				endDeepPress: () =>
				{
					// this is called when the "force click" / "deep press" end
				},
				change: (force, event, isPollyfill) =>
				{
					// this is called every time there is a change in pressure
					// 'force' is a value ranging from 0 to 1
					// WARNING: it does not give correct XY coordinates for none pressure sensitive devices
		
					// log(`${isPollyfill ? 'fake ' : ''}force: ${force}`);
					// log(event);

					strokeMove(event, force, isPollyfill);
				},
			});
			
			window._vm_.$on('cmdDocSave', ()=>
			{
				log('on cmdDocSave')
				canvasToImage(this.canvasID, 
				{
					name: 'paint-canvas',
					type: 'png',
					quality: 1
				});
			});
			
			window._vm_.$on('cmdExportColor', ()=>
			{
				log('on cmdExportColor')
				var dim = this.channelDimension('color');

				this.tempFbo.resize(dim, dim)
				this.tempFbo.use( ()=>{ this.toggleDrawUVMap() } )
				var dataTex = new DataTexture();
				dataTex.readFromFBO(this.regl, this.tempFbo);
				let canvas = document.createElement('canvas');
				canvas.width = dim;
				canvas.height = dim;
				dataTex.drawToCanvas2D(canvas.getContext('2d'))
				canvasToImage(canvas, {
					name: 'color',
					type: 'png',
					quality: 1
				});
				canvas = null;
				dataTex.data = null;
				dataTex = null;

				this.toggleDrawUVMap()
				this.tempFbo.resize(2, 2)
			});
			
			window._vm_.$on('cmdExportChannel', (channel)=>
			{
				log('on cmdExportChannel')
				var dim = this.channelDimension(channel);

				var fbo = this.tempFbo;
				if (channel=='normal')
				{
					fbo = this.regl.framebuffer({
						width: dim,
						height: dim,
						colorFormat: 'rgba',
						colorType: 'float',
						depth: false,
						stencil: false,
					})
				}
				else
				{
					fbo.resize(dim, dim)
				}
				fbo.use( ()=>
				{
					this.regl.clear({ depth: 1, color: [0, 0, 0, 1] })
					this.drawTexture({texture: this.sceneGeomArray[this.activeGeomIdx][channel+'Tex'], showGrid: false, showOpacity: true});
				} )
				var dataTex = new DataTexture();
				dataTex.readFromFBO(this.regl, fbo);


				function base64ArrayBuffer(arrayBuffer) {
					var base64    = ''
					var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

					var bytes         = new Uint8Array(arrayBuffer)
					var byteLength    = bytes.byteLength
					var byteRemainder = byteLength % 3
					var mainLength    = byteLength - byteRemainder

					var a, b, c, d
					var chunk

					// Main loop deals with bytes in chunks of 3
					for (var i = 0; i < mainLength; i = i + 3) {
						// Combine the three bytes into a single integer
						chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

						// Use bitmasks to extract 6-bit segments from the triplet
						a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
						b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
						c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
						d = chunk & 63               // 63       = 2^6 - 1

						// Convert the raw binary segments to the appropriate ASCII encoding
						base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
					}

					// Deal with the remaining bytes and padding
					if (byteRemainder == 1) {
						chunk = bytes[mainLength]

						a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

						// Set the 4 least significant bits to zero
						b = (chunk & 3)   << 4 // 3   = 2^2 - 1

						base64 += encodings[a] + encodings[b] + '=='
					} else if (byteRemainder == 2) {
						chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

						a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
						b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

						// Set the 2 least significant bits to zero
						c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

						base64 += encodings[a] + encodings[b] + encodings[c] + '='
					}
					
					return base64
				}

				function saveAs(blob, fileName) {
					var url = window.URL.createObjectURL(blob);

					var anchorElem = document.createElement("a");
					anchorElem.style = "display: none";
					anchorElem.href = url;
					anchorElem.download = fileName;

					document.body.appendChild(anchorElem);
					anchorElem.click();

					document.body.removeChild(anchorElem);

					// On Edge, revokeObjectURL should be called only after
					// a.click() has completed, atleast on EdgeHTML 15.15048
					setTimeout(function() {
						window.URL.revokeObjectURL(url);
					}, 1000);
				}

				function saveBase64As(b64, fileName) {
					// var url = window.URL.createObjectURL(blob);

					var anchorElem = document.createElement("a");
					anchorElem.style = "display: none";
					anchorElem.href = b64;
					anchorElem.download = fileName;

					document.body.appendChild(anchorElem);
					anchorElem.click();

					document.body.removeChild(anchorElem);

					// On Edge, revokeObjectURL should be called only after
					// a.click() has completed, atleast on EdgeHTML 15.15048
					// setTimeout(function() {
					// 	window.URL.revokeObjectURL(url);
					// }, 1000);
				}

				if (channel=='normal')
				{
					let data16 = dataTex.convertToUInt16();
					data16 = dataTex.flipYData(data16, dataTex.width*4*2);
					// let data16 = dataTex.data;
					let img = PNG.sync.write({
							data: data16, 
							width: dataTex.width,
							height: dataTex.height,
							gamma: 0
						},
						{
							width: dataTex.width,
							height: dataTex.height,
							colorType: 6, // rgba
							bitDepth: 16,
							inputHasAlpha: true
						});
					// let img = UPNG.encodeLL([data16], dataTex.width, dataTex.height,
					// 					dataTex.format.indexOf('rgb') > -1 ? 3 : 1,
					// 					dataTex.format=='rgba' || dataTex.format=='alpha' ? 1 : 0,
					// 					16
					// 					);
					// let img = UTIF.encode16bitImage(data16, dataTex.width, dataTex.height);
					// let img = UPNG.encode([dataTex.data], dataTex.width, dataTex.height,
					// 					0);
					// WARNING: trying to save using a Blob, messes-up the file.
					// let blob = new Blob(new Uint8Array(img), {type: 'image/png'});
					// let blob = new Blob(new Uint8Array(img), {type: 'octet/stream'});
					// let blob = new Blob(new Uint8Array(img), {type: 'application/octet-stream'});
					// let blob = new File(new Uint8Array(img), 'texture.png', {type: 'application/octet-stream'});

					let b64encoded = base64ArrayBuffer(img);
					// b64encoded = 'data:image/png;base64,'+b64encoded;
					// b64encoded = 'data:image/tiff;base64,'+b64encoded;
					b64encoded = 'data:octet/stream;base64,'+b64encoded;
					saveBase64As(b64encoded, 'normals-16bit.png')
					// saveAs(blob, 'normals-16bit.tif')
					// FileSaver.saveAs(blob, 'normals.png');//, true);
					// FileSaver.saveAs(blob);
					fbo.destroy();
				}
				else
				{
					let canvas = document.createElement('canvas');
					canvas.width = dim;
					canvas.height = dim;
					let data = new Uint8Array( dataTex.flipYData(dataTex.data, dataTex.width*4).buffer );
					dataTex.drawToCanvas2D(canvas.getContext('2d'), data)
					// dataTex.drawToCanvas2D(canvas.getContext('2d'))
					// canvasToImage(this.canvasID, {
					canvasToImage(canvas, {
						name: channel,
						type: 'png',
						quality: 1
					});
					canvas = null;
					fbo.resize(2, 2)
				}
				dataTex.data = null;
				dataTex = null;

				// this.$refs.canvas.width = prevWidth;
				// this.$refs.canvas.height = prevHeight;
				// this.resizeCanvasFBO(prevViewerWidth, prevViewerHeight)
				// this.toggleDrawUVMap({srcKey:'uv'})
			});
			
			window._vm_.$on('cmdCanvasClear', ()=>
			{
				log('on cmdCanvasClear')
				rAF.request( (time) => 
				{
					this.paintSurfFbos[0].use(() => this.regl.clear({ depth: 1, color: [1, 1, 1, 0] })	);
					// this.paintSurfFbos[1].use(() => this.regl.clear({ depth: 1, color: [1, 1, 1, 0] })	);
					this.compositeStroke()
				});
			});
			
			window._vm_.$on('cmdCanvasFill', ()=>
			{
				log('on cmdCanvasFill')
				rAF.request( (time) => 
				{
					this.paintSurfFbos[0].use(() => this.regl.clear({ depth: 1, color: this.brushColor })	);
					// this.paintSurfFbos[1].use(() => this.regl.clear({ depth: 1, color: this.brushColor })	);
					this.compositeStroke()
				});
			});


		},
		...meshFunctions,
		...spotlightFunctions,
		...mapMutations([	//'setActiveToolName',
							'initStore',
							'setLoadedBrushStamps',
							'setActiveBrushStampIdx',
							'saveCurrentStrokePreset',
							'setActiveStrokePreset',
							'setSpotlightImgSrc',
							'setSpotlightImg',
							'setMeshLoaded',
							'setPickedColor',
							'setBrushState',
							'setBrushStampOpacity',
							'setBrushSize',
							'setBrushGap',
							'setBrushOffset',
							'setBrushAlign',
							'setBrushRotation',
							'setBrushHue',
							'setBrushSaturation',
							'setBrushLuminance',
							'setBrushPressureFlow',
							'setBrushPressureOpacity',
							'setBrushPressureSize',
							'setBrushPressureGap',
							'setBrushPressureOffset',
							'setBrushPressureAlign',
							'setBrushPressureRotation',
							'setBrushPressureHue',
							'setBrushPressureSaturation',
							'setBrushPressureLuminance',
							'setCurrentAction',
							'pushUndoAction',
							'pushRedoAction',
							'popUndoAction',
							'popRedoAction',
							'clearRedoActions',
							'clearUndoActions',
							'clearCurrentUndoRedoActions',
							'setActiveGeomIdx',
							'createGeomLayers',
							'createLayerData',
							'setLayerData',
							'setChannelLayers',
							'setGeomChannelRefresh',
							'setLightDirection'
							])
	},

}
</script>


<style lang="scss">
.canvas-wrapper {
	position: relative;
	width: 100%;
	height: 100%;

	&.dragover {
		z-index: -1;
	}

	canvas {
		width: 100%;
		height: 100%;
	}

	.active-geom-name
	{
		display: inline-block;
		position: absolute;
		bottom: 10px;
		left: 0;
		right: 0;
		margin: auto;
		font-size: 12px;
		color: grey;
		font-family: 'Courier New', Courier, monospace;
		text-align: center;
		user-select: none;
		pointer-events: none;
	}

}

.brush-dialog {
	height: 100% !important;

	.thumbnail {
		margin: 10px;
		cursor: pointer;
	}
	.thumbnail .card__media {
		background: url('/img/checker-darker.png') repeat;
		border: 4px solid transparent;
		// border-radius: 4px !important;
	}
	.selected.card__media {
		border-color: #2196F3;
	}

	.drop-img-thumbnail 
	{
		display: inline-block;
		position: relative;
		width: 200px;
		height: 200px;
		background: url('/img/drop-img-small.svg') no-repeat;
		background-size: contain;
		background-position: center center;
		margin: 10px;
	}

	.brushStampDropArea.dragging:after {
		content: '';
		position: absolute;
		$gap: 2em;
		left: $gap;
		right: $gap;
		top: $gap;
		bottom: $gap;
		padding: 50px;
		// border: 4px solid grey;
		border: 10px dashed #dddddd;
		border-radius: 10px;
		pointer-events: none;
	}

	.brushStampDropArea.dragging {
		.container {
			// visibility: hidden;
			opacity: 0;
			// pointer-events: none;
		}
	}
}

.canvas-wrapper > svg {
	display: block;
	position: absolute;
	pointer-events: none;
	top: 0;
	left: 0;
}

.dragging .canvas-wrapper {
	opacity: 0.1;
	// pointer-events: none;
}
</style>

