module.exports = (options, webpack) => {
  return {
    ...options,
    externals: [
      ...(Array.isArray(options.externals) ? options.externals : []),
    ],
    plugins: [
      ...(options.plugins || []),
      new webpack.IgnorePlugin({
        resourceRegExp: /prisma\.config/,
      }),
    ],
  };
};
