/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add WASM file loader
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add rule for .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[name][ext]'
      }
    });

    // Configure WASM loading
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Add source maps for debugging
    if (!isServer) {
      config.devtool = 'source-map';
    }

    return config;
  },
  // Add headers for WASM MIME type
  async headers() {
    return [
      {
        source: '/static/wasm/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
