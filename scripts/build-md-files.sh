#!/usr/bin/env bash
set -exuo pipefail

sed 's/__TITLE__/Mermaid Preview ToS/g' public/default-header.html > ./public/tos.html
npx  marked -i public/tos.md >> ./public/tos.html
cat ./public/default-footer.html >> ./public/tos.html

sed 's/__TITLE__/Mermaid Preview Privacy Policy/g' public/default-header.html > ./public/privacy-policy.html
npx  marked -i public/privacy-policy.md >> ./public/privacy-policy.html
cat ./public/default-footer.html >> ./public/privacy-policy.html
