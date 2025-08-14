import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kyosan-map/ui"],
  experimental:{
    useCache:true,
  }
};

export default nextConfig;
