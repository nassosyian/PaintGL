'use strict'


import Tool from './Tool'
import DataTexture from './DataTexture'

window.orbitUndoIdx = window.orbitUndoIdx || 0;

// TODO: 	take the current channer layer texture and push it 
//			on Undo, restore the layer data and copy it the geom texture
function grabCurrentUVMap(state, texmap, geoIndices)
{
	var indeces = geoIndices ? geoIndices.slice() : state.activeGeom.length > 0 ? state.activeGeom.slice() : (Array(state.sceneGeomArray.length)).fill(0).map( (_,i) => i );
	var texList = [];
	const map = texmap ? texmap.slice() : state.getActiveChannelTextureName();

	// if (!map)	debugger;

	var fbo = state.regl.framebuffer({
		width: 4,
		height: 4,
		colorFormat: 'rgba',
		depth: false,
		stencil: false,
	});

	// var fbo = state.dilateFbo;

	log('storing textures of '+JSON.stringify(indeces));

	indeces.forEach( (geoIdx) => {
		var tex = new DataTexture();
		fbo({
			width: state.BUFFER_DIMENSION,
			height: state.BUFFER_DIMENSION,
			color: state.sceneGeomArray[geoIdx][map],
			colorFormat: 'rgba',
			depth: false,
			stencil: false,
		});
		tex.readFromFBO(state.regl, fbo);
		tex.idx = window.orbitUndoIdx; 
		texList.push(tex);
	} );

	// fbo({
	// 	width: 4,
	// 	height: 4,
	// 	depth: false,
	// 	stencil: false,
	// });
	fbo.destroy();

	return  {
		// data: { tex: tex, idx: window.orbitUndoIdx++ },
		data: { texList, geoIndeces: indeces.slice(), idx: window.orbitUndoIdx++, map,  },
		apply: (data) => 
		{
			log('reverting to texture '+data.idx);
			var currentAction = state.currentAction;
			if (!currentAction)
			{
				log('creating new currentAction')
				var redoAction = grabCurrentUVMap(state, map, data.geoIndeces);
				_vm_.$emit('registerCurrentAction', redoAction);
			}
			log('writing textures of '+JSON.stringify(data.geoIndeces));

			data.geoIndeces.forEach( (geoIdx, i) => {
				var tex = data.texList[i];
				if (!tex)
				{
					log('error: tex['+i+'] is empty');
					return;
				}
				if (!state.sceneGeomArray[geoIdx][map])
				{
					log('error: geo['+geoIdx+']'+map+' is empty');
					return;
				}
				// else
				// 	log(`writing to geo[${geoIdx}]${map}`)
				tex.writeToTexture(state.sceneGeomArray[geoIdx][map], {
					mag: 'linear',
					min: 'linear',
					// wrap: 'repeat'
				});
			})

			// _vm_.$emit('popUndo');
			state.refreshMesh = true;
		}
	}
}

function pushUndo(state, undoData)
{
	
	var ret = {
		// data: { tex: tex, idx: window.orbitUndoIdx++ },
		tool: 'orbit',
		data: { undoData, idx: window.orbitUndoIdx++, },
		apply: (data) => 
		{
			log('reverting to texture '+data.idx);
			var currentAction = state.currentAction;
			if (!currentAction)
			{
				log('creating new currentAction')
				var redoData = [];
				data.undoData.forEach( (tex)=>
				{
					const geomIdx = tex.geomIdx;
					const channelIdx = tex.channelIdx;
					const textureIdx = tex.textureIdx;
					const layerUUID = tex.layerUUID;

					var layerData = state.getLayerData(textureIdx);
					if (layerData)
					{
						let clone = layerData.clone();
						clone.geomIdx = geomIdx;
						clone.channelIdx = channelIdx;
						clone.textureIdx = textureIdx;
						clone.layerLabel = tex.layerLabel;
						clone.layerUUID = tex.layerUUID;
						redoData.push(clone);
					}
				});
				var redoAction = pushUndo(state, redoData);
				_vm_.$emit('registerCurrentAction', redoAction);
			}
			// log('writing textures of '+JSON.stringify(data.geoIndeces));

			data.undoData.forEach( (tex)=>
			{
				const geomIdx = tex.geomIdx;
				const channelIdx = tex.channelIdx;
				const textureIdx = tex.textureIdx;
				const layerUUID = tex.layerUUID;

				var layerData = state.getLayerData(textureIdx);
				if (layerData)
				{
					// restore the layer data
					layerData.data = tex.data.slice();
					layerData.width = tex.width;
					layerData.height = tex.height;
					layerData.potSize = pow2ceil( Math.max(tex.width, tex.height) );
					state.setLayerData({index: textureIdx, data: layerData})
					state.setGeomChannelRefresh({geomIdx: geomIdx, channel: channelIdx, refresh: true});

					var geom = state.sceneGeomArray[geomIdx];


					var texture = null;
					var clearClr = [0, 0, 0, 0];
					switch (channelIdx) 
					{
						case 1: // Metallic
							texture = 'metallicTex'; clearClr = [0, 0, 0, 0]; break;
						
						case 2: // Roughness
							texture = 'roughnessTex'; clearClr = [1, 1, 1, 0]; break;  // Roughness
						case 3: // Normal
							texture = 'normalTex'; clearClr = [0, 0, 0, 0]; break; // Normal
						case 4: // Emissive
							texture = 'emissiveTex'; clearClr = [0, 0, 0, 0]; break; // Emissive

						default:
						case 5: // AO
						case 0: // Color
							texture = 'colorTex'; /* clearClr = [1, 1, 1, 0]; */ break; // Color
							break;
					}
					state.combineLayersToTexture(geomIdx, channelIdx, geom[texture]);//, tempFbo)
					
					// layerData.writeToTexture(geom[texture]);
				}
			});

			state.refreshMesh = true;
			// state.drawCanvas();

			// data.geoIndeces.forEach( (geoIdx, i) => {
			// 	var tex = data.texList[i];
			// 	if (!tex)
			// 	{
			// 		log('error: tex['+i+'] is empty');
			// 		return;
			// 	}
			// 	if (!state.sceneGeomArray[geoIdx][map])
			// 	{
			// 		log('error: geo['+geoIdx+']'+map+' is empty');
			// 		return;
			// 	}
			// 	// else
			// 	// 	log(`writing to geo[${geoIdx}]${map}`)
			// 	tex.writeToTexture(state.sceneGeomArray[geoIdx][map], {
			// 		mag: 'linear',
			// 		min: 'linear',
			// 		// wrap: 'repeat'
			// 	});
			// })

			// _vm_.$emit('popUndo');
			// state.refreshMesh = true;
		}
	};

	return ret;

}


class ToolOrbit extends Tool 
 {
	
	constructor(state, options) 
	{
		super(state, options);

		this.lastX = 0;
		this.lastY = 0;
		this.mouseMoveHandler = null;
		this.mouseDown = false;
		this.hadPaintStrokes = false;
	}

	destroy(state) 
	{
		
	}

	activate(state)
	{
		state.pointerStyle = null;

		this.hadPaintStrokes = state.undoPaintActionCount > 0;

		_vm_.$emit('changeMode', 'orbit')

		// this.mouseMoveHandler = this.onMouseMove.bind(this, state);
		// state.$refs.canvas.addEventListener('mousemove', this.mouseMoveHandler)
		// this.copyPaint(state)
		state.overlayDestFbo.use( () => state.regl.clear({ depth: 1, color: [0, 0, 0, 0] }) );
		state.redrawTextureLayers(0);
		// state.refreshMesh = true;
	}

	deactivate(state)
	{
		state.pointerStyle = null;
		// state.$refs.canvas.removeEventListener('mousemove', this.mouseMoveHandler)
		// this.mouseMoveHandler = null;
	}

	bakePaint(state, erase)
	{
		// logfunc()
		this.hadPaintStrokes = state.undoPaintActionCount > 0;
		this.copyPaint(state, erase)
	}

	copyPaint(state, erase)
	{
		// var dataTex = new DataTexture({width: state.BUFFER_DIMENSION, height:state.BUFFER_DIMENSION,
		// 	format:'rgba'});
		// logfunc()

		if (this.hadPaintStrokes==false)
			log('no paint strokes found, ignoring...')
			
		if (state.extractMeshTexture && this.hadPaintStrokes)
		{
			log('copyPaint begin: extracting texture...')
			
			state.meshTempFbo({
				// width: state.BUFFER_DIMENSION,
				// height: state.BUFFER_DIMENSION,
				width: state.VIEWER_WIDTH_POT,
				height: state.VIEWER_HEIGHT_POT,
				depthTexture: true,
				stencil: false,
				depth: state.meshDepthTexGreater
			})
			state.meshTempFbo.use( ()=>
			{
				state.regl.clear({ depth: 1, color: [0, 0, 0, 0] })
				state.cullFace = 'front';
				state.drawMeshUV(state.sceneGeomArray)
			} )

			state.meshTempFbo({
				// width: state.BUFFER_DIMENSION,
				// height: state.BUFFER_DIMENSION,
				width: state.VIEWER_WIDTH_POT,
				height: state.VIEWER_HEIGHT_POT,
				depthTexture: true,
				stencil: false,
				depth: state.meshDepthTexLess
			})
			state.meshTempFbo.use( ()=>
			{
				state.regl.clear({ depth: 1, color: [0, 0, 0, 0] })
				state.cullFace = 'back';
				state.drawMeshUV(state.sceneGeomArray)
			} )

			state.meshTempFbo({
				// width: state.BUFFER_DIMENSION,
				// height: state.BUFFER_DIMENSION,
				width: state.VIEWER_WIDTH_POT,
				height: state.VIEWER_HEIGHT_POT,
				depthTexture: true,
				stencil: false,
				depth: state.meshDepthTexMidpoint
			})
			state.regl._gl.colorMask(false, false, false, false);
			
			state.meshTempFbo.use( ()=>
			{
				state.regl.clear({ depth: 1, color: [0, 0, 0, 0] })
				state.regl._gl.colorMask(false, false, false, false);
				state.calcMidpointDepth()
			} )
			state.regl._gl.colorMask(true, true, true, true);


			const indeces = state.activeGeom.length > 0 ? state.activeGeom.slice() : (Array(state.sceneGeomArray.length)).fill(0).map( (_,i) => i );

			
			if (state.redoActionCount > 0)
			{
				state.clearRedoActions();
			}
			// _vm_.$emit('registerUndoAction', state.currentAction ? null : grabCurrentUVMap(state) );


			var texture = state.getActiveChannelTextureName();
			var clearClr = state.getActiveChannelClearColor();


			log('copyPaint: extracting ... '+texture);

			var tempFbo = state.regl.framebuffer();
			var tempTex = state.regl.texture();
			var tempLayerTex = [state.regl.texture(), state.regl.texture(), state.regl.texture(), state.regl.texture(), state.regl.texture(), state.regl.texture()];

			var undoData = [];
			var floatFbo = null;
			if (texture=='normalTex')
			{
				floatFbo = state.regl.framebuffer({
					width: state.VIEWER_WIDTH_POT,
					height: state.VIEWER_HEIGHT_POT,
					color: state.viewerNormalTex,
					depthStencil: false
				})
			}

			// state.sceneGeomArray.forEach( (geo) =>
			indeces.forEach( (idx) =>
			{
				var geo = state.sceneGeomArray[idx];
				var layer = state.getGeomChannelLayersWithFilter(idx, state.activeChannel, l => l.selected)[0];

				if (layer)
				{
					let textureIdx = layer.textureIdx;
					let layerData = state.getLayerData(textureIdx);

					if (layerData.checkIsEmpty())
						log(`DataTex[${state.activeChannel}] is empty`)
					layerData.writeToTexture(tempTex);
					log(`found DataTex[${state.activeChannel}]`, layerData)
					// validate
					{
						tempFbo({width:tempTex.width, height:tempTex.height, color:[tempTex], depthStencil:false});
						let dataTex = new DataTexture({ width:layerData.width, 
														height:layerData.height,
														format:layerData.format,
														type:layerData.type
													});
						dataTex.readFromFBO(state.regl, tempFbo);
						log(`validating DataTex[${state.activeChannel}]`, dataTex);
						log(`validating tempTex`, tempTex);
						log(`validating tempFbo`, tempFbo);
						dataTex = null;
					}

				}
				else
				{
					tempTex({
						width: geo[texture].width,
						height: geo[texture].height,
						format: geo[texture].format,
						type: geo[texture].type,
					});
				}

				tempFbo({
					width: tempTex.width,
					height: tempTex.height,
					// color: tempTex,
					// format: tempTex.format,
					colorFormat: tempTex.format,
					// type: tempTex.type=='float32' ? 'float' : tempTex.type,
					colorType: tempTex.type=='float32' ? 'float' : tempTex.type,
					depthStencil: false
				})

				if (texture=='normalTex')
				{
					floatFbo.use( ()=>{
						state.regl.clear({ depth: 1, color: [0.5,0.5,1,1] })
						state.convertBumpToNormalTexture({normalTex: state.activeBufferTex,
														geoNormalTex: state.viewerGeomNTex, 
														geoTangentTex: state.viewerGeomTTex });
						state.activeBufferTex({copy: true, mag: 'linear', min:'linear', format:state.activeBufferTex.format, type:state.activeBufferTex.type,})
						// state.paintSurfTextures[0]({copy: true, mag: 'linear', min:'linear'})
					} )
				}

				tempFbo.use( ()=>
				{
					// state.regl.clear({ depth: 1, color: [1, 1, 1, 0] })
					state.regl.clear({ depth: 1, color: clearClr })
					// geo.bgTex = geo[texture];
					geo.bgTex = tempTex;
					geo.erase = erase || false;
					state.extractMeshTexture([geo]);
					delete geo.erase;
					delete geo.bgTex;
					// geo.bgTex = null;
					// geo[texture]({copy: true, mipmap: 'nice', mag: 'linear', min:'mipmap'})
					geo[texture]({copy: true, mag: 'linear', min:'linear', format:geo[texture].format, type:geo[texture].type})

					// if (texture=='normalTex')
					// {
					// 	state.regl.clear({ depth: 1, color: [0,0,0,0] })
					// 	state.convertBumpToNormalTexture(geo);
					// 	geo[texture]({copy: true, mag: 'linear', min:'linear'})
					// }
				} )

				// var layer = state.activeChannelSelectedLayer;
				if (layer)
				{
					var textureIdx = layer.textureIdx;
					var layerData = state.getLayerData(textureIdx);
					if (layerData)
					{
						if (layerData.data)
						{
							// Clone the previous DataTexture in the layer
							var clone = layerData.clone();
							clone.geomIdx = idx;
							clone.channelIdx = state.getActiveChannelIndex();
							clone.textureIdx = textureIdx;
							clone.layerLabel = layer.label;
							clone.layerUUID = layer.layerUUID;
							undoData.push(clone);
						}

						// Copy the current texture to the Layer
						// tempFbo({
						// 	width: geo[texture].width,
						// 	height: geo[texture].height,
						// 	color: geo[texture],
						// 	depthStencil: false
						// })
						layerData.readFromFBO(state.regl, tempFbo);
					}
					else
					{
						console.error('no DataTexture found for layer '+layerData.label+' of '+geo.name);
						// log('error: layerData = null');
					}	
				}
				else
				{
					console.error('error: no selected layer found for channel '+layerData.label+' of '+geo.name);
				}

				// Merge the texture to put onto object
				// tempFbo({
				// 	width: tempTex.width,
				// 	height: tempTex.height,
				// 	// color: tempTex,
				// 	format: geo[texture].format,
				// 	type: geo[texture].type,
				// 	depthStencil: false
				// })
				
				state.combineLayersToTexture(idx, state.activeChannel, geo[texture], tempFbo)
			} )

			if (floatFbo)
				floatFbo.destroy();

			if (undoData.length)
				_vm_.$emit('registerUndoAction', state.currentAction ? null : pushUndo(state, undoData) );

			state.paintSurfFbos[0].use( ()=>state.regl.clear({ depth: 1, color: [0, 0, 0, 0] }) )
			state.clearUndoActions('paint');
			tempFbo.destroy();
			state.refreshMesh = true;
			state.drawCanvas();
			log('copyPaint end')
		}

	}

	strokeBegin(state) 
	{
		this.lastX = state.lastMousePos.x
		this.lastY = state.lastMousePos.y
		this.mouseDown = true
		state.showPressureCircle = false;
	}

	strokeEnd(state) 
	{
		this.mouseDown = false;
	}

	_onPointerMove(state) 
	{
		
	}

	strokeMove(state, e) 
	{
		if (!state.camera)
		{
			log('orbit: no camera found')
			return;
		}

		if (!this.mouseDown)
		{
			return;
		}

		const now =  (new Date).getTime();

		var dx =  (state.currentMousePos.x - this.lastX) / state.regl._gl.drawingBufferWidth
		var dy = -(state.currentMousePos.y - this.lastY) / state.regl._gl.drawingBufferHeight
		// log(`orbit ${e.which} ${dx} ${dy}`)
		// if(e.which === 0) // left button 
		{
			// if (e.shiftKey && e.ctrlKey)
			if (e.altKey)
			{
				//rotate on Z 
				state.camera.rotate(now, 0, 0, dx)
			} 
			else if (e.ctrlKey) 
			{
				// zoom
				if (e.shiftKey) 
					state.camera.pan(now, 0, 0, dy*10)
				else
					state.camera.pan(now, 0, 0, dy)
			} 
			else if (e.shiftKey) 
			{
				//pan
				state.camera.pan(now, -dx, dy)
			}
			else 
			{
				//rotate 
				state.camera.rotate(now, -dx, dy)
			}
			state.refreshMesh = true;
			state.drawCanvas()
		} 
		this.lastX = state.currentMousePos.x
		this.lastY = state.currentMousePos.y
	}

}


export default ToolOrbit;