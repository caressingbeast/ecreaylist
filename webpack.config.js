let path = require("path");

module.exports = {
	entry: path.resolve(__dirname, "public/js/app.js"),
	output: {
		path: path.resolve(__dirname, "public/js/"),
		publicPath: "/js",
		filename: "app.min.js",
		chunkFilename: "app.[id].min.js"
	},
	resolve: {
		extensions: [
			// resolves extensions in this preferred order
			".jsx",
			".js",
			".min.js"
		],
		alias: {
			// path configs
		}
	},
	devtool: "source-map", // slows compiling, but keeps sanity
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: "babel-loader"
			}
		]
	},
	devServer: {
		inline: true,
		contentBase: path.resolve(__dirname, "public"),
		historyApiFallback: true,
		host: "localhost",
		port: 8080
	}
};
