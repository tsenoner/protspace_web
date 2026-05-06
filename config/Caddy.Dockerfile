# Custom Caddy build with the caddy-ratelimit plugin baked in.
# Required by the prep backend's hardening posture (and matches the
# `Caddyfile.example` deployment recipe).

FROM caddy:2-builder AS builder
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
