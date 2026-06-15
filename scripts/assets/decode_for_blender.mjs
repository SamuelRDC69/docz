// Decode a shipped, web-optimized GLB into a Blender-importable one.
//
// The shipping character GLBs in public/models/chars/ are optimized for the
// browser (three.js): EXT_meshopt_compression + EXT_texture_webp +
// KHR_mesh_quantization, all listed in extensionsRequired. Blender's glTF
// importer does NOT support EXT_meshopt_compression, so it aborts the import.
//
// This script reads the optimized file (registering the meshopt DECODER so the
// geometry is decompressed on read), then dequantizes meshes and converts
// textures to PNG, and writes WITHOUT re-applying meshopt. The result imports
// cleanly into Blender on any recent version.
//
// Usage:
//   node scripts/assets/decode_for_blender.mjs public/models/chars/barbarian.glb
//   node scripts/assets/decode_for_blender.mjs <in.glb> <out.glb>

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/assets/decode_for_blender.mjs <in.glb> [out.glb]');
  process.exit(1);
}
const output = process.argv[3] ?? input.replace(/\.glb$/i, '.blender.glb');

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  // Only the decoder — no encoder, so meshopt is NOT re-applied on write.
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

await MeshoptDecoder.ready;

const doc = await io.read(input);
await doc.transform(
  dequantize(),                                   // drop KHR_mesh_quantization
  textureCompress({ encoder: sharp, targetFormat: 'png' }), // webp -> png
);
await io.write(output, doc);

console.log(`Wrote ${output} — meshopt decoded, textures as PNG. Import this in Blender.`);
