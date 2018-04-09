
VERSION=`cat package.json|awk -F"[:]" '/version/{print $2}' | sed 's/\"//g' | sed 's/^[ \t]*//g' |sed 's/\(.*\).$/\1/g' `

set -e

read -p "Releasing v$VERSION - are you sure? (y/n)" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Releasing v$VERSION ..."

  # build
   npm run build

  # commit
  
  git add -A
  git commit -m "[build] v$VERSION"
  # npm version $VERSION --message "[release] $VERSION"

  # publish
  # git push origin refs/tags/v$VERSION
  git tag -a v$VERSION -m"[release] v$VERSION"
  git push origin v$VERSION  
  git push
  npm publish
fi
