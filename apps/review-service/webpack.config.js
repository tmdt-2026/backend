module.exports = (options, webpack) => {
  return {
    ...options,
    externals: [
      ...(Array.isArray(options.externals) ? options.externals : []),
    ],
    plugins: [
      ...(options.plugins || []),
      // Ignore prisma.config.ts khi webpack bundle
      new webpack.IgnorePlugin({
        resourceRegExp: /prisma\.config/,
      }),
    ],
  };
};
