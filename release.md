## New Release
pnpm build <- check if its buildling
set new version in package.json
pnpm run version
git tag -a 0.0.4 -m "0.0.4"
git push origin 0.0.4

## Remove Tag
git tag -d 0.0.4
git push origin :refs/tags/0.0.4
git tag 0.0.4
git push origin 0.0.4
