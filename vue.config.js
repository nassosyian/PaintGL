var LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
var UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
	// If extractCSS is always true, the 'Hot module replacement' will not work.
	// extractCSS: process.env.NODE_ENV === 'production'
	configureWebpack: config => {


		// config.plugins = [new LodashModuleReplacementPlugin];
		if (process.env.NODE_ENV === 'production') 
		{
		  // mutate config for production...
		//   console.log(config);
		  config.plugins.push(
			new UglifyJsPlugin({
				uglifyOptions:{
						output: {
							comments: false, // remove comments
						},
						compress: {
							unused: true,
							dead_code: true, // big one--strip code that will never execute
							warnings: false, // good for prod apps so users can't peek behind curtain
							drop_debugger: true,
							conditionals: true,
							// evaluate: true,
							// drop_console: true, // strips console statements
							sequences: true,
							booleans: true,
						},
						mangle: true
				},
			  }),
			);
		} 
		else 
		{
		  // mutate for development...
		  config.devtool = 'source-map'
		}
	}
};