'use strict'

import Vue from 'vue'
import Vuex from 'vuex'
// import mutations from './mutations.js'
// import actions from './actions.js'
const ls = require('local-storage');



function getPresets()
{
	var presets = ls.get('stroke-presets');

	if (presets != null)
	{
		log('...found stroke presets ', presets);
		state.strokePresets = presets;
	}
	else
	{
		presets = [{
			name: 'default',
			stampOpacity: [10, 50],
			size: [1, 50],
			gap: [0, 0],
			offset: [0, 0],
			align: [0, 0],
			rotation: [0, 0],
			hue: [0, 0],
			saturation: [0, 0],
			luminance: [0, 0],
			pressure: {
				// these must be the index of the active button if not NULL
				flow: 0,
				opacity: 0,
				size: 0,
				gap: 0,
				offset: null,
				align: null,
				rotation: null,
				hue: null,
				saturation: null,
				luminance: null,
			},
		}]
	}
	return presets;
}

const state = {
	objFileData: '',
	objMesh: null,
	sceneGeom: null,
	meshLoaded: false,
	activeGeomIdx: 0,
	geomNames: [],
	// textureDim: 4096 >> 1,
	processingMeshState: 0,
	brushColor: [1, 1, 1, 1],
	// brushStampOpacity: 0.1,
	activeModeName: '',
	activeToolName: '',
	brush: {
		color: [1, 1, 1, 1],
		stampOpacity: [10, 50],
		size: [1, 50],
		gap: [0, 0],
		offset: [0, 0],
		align: [0, 0],
		rotation: [0, 0],
		hue: [0, 0],
		saturation: [0, 0],
		luminance: [0, 0],
		pressure: {
			// these must be the index of the active button if not NULL
			flow: 0,
			opacity: 0,
			size: 0,
			gap: 0,
			offset: null,
			align: null,
			rotation: null,
			hue: null,
			saturation: null,
			luminance: null,
		},
	},

	strokePresets: [],
	activeStrokePreset: 0,
	loadedBrushStamps: [],
	activeBrushStampIdx: 0,

	spotlightImgSrc: null,
	spotlightImg: null,
	spotlightVertices: [],
	spotlightWrappedVertices: [],
	spotlightIndeces: [],
	spotlightVertexUVs: [],
	spotlightUVs: [],
	activeSpotlightTool: 0,
	
	modeList: ['canvas', 'mask', 'spotlight'],
	currentMode: 'canvas',
	
	toolList: ['orbit', 'paint', 'mask', 'spotlight'],
	currentTool: 'paint',

	lightDirection: [0.0, 1.0, 0.0],

	currentStack: { // this should have 1 action MAX
		'orbit': null,
		'paint': null,
		'mask': null,
		'spotlight': null
	},
	undoStack: {
		'orbit': [],
		'paint': [],
		'mask': [],
		'spotlight': []
	},
	redoStack:  {
		'orbit': [],
		'paint': [],
		'mask': [],
		'spotlight': []
	},

	
	// this stores the DataTextures from the layers of all the channels.
	layerDataStore: [], // can be either filled or null
	channelList: ['color', 'metallic', 'roughness', 'normal', 'emissive' /* , 'ambient occlusion' */],
	channelListClear: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0.5, 0.5, 1, 1], [0, 0, 0, 0]],
	
	currentChannel: 'color', // TODO: replace 'channels.color' with this
	currentChannelSolo: false,
	geomLayers: [ // TODO: accomodate multiple object layer lists.
		{
			dimensions: [2048, 2048, 2048, 2048, 2048],
			channels: {
				current: 'color',
				// each channel has a layer list.
				color: [],
				metallic: [],
				roughness: [],
				normal: [],
				emissive: [],
				'ambient occlusion': [],
			}
		}
	],
	
}

const getters = {
	activeBrushStamp: (state)=> state.loadedBrushStamps[state.activeBrushStampIdx]
	,strokePresetsCount: (state)=> state.strokePresets.length
	,brushStampOpacity: (state) => state.brush.stampOpacity
	,brushSize: (state) => state.brush.size
	,brushGap: (state) => state.brush.gap
	,brushOffset: (state) => state.brush.offset
	,brushAlign: (state) => state.brush.align
	,brushRotation: (state) => state.brush.rotation
	,brushHue: (state) => state.brush.hue
	,brushSaturation: (state) => state.brush.saturation
	,brushLuminance: (state) => state.brush.luminance
	,brushPressureFlow: (state) => state.brush.pressure.flow!==null
	,brushPressureOpacity: (state) => state.brush.pressure.opacity!==null
	,brushPressureSize: (state) => state.brush.pressure.size!==null
	,brushPressureGap: (state) => state.brush.pressure.gap!==null
	,brushPressureOffset: (state) => state.brush.pressure.offset!==null
	,brushPressureAlign: (state) => state.brush.pressure.align!==null
	,brushPressureRotation: (state) => state.brush.pressure.rotation!==null
	,brushPressureHue: (state) => state.brush.pressure.hue!==null
	,brushPressureSaturation: (state) => state.brush.pressure.saturation!==null
	,brushPressureLuminance: (state) => state.brush.pressure.luminance!==null
	,currentAction: (state) => state.currentStack[state.currentTool] || null
	,undoAction: (state) => state.undoStack[state.currentTool][state.undoStack[state.currentTool].length-1]
	,redoAction: (state) => state.redoStack[state.currentTool][state.redoStack[state.currentTool].length-1]
	,undoPaintActionCount: (state) => state.undoStack['paint'].length
	,undoActionCount: (state) => state.undoStack[state.currentTool].length
	,redoActionCount: (state) => state.redoStack[state.currentTool].length
	,hasNoUndoActions: (state) => state.undoStack[state.currentTool].length == 0
	,hasNoRedoActions: (state) => state.redoStack[state.currentTool].length == 0
	,getPrevUndoAction: (state) => state.undoStack[state.currentTool][state.undoStack[state.currentTool].length-1] || null
	,getNextRedoAction: (state) => state.redoStack[state.currentTool][state.redoStack[state.currentTool].length-1] || null
	,layerDataCount: (state) => state.layerDataStore.length
	,getLayerData: (state) => (idx) => state.layerDataStore[idx] || null
	,getChannelLayers: (state) => (ch) => { ch = ch || state.geomLayers[state.activeGeomIdx].channels.current; return state.geomLayers[state.activeGeomIdx].channels[ch]; }
	,activeChannelLayers: (state) => { if (!state.geomLayers || !state.geomLayers[state.activeGeomIdx]) return []; var ch = state.geomLayers[state.activeGeomIdx].channels.current; return state.geomLayers[state.activeGeomIdx].channels[ch]; }
	,activeChannelSelectedLayer: (state) => { if (!state.geomLayers || !state.geomLayers[state.activeGeomIdx]) return []; var ch = state.geomLayers[state.activeGeomIdx].channels.current; return state.geomLayers[state.activeGeomIdx].channels[ch].filter(l => l.selected)[0]; }
	,getGeomChannelLayersWithFilter: (state) => (geomIdx, channelIdx, filterFunc) => 
	{ 
		geomIdx = (typeof geomIdx=='undefined') ? state.activeGeomIdx : geomIdx; 
		if (!state.geomLayers || !state.geomLayers[geomIdx]) return []; 
		var ch = (typeof channelIdx=='undefined') ? state.geomLayers[geomIdx].channels.current : channelIdx; 
		if (filterFunc)
			return state.geomLayers[geomIdx].channels[ch].filter(filterFunc); 
		else
			return state.geomLayers[geomIdx].channels[ch]; 
	}
	,getGeomChannelRefresh: (state) => (geomIdx, channelIdx) => {
		geomIdx = (typeof geomIdx == 'undefined') ? state.activeGeomIdx : geomIdx;
		var ch = (typeof channelIdx == 'undefined') ? state.geomLayers[geomIdx].channels.current : channelIdx;
		return state.geomLayers[geomIdx].needsRefresh[ch];
	}
	,activeChannel: (state) => state.geomLayers[state.activeGeomIdx].channels.current
	,getActiveChannelDimension: (state) => (_) => state.geomLayers[state.activeGeomIdx].dimensions[state.channelList.indexOf(state.geomLayers[state.activeGeomIdx].channels.current)]
	,channelDimension: (state) => (ch) => state.geomLayers[state.activeGeomIdx].dimensions[state.channelList.indexOf(ch)]
	,getChannelMaxDimension: (state) => () => Math.max.apply(null, state.geomLayers[state.activeGeomIdx].dimensions)
	,getActiveChannelIndex: (state) => () => state.channelList.indexOf(state.geomLayers[state.activeGeomIdx].channels.current)
	,getActiveChannelTextureName: (state) => () => state.geomLayers[state.activeGeomIdx].channels.current+'Tex'
	,getActiveChannelClearColor: (state) => () => state.channelListClear[state.channelList.indexOf(state.geomLayers[state.activeGeomIdx].channels.current)]
	,channelList: (state) => state.channelList
	,getBrushState:  (state) => () =>
	{
		var brush = {
			// name: name || '', 
			color: state.brushColor.slice(),
			stampOpacity: state.brush.stampOpacity.slice(),
			size: state.brush.size.slice(),
			gap: state.brush.gap.slice(),
			offset: state.brush.offset.slice(),
			align: state.brush.align.slice(),
			rotation: state.brush.rotation.slice(),
			hue: state.brush.hue.slice(),
			saturation: state.brush.saturation.slice(),
			luminance: state.brush.luminance.slice(),
			pressure: {
				// these must be the index of the active button if not NULL
				flow: state.brush.pressure.flow,
				opacity: state.brush.pressure.opacity,
				size: state.brush.pressure.size,
				gap: state.brush.pressure.gap,
				offset: state.brush.pressure.offset,
				align: state.brush.pressure.align,
				rotation: state.brush.pressure.rotation,
				hue: state.brush.pressure.hue,
				saturation: state.brush.pressure.saturation,
				luminance: state.brush.pressure.luminance,
			}
		};

		return brush;
	}

}

function asArray(val) { return Array.isArray(val) ? val : [val, val] }

// Mutations are always synchronous. If you want asynchronous use Actions
// Mutations/Actions *cannot* have a return value.
const mutations = {
	// setTextureDim(state, payload) { state.textureDim = payload; }

	initStore(state) {
		state.strokePresets = getPresets();
	}
	,setLoadedBrushStamps(state, payload) { state.loadedBrushStamps = payload; }
	,setActiveBrushStampIdx(state, payload) { state.activeBrushStampIdx = payload; }
	,setSpotlightImgSrc(state, payload) { state.spotlightImgSrc = payload; }
	,setSpotlightImg(state, payload) { state.spotlightImg = payload; }
	,setActiveSpotlightTool(state, payload) { state.activeSpotlightTool = payload; }
	,setMeshLoaded(state, payload) { state.meshLoaded = payload; }
	,setActiveModeName(state, payload) {	state.activeModeName = payload;	}
	,setActiveToolName(state, payload) { state.activeToolName = payload;	}
	,setActiveChannel(state, payload) { state.geomLayers[state.activeGeomIdx].channels.current = payload;	}
	,setActiveChannelDimension(state, payload) { state.geomLayers[state.activeGeomIdx].dimensions[state.channelList.indexOf(state.geomLayers[state.activeGeomIdx].channels.current)] = payload; }
	,setChannelDimension(state, payload) { state.geomLayers[state.activeGeomIdx].dimensions[state.channelList.indexOf(payload.channel)] = payload.value; }
	,setPickedColor(state, payload) {
		// log('setting picked color to '+JSON.stringify(payload) )
		state.brushColor = [payload.r / 255.0, payload.g / 255.0, payload.b / 255.0, payload.a ];
		// log('setting picked color to '+JSON.stringify(state.brushColor) )
	}
	// setBrushStampOpacity(state, payload) {
	// 	state.brushStampOpacity = parseFloat(payload || 0.0) || 0.0;
	// }
	,setBrushStampOpacity(state, payload) {	state.brush.stampOpacity = asArray(payload);	}
	,setBrushSize(state, payload) { state.brush.size = asArray(payload);	}
	,setBrushGap(state, payload) { state.brush.gap = asArray(payload);	}
	,setBrushOffset(state, payload) { state.brush.offset = asArray(payload);	}
	,setBrushAlign(state, payload) { state.brush.align = asArray(payload);	}
	,setBrushRotation(state, payload) { state.brush.rotation = asArray(payload);	}
	,setBrushHue(state, payload) { state.brush.hue = asArray(payload);	}
	,setBrushSaturation(state, payload) { state.brush.saturation = asArray(payload);	}
	,setBrushLuminance(state, payload) { state.brush.luminance = asArray(payload);	}
	,setBrushPressureFlow(state, payload) { state.brush.pressure.flow = payload;	}
	,setBrushPressureOpacity(state, payload) { state.brush.pressure.opacity = payload;	}
	,setBrushPressureSize(state, payload) { state.brush.pressure.size = payload;	}
	,setBrushPressureGap(state, payload) { state.brush.pressure.gap = payload;	}
	,setBrushPressureOffset(state, payload) { state.brush.pressure.offset = payload;	}
	,setBrushPressureAlign(state, payload) { state.brush.pressure.align = payload;	}
	,setBrushPressureRotation(state, payload) { state.brush.pressure.rotation = payload;	}
	,setBrushPressureHue(state, payload) { state.brush.pressure.hue = payload;	}
	,setBrushPressureSaturation(state, payload) { state.brush.pressure.saturation = payload;	}
	,setBrushPressureLuminance(state, payload) { state.brush.pressure.luminance = payload;	}
	,setCurrentTool(state, toolName) 
	{ 
		if (state.toolList.includes(toolName))  
		{
			if (toolName == 'orbit')
			{
				// destroy the paint unde/redo stack
				state.undoStack['paint'] = [];
				state.redoStack['paint'] = [];
			}
			state.currentTool = toolName; 
		}
	}
	,setCurrentMode(state, modeName) 
	{ 
		if (state.modeList.includes(modeName))  
			state.currentMode = modeName; 
	}
	,setCurrentAction(state, payload) { /* log('setCurrentAction'), */ state.currentStack[state.currentTool] = (payload || null) }
	// ,pushUndoAction(state, payload) { state.undoStack[state.currentTool].push(payload)	}
	,pushUndoAction(state, payload) { state.undoStack[payload.tool || state.currentTool].push(payload)	}
	,popUndoAction(state) { return state.undoStack[state.currentTool].length ? state.undoStack[state.currentTool].pop() : null	}
	,pushRedoAction(state, payload) { state.redoStack[payload.tool || state.currentTool].push(payload)	}
	,popRedoAction(state) { return state.redoStack[state.currentTool].length ? state.redoStack[state.currentTool].pop() : null	}
	,printUndoActions(state) { log( JSON.stringify(state.undoStack[state.currentTool].map( x => x.data.idx ) ));	}
	,printRedoActions(state) { log( JSON.stringify(state.redoStack[state.currentTool].map( x => x.data.idx ) ));	}
	,clearUndoActions(state, tool) { state.undoStack[tool || state.currentTool] = []; /* log('clearRedoActions') */	}
	,clearRedoActions(state, tool) { state.redoStack[tool || state.currentTool] = []; /* log('clearRedoActions') */	}
	,clearCurrentUndoRedoActions(state) { state.undoStack[state.currentTool] = []; state.redoStack[state.currentTool] = [];	}

	,setLightDirection(state, vector) {	if (vector) state.lightDirection = vector.slice();	}

	,setCurrentChannelSolo(state, active) { state.currentChannelSolo = active || false; }

	,createLayerData(state) { state.layerDataStore.push({}); return state.layerDataStore.length-1; }
	,deleteLayerData(state, idx) { state.layerDataStore[idx] = null; }
	,setLayerData(state, payload) { state.layerDataStore[payload.index] = payload.data; }
	,setChannelLayers(state, payload) { var ch = payload.channel || state.geomLayers[state.activeGeomIdx].channels.current; state.geomLayers[state.activeGeomIdx].channels[ch] = payload.layers; }
	,setGeomChannelRefresh(state, payload) {
		var geomIdx = (typeof payload.geomIdx == 'undefined') ? state.activeGeomIdx : payload.geomIdx;
		var ch = (typeof payload.channel == 'undefined') ? state.geomLayers[geomIdx].channels.current : payload.channel;
		state.geomLayers[geomIdx].needsRefresh[ch] = !!payload.refresh;
	}
	,setActiveGeomIdx(state, idx) {state.activeGeomIdx = idx > -1 ? idx : 0;}
	,createGeomLayers(state, nameList) {
		state.activeGeomIdx = 0;
		state.geomNames = nameList.slice();
		state.geomLayers = []; 
		var count = nameList.length ? nameList.length : 1;
		for (var i = 0; i < count; i++)
			state.geomLayers.push(
				{
					dimensions: [2048, 2048, 2048, 2048, 2048],
					channels: {
						current: 'color',
						// each channel has a layer list.
						color: [],
						metallic: [],
						roughness: [],
						normal: [],
						emissive: [],
						'ambient occlusion': [],
					},
					needsRefresh: {
						color: false,
						metallic: false,
						roughness: false,
						normal: false,
						emissive: false,
						'ambient occlusion': false,
					}
				}
			)
	}
	,setBrushState(state, brush)
	{
		state.brushColor = brush.color.slice();
		state.brush.color = brush.color.slice();
		state.brush.stampOpacity = brush.stampOpacity.slice();
		state.brush.size = brush.size.slice();
		state.brush.gap = brush.gap.slice();
		state.brush.offset = brush.offset.slice();
		state.brush.align = brush.align.slice();
		state.brush.rotation = brush.rotation.slice();
		state.brush.hue = brush.hue.slice();
		state.brush.saturation = brush.saturation.slice();
		state.brush.luminance = brush.luminance.slice();
		state.brush.pressure.flow = brush.pressure.flow;
		state.brush.pressure.opacity = brush.pressure.opacity;
		state.brush.pressure.size = brush.pressure.size;
		state.brush.pressure.gap = brush.pressure.gap;
		state.brush.pressure.offset = brush.pressure.offset;
		state.brush.pressure.align = brush.pressure.align;
		state.brush.pressure.rotation = brush.pressure.rotation;
		state.brush.pressure.hue = brush.pressure.hue;
		state.brush.pressure.saturation = brush.pressure.saturation;
		state.brush.pressure.luminance = brush.pressure.luminance;
	}
	,saveCurrentStrokePreset(state, name)
	{
		var stroke = {
			name: name || '', 
			stampOpacity: state.brush.stampOpacity.slice(),
			size: state.brush.size.slice(),
			gap: state.brush.gap.slice(),
			offset: state.brush.offset.slice(),
			align: state.brush.align.slice(),
			rotation: state.brush.rotation.slice(),
			hue: state.brush.hue.slice(),
			saturation: state.brush.saturation.slice(),
			luminance: state.brush.luminance.slice(),
			pressure: {
				// these must be the index of the active button if not NULL
				flow: state.brush.pressure.flow,
				opacity: state.brush.pressure.opacity,
				size: state.brush.pressure.size,
				gap: state.brush.pressure.gap,
				offset: state.brush.pressure.offset,
				align: state.brush.pressure.align,
				rotation: state.brush.pressure.rotation,
				hue: state.brush.pressure.hue,
				saturation: state.brush.pressure.saturation,
				luminance: state.brush.pressure.luminance,
			}
		};

		state.strokePresets.push(stroke);
		try {
			ls.set('stroke-presets', state.strokePresets);
		} catch (error) {
			log('ERROR: ', error);
		}
	}
	,setActiveStrokePreset(state, idx)
	{
		var preset = state.strokePresets[idx];
		state.brush.stampOpacity = preset.stampOpacity.slice();
		state.brush.size = preset.size.slice();
		state.brush.gap = preset.gap.slice();
		state.brush.offset = preset.offset.slice();
		state.brush.align = preset.align.slice();
		state.brush.rotation = preset.rotation.slice();
		state.brush.hue = preset.hue.slice();
		state.brush.saturation = preset.saturation.slice();
		state.brush.luminance = preset.luminance.slice();
		state.brush.pressure.flow = preset.pressure.flow;
		state.brush.pressure.opacity = preset.pressure.opacity;
		state.brush.pressure.size = preset.pressure.size;
		state.brush.pressure.gap = preset.pressure.gap;
		state.brush.pressure.offset = preset.pressure.offset;
		state.brush.pressure.align = preset.pressure.align;
		state.brush.pressure.rotation = preset.pressure.rotation;
		state.brush.pressure.hue = preset.pressure.hue;
		state.brush.pressure.saturation = preset.pressure.saturation;
		state.brush.pressure.luminance = preset.pressure.luminance;
		state.activeStrokePreset = idx;
	}
};

const actions = {
};

Vue.use(Vuex)


export default new Vuex.Store({
		state,
		getters,
		mutations,
		actions
	})



