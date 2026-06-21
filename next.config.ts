import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "ts-morph",
    "simple-git",
    "bullmq",
    "ioredis",
    "@prisma/client",
    "prisma",
    "@langchain/langgraph",
    "@langchain/core",
    "@langchain/openai",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
