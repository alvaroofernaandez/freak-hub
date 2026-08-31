# Freak Hub — API (Go)
# Every target is safe to run from the repo root as `make -C apps/api <target>`.

GO           ?= go
BINARY       ?= bin/api
PKG          ?= ./...
GOLANGCI     ?= $(shell $(GO) env GOPATH)/bin/golangci-lint
SQLC         ?= $(shell $(GO) env GOPATH)/bin/sqlc
GOOSE_DIR    ?= db/migrations

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: dev
dev: ## Run the API with live-reloading disabled (plain go run)
	$(GO) run ./cmd/api

.PHONY: build
build: ## Compile the API binary into bin/
	CGO_ENABLED=0 $(GO) build -trimpath -ldflags="-s -w" -o $(BINARY) ./cmd/api

.PHONY: test
test: ## Run the unit test suite
	$(GO) test -race -count=1 $(PKG)

.PHONY: test-cover
test-cover: ## Run tests and open the coverage report
	$(GO) test -race -count=1 -coverprofile=coverage.out $(PKG)
	$(GO) tool cover -html=coverage.out

.PHONY: lint
lint: ## Run go vet and golangci-lint
	$(GO) vet $(PKG)
	@test -x $(GOLANGCI) || (echo "golangci-lint missing: make tools" && exit 1)
	$(GOLANGCI) run

.PHONY: fmt
fmt: ## Format the code
	$(GO) fmt $(PKG)

.PHONY: sqlc
sqlc: ## Regenerate the type-safe query layer from db/queries
	@test -x $(SQLC) || (echo "sqlc missing: make tools" && exit 1)
	$(SQLC) generate

.PHONY: migrate-up
migrate-up: ## Apply every pending migration
	$(GO) run ./cmd/migrate up

.PHONY: migrate-down
migrate-down: ## Roll back the last migration
	$(GO) run ./cmd/migrate down

.PHONY: migrate-status
migrate-status: ## Show which migrations have run
	$(GO) run ./cmd/migrate status

.PHONY: migrate-new
migrate-new: ## Create a migration: make migrate-new NAME=add_something
	@test -n "$(NAME)" || (echo "NAME is required, e.g. make migrate-new NAME=add_reviews" && exit 1)
	@printf -- '-- +goose Up\n-- +goose StatementBegin\n\n-- +goose StatementEnd\n\n-- +goose Down\n-- +goose StatementBegin\n\n-- +goose StatementEnd\n' \
		> $(GOOSE_DIR)/$$(date -u +%Y%m%d%H%M%S)_$(NAME).sql
	@echo "created $(GOOSE_DIR)/$$(date -u +%Y%m%d%H%M%S)_$(NAME).sql"

.PHONY: tools
tools: ## Install the developer tooling (sqlc, golangci-lint)
	$(GO) install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	$(GO) install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest

.PHONY: clean
clean: ## Remove build artefacts
	rm -rf bin coverage.out
