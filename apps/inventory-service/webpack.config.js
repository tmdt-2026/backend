// apps/inventory-service/webpack.config.js
// apps/user-service/webpack.config.js  
// ... (copy y chang cho mỗi service có prisma)

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