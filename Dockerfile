# CloudFlare FPC Worker — Test Runner
#
# Runs the Jest integration test suite against a live Cloudflare Worker endpoint.
# The container performs no deployment — it only sends HTTP requests and
# asserts response headers.
#
# Build:  docker build -t fpc-tests .
# Run:    docker run --rm -e TEST_URL=https://yoursite.com/ fpc-tests

FROM node:20-alpine

# Install ca-certificates so HTTPS requests to the target site work correctly
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Install dependencies first (layer-cached unless package*.json changes)
COPY package.json package-lock.json* ./
RUN npm install

# Copy project sources
COPY . .

# TEST_URL must be supplied at runtime — fail fast with a clear message if absent
ENTRYPOINT ["sh", "-c", "\
  if [ -z \"$TEST_URL\" ]; then \
    echo 'ERROR: TEST_URL is not set.'; \
    echo 'Usage: docker run --rm -e TEST_URL=https://yoursite.com/ fpc-tests'; \
    exit 1; \
  fi; \
  echo \"Running FPC tests against: $TEST_URL\"; \
  exec npm run test:ci \
"]
