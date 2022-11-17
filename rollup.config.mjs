export default {
  input: 'src/index.mjs',
  output: [
      {
        file: "dist/node-live-stream-h5-flv.cjs",
        format: 'cjs'
      },
      {
        file: "dist/node-live-stream-h5-flv.mjs",
        format: 'es'
      },
  ]
};