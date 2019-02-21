'use strict'

require('../node_modules/vuetify/src/stylus/app.styl')

import Vue from 'vue'
import {
	Vuetify,
	VApp,
	VNavigationDrawer,
	VDialog,
	VToolbar,
	VMenu,
	VExpansionPanel,
	VCard,
	VSlider,
	// VContainer,
	// VLayout,
	// VFlex,
	// VSpacer,
	VList,
	VDivider,
	VTextField,
	VTabs,
	VSubheader,
	VCheckbox,
	VSelect,
	VBtn,
	VBtnToggle,
	VIcon,
	VProgressLinear,
	VProgressCircular,


	// VFooter,
	VGrid,
	transitions
} from 'vuetify'
// import Vuetify from 'vuetify'
// import Vuetify from 'vuetify'
// import * as VueMenu from '@hscmap/vue-menu'
import Vddl from 'vddl';
import Vuebar from 'vuebar';
// import VuePerfectScrollbar from 'vue-perfect-scrollbar';
import VueTippy from 'vue-tippy'
// import VueWorker from 'vue-worker'
import Dropdown from 'bp-vuejs-dropdown';
import DropFile from './components/DropFile.vue'
import App from './App.vue'
import Spinner from 'vue-simple-spinner'
// require('vue-simple-spinner/dist/vue-simple-spinner.min.js')

window.log = function() {};

function checkWebp() 
{
	if (!window.createImageBitmap) return new Promise((resolve, reject) => { reject() });
	
	const webpData = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
	// const blob = await fetch(webpData).then(r => r.blob());
	// return createImageBitmap(blob).then(() => true, () => false);
	return fetch(webpData)
				.then(r => createImageBitmap(r.blob()) )
				;
}

checkWebp().then(()=> window.supportsWebp = true, ()=> window.supportsWebp = false);

function pow2floor(v)
{
	v++;
	var p = 1;
	while (v >>= 1) {p <<= 1;}
	return p;
}

function pow2ceil(v)
{
	v--;
	var p = 2;
	while (v >>= 1) {p <<= 1;}
	return p;
}

window.pow2floor = pow2floor;
window.pow2ceil = pow2ceil;


window.isNumber = require('is-number');
window.clamp = (value, min, max) => {var num = parseFloat(value) || 0; return num <= min ? min : num >= max ? max : num; }

window.logfunc = function logFunc(message) 
{
	var stack = new Error().stack,
		caller = stack.split('\n')[2].trim();
	log(caller + (message ? ":" + message: '') );
}



window.onload = function _onLoad() {

	Vue.config.productionTip = false


	Vue.use(Vuetify, {
		components: {
			VApp,
			VNavigationDrawer,
			VDialog,
			VToolbar,
			VMenu,
			VExpansionPanel,
			VCard,
			VSlider,
			// VContainer,
			// VLayout,
			// VFlex,
			// VSpacer,
			VList,
			VDivider,
			VTextField,
			VTabs,
			VCheckbox,
			VSelect,
			VSubheader,
			VBtn,
			VBtnToggle,
			VIcon,
			VProgressLinear,
			VProgressCircular,

			// VFooter,
			VGrid,
			transitions,
		},
		theme: {
			primary: '#2196F3',
			secondary: '#424242',
			accent: '#2196F3',
			error: '#FF5252',
			info: '#82b1ff',
			success: '#4CAF50',
			warning: '#FFC107'
		}
	})

	// Vue.use(VueMenu);
	Vue.use(VueTippy);
	Vue.use(Vddl);
	Vue.use(Vuebar);
	// Vue.use(VueWorker);
	// Vue.use(VueVisible);
	// Vue.use(Dropdown);
	// Vue.use(VuePerfectScrollbar);

	Vue.component('simple-spinner', Spinner)
	Vue.component('dropdown', Dropdown)
	Vue.component('drop-file', DropFile)
	// Vue.component('VuePerfectScrollbar', VuePerfectScrollbar)
	// Vue.component('v-bar', Vuebar)
	// Vue.use({
	// 	components: 
	// 		{
	// 			'simple-spinner': Spinner
	// 		}
	// 	})

	Vue.use(require('vue-shortkey'), { prevent: ['input', 'textarea'] })


	window._vm_ = new Vue();

	new Vue({
		// el: 'app',
		render: h => h(App),
		mounted() {
			// this.$nextTick({
			//     // Code that will run only after the
			//     // entire view has been rendered
			// })
		}
	}).$mount('#start')

};

if (!window._supportsWebgl || (navigator.userAgent.indexOf("Trident")>-1) )
	window.onload = null;

if (module.hot) {
	module.hot.accept();
}