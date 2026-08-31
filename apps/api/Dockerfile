# syntax=docker/dockerfile:1

# --- Build ------------------------------------------------------------------
FROM golang:1.26-alpine AS build

WORKDIR /src

# Copy the manifests first so the dependency layer is cached across code changes.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .

# CGO off keeps the binary static, so the runtime image needs no libc.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# --- Runtime ----------------------------------------------------------------
FROM alpine:3.22 AS runtime

# ca-certificates is required to reach Clerk over TLS.
RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 freakhub

COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate

USER freakhub
EXPOSE 8080

# The health endpoint is public on purpose so the orchestrator can poll it.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/api"]
