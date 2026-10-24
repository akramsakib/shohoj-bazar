#!/usr/bin/env bash
# ---------------------------------------------------------------
# Shohoj Bazar — one-shot publish to GitHub Pages
#
#   export GH_TOKEN=ghp_xxx        # fine-grained token, Contents: read & write
#   export GH_OWNER=your-username
#   export GH_REPO=shohoj-bazar    # optional, defaults to shohoj-bazar
#   export GH_EMAIL=you@email.com  # optional, used for the commit
#   ./deploy.sh
# ---------------------------------------------------------------
set -euo pipefail

API="https://api.github.com"
: "${GH_TOKEN:?Set GH_TOKEN first}"
: "${GH_OWNER:?Set GH_OWNER first}"
GH_REPO="${GH_REPO:-shohoj-bazar}"
GH_EMAIL="${GH_EMAIL:-${GH_OWNER}@users.noreply.github.com}"
BRANCH="main"
DIR="$(cd "$(dirname "$0")" && pwd)"

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

gh() { # gh METHOD PATH [BODY]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" -H "Authorization: Bearer $GH_TOKEN" \
      -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
      -d "$body" "$API$path"
  else
    curl -sS -X "$method" -H "Authorization: Bearer $GH_TOKEN" \
      -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
      "$API$path"
  fi
}

json() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(eval('(JSON.parse(d))'+process.argv[1]))}catch(e){console.log('')}})" "$1"; }

# ---------- 0. verify the token ----------
say "Checking the token"
WHO=$(gh GET /user)
LOGIN=$(printf '%s' "$WHO" | json ".login")
if [ -z "$LOGIN" ]; then
  warn "The token was rejected by GitHub:"
  printf '%s\n' "$WHO" | head -5
  exit 1
fi
echo "   authenticated as: $LOGIN"

if [ "$LOGIN" != "$GH_OWNER" ]; then
  warn "Token belongs to '$LOGIN' but GH_OWNER is '$GH_OWNER' — using '$LOGIN'"
  GH_OWNER="$LOGIN"
fi

# ---------- 1. create the repo if needed ----------
say "Repository $GH_OWNER/$GH_REPO"
if gh GET "/repos/$GH_OWNER/$GH_REPO" | json ".id" | grep -q .; then
  echo "   already exists"
else
  CREATED=$(gh POST "/user/repos" "{\"name\":\"$GH_REPO\",\"description\":\"Shohoj Bazar — virtual super shop for Bangladesh\",\"private\":false,\"has_issues\":true,\"has_wiki\":false}")
  if printf '%s' "$CREATED" | json ".full_name" | grep -q .; then
    echo "   created"
  else
    warn "Could not create the repo:"; printf '%s\n' "$CREATED" | head -5; exit 1
  fi
fi

# ---------- 2. commit and push ----------
say "Pushing the shop"
cd "$DIR"
if [ ! -d .git ]; then
  git init -q
  git symbolic-ref HEAD "refs/heads/$BRANCH"
fi
git config user.email "$GH_EMAIL"
git config user.name "$GH_OWNER"
git add -A
if git diff --cached --quiet; then
  echo "   nothing new to commit"
else
  git commit -q -m "Shohoj Bazar — virtual super shop (Section 1: the walkable shop)"
  echo "   committed"
fi
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${GH_TOKEN}@github.com/${GH_OWNER}/${GH_REPO}.git"
git push -q -u origin "$BRANCH" --force

# ---------- 3. enable Pages ----------
say "Turning on GitHub Pages"
PAGES=$(gh POST "/repos/$GH_OWNER/$GH_REPO/pages" "{\"source\":{\"branch\":\"$BRANCH\",\"path\":\"/\"}}")
if printf '%s' "$PAGES" | json ".html_url" | grep -q .; then
  echo "   pages enabled"
else
  # already enabled — make sure the source is right
  gh PUT "/repos/$GH_OWNER/$GH_REPO/pages" "{\"source\":{\"branch\":\"$BRANCH\",\"path\":\"/\"}}" >/dev/null || true
  echo "   pages already configured"
fi

URL="https://${GH_OWNER}.github.io/${GH_REPO}/"
printf '\n\033[1;32m✅ Live at %s\033[0m\n' "$URL"
cat <<EOF

   First deploy takes 1–2 minutes to become reachable.
   Repo:      https://github.com/${GH_OWNER}/${GH_REPO}
   Pages cfg: https://github.com/${GH_OWNER}/${GH_REPO}/settings/pages

   Re-run ./deploy.sh any time to publish updates.

EOF
