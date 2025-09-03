import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@kyosan-map/ui","@kyosan-map/out-camera"],
  experimental:{
    useCache:true,
  }
};

export default nextConfig;
