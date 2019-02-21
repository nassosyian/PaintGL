<template lang="pug">
	.drop-wrapper(:class="{dragging: isDragging}" ref="wrapper" )
		slot
</template>

<script>
export default {
	name: 'drop-file',
	props: {
		types: {
			type: String,
			default: '.fbx'
		},
		eventname: {
			type: String,
			default: 'dropped'
		},
		enableClick: { default: false }
	},
	data() {
		return {
			isDragging: false
		};
	},
	methods: {
		verifyFile(filename)
		{
			var exts = this.types.toLowerCase().split(',').filter(ext => filename.toLowerCase().indexOf(ext) >= 0);
			return exts.length > 0;
		},
		openFileDialog(e)
		{
			// log('openFileDialog called');

			// creating input on-the-fly
			var input = document.createElement("input");
			// debugger
			input.setAttribute("type", "file");
			log(this.types);
			input.setAttribute("accept", this.types || ".fbx");
			input.style = "display:inline-block;position:absolute;left:0;top:0;z-index:-1000;opacity:0";

			input.onchange = function(evt) 
			{
				
				if (!evt.target.files || evt.target.files.length == 0)
				{
					log('no files or files length==0');
					return false;
				}
				const file = evt.target.files[0];

				// log(file);
				log('emitting '+this.eventname+' for file '+file.name);
				_vm_.$emit(this.eventname, file);
			}
					input.click(); // opening dialog
		}

	},
	mounted () 
	{
		log('mounted DropFile');
		
		window._vm_.$on('cmdDocLoadObj', ()=>{ this.openFileDialog() });

		if (this.enableClick)
		{
			this.$refs.wrapper.addEventListener('click', (e)=> {
				this.openFileDialog(e);
			})
			
			// this.$on('click', this.openFileDialog);
		}
		
		const opts = {capture: true, passive: false};


		this.$refs.wrapper.addEventListener('dragenter', (e) => { logfunc() }, opts)
		this.$refs.wrapper.addEventListener('dragleave', (e) => 
		{
			logfunc()
			this.isDragging = false;
		}, 
		opts)
		this.$refs.wrapper.addEventListener('dragexit', (e) => 
		{
			logfunc()
			this.isDragging = false;
		}, 
		opts)

		this.$refs.wrapper.addEventListener('dragover', (e) => 
		{
			logfunc()
			// log(e.dataTransfer.types);
			if (e.dataTransfer.types.length > 0)
			{
				this.isDragging = e.dataTransfer.types.filter(item => item.toLowerCase() == 'files').length > 0;
				e.preventDefault();
			}
			else
			{
				this.isDragging = false;
			}

		}, opts)

		this.$refs.wrapper.addEventListener('drop', (e) =>
		{
			logfunc()
			if (e.dataTransfer.files.length)
			{
				e.preventDefault();
				log(e.dataTransfer.files.length);
				log(e.dataTransfer.files[0]);

				const file = e.dataTransfer.files[0];

				log('emitting '+this.eventname+' for file '+file.name);
				_vm_.$emit(this.eventname, file);
			}

			this.isDragging = false;
		}, opts)
	}
}
</script>



<style lang="sass">

.drop-wrapper
	
</style>
