<template lang="pug">
	.canvas-wrapper
		canvas(:width="width" :height="height" ref="canvas")
		slot(v-model="regl")
</template>

<script>
	const REGL = require('regl')	

	export default {
		name: 'webgl',
		props: {
			// color: {
			// 	// type: Object,
			// 	default: {rgba: { r: 25, g: 77, b: 51, a: 1 }}
			// },
			width: {
				type: Number,
				default: 800
			},
			height: {
				type: Number,
				default: 800
			},
			// mesh: {
			// 	type: Object,
			// 	default: null
			// },
			extentions: {
				default: ''
			}
		},
		data () {
			return {
				provider: {
					// we need to put it into an object for it become reactive when injected
					regl: null, 
				}
				// objMesh() {},
				// tick: null,
				// drawCall: null
			}
		},
		provide() 
		{
			return 
			{
				provider: this.provider
			}
		},

		methods: {

		},
		
		mounted () 
		{
			log('mounted WebGL');
			var exts = this.extentions.split(' ');
			exts = exts || [];
			this.provider.regl = REGL( this.$refs.canvas, {
				 
					extensions: ['angle_instanced_arrays'].concat(exts)	
				});
			log(this.provider.regl)
		},
		destroyed() 
		{
			this.provider.regl.destroy();
		}
	}
</script>

