<template lang="pug">
vddl-list.layer-list(:list="list" :horizontal="false" :drop="handleDrop" )
	vddl-draggable.layer-list-item( v-for="(item, index) in list" :key="item.vddlid" :draggable="item" :index="index" :wrapper="list" :moved="handleMoved" effect-allowed="move" )
		vddl-nodrag.nodrag(:class="{selected: item.selected}")
			v-layout(row justify-space-between px-2 py-2  @mousedown="select($event, index)"  )
				vddl-handle.handle( :handle-left="20" :handle-top="20")
					v-icon(dark) drag_handle
				span.label(v-if="!item.editingLabel" @dblclick="()=>{item.editingLabel = true}") {{item.label}}
				span(v-else): v-text-field(v-model="item.label" :autofocus="true" name="labelInput"  @change="(e)=>{onLabelChange(e, item)}" @keyup.enter="(e)=>{onLabelChange(e, item); item.editingLabel = false}" @blur="(e)=>{onLabelChange(e, item); item.editingLabel = false}" @focus="(e)=>{e && e.target.select()}")

				v-btn.visibility(flat @click="(e)=>toggleVisibility(e, item)")
					span.tool-icon(:class="{'icon-eye-show': item.visible===true, 'icon-eye-hide': item.visible===false}")

</template>

<script>
import { mapMutations, mapState, mapGetters } from 'vuex'

export default {
	props: {
		list: {
			default: [],
			required: true,
		}
	},
	data() {
		return { 
			selected: null,
			selectedIdx: -1,
			// editingLabel: false
		 };
	},

	computed: {
		...mapGetters([
					'getLayerData',
					'layerDataCount',
					'getChannelLayers',
					'getActiveChannelDimension',
					// 'activeChannel',
					'getActiveChannelIndex',
					'channelDimension',
					])
	},

	methods: {

		toggleVisibility(e, item)
		{
			item.visible = !item.visible;
			// log(item.visible);
			// this.$forceUpdate();
			this.$emit('reordered-layer', 0);
		},

		onLabelChange(e, item)
		{
			// log(arguments)
			var val = e.target.value || '';
			var label = val.length > 37 ? val.slice(0, 38) : val;
			item.label = label;
			var layer = this.getLayerData(item.textureIdx);
			if (layer && layer.data)
			{
				layer.data.label = label;
				// log(layer.data.label);
			}
		},

		handleInserted(data) 
		{
			// log(':v-list: inserted');
			// log(data);
		},
		handleDrop(data) 
		{
			// log(':v-list: drop');
			// log(data);
			const { index, list, item } = data;
			// change the id
			item.vddlid = new Date().getTime();

			var itemIdx = this.selectedIdx;
			var insertIdx = index;
			// log('itemIdx: '+itemIdx);
			if (insertIdx > this.selectedIdx) insertIdx--;

			list.splice(this.selectedIdx, 1); // remove the original item
			list.splice(insertIdx, 0, item); //  insert the new one

			this.list = list;
		},
		handleMoved(item) 
		{
			// initially the original drag-source item was removed by this 
			// by this callback, but that resulted in visible flicker in the list refresh
			// so i moved it to handleDrop()

			// log(':v-draggable: moved', item);
			// log(item);
			const { index, list } = item;
			this.$emit('reordered-layer', index);
		},
		select(e, index)
		{
			// log('selected '+index)
			this.$emit('will-select-layer', index);
			if (e.shiftKey)
				this.$props.list[index].selected = true
			else
				this.$props.list.forEach((el, idx) => el.selected = idx==index )
			this.selectedIdx = index;

			this.$emit('selected-layer', index);
		},
		...mapMutations([
					'setLayerData',
					'setChannelLayers',
					])
	},
}
</script>

<style lang="sass">
.layer-list
	.handle
		cursor: ns-resize
	.vddl-placeholder
		display: block
		position: relative
		width: 100%
		height: 40px

.layer-list-item
	// .visibility, .tool-icon
	.visibility
		display: inline-block
		width: 24px
		height: 24px
		margin: 0
		padding: 0

	.btn__content
		padding: 0
	// .tool-icon
	// 	width: 32px
		
		// display: inline-block
		// display: inline
	.label
		flex-basis: 260px
		text-align: center
	.input-group
		padding: 0
		width: 260px
	.input-group__input
		min-height: 20px
	.input-group--text-field input
		font-size: 1em
		height: 20px
		text-align: center
	.input-group__details
		min-height: 1px
		padding: 0
		margin: 0
		// display: none
	.selected
		background: #696969


//---------------------------------------------
// /**
// * For the correct positioning of the placeholder element, the vddl-list and
// * it's children must have position: relative
// */
.vddl-list, .vddl-draggable
	position: relative

// /**
// * The vddl-list should always have a min-height,
// * otherwise you can't drop to it once it's empty
// */
.vddl-list
	padding-left: 0px
	// min-height: @item-height


// /**
// * The vddl-dragging-source class will be applied to
// * the source element of a drag operation. It makes
// * sense to hide it to give the user the feeling
// * that he's actually moving it.
// */
.vddl-dragging-source
	display: none
//---------------------------------------------



.vddl-list, .vddl-draggable
	position: relative

.vddl-list
	min-height: 50vh

.vddl-dragging
	opacity: 0.9

.vddl-dragging-source
	visibility: hidden

</style>
