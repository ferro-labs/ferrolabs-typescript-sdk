.PHONY: install fmt lint test typecheck build clean

install:
	npm install

fmt:
	npx prettier --write 'src/**/*.ts' 'tests/**/*.ts'

lint:
	npx eslint src/ tests/

test:
	npx vitest run

typecheck:
	npx tsc --noEmit

build:
	npx tsup

clean:
	rm -rf dist coverage .tsbuildinfo
