# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.14.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y build-essential pkg-config python3 python-is-python3

# Install node modules
# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
COPY --link package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY --link . .
RUN npm run build


# Final stage for app image
FROM base

# Install packages needed for deployment
# Note: this installs the necessary libs to make the browser work with Puppeteer.
# Install Google Chrome Stable and fonts
RUN apt update && apt install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt update && \
  apt install google-chrome-stable -y --no-install-recommends && \
  apt install fontconfig fonts-noto-color-emoji -y && \
  fc-cache -fv && \
  rm -rf /var/lib/apt/lists/*

RUN echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections
RUN sh -c 'echo "deb http://http.us.debian.org/debian stable main contrib non-free" >> /etc/apt/sources.list.d/contrib.list' && \
    apt update && apt install -y ttf-mscorefonts-installer
RUN apt install -y fonts-font-awesome xfonts-terminus fonts-freefont-ttf fonts-takao
RUN fc-cache -fv

# Copy built application
COPY --from=build /app /app

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "node", "dist/index.js" ]
