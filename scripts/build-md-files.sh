#!/usr/bin/env bash
set -exuo pipefail

sed 's/__TITLE__/Terms of Service/g' public/default-header.html > ./public/tos.html
npx  marked -i public/md/tos.md >> ./public/tos.html
cat ./public/default-footer.html >> ./public/tos.html

sed 's/__TITLE__/Privacy Policy/g' public/default-header.html > ./public/privacy-policy.html
npx  marked -i public/md/privacy-policy.md >> ./public/privacy-policy.html
cat ./public/default-footer.html >> ./public/privacy-policy.html

sed 's/__TITLE__/Support/g' public/default-header.html > ./public/support.html
npx  marked -i public/md/support.md >> ./public/support.html
cat ./public/default-footer.html >> ./public/support.html
