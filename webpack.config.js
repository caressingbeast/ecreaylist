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
			// todo: remove these once we convert to ES6 imports (and we stop using the script-loader)
			'socket.io-client$': 'socket.io-client/dist/socket.io.js',
			'angular$': 'angular/angular.js'
		}
	},
	devtool: "source-map", // slows compiling, but keeps sanity
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: "babel-loader"
			},
			{
				test: /\.css$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'style-loader',
					},
					{
						loader: 'css-loader',
						options: {
							importLoaders: 1,
						}
					},
					{
						loader: 'postcss-loader'
					}
				]
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
