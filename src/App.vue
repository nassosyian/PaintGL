<template lang="pug">
	v-app#app
		.flex.row
			.flex.column.main-area(column)
				v-toolbar.align-start(dark dense height="32px" style="height:32px;")
					v-toolbar-items

						dropdown( :trigger="'hover'" )
							v-btn(dark small depressed slot="btn") Document
							v-list(slot="body")
								v-list-tile(@click="cmdDocLoadObj" v-shortkey="['ctrl', 'l']" @shortkey.native="cmdDocLoadObj" )
									v-list-tile-title Load FBX
								v-list-tile(@click="showSamplesDialog = true")
									v-list-tile-title Load Sample
								v-divider
								v-list-tile(@click="cmdCanvasClearUndos"  :disabled="undoActionCount <= 0")
									v-list-tile-title Clear Undos
								v-divider
								v-list-tile()
									dropdown( :trigger="'hover'" :role="'sublist'" :align="'right'")
										v-list-tile-title(dark small depressed slot="btn") Export Channel
										v-list(slot="body")
											v-list-tile(@click="cmdExportChannel('color')"): v-list-tile-title Color
											v-list-tile(@click="cmdExportChannel('metallic')"): v-list-tile-title Metallic
											v-list-tile(@click="cmdExportChannel('roughness')"): v-list-tile-title Roughness
											v-list-tile(@click="cmdExportChannel('normal')"): v-list-tile-title Normal
											v-list-tile(@click="cmdExportChannel('emissive')"): v-list-tile-title Emissive

						dropdown( :trigger="'hover'" )
							v-btn(dark small depressed slot="btn") Help
							v-list(slot="body")
								v-list-tile(@click="cmdShowAbout" )
									v-list-tile-title Info
								v-list-tile(@click="cmdGithub"   )
									v-list-tile-title Github page
								v-list-tile(@click="cmdAboutDev"   )
									v-list-tile-title About the developer



					v-spacer
					v-toolbar-items.undo-redo
						v-btn-toggle()
							v-btn.icon-btn(flat :disabled="undoActionCount == 0" @click="cmdUndo" v-shortkey="['ctrl', 'z']" @shortkey.native="cmdUndo" title="Undo [ctrl-z]" v-tippy)
								v-icon undo
								span(v-if="undoActionCount > 0") {{undoActionCount}}
							v-btn.icon-btn(flat :disabled="redoActionCount == 0" @click="cmdRedo" v-shortkey="['ctrl', 'y']" @shortkey.native="cmdRedo" title="Redo [ctrl-y]" v-tippy)
								v-icon redo
								span(v-if="redoActionCount > 0") {{redoActionCount}}
								
					v-toolbar-items(style="margin-left: 32px")
					v-toolbar-items(:class="{invisible: showTools}")
						v-btn-toggle(v-model="activeToolIdx"  v-shortkey="{'1':['1'], '2':['2'], '3':['3'], '4':['4'], '5':['5'], '6':['6'], '7':['7']}" @shortkey.native="cmdToolShortcut")
							v-btn.icon-btn(flat title="Orbit/Pan/Zoom  [1]" v-tippy)
								span.tool-icon.icon-orbit
							v-btn.icon-btn(flat title="Color Picker  [2]" v-tippy)
								span.tool-icon.icon-color-picker
							v-btn.icon-btn(flat title="Paint bursh  [3]" v-tippy)
								span.tool-icon.icon-brush
							v-btn.icon-btn(flat title="Smear brush  [4]" v-tippy)
								span.tool-icon.icon-smear
							v-btn.icon-btn(flat title="Stamp image  [5]" v-tippy)
								span.tool-icon.icon-stamp
							v-btn.icon-btn(flat :disabled="disableErase" title="Eraser brush  [6]" v-tippy)
								span.tool-icon.icon-eraser
					v-spacer
					v-toolbar-items
						h3(style="line-height: 32px;pointer-events:none;") PaintGL

				drop-file.flex.column.align-stretch( :enableClick="true" ref="dropArea" types=".fbx" )
					v-flex.start-panel(xs12 sm6 :style="{display: meshLoaded ? 'none' : 'block'}")
						v-btn(xs12  dark large color="primary" @click.stop.prevent="showSamplesDialog = true") Load sample object
						h4(style="display:block; color: grey; text-align:center") or

					.drop-area
						.border
							.msg Drop file here
						.icon(v-show="showDropIcon" :style="{display: meshLoaded ? 'none' : 'block'}")
					paint-surface-2d.flex.column.align-stretch(:class="{invisible: !meshLoaded}" ref="paintsurf")
			side-bar
			v-dialog(v-model="showLoadingDialog" persistent max-width="290")
				v-card
					v-card-title.headline 
					v-progress-circular(:indeterminate="progressPercent==0" :value="progressPercent > 0 ? progressPercent : 50" :size="50" :rotate="progressPercent > 0 ? -90: 0" color="primary darken-2") {{ progressPercent==0 ? '' : progressPercent+'%' }}
					v-card-text {{loadingMsg}}
			v-dialog(v-model="showMessageDialog" persistent max-width="290")
				v-card
					v-card-title.headline  {{dialogMsgTitle}}
					v-card-text {{dialogMsgText}}
					v-card-actions()
						v-layout(row justify-center)
							v-btn(@click="showMessageDialog = false") Close
			v-dialog(v-model="showSamplesDialog" max-width="680px")
				v-card.sample-dialog(:class="{disabled: !showSamplesDialog}")
					v-toolbar(card dark)
						v-toolbar-title click on the sample to load...
						v-spacer
						v-toolbar-items
						v-btn(icon @click="showSamplesDialog = false" dark): v-icon close
					v-card-text
						v-layout(row)
							v-flex(column)
								img(:src="_baseUrl + 'assets/angel.png'" width="200px" height="200px" data-fbx="angel" @click.stop.prevent="(e) => cmdLoadSample(e)")
								a(:href="_baseUrl + 'assets/angel.fbx'") download link
							v-flex(column)
								img(:src="_baseUrl + 'assets/buddha.png'" width="200px" height="200px" data-fbx="buddha" @click.stop.prevent="(e) => cmdLoadSample(e)")
								a(:href="_baseUrl + 'assets/buddha.fbx'") download link
							v-flex(column)
								img(:src="_baseUrl + 'assets/dragon.png'" width="200px" height="200px" data-fbx="dragon" @click.stop.prevent="(e) => cmdLoadSample(e)")
								a(:href="_baseUrl + 'assets/dragon.fbx'") download link
		v-dialog(v-model="showAboutDialog" max-width="800px" scrollable transition--="none")
			v-card.brush-dialog(:class="{disabled: !showAboutDialog}")
				v-toolbar(card dark)
					v-toolbar-title Welcome to PaintGL!
					v-spacer
					v-toolbar-items
					v-btn(icon @click="showAboutDialog = false" dark): v-icon close
				v-card-text
					v-container()
						.align-left
							h2 version 0.1:
							p This is the first version of #[strong PaintGL], a realtime #[strong PBR 3D painting] web-app. (proof-of-concept)
							ol
								li Can paint in the color, metallic, roughness, normal and emissive channels in realtime.
								li Pressure sensitive brushes (requires tablet).
								li Customisable brush image, color, size, flow, gap, offset, alignment, rotation, hue, saturation, luminance.
								li Multiple layers per channel. 
								li Texture export of the color, metallic, roughness, normal and emissive channels.
								li 16-bit color import/export for the normal channel.
								li Automatically dilates the texture to avoid uv gaps.
							h3 #[br]
							p NOTES:
							ul
								li When trying to enter a single value for the brush parameters, click on the number to input a number.
								li Hover over the brush preview to change its image.
								li The eraser tool is only enabled on layers above the bottom one.
								li The smear tool works best with "Gap: 0px"
								li Wacom tablets on Windows have confict issues with Win Pen & Touch. Avoid pressing-and-holding (pop-up menu appears). If you experience more problems, #[a(href="http://www.designimage.co.uk/how-to-remove-the-annoying-wacom-circles-in-windows/" target="_blank" rel="external nofollow") this] or #[a(href="http://viziblr.com/news/2013/6/23/the-windows-and-wacom-tablet-nightmare-is-over.html" target="_blank" rel="external nofollow") this] link might help.
								li Rougness, by-default, is already at 100%. you need to use Intensity => 0% to make it visible when painting.
								li If you load a scene with multiple objects you need to select the active object from the drop-down menu of the 'Layers' tab.
								li Sometimes the 'Open file' dialog does not register the selected file and does nothing. Try again a second time. You should see a 'loading' spinner pop-up.
								li Overlapping UVs cause unpredictable behavior. Best avoid them.
								li If a slider gets glitchy and keeps snapping to 100%, switch to another tab and then switch back.



</template>

<script>
import store from './store/index.js'
import { mapState, mapMutations, mapGetters } from 'vuex'
import SideBar from './components/SideBar.vue'
import WebGL from './components/WebGL.vue'
import PaintSurface2D from './components/PaintSurface2D.vue'
const Cookies = require('js-cookie');

export default {
	name: 'app',
	store,
	components: 
	{
		// 'drop-file': DropFile,
		'side-bar': SideBar,
		'webgl': WebGL,
		'paint-surface-2d': PaintSurface2D,
		// 'paint-surface-3d': PaintSurface3D,
		// 'chrome-picker': Chrome
	},
	data() {
		return {
			progress: 0,
			showLoadingDialog: false,
			showMessageDialog: false,
			showSamplesDialog: false,
			showAboutDialog: false,
			dialogMsgTitle: '',
			dialogMsgText: '',
			loadingMsg: 'loading...',
			activeToolIdx: 0,
			activeModeIdx: 0,
			toolNames: [/*'select',*/ 'orbit', 'color-picker', 'brush', 'smear', 'stamp', 'eraser'/* , 'roller' */],
			modeNames: ['canvas', 'mask', 'spotlight'],
		};
	},
	watch: 
	{
		activeToolIdx(newValue) 
		{
			this.$store.commit('setActiveToolName', this.toolNames[newValue]);
		},
		activeModeIdx(newValue) 
		{
			this.$store.commit('setActiveModeName', this.modeNames[newValue]);
		}
	},
	computed: 
	{
		_baseUrl() { return window._baseUrl; },
		showTools()	{	return (this.$store.state.activeModeName=='spotlight');	},
		showDropIcon()
		{
			return !(this.processingMeshState > 0);
		},
		disableErase() 
		{
			var layers = this.getChannelLayers();
			if (layers.length <= 1)	return true;
			if (layers[layers.length-1].selected) return true;
			return false;
		},
		progressPercent() { return Math.floor(this.progress); },
		...mapState(['meshLoaded']),
		...mapGetters([
						'currentAction',
						'undoAction',
						'redoAction',
						'hasNoUndoActions',
						'hasNoRedoActions',
						'undoActionCount',
						'redoActionCount',
						'getChannelLayers'
					])
	},
	methods: 
	{
		updateProgress(e)
		{
			// log(e)

			this.progressPercent = e;
		},
		cmdToolShortcut(e)
		{
			// log('pressed ' + e.srcKey);
			var idx = parseInt(e.srcKey) || 0;
			idx = Math.max(idx-1, 0)
			if (idx < this.toolNames.length)
			{
				if (idx == 5)
				{
					if (!this.disableErase())
						this.activeToolIdx = idx;
				}
				else
					this.activeToolIdx = idx;
				
				// this.$nextTick( ()=> {
				// 	this.$store.commit('setActiveToolName', this.toolNames[idx]);
				// })
					// this.activeToolIdx = idx;
			}

			// const idx = [].slice.call(e.target.parentNode.children).indexOf(e.target);
			// log('pressed ' + (idx+1));
		},
		cmdDocNew2D() 
		{
			window._vm_.$emit('cmdDocNew2D');
		},
		cmdDocNew3D() 
		{
			window._vm_.$emit('cmdDocNew3D');
		},
		cmdShowAbout() 
		{
			this.showAboutDialog = true;
		},
		cmdGithub()
		{
			var win = window.open('https://github.com/nassosyian/PaintGL', '_blank');
			win && win.focus();
		},
		cmdAboutDev()
		{
			var win = window.open('http://www.nassosyian.net/cv', '_blank');
			win && win.focus();
		},
		// dispatchLoadObj()
		// {
		// 	var event = new KeyboardEvent('keydown', {
		// 		key: 'l', ctrlKey: true, code: 'l'.charCodeAt(0)
		// 	});
		// 	// window.dispatchEvent(event)
			
		// 	document.dispatchEvent(event)
		// 	// window._vm_.$emit('cmdDocLoadObj');

		// },
		cmdDocLoadProject()
		{

		},
		cmdDocLoadObj() 
		{
			// log('cmdDocLoadObj')
			// // debugger;
			// // setTimeout(() => {
			// // this.$nextTick(() => {
				this.$refs.dropArea.openFileDialog();
			// // });
			// // }, 1000);
			// this.$refs.dropArea.click();
		},

		cmdLoadSample(e)
		{
			// log('load sample ', e);
			var name = e.target.getAttribute('data-fbx') || '';
			log('load sample ', name);
			
			// TODO: download file

			// TODO: load it
			this.showSamplesDialog = false;
			_vm_.$emit('open-url-file', _baseUrl+`assets/${name}.fbx`);
			
		},

		cmdDocSave() 
		{
			window._vm_.$emit('cmdDocSave');
		},
		cmdDocSaveProject() 
		{
			window._vm_.$emit('cmdDocSaveProject');
		},

		cmdExportColor()
		{
			window._vm_.$emit('cmdExportColor');
		},

		cmdExportChannel(name)
		{
			window._vm_.$emit('cmdExportChannel', name);
		},
		cmdCanvasFlipH() 
		{
			log('emiting cmdCanvasFlipH')
			window._vm_.$emit('cmdCanvasFlipH');
		},
		cmdCanvasFlipV() 
		{
			log('emiting cmdCanvasFlipV')
			window._vm_.$emit('cmdCanvasFlipV');
		},
		cmdCanvasClear() 
		{
			log('emiting cmdCanvasClear')
			window._vm_.$emit('cmdCanvasClear');
		},
		cmdCanvasFill() 
		{
			log('emiting cmdCanvasFill')
			window._vm_.$emit('cmdCanvasFill');
		},
		cmdCanvasClearUndos() 
		{
			// log('emiting cmdCanvasClearUndos')
			// window._vm_.$emit('cmdCanvasClearUndos');
			this.clearUndoActions();
		},
		cmdUndo()
		{
			if (this.undoActionCount <= 0)
				return;
			// log('emiting cmdUndo')
			var action = this.undoAction;
			action.apply(action.data);
			action = this.currentAction;
			// if (!action)	debug;
			this.pushRedoAction( action )
			action = this.undoAction;
			var temp = this.popUndoAction()
			this.setCurrentAction( action );
		},
		cmdRedo()
		{
			log('cmdRedo')
			if (this.redoActionCount <= 0)
				return;
			// log('emiting cmdRedo')
			var action = this.redoAction;
			// action.performRedo(action.data);
			action.apply(action.data);
			action = this.currentAction;
			// if (!action)	debug;
			this.pushUndoAction( action )
			action = this.redoAction;
			var temp = this.popRedoAction();
			this.setCurrentAction( action );
		},
		...mapMutations([	
							'initStore',
							'setMeshLoaded',
							'setCurrentAction',
							'pushUndoAction',
							'pushRedoAction',
							'popUndoAction',
							'popRedoAction',
							'clearRedoActions',
							'setCurrentTool',
							'setCurrentMode',
							'clearUndoActions',
							'clearCurrentUndoRedoActions',
							'printUndoActions',
							'printRedoActions',
							'setActiveToolName'
							])
	},
	mounted() 
	{
		var latestVersion = Cookies.get('version');

		_vm_.$on('objectParsed', () => {//this.activeToolIdx = 2; 
							this.setActiveToolName('orbit');
							this.$nextTick( ()=>{ this.clearCurrentUndoRedoActions() } ) });
		_vm_.$on('showLoading', (opt) => {if (opt.msg) this.loadingMsg = opt.msg; this.showLoadingDialog = true; this.progress = (opt.progress) ? opt.progress : 0; } )
		_vm_.$on('hideLoading', () => { this.showLoadingDialog = false; } )
		_vm_.$on('changeMode', (mode) => { this.setCurrentTool(mode); } )
		_vm_.$on('progress', (percent) => { 
			// log('progress percent: '+percent); 
			// document.getElementById('progress-bar').style.width = percent+'%'
			this.progress = percent; 
			} )

		_vm_.$on('show-message', (opt) => 
		{
			this.dialogMsgTitle = opt.title || '';
			this.dialogMsgText = opt.text || '';
			this.showMessageDialog = true;
		})

		function delegate(e) { return true; this.$refs.dropArea.$refs.wrapper.dispatchEvent(e) }
		this.$nextTick( ()=> 
		{
			this.activeToolIdx = 0;

			this.showAboutDialog = true;
			if ( !latestVersion)
			{
				Cookies.set('version', '0.1');
			}
			else
			{
				log('version: ', latestVersion);
			}

		})
	} // mounted()
}
</script>

<style lang="sass">

// html, body, #app, .container
html, body, #app
	width: 100%
	// width: 100vw
	height: 100%
	// height: 100vh
	padding: 0
	margin: 0
	// overflow: auto
	overflow: hidden !important

.flex
	display: flex
	flex-wrap: no-wrap
	align-items: stretch
	flex: 1 1 auto
	justify-content: space-around
	align-content: center
	// flex-basis: auto

	&.row
		flex-direction: row

	&.column
		flex-direction: column

	&.justify-content-start
		justify-content: flex-start

	&.justify-content-end
		justify-content: flex-end

	&.justify-content-center
		justify-content: center

	&.justify-content-space-between
		justify-content: space-between

	&.justify-content-space-around
		justify-content: space-around

	&.justify-content-space-evenly
		justify-content: space-evenly

	&.align-content-start
		align-content: flex-start

	&.align-content-end
		align-content: flex-end

	&.align-content-center
		align-content: center

	&.align-content-space-between
		align-content: space-between

	&.align-content-space-around
		align-content: space-around

	.align-start
		align-self: flex-start

	.align-end
		align-self: flex-end

	.align-center
		align-self: center

	.align-stretch
		align-self: stretch

	.align-baseline
		align-self: baseline

#app
	font-family: 'Avenir', Helvetica, Arial, sans-serif
	-webkit-font-smoothing: antialiased
	-moz-osx-font-smoothing: grayscale
	text-align: center
	color: #2c3e50
	margin-top: 0

	.disabled
		opacity: 0.5 !important
		pointer-events: none !important
		user-select: none !important

	.invisible
		// visibility: hidden
		opacity: 0
		pointer-events: none

	.progress-circular__overlay
		transition: 0s

	.toolbar
		z-index: 10
		box-shadow: none

		.btn-toggle
			box-shadow: none

		.bp-dropdown
			display: inline-flex
			margin-right: 10px

			.text--disabled
				color: white !important
				opacity: 0.5
				pointer-events: none

		.progress-bar
			display: block
			position: absolute
			bottom: 0
			left: 0
			width: 0%
			height: 2px
			background-color: #2196f3
			pointer-events: none

	.main-area
		.menubar
			padding: 0
			background: transparent

			.menu
				border-radius: 0
				background-color: white !important

			.menubaritem
				font-size: 15px
				padding: 5px 10px
				border-radius: 0
				text-align: left

		.drop-wrapper
			height: calc(100vh - 32px)

		.start-panel
			display: block
			position: absolute
			left: 0
			right: 0
			top: 20%
			margin: auto
			text-align: center

	.overlay
		transition: 0s

	.menu__content--select.menuable__content__active
		pointer-events: all

	.sample-dialog
		img
			margin: 0 10px
			cursor: pointer
			transition: 0.3s
			border-radius: 10px
			background: grey

			&:hover
				background: #2196f3
			
		a
			display: block
			text-decoration: none
			text-align: center
			margin: 10px
			margin-bottom: 0

			&:hover
				text-decoration: underline




.tippy-content
	font-family: sans-serif

.undo-redo
	span
		position: absolute
		right: 2px
		bottom: 0
		font-size: 8px

// div:not(.main-area) .btn, 
aside .icon-btn, .tabs__content .icon-btn, .toolbar__items .icon-btn
	width: 38px
	height: 32px
	padding: 0

$sidebar-width: 240px

span
	&.bp-dropdown__btn
		padding: 0
		border: none

		&.bp-dropdown__btn--active
			background-color: inherit

	&.bp-dropdown__btn, &.bp-dropdown__sub
		// .bp-dropdown--sub
		~ .bp-dropdown__body
			padding: 0
			background-color: inherit
			& > .list
				padding: 0

.bp-dropdown__btn--active svg.bp-dropdown__icon--bottom, .bp-dropdown__sub--active svg.bp-dropdown__icon--bottom
	transform: none

.bp-dropdown__btn--active svg.bp-dropdown__icon--right, .bp-dropdown__sub--active svg.bp-dropdown__icon--right
	transform: none

.application.theme--light .text--disabled


.drop-area
	.icon
		// background-image: url('/img/drop-file-obj.svg')
		background-image: url('/img/drop-file-fbx.svg')


.icon-brush
	background-image: url('/img/brush.svg')

.icon-brushes
	background-image: url('/img/brushes.svg')

.icon-burn
	background-image: url('/img/burn.svg')

.icon-cam-rotate
	background-image: url('/img/cam_rotate.svg')

.icon-color
	background-image: url('/img/color.svg')

.icon-orbit
	background-image: url('/img/orbit.svg')

.icon-color-picker
	background-image: url('/img/color-picker.svg')

.icon-eraser
	background-image: url('/img/eraser.svg')

.icon-hand
	background-image: url('/img/hand.svg')

.icon-layers
	background-image: url('/img/layers.svg')

.icon-mask
	background-image: url('/img/mask.svg')

.icon-smear
	background-image: url('/img/smear.svg')

.icon-sponge
	background-image: url('/img/sponge.svg')

.icon-stamp
	background-image: url('/img/stamp.svg')

.icon-roller
	background-image: url('/img/roller.svg')

.icon-wrap
	background-image: url('/img/wrap.svg')

.icon-flip-h
	background-image: url('/img/flip-h.svg')

.icon-flip-v
	background-image: url('/img/flip-v.svg')

.icon-canvas
	background-image: url('/img/canvas.svg')

.icon-tool-presets
	background-image: url('/img/tool_presets.svg')

.icon-zoom
	background-image: url('/img/zoom.svg')

.icon-pen
	background-image: url('/img/hand-pen.svg')

.icon-pen-add
	background-image: url('/img/pen-add.svg')

.icon-pen-remove
	background-image: url('/img/pen-remove.svg')

.icon-pen-edit
	background-image: url('/img/pen-edit.svg')

.icon-folder
	background-image: url('/img/folder.svg')

.icon-pointer
	background-image: url('/img/pointer.svg')

.icon-eye-show
	background-image: url('/img/show.svg')

.icon-eye-hide
	background-image: url('/img/hide.svg')


html, body
	position: absolute
	width: 100%
	height: 100%
	margin: 0
	padding: 0


// #app
// 	background-color: darkgreen

.align-left
	text-align: left

canvas
	user-select: none
	touch-action: none
	-webkit-touch-callout: none

.color-picker > canvas
	// cursor: url('data:image/svg+xml;utf8,<?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="32" height="32"	 viewBox="0 0 32 32" style="enable-background:new 0 0 32 32;" xml:space="preserve"><g><polygon id="fill" fill="#FFFFFF" points="4.6,29 9.7,26.5 21.6,14.7 16.8,10.9 5.2,22.5 2.8,27.1 0.4,29.9 1.8,31.6 	"/><path d="M25.3,11.5l-4.9-4.9l-2.3-2.3c-0.3-0.3-0.6-0.3-0.9,0l-3.6,3.6c-0.3,0.3-0.3,0.6,0,0.9L16,11L5,22c-0.1,0-0.1,0-0.1,0.1 l-3.2,5.4c-0.1,0.1-0.3,0.3-0.4,0.4C0.6,28.6,0,29.2,0,30c0,0.4,0.3,0.9,0.7,1.4s0.9,0.7,1.4,0.6c0.8,0,1.4-0.6,2.1-1.3 c0.1-0.1,0.3-0.3,0.4-0.4l5.4-3.1c0.1-0.1,0.1-0.1,0.1-0.1l10.9-11l2.3,2.3c0.3,0.3,0.6,0.3,0.9,0l3.6-3.6c0.3-0.3,0.3-0.6,0-0.9 L25.3,11.5z M3.1,29.8c-0.4,0.4-0.9,0.9-1.2,0.9c-0.2,0-0.4-0.2-0.5-0.3c-0.2-0.2-0.3-0.4-0.3-0.5c0-0.3,0.4-0.8,0.9-1.1 c0.2-0.1,0.4-0.3,0.5-0.5c0,0,0-0.1,0.1-0.1l1,1c0,0-0.1,0-0.1,0.1C3.4,29.5,3.3,29.6,3.1,29.8z M9.2,26.1l-4.3,2.5l-1.5-1.5 L6,22.8l10.9-10.9l3.3,3.3L9.2,26.1z"/><path d="M31,1.8l-0.8-0.7c-0.6-0.6-1.3-0.9-2.1-0.9c-0.8,0-1.6,0.3-2.1,0.9l-4.7,4.7l4.9,4.9L31,6c0.6-0.6,0.9-1.3,0.9-2.1 C31.8,3.1,31.5,2.3,31,1.8z"/></g></svg>') 0 64, auto
	cursor: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiINCgkgdmlld0JveD0iMCAwIDMyIDMyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzMiAzMjsiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPGc+DQoJPHBvbHlnb24gaWQ9ImZpbGwiIGZpbGw9IiNGRkZGRkYiIHBvaW50cz0iNC42LDI5IDkuNywyNi41IDIxLjYsMTQuNyAxNi44LDEwLjkgNS4yLDIyLjUgMi44LDI3LjEgMC40LDI5LjkgMS44LDMxLjYgCSIvPg0KCTxwYXRoIGQ9Ik0yNS4zLDExLjVsLTQuOS00LjlsLTIuMy0yLjNjLTAuMy0wLjMtMC42LTAuMy0wLjksMGwtMy42LDMuNmMtMC4zLDAuMy0wLjMsMC42LDAsMC45TDE2LDExTDUsMjJjLTAuMSwwLTAuMSwwLTAuMSwwLjENCgkJbC0zLjIsNS40Yy0wLjEsMC4xLTAuMywwLjMtMC40LDAuNEMwLjYsMjguNiwwLDI5LjIsMCwzMGMwLDAuNCwwLjMsMC45LDAuNywxLjRzMC45LDAuNywxLjQsMC42YzAuOCwwLDEuNC0wLjYsMi4xLTEuMw0KCQljMC4xLTAuMSwwLjMtMC4zLDAuNC0wLjRsNS40LTMuMWMwLjEtMC4xLDAuMS0wLjEsMC4xLTAuMWwxMC45LTExbDIuMywyLjNjMC4zLDAuMywwLjYsMC4zLDAuOSwwbDMuNi0zLjZjMC4zLTAuMywwLjMtMC42LDAtMC45DQoJCUwyNS4zLDExLjV6IE0zLjEsMjkuOGMtMC40LDAuNC0wLjksMC45LTEuMiwwLjljLTAuMiwwLTAuNC0wLjItMC41LTAuM2MtMC4yLTAuMi0wLjMtMC40LTAuMy0wLjVjMC0wLjMsMC40LTAuOCwwLjktMS4xDQoJCWMwLjItMC4xLDAuNC0wLjMsMC41LTAuNWMwLDAsMC0wLjEsMC4xLTAuMWwxLDFjMCwwLTAuMSwwLTAuMSwwLjFDMy40LDI5LjUsMy4zLDI5LjYsMy4xLDI5Ljh6IE05LjIsMjYuMWwtNC4zLDIuNWwtMS41LTEuNQ0KCQlMNiwyMi44bDEwLjktMTAuOWwzLjMsMy4zTDkuMiwyNi4xeiIvPg0KCTxwYXRoIGQ9Ik0zMSwxLjhsLTAuOC0wLjdjLTAuNi0wLjYtMS4zLTAuOS0yLjEtMC45Yy0wLjgsMC0xLjYsMC4zLTIuMSwwLjlsLTQuNyw0LjdsNC45LDQuOUwzMSw2YzAuNi0wLjYsMC45LTEuMywwLjktMi4xDQoJCUMzMS44LDMuMSwzMS41LDIuMywzMSwxLjh6Ii8+DQo8L2c+DQo8L3N2Zz4NCg==") 0 64, auto


.tool-icon
	width: 32px
	height: 32px
	max-width: 100%
	max-height: 100%

	background-repeat: no-repeat
	background-size: contain
	background-position: center center 
	// padding: 4px
	// background-size: 28px 28px
	background-size: 90% 90%

.drop-wrapper
	display: block
	position: relative
	width: 100%
	height: 100%


.drop-wrapper
	display: block
	// position: absolute
	height: 100%
	width: 100%
	top: 0
	bottom: 0
	left: 0
	right: 0

.drop-area
	display: block
	position: absolute
	// position: relative
	// width: 100%
	// height: 100%
	left: 0
	right: 0
	top: 0
	bottom: 0
	pointer-events: none
	padding: 0
	margin: auto

	// @keyframes moving-dash
	// 	from
	// 		stroke-dashoffset: 0px
	// 	to
	// 		stroke-dashoffset: 100px

	.border
		display: none
		position: absolute
		$gap: 2em
		left: $gap
		right: $gap
		top: $gap
		bottom: $gap
		border: 10px dashed #dddddd
		// animation: moving-dash 1s 1000 forwards
		pointer-events: none
		border-radius: 50px
		text-align: center
		vertical-align: middle

		&:before
			content: ''
			display: inline-block
			position: relative
			height: 100%
			width: 0


		.msg
			display: inline-block
			position: relative
			// position: absolute
			left: 0
			right: 0
			top: 0
			bottom: 0
			font-family: Arial, Helvetica, sans-serif
			font-size: 3em
			font-weight: bold
			color:  #dddddd
			text-align: center
			margin: auto
			// width: 16em
			// height: 4em
			letter-spacing: 0.03em
			text-transform: uppercase


	.icon
		display: inline-block
		position: absolute
		width: 300px
		height: 300px
		max-width: 90vw
		max-height: 80vh
		left: 0
		right: 0
		top: 10%
		bottom: 0
		margin: auto
		
		// putting image urls in an external Sass file crashes Parcel

		// background-image: url('../img/drop-file-obj.svg')
		// background-image: url('../img/drop-file-obj.svg')
		// background-image: url('../assets/logo.png')
		background-repeat: no-repeat
		background-position: center center
		background-size: contain
		// background-color: cyan
		pointer-events: none

		// @media (min-height:840px)
		// 	top: 10%

.drop-wrapper.dragging
	& > .drop-area
		// background: rgba(255,255,255,0.8)

	.border
		display: block

	.icon
		display: none


.vb
	$handleWidth: 17px
	width: calc(100% + #{$handleWidth})
	> .vb-dragger
		z-index: 5
		width: 12px
		right: $handleWidth
		> .vb-dragger-styler
			-webkit-backface-visibility: hidden
			backface-visibility: hidden
			-webkit-transform: rotate3d(0, 0, 0, 0)
			transform: rotate3d(0, 0, 0, 0)
			-webkit-transition: background-color 100ms ease-out, margin 100ms ease-out, height 100ms ease-out
			transition: background-color 100ms ease-out, margin 100ms ease-out, height 100ms ease-out
			// background-color: rgba(48, 121, 244, 0.1)
			background-color: rgba(150, 150, 150, 0.3)
			margin: 5px 5px 5px 0
			border-radius: 20px
			height: calc(100% - 10px)
			display: block
	&.vb-scrolling-phantom > .vb-dragger > .vb-dragger-styler
		// background-color: rgba(48, 121, 244, 0.3)
		background-color: rgba(150, 150, 150, 0.3)
	> .vb-dragger:hover > .vb-dragger-styler, &.vb-dragging > .vb-dragger > .vb-dragger-styler
		// background-color: rgba(48, 121, 244, 0.5)
		background-color: rgba(150, 150, 150, 0.5)
		margin: 0px
		height: 100%
	&.vb-dragging-phantom > .vb-dragger > .vb-dragger-styler
		// background-color: rgba(48, 121, 244, 0.5)
		background-color: rgba(150, 150, 150, 0.3)



@media (max-height: 840px)
	.drop-area
		.icon
			top: 10%

@media (max-height: 720px)
	.drop-area
		.icon
			top: 20%

@media (max-height: 620px)
	.drop-area
		.icon
			top: 30%

@media (max-height: 540px)
	.drop-area
		.icon
			top: 40%
</style>
