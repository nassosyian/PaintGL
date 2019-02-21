<template lang="pug">
	aside
		v-tabs(grow v-model="tab" dark)
			v-tab(href="#tab-tool" @click="refresh" @mouseenter="tab = 'tab-tool'; refresh();") Tool
			v-tab(href="#tab-layers" @click="refresh" @mouseenter="tab = 'tab-layers'; refresh();") Layers
			v-tab(href="#tab-viewer" @click="refresh" @mouseenter="tab = 'tab-viewer'; refresh();") Viewer
		v-tabs-items(grow v-model="tab" :touchless="true")
			v-tab-item(id="tab-tool" :class="{disabled: !meshLoaded}")
				v-expansion-panel(dark v-bar)
					v-layout(column v-if="showBrushTool")
						include ./tool-brush.pug
					v-layout(column v-if="showOrbitTool")
						include ./tool-orbit.pug
					v-layout(column v-if="showSpotlightTool")
						include ./tool-spotlight.pug
						
			v-tab-item(id="tab-layers")
				v-expansion-panel(dark v-bar)
					//- v-container(fluid)
					v-layout(column  px-2 py-2)
						//- v-layout( px-2 py-2)
						//- v-card.px-2.py-2(flat)
						v-layout( row justify-space-between)
							.label object 
							v-flex(xs10): v-select(ref="geomSelect" v-model="activeGeomName" :items="geomNames" dense flat single-line :class="{disabled: !meshLoaded}")
						//- v-card.px-2.py-2(flat)
						v-layout(row justify-space-between)
							.label channel 
							v-flex(xs7): v-select(label-old="active channel" v-model="activeChannel" :items="channelList" dense flat single-line )
						v-layout(row justify-space-between)
							.label Texture Resolution: 
							v-flex(xs7): v-select(ref="texRes" label="Texture Resolution" v-model="textureRes" :items="textureDimList" single-line)

						v-checkbox(label="show only active channel" v-model="activeChannelSolo" :class="{disabled: !meshLoaded}")
						.layer-box(:class="{disabled: !meshLoaded}")
							drop-file.flex.column.align-stretch( ref="layerDropArea" types=".png,.jpg,.jpeg" eventname="layerDropped")
								.drop-area
									.border
								layer-list(ref="layerList" :list="activeLayerList" @will-select-layer="onWillSelectLayer" @selected-layer="onSelectedLayer" @reordered-layer="onReorderedLayer")
							v-layout(column)
								.label Opacity
								slider(ref="layerOpacity" :min="0" :max="100" :interval="1" width="100%" tooltip="hover" :tooltipDir="['top']" v-model="activeLayerOpacity")
							v-layout(row justify-space-between align-content-center)
								v-btn(flat @click="cmdLoadLayer" :disabled="activeLayerList.length >= 6" title="Load Texture" v-tippy)
									span.tool-icon.icon-folder
								v-btn(flat @click="cmdMergeLayers" :disabled="activeLayerList.length <= 1 || selectedCount < 2" title="Merge Layers" v-tippy)
									v-icon vertical_align_center
								v-spacer
								v-btn(flat @click="cmdAddLayer" :disabled="activeLayerList.length >= 6" title="Add Layer" v-tippy)
									v-icon add_circle_outline
								v-btn(flat @click="cmdRemoveLayer" :disabled="activeLayerList.length <= 1" title="Delete Layer" v-tippy)
									v-icon remove_circle_outline


			v-tab-item(id="tab-viewer")
				v-expansion-panel(dark v-bar)
					v-layout(column px-4)
						v-layout(row justify-space-between align-content-center)
							v-flex(xs2 align-center).label Mode
							v-flex(xs8 align-content-center)
								v-select(:items="viewerModeItems" v-model="viewerMode" single-line color="blue")
						v-card.px-2.py-2
							v-layout(row)
								.label Field Of View: {{viewerFOV}} degrees
							slider(ref="sliderViewerFOV" :min="10" :max="180" :interval="0.1" width="100%" tooltip="false" v-model="viewerFOV")
						v-card.px-2.py-2
							v-layout(row)
								.label Light Rotation: {{viewerLightRotation}} degrees
							slider(ref="sliderViewerLightRotation" :min="0" :max="360" :interval="1" width="100%" tooltip="false" v-model="viewerLightRotation")
						v-card.px-2.py-2
							v-layout(row)
								.label Ambient Occlusion opacity: {{viewerAO}}%
							slider(ref="sliderViewerAO" :min="0" :max="100" :interval="1" width="100%" tooltip="false" v-model="viewerAO")
						v-card.px-2.py-2
							v-layout(row)
								.label Ambient Light opacity: {{viewerAL}}%
							slider(ref="sliderViewerAL" :min="0" :max="100" :interval="1" width="100%" tooltip="false" v-model="viewerAL")



</template>

<script>
import { mapMutations, mapState, mapGetters } from 'vuex'
// import VueCollapse from 'vue2-collapse'
import { Chrome } from 'vue-color'
// import { Sketch } from 'vue-color'
// import { Photoshop } from 'vue-color'
import Slider from './Slider.vue'
import LayerList from './LayerList.vue'
import DataTexture from '../classes/DataTexture';
import spotlightMethods from '../utils//spotlight-methods'

export default {
	props: {},
	data() {
		return {
			currentColor: {
				hex: '#0D9451',
				hsl: { h: 150, s: 0.5, l: 0.2, a: 1 },
				hsv: { h: 150, s: 0.66, v: 0.30, a: 1 },
				rgba: { r: 25, g: 77, b: 51, a: 1 },
				a: 1
			},
			// showBrushPanel: true,
			tab: null,
			viewerMode: 'orbit',
			viewerModeItems: ['turntable', 'orbit'],
			viewerFlipX: false,
			viewerFlipY: false,
			viewerFOV: 90,
			viewerAO: 100,
			viewerAL: 100,
			viewerSpotlight: 100,
			viewerLightRotation: 0, 

			textureDimList: [
				{text: '512x512', value: 512},
				{text: '1024x1024', value: 1024},
				{text: '2048x2048', value: 2048},
				{text: '4096x4096', value: 4096},
				{text: '8192x8192', value: 8192},
				// {text: '16384x16384', value: 16384},
			],
			textureRes: 2048,
			// spotlightImgSrc: null,
			// spotlightImg: null,
			// spotlightVertices: [],
			// spotlightWrappedVertices: [],
			// spotlightIndeces: [],
			// spotlightVertexUVs: [],
			// spotlightUVs: [],
			spotlightTool: 0,

			editingBrushStampOpacity: false,
			editingBrushSize: false,
			editingBrushIntensity: false,
			editingBrushGap: false,
			editingBrushOffset: false,
			editingBrushAlign: false,
			editingBrushRotation: false,
			editingBrushHue: false,
			editingBrushSaturation: false,
			editingBrushLuminance: false,
			// stampOpacity: [1, 10],
			// brushSize: [100, 100],
			// brushGap: [0, 0],
			// brushAlign: [0, 0],
			// brushRotation: [0, 0],
			// brushHue: [0, 0],
			// brushSaturation: [0, 0],
			// brushLuminance: [0, 0],
			// pressure: {
			// 	flow: null,
			// 	opacity: null,
			// 	size: null,
			// 	gap: null,
			// 	align: null,
			// 	rotation: null,
			// 	hue: null,
			// 	saturation: null,
			// 	luminance: null,
			// },
			blendModes: ['Normal', 'Dissolve', 'Behind', 'Clear', 'Darken', 'Multiply', 
						'Color Burn', 'Linear Burn', 'Lighten', 'Screen', 'Color Dodge', 
						'Linear Dodge (Add)', 'Overlay', 'Soft Light', 'Hard Light', 
						'Vivid Light', 'Linear Light', 'Pin Light', 'Hard Mix', 
						'Difference', 'Exclusion', 'Subtract', 'Divide', 
						'Hue', 'Saturation', 'Color', 'Luminosity', 'Lighter Color', 'Darker Color'],
			activeBlendMode: 'Normal',
			activeLayerOpacity: 100,
			activeChannelSolo: false,
			activeChannel: 'color',
			activeGeomName: '',
			// channelList: ['color', 'metallic', 'roughness', 'normal', 'emissive' /* , 'ambient occlusion' */],
			channelLayers: {
				selectedLayerIdx: 0,
				'color': [
					// instead of a singular 'textureIdx' use plural 'textureIdxs' to account for multi-object scenes.
					{vddlid: 0, label: 'layer0', textureIdx: 0, opacity: 100, visible: true, selected: true, mode: 'normal'},
				],
				'metallic': [ {id: 0, label: 'layer0', visible: true, selected: true, mode: 'normal'}, ], 
				'roughness': [ {id: 0, label: 'layer0', visible: true, selected: true, mode: 'normal'}, ], 
				'normal': [ {id: 0, label: 'layer0', visible: true, selected: true, mode: 'normal'}, ], 
				'emissive': [ {id: 0, label: 'layer0', visible: true, selected: true, mode: 'normal'}, ], 
				'ambient occlusion': [ {id: 0, label: 'layer0', visible: true, selected: true, mode: 'normal'}, ]
			},
			// activeLayerList: []
		}
	}
	,watch: 
	{
		spotlightTool(newVal) { this.setActiveSpotlightTool(newVal) },
		currentColor(newVal) 
		{
			this.setPickedColor(this.currentColor.rgba)
		},

		activeChannel(newVal)
		{
			if (newVal == this.$store.getters.activeChannel)
				return;
			_vm_.$emit('reordered-texture-layer', 0);

			this.setActiveChannel(newVal);
			this.textureRes = this.getActiveChannelDimension();
			_vm_.$emit('changeActiveChannel', newVal);
			
			// this.$refs.texRes.$forceUpdate()
		},

		activeChannelSolo(newVal)
		{
			this.setCurrentChannelSolo(!!newVal)
		},

		tab(newVal)
		{
			log(newVal);
		},

		activeGeomIdx(newVal)
		{
			this.activeGeomName = this.geomNames[newVal];
		},

		activeGeomName(newVal)
		{
			this.setActiveGeomIdx(this.geomNames.indexOf(newVal))
		},

		textureRes(newVal)
		{
			// if (newVal != this.$store.state.textureDim)
			// if (newVal != this.getActiveChannelDimension())
			// if (newVal != this.channelDimension(this.$store.state.channels.current))
			if (newVal != this.channelDimension(this.$store.getters.activeChannel))
			{
				// this.setTextureDim(newVal)
				_vm_.$emit('resizeTextures', {value: newVal});
				this.setActiveChannelDimension(newVal)
			}
			else
			{
				log('set textureRes: '+newVal+' is same as before')
			}
		},

		activeLayerOpacity(newVal)
		{
			this.activeChannelSelectedLayer.opacity = newVal;
			this.onReorderedLayer(this.channelLayers.selectedLayerIdx);
		},

		viewerAO(newVal)
		{
			window._vm_.$emit('viewerAO', newVal*0.01);
		},

		viewerAL(newVal)
		{
			window._vm_.$emit('viewerAL', newVal*0.01);
		},

		viewerLightRotation(newVal)
		{
			const TO_RADIANS = Math.PI / 180.0;
			var sin = Math.sin(newVal * TO_RADIANS);
			var cos = Math.cos(newVal * TO_RADIANS);
			// log(sin);
			this.setLightDirection([cos, sin, 0]);
		},

		viewerFOV(newVal)
		{
			window._vm_.$emit('viewerFOV', newVal*(Math.PI / 180.0));
		},

		viewerMode(newVal)
		{
			// log(newVal);
			window._vm_.$emit('viewerMode', newVal);
		},

		viewerFlipX(newVal)
		{
			// log(newVal);
			window._vm_.$emit('viewerFlipX', newVal);
		},

		viewerFlipY(newVal)
		{
			// log(newVal);
			window._vm_.$emit('viewerFlipY', newVal);
		},
	}
	,computed: {
		// don't use computed properties for textureRes, because it is always cached
		// textureRes: {
		// 	// get() { return this.$store.state.textureDim; }, 
		// 	get() { return this.getActiveChannelDimension(); }, 
		// 	set(val) 
		// 	{
		// 		// if (val != this.$store.state.textureDim)
		// 		if (val != this.getActiveChannelDimension())
		// 		{
		// 			// this.setTextureDim(val)
		// 			_vm_.$emit('resizeTextures', {value: val});
		// 			this.setActiveChannelDimension(val)
		// 		}
		// 		else
		// 		{
		// 			log('set textureRes: '+val+' is same as before')
		// 		}
		// 	}
		// },
		showIntensitySlider() { return this.$store.state.activeToolName=='eraser' || (this.activeChannel!='color' && this.activeChannel!='emissive')},
		showSpotlightTool() { return (this.$store.state.activeModeName=='spotlight') },
		showOrbitTool() { return (this.$store.state.activeModeName!='spotlight' && this.$store.state.activeToolName=='orbit') },
		showBrushTool() { return (this.$store.state.activeModeName!='spotlight' && this.$store.state.activeToolName!='orbit') },
		activeLayerList: {
			get() {return this.activeChannelLayers}, 
			set(value) {
					this.setChannelLayers({layers: value});
				} 
		},
		selectedCount() { return this.activeChannelLayers.filter(l => l.selected).length },
		stampOpacity: {get() { return this.$store.state.brush.stampOpacity}, set(val){ this.setBrushStampOpacity(val); this.updateStroke() }},
		brushIntensity: {get() { 
				return Math.round(this.$store.state.brushColor[0]*100)
			}, 
			set(val){ 
				var c = val*2.55; 
				this.setPickedColor({r:c,g:c,b:c,a:1.0} ); 
				this.updateStroke() }},
		brushSize: {get() { return this.$store.state.brush.size}, set(val){ this.setBrushSize(val); this.updateStroke() }},
		brushGap: {get() { return this.$store.state.brush.gap}, set(val){ this.setBrushGap(val); this.updateStroke() }},
		brushOffset: {get() { return this.$store.state.brush.offset}, set(val){ this.setBrushOffset(val); this.updateStroke() }},
		brushAlign: {get() { return this.$store.state.brush.align}, set(val){ this.setBrushAlign(val); this.updateStroke() }},
		brushRotation: {get() { return this.$store.state.brush.rotation}, set(val){ this.setBrushRotation(val); this.updateStroke() }},
		brushHue: {get() { return this.$store.state.brush.hue}, set(val){ this.setBrushHue(val); this.updateStroke() }},
		brushSaturation: {get() { return this.$store.state.brush.saturation}, set(val){ this.setBrushSaturation(val); this.updateStroke() }},
		brushLuminance: {get() { return this.$store.state.brush.luminance}, set(val){ this.setBrushLuminance(val); this.updateStroke() }},
		pressureFlow: {get() { return this.$store.state.brush.pressure.flow}, set(val){ this.setBrushPressureFlow(val) }},
		pressureOpacity: {get() { return this.$store.state.brush.pressure.opacity}, set(val){ this.setBrushPressureOpacity(val) }},
		pressureSize: {get() { return this.$store.state.brush.pressure.size}, set(val){ this.setBrushPressureSize(val) }},
		pressureGap: {get() { return this.$store.state.brush.pressure.gap}, set(val){ this.setBrushPressureGap(val) }},
		pressureOffset: {get() { return this.$store.state.brush.pressure.offset}, set(val){ this.setBrushPressureOffset(val) }},
		pressureAlign: {get() { return this.$store.state.brush.pressure.align}, set(val){ this.setBrushPressureAlign(val) }},
		pressureRotation: {get() { return this.$store.state.brush.pressure.rotation}, set(val){ this.setBrushPressureRotation(val) }},
		pressureHue: {get() { return this.$store.state.brush.pressure.hue}, set(val){ this.setBrushPressureHue(val) }},
		pressureSaturation: {get() { return this.$store.state.brush.pressure.saturation}, set(val){ this.setBrushPressureSaturation(val) }},
		pressureLuminance: {get() { return this.$store.state.brush.pressure.luminance}, set(val){ this.setBrushPressureLuminance(val) }},
		...mapState(['activeGeomIdx', 'activeToolName', 'activeModeName', 'activeSpotlightTool', 'spotlightImgSrc', 'channelList', 'geomNames', 'meshLoaded', 'loadedBrushStamps', 'activeBrushStampIdx', 'brushColor']),
		...mapGetters([
					'activeBrushStamp',
					'getLayerData',
					'layerDataCount',
					'activeChannelSelectedLayer',
					'getChannelLayers',
					'getActiveChannelDimension',
					// 'activeChannel',
					'getActiveChannelTextureName',
					'getActiveChannelIndex',
					'channelDimension',
					'activeChannelLayers'
					])
	}
	,methods: 
	{
		onChange(e) 
		{
			e.target.dispatchEvent(new Event('change'))
		},
		isNumber(val) { return window.isNumber(val) },
		refresh()
		{
			log('refresh()')
			const callback = () =>
			{
				for (var key in this.$refs)
				{
					if (this.$refs[key] && this.$refs[key].refresh)
					{
						log('refreshing '+key);
						this.$refs[key].refresh()
					}
				}
				this.currentColor.rgba = [ this.brushColor[0]*255, this.brushColor[1]*255, this.brushColor[2]*255, this.brushColor[3] ];
				if (this.$refs.colorWidget)
				{
					this.$refs.colorWidget.inputChange({
						r: this.currentColor.rgba[0], 
						g: this.currentColor.rgba[1], 
						b: this.currentColor.rgba[2], 
						a: this.currentColor.rgba[3], 
					});

					if (this.$store.state.activeToolName=='eraser' || 
						this.$store.state.activeToolName=='smear')
					{
						this.$refs.colorWidget.inputChange({s: '0%'})
					}
					// this.$refs.colorWidget.$forceUpdate();
				}
				// this.$refs.colorWidget.rgba.r = this.currentColor.rgba[0];
				// this.$refs.colorWidget.rgba.g = this.currentColor.rgba[1];
				// this.$refs.colorWidget.rgba.b = this.currentColor.rgba[2];
				// this.$refs.colorWidget.rgba.a = this.currentColor.rgba[3];
			};
			setTimeout(callback, 50)
			setTimeout(callback, 800)
		},

		showBrushImageDialog()
		{
			_vm_.$emit('show-brush-image-dialog');
		},

		showBrushStrokePresetDialog()
		{
			_vm_.$emit('show-brush-stroke-preset-dialog');
		},

		updateStroke()
		{
			_vm_.$emit('update-brush-stroke-preview', this.$refs.strokePreview);
		},

		onWillSelectLayer(index)
		{
			log('will-select-texture-layer', index)
			_vm_.$emit('will-select-texture-layer', index)
		},

		onReorderedLayer(index)
		{
			log('reordered-texture-layer', index)
			_vm_.$emit('reordered-texture-layer', index)
		},

		onSelectedLayer(index)
		{
			this.channelLayers.selectedLayerIdx = index;
			this.activeLayerOpacity = this.activeChannelSelectedLayer.opacity;
			// log('on selected layer index '+index);
			log('selected-texture-layer', index)
			_vm_.$emit('selected-texture-layer', index)
		},

		onLoadLayer(file)
		{
			log('onLoadLayer ', file)

			if (this.activeLayerList.length >= 6)
			{
				log('error: cannot add more layers');
				return;
			}

			var dataTex = new DataTexture();
			if (file.name.toLowerCase().indexOf('.jpg') > -1 || file.name.toLowerCase().indexOf('.jpeg') > -1
				// || file.name.toLowerCase().indexOf('.png') > -1
				)
			{
				var reader  = new FileReader();
				var img = new Image();

				img.onload = (e) =>
				{
					var potSize = this.getActiveChannelDimension();
					dataTex.label = file.name;

					_vm_.$emit('resizeDataTex', {dataTex: dataTex, radius: potSize, image: img});
					this.$nextTick(()=>{
						this.addLayer(dataTex);
					})
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
			else if (file.name.toLowerCase().indexOf('.png') > -1)
			{
				dataTex.readFromPNGFile(file)
					.then(()=>{
						log(`loaded texture "${file.name}"`);
						// if (dataTex.potSize != this.getActiveChannelDimension() || 
						// 	dataTex.width != dataTex.potSize || 
						// 	dataTex.height != dataTex.potSize)
						{
							var potSize = this.getActiveChannelDimension();

							_vm_.$emit('resizeDataTex', {dataTex: dataTex, radius: potSize, flipY: true});
							this.$nextTick(()=>{
								this.addLayer(dataTex);
							})
						}
					})
					.catch( (error)=>{
						log(`Error loading texture "${file.name}": ${error}`);
					} );
			}
			
		},

		addLayer(dataTex)
		{
			var idx = this.channelLayers.selectedLayerIdx;
			var texIdx = this.layerDataCount;
			this.createLayerData();
			this.setLayerData({
							index: texIdx, 
							data: dataTex, 
							channel: this.activeChannel
						});
			var layer = {
					vddlid: new Date().getTime(), 
					label: dataTex.label ? dataTex.label.substring(0, 34) : 'layer'+this.activeLayerList.length, 
					textureIdx: texIdx, 
					layerUUID: new Date().getTime(), 
					opacity: 100,
					selected: true,
					visible: true,
					editingLabel: false,
					mode: 'normal'
				};
			var newList = this.activeLayerList.slice(); // clone the array
			newList.forEach((el, idx) => {el.selected = false} )
			newList.splice(idx, 0, layer);
			this.activeLayerList = newList;
			// idx--;
			_vm_.$emit('reordered-texture-layer', idx);
			return idx;
		},

		cmdAddLayer()
		{
			log('cmd add-layer')

			this.onWillSelectLayer(idx)


			if (this.activeLayerList.length >= 6)
			{

			}
			var isNormal = this.getActiveChannelTextureName() == 'normalTex';
			var tex = new DataTexture({
				width: this.getActiveChannelDimension(),
				height: this.getActiveChannelDimension(),
				format: 'rgba',
				type: isNormal ? 'float' : 'uint8',
				mag: 'linear',
				min: isNormal ? 'linear' : 'mipmap',
				wrap: 'clamp'
			});
			tex.alloc(isNormal);

			var idx = this.addLayer(tex);

			// this.$refs.layerList.$forceUpdate();
			// this.$refs.layerList.select({}, idx);
			this.onSelectedLayer(idx);

			// log(this.activeLayerList);
			// log(newList);
		},

		cmdRemoveLayer()
		{
			var idx = 0;
			var i = 0;
			// var removed = [];
			var textureIndex = 0;
			var newList = this.activeLayerList.slice(); // clone the array
			while (i < newList.length)
			{
				if (newList.length < 2) break;
				if (newList[i].selected)
				{
					textureIndex = newList[i].textureIdx;
					this.deleteLayerData(textureIndex);

					// removed.push(textureIndex);
					newList.splice(i, 1)
				}
				else
					i++
			}
			newList[0].selected = true;
			this.activeLayerList = newList;
			this.channelLayers.selectedLayerIdx = Math.min(newList.length-1, this.channelLayers.selectedLayerIdx);
			_vm_.$emit('reordered-texture-layer', idx)
		},

		cmdMergeLayers()
		{
			var idx = 0;
			var i = 0;
			var textureIndex = 0;

			_vm_.$emit('merge-selected-texture-layers');
			var selectedCount = this.activeLayerList.filter(l => l.selected).length;

			while (i < this.activeLayerList.length && selectedCount > 1)
			{
				if (this.activeLayerList[i].selected)
				{
					textureIndex = this.activeLayerList[i].textureIdx;
					this.deleteLayerData(textureIndex);

					this.activeLayerList.splice(i, 1)
					selectedCount--;
				}
				else
					i++
			}
		},

		cmdLoadLayer()
		{
			this.$refs.layerDropArea.openFileDialog();
		},

		clampBrushIntensity(value) 
		{
			if (!isNumber(value))	return;
			this.brushIntensity = clamp(value, 0, 100);
		},

		clampBrushSize(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushSize(clamp(value, 0, 500));
		},
		clampBrushStampOpacity(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushStampOpacity(clamp(value, 0, 100));
		},
		clampBrushGap(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushGap(clamp(value, 0, 100));
		},
		clampBrushOffset(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushOffset(clamp(value, -100, 100));
		},
		clampBrushAlign(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushAlign(clamp(value, 0, 100));
		},
		clampBrushRotation(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushRotation(clamp(value, -360, 360));
		},
		clampBrushHue(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushHue(clamp(value, -100, 100));
		},
		clampBrushSaturation(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushSaturation(clamp(value, -100, 100));
		},
		clampBrushLuminance(value) 
		{
			if (!isNumber(value))	return;
			this.setBrushLuminance(clamp(value, -100, 100));
		},
		// viewerSetMode(event)
		// {
		// 	log(event)
		// },

		...spotlightMethods,

		...mapMutations([
					// 'setTextureDim',
					'setActiveChannelDimension',
					'setSpotlightImgSrc',
					'setSpotlightImg',
					'setActiveSpotlightTool',
					'setPickedColor',
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
					'createLayerData',
					'deleteLayerData',
					'setLayerData',
					'setChannelLayers',
					'setActiveChannel',
					'setActiveGeomIdx',
					'setLightDirection',
					'setCurrentChannelSolo'
					])
	}
	,components: {
		'color-picker': Chrome,
		// 'color-picker': Sketch,
		// 'color-picker': Photoshop,
		'slider': Slider,
		'layer-list': LayerList,
	}
	,mounted () 
	{
		this.setPickedColor(this.currentColor.rgba);
		this.setBrushStampOpacity(this.stampOpacity);
			this.refresh()

		this.activeLayerList = this.channelLayers['color'];

		window._vm_.$on('setColor', (payload)=>
		{
			// log(JSON.stringify(payload))
			// this.$refs.colorWidget.inputChange(payload);
			payload.source = 'rgba'
			this.$refs.colorWidget.colorChange(payload);
		});

		_vm_.$on('switch-tab', (tab) => this.tab = tab);
		_vm_.$on('layerDropped', this.onLoadLayer);
		_vm_.$on('objectParsed', ()=>{this.activeGeomName = this.geomNames[0];})
		_vm_.$on('refresh-brush', ()=>{this.refresh();})
	}
}
</script>


<style lang="scss">
aside {
	display: block;
	position: relative;
	// min-width: 350px;
	width: 350px;
	flex: 0 0 auto;
	// flex-basis: 350px;
	// flex-grow: 0;
	// flex-shrink: 0;
	height: 100vh;
	background: #424242;
}

.vue-slider-component {
	// width: calc(100% - 24px);
	// margin-bottom: 32px;
	margin-bottom: 12px;
}

.title-toggle-btn {
	// width: 24px;
	height: 24px !important;
	padding: 0 !important;
	margin: 0;

	.tool-icon {
		// width: 22px;
		height: 22px;
		pointer-events: none;
		background-size: 22px
	}
}

aside .card:hover {
	background-color: #484848;
}

aside .label  {
	display: inline-block;
	font-family: sans-serif;
	font-weight: normal;
	font-size: 1em;
	color: rgba(255, 255, 255, 0.8);
	vertical-align: middle;
	align-self: center;

	span {
		display: inline-block;
		vertical-align: bottom;

		&:first-child {	white-space: pre-wrap; }
	}
	span.range {
		cursor: pointer;
	}

	.input-group__input {
		min-height: 20px;
		height: 20px;

		.input-group--text-field__suffix {
			font-size: 14px
		}
	}

	.input-group {
		padding: 0;
		width: 80px;
		height: 20px;
		font-size: 14px;

		input {
			font-size: 14px;
			text-align: center;
			height: 20px;
			caret-color: #82b1ff !important;
		}

		.input-group__details { min-height: 1px; padding: 0; color: #82b1ff !important; }
		.input-group__messages { 
			display: none;
			padding: 0;
			min-height: 0;
		}
	}
}

aside .vue-slider-component .vue-slider-tooltip {
	font-size: 12px;
	padding: 1px 3px;
	// border: 1px solid rgba(52, 152, 219, 0.373);
	// background-color: rgba(52, 152, 219, 0.373);
}

aside {

	.spotlight-img-drop {

		display: block;
		position: relative;
		background-size: contain;
		width: 100%;
		height: 250px;

		img {
			display: inline-block;
			position: absolute;
			height: auto;
			width: auto;
			max-width: 100%;
			max-height: 250px;
			margin: auto;
			left: 0;
			right: 0;
			top: 0;
			bottom: 0;
		}

		.icon {
			display: block;
			position: absolute;
			width: 100%;
			height: 100%;
			left: 0;
			top: 0;
			background-image: url('/img/drop-img.svg');
			background-repeat: no-repeat;
		}

		img ~ .icon {
			opacity: 0;
		}

		&.dragging .icon {
			display: block;
			opacity: 1;
		}

		&.dragging img {
			opacity: 0.5
		}

	}

	.tabs__container {
		height: 32px
	}

	// .tabs__items, .tabs__content {
	// 	height: 100%;
	// }

	.tabs .vb, .expansion-panel {
		height: calc(100vh - 32px);
	}

	.tab-transition-leave, .tab-transition-leave-active, .tab-transition-leave-to, .tab-reverse-transition-enter, .tab-reverse-transition-enter-active, .tab-reverse-transition-enter-to {
		.vb { width: 100% }
		.vb > .vb-dragger { right: 0; }
		.vb-content { overflow: hidden !important; 	}
	}

	.stroke-preview-wrapper
	{
		position: relative;
		width: 320px;
		height: 140px;

		.invisible
		{
			visibility: hidden;
		}

		.stamp 
		{
			display: inline-block;
			position: relative;
			width: 140px;
			height: 140px;
			background-size: contain;
			background-position: center center;
		}

		.buttons 
		{
			max-width: 120px;
			justify-content: space-evenly;
		}

		button
		{
			font-family: inherit;
			font-size: 14px;
			font-weight: 500;
		}

		.btn, .btn__content
		{
			transition: none;
		}

		.stamp-wrapper
		{
			display: inline-block;
			position: relative;
			width: 140px;
			height: 140px;
		}

		.stamp-overlay
		{
			// display: block;
			position: absolute;
			left: 0;
			top: 0;
			right: 0;
			bottom: 0;
			visibility: hidden;
			justify-content: space-evenly;

			&.visible 
			{
				visibility: visible;
			}
		}

		&:hover 
		{
			.stroke-preview 
			{
				visibility: hidden;
			}

			.stamp-overlay 
			{
				visibility: visible;
			}
		}
	}

	.stroke-preview, .stamp-wrapper {
		background: url('/img/checker-darker.png') repeat
	}

	.vue-slider-component .vue-slider {
		background-color: rgb(109, 109, 109);
	}

	.vue-slider-component .vue-slider-process {
		background-color: #d6d6d6;
	}

	// .tab-layers 
	.input-group--select .input-group__selections { justify-content: center; }

	.layer-box {
		border: 1px solid #676767;

		.drop-area .border {
			$gap: 1em;
			left: $gap;
			right: $gap;
			top: $gap;
			bottom: $gap;
			border-width: 3px;
			border-radius: 10px
		}

		.drop-wrapper.dragging {
			.vddl-draggable {
				opacity: 0;
				pointer-events: none;
			}
		}
	}

	.btn {
		min-width: 10px;
	}

	// .btn__content {
	// 	padding: 0;
	// }

	.btn--disabled .btn__content .tool-icon {
		opacity: 0.5;
	}

}

aside .btn-toggle {
	border: 1px solid transparent;
}
aside .btn-toggle .btn {
	// padding: 0px 8px;
}

aside .btn-toggle--selected {
	box-shadow: none;
	border: 1px solid #c9c9c9;

	.title-toggle-btn {
		// width: 22px;
		// height: 22px;

		.tool-icon {
			// height: 22px;
		}
	}
}

</style>




