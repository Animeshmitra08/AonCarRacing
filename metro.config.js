// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 3D car models are bundled as binary assets and loaded with three's GLTFLoader.
config.resolver.assetExts.push("glb");

module.exports = config;
