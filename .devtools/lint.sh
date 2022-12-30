#!/usr/bin/bash

if ! which npx 2>&1 > /dev/null; then
    echo "[lint] npm/npx is not installed"
    exit 1
fi

npx prettier > /dev/null || npm install prettier && echo "[lint] We have 'prettier'"
npx eslint > /dev/null || npm install eslint && echo "[lint] We have 'eslint'"
npx prettier-eslint > /dev/null || npm install prettier-eslint-cli && echo "[lint] We have 'prettier-eslint'"

echo "[lint] Linting JavaScript files..."
npx prettier-eslint --write "**/*.js"
echo "[lint] Linting HTML files..."
npx prettier-eslint --write "**/*.html"
echo "[lint] Linting CSS files..."
npx prettier-eslint --write "**/*.css"
echo "[lint] Linting MarkDown files"
npx prettier-eslint --write "**/*.md"

echo "[lint] Finished Linting."