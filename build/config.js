const path = require('path');
const resolve=require('resolve')
const buble = require('rollup-plugin-buble');
const babel = require('rollup-plugin-babel');
const rollupResolve =require('rollup-plugin-node-resolve')
const version = process.env.VERSION || require('../package.json').version;
const libName=require('../package.json').name
const moduleName=libName.substring(0,libName.lastIndexOf('.')) 


const banner =
  `/*
 * ${libName.toUpperCase()} v${version}
 * (c) 2016-${new Date().getFullYear()} Rhymedys<Rhymedys@gmail.com>
 * Released under the MIT license.
 */`;

const configs = {
  'dev': {
    input: path.resolve(__dirname, '../src/index.js'),
    output: {
      file: path.resolve(__dirname, `../dist/${libName}-${version}.js`),
      format:'es',
      banner,
      name: 'LightSocketIO' 
    },
    plugins: [
      buble(),
      babel()
    ]
  },
  'production': {
    input: path.resolve(__dirname, '../src/index.js'),
    output: {
      file: path.resolve(__dirname, `../dist/${libName}-${version}.js`),
      format:'es',
      banner,
      name: 'LightSocketIO',
      env: 'production'
    },  
    plugins: [
      buble(),
      babel()
  
    ]
  }
};

if (process.env.TARGET) {
  module.exports = configs[process.env.TARGET];
} else {
  module.exports =configs['production'];
}