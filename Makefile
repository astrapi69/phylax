.DEFAULT_GOAL := help

.PHONY: help dev preview install clean icons lint lint-fix format format-check typecheck test test-watch test-coverage test-e2e test-e2e-ui test-e2e-production test-bundle-size test-mutation-dry test-mutation-quick build check ci-local-fast ci-local-full

# -- Development --

dev: ## Start the dev server on port 6173
	npm run dev

preview: ## Preview the production build on port 6174
	npm run preview

install: ## Clean install of dependencies
	npm ci

clean: ## Remove node_modules, dist, and coverage
	rm -rf node_modules dist coverage

icons: ## Generate PNG icons from SVG sources
	node scripts/generate-icons.mjs

# -- Quality --

lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with --fix
	npx eslint --fix .

format: ## Run Prettier --write
	npm run format

format-check: ## Run Prettier --check
	npm run format:check

typecheck: ## Run tsc --noEmit
	npm run typecheck

# -- Testing --

test: ## Run all unit tests once
	npm test

test-watch: ## Run unit tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

test-e2e: ## Run Playwright end-to-end tests
	npm run test:e2e

test-e2e-ui: ## Run Playwright tests in interactive UI mode
	npx playwright test --ui

test-e2e-production: ## Run Playwright E2E against production build
	npx playwright test --config playwright.config.production.ts

test-bundle-size: build ## Check production bundle against size-limit budgets
	npm run size

test-mutation-dry: ## Validate Stryker config without running mutations
	npx stryker run --dryRunOnly

test-mutation-quick: ## Run Stryker mutation tests for the crypto module only
	npx stryker run

# -- Build and release --

build: ## Production build
	npm run build

check: lint typecheck test build ## Run lint, typecheck, test, and build (CI gate)

# -- CI parity --

ci-local-fast: lint typecheck test ## Fast CI check (no build, no E2E)

ci-local-full: lint typecheck test-coverage test-bundle-size test-e2e test-e2e-production ## Full CI check

# -- Meta --

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
