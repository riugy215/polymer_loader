'use strict';

const path 			= require('path');
const fs 			= require('fs');
const loaderUtils 	= require('loader-utils');
const SourceMap 	= require('source-map');

module.exports = function (source, sourceMap)
{
    let query = loaderUtils.parseQuery(this.query);

    if (this.cacheable)
        this.cacheable();

    // /foo/bar/file.js
    let srcFilepath 	= this.resourcePath;
	
    // /foo/bar/file.js -> file
    let srcFilename 		= path.basename(srcFilepath, path.extname(srcFilepath));
	
    // /foo/bar/file.js -> /foo/bar
    let srcDirpath  		= path.dirname(srcFilepath);
	
    // /foo/bar -> bar
    let srcDirname  		= srcDirpath.split(path.sep).pop();

    let elementName 		= srcFilename == 'index' ? srcDirname : srcFilename;

    let templateExtension 	= query.templateExt || query.templateExtension || 'html';
    let styleExtension    	= query.styleExt || query.styleExtension || 'css';

    let htmlExists = fs.existsSync(path.join(srcDirpath, elementName+'.'+templateExtension));
    let cssExists  = fs.existsSync(path.join(srcDirpath, elementName+'.'+styleExtension));

    let buffer = (htmlExists || cssExists) ? ['\n/* inject from polymer-loader */\n'] : '';
	
	buffer.push("(function() {");
	buffer.push(	"\tlet componentTemplate	= \"\";");
	
	if (cssExists)
		buffer.push("\tcomponentTemplate += require('./"+elementName+"."+styleExtension+"') + '\\n';");
		
	if (htmlExists)
		buffer.push("\tcomponentTemplate += require('./"+elementName+"."+templateExtension+"') + '\\n';");
		
	buffer	= buffer.concat([
		"\tlet html = require(\"@polymer/polymer\").html;",
		"\tlet Component 	= require('./"+elementName+".js');",
		"\tif (\"default\" in Component)",
		"\t\tComponent = Component.default;",
		"\tObject.defineProperty(Component, \"template\", {value: html([componentTemplate])});",
		"\tcustomElements.define(\"" + elementName + "\", Component);",
		"})();"
	])
	
	let inject = buffer.join("\n");

    // support existing SourceMap
    // https://github.com/mozilla/source-map#sourcenode
    // https://github.com/webpack/imports-loader/blob/master/index.js#L34-L44
    // https://webpack.github.io/docs/loaders.html#writing-a-loader
    if (sourceMap) {
        var currentRequest = loaderUtils.getCurrentRequest(this);
        var SourceNode = SourceMap.SourceNode;
        var SourceMapConsumer = SourceMap.SourceMapConsumer;
        var sourceMapConsumer = new SourceMapConsumer(sourceMap);
        var node = SourceNode.fromStringWithSourceMap(source, sourceMapConsumer);

        node.prepend(inject);

        var result = node.toStringWithSourceMap({
            file: currentRequest
        });

        this.callback(null, result.code, result.map.toJSON());

        return;
    }

    // prepend collected inject at the top of file
    return source +'\n'+ inject;


    // return the original source and sourceMap
    if (sourceMap) {
        this.callback(null, source, sourceMap);
        return;
    }

    // return the original source
    return source;
};

