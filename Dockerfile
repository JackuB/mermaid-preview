FROM node:22-alpine3.20 as base
LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base as build


# Install node modules
# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"
COPY --link package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY --link . .
# Our build script uses bash, we need to add it to alpine
RUN apk add bash
RUN npm run build

# Final stage for app image
FROM base

# Install packages needed for deployment
# Note: this installs the necessary libs to make the browser work with Puppeteer.
# Install Google Chrome Stable and fonts
# Install packages needed to build node modules
RUN apk add chromium font-noto-cjk font-noto-emoji \
  terminus-font ttf-dejavu ttf-freefont ttf-font-awesome \
  ttf-inconsolata ttf-linux-libertine \
  && fc-cache -f

# Copy built application
COPY --from=build /app /app

ENV CHROME_BIN="/usr/bin/chromium-browser"

EXPOSE 3000
CMD [ "node", "dist/index.js" ]
