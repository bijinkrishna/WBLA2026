const fs = require('fs');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: fs.existsSync(path.join(__dirname, 'VERSION'))
      ? fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim()
      : '0.0.0',
  },
};

module.exports = nextConfig;
