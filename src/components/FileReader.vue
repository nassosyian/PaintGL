<template lang="pug">
	.file-reader
		input(:name="msg" type="file" @change="onChange")
		slot
</template>


<script>
export default {
	name: 'file-reader',
	props: {
		msg: {
			type: String,
			default: 'Load file'
		}
	},
	data() {
		 return {
			 isText: true,
			 fileData: null,
			 error: '',
			 readState: 0,
		 };
	},
	methods: 
	{
		onChange(e) 
		{
			var file = e.target.files[0];
			if (!file) 
			{
				return;
			}

			var reader = new FileReader();
			this.readState = 0;
			reader.onerror = (e)=>{ this.readState = 0; this.error = e.error; }
			reader.onload = (e) =>
			{
				this.fileData = e.target.result;
				this.readState = 0;

				this.$emit('file-changed', this.fileData);
			};
			if (this.isText)
				reader.readAsText(file);
			else
				reader.readAsDataURL(file);
			this.readState = 1;
		}
	}
};
</script>


