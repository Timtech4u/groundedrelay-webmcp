#!/usr/bin/env bash
set -euo pipefail

# This command creates the three Pages projects when needed, then publishes only
# tracked files from the exact clean origin/main commit. During the first
# rights-safe migration, deploy the fail-closed storefront first, smoke it,
# then provider, then the independent merchant proof.
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
wrangler_version="4.126.0"

cd "$project_dir"
command -v git >/dev/null 2>&1 || { echo "git is required." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is required." >&2; exit 1; }
command -v shasum >/dev/null 2>&1 || { echo "shasum is required." >&2; exit 1; }

origin_url="$(git remote get-url origin 2>/dev/null || true)"
case "$origin_url" in
  https://github.com/Timtech4u/groundedrelay-webmcp|https://github.com/Timtech4u/groundedrelay-webmcp.git|git@github.com:Timtech4u/groundedrelay-webmcp.git|ssh://git@github.com/Timtech4u/groundedrelay-webmcp.git) ;;
  *)
    echo "Refusing deployment: origin is not the clean public GroundedRelay repository." >&2
    echo "Expected github.com/Timtech4u/groundedrelay-webmcp; received ${origin_url:-no origin}." >&2
    exit 1
    ;;
esac

branch="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$branch" != "main" ]]; then
  echo "Refusing deployment: check out the public main branch first (found ${branch:-detached HEAD})." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  echo "Refusing deployment: the working tree is dirty." >&2
  echo "Commit or remove local changes, then run this command from a clean main checkout." >&2
  exit 1
fi

git fetch --quiet origin main
commit_sha="$(git rev-parse HEAD)"
origin_main_sha="$(git rev-parse origin/main)"
if [[ "$commit_sha" != "$origin_main_sha" ]]; then
  echo "Refusing deployment: HEAD does not equal origin/main." >&2
  echo "HEAD:        $commit_sha" >&2
  echo "origin/main: $origin_main_sha" >&2
  exit 1
fi

echo "Running deterministic and public-code release gates before Cloudflare access…"
npm run check
npm run check:release -- --code-only

echo "Verifying Cloudflare identity and Pages projects…"
npx --yes "wrangler@${wrangler_version}" whoami --json >/dev/null
projects_json="$(npx --yes "wrangler@${wrangler_version}" pages project list --json)"
for project_name in groundedrelay groundedrelay-provider groundedrelay-merchant; do
  if ! PROJECTS_JSON="$projects_json" PROJECT_NAME="$project_name" \
      node --input-type=module <<'NODE'
const projects = JSON.parse(process.env.PROJECTS_JSON || "[]");
const name = process.env.PROJECT_NAME;
process.exit(projects.some((candidate) => candidate?.["Project Name"] === name) ? 0 : 1);
NODE
  then
    echo "Creating Cloudflare Pages project: $project_name"
    npx --yes "wrangler@${wrangler_version}" pages project create "$project_name" \
      --production-branch main
    projects_json="$(npx --yes "wrangler@${wrangler_version}" pages project list --json)"
  fi
done
PROJECTS_JSON="$projects_json" node --input-type=module <<'NODE'
const projects = JSON.parse(process.env.PROJECTS_JSON || "[]");
const expected = [
  ["groundedrelay", "groundedrelay.pages.dev"],
  ["groundedrelay-provider", "groundedrelay-provider.pages.dev"],
  ["groundedrelay-merchant", "groundedrelay-merchant.pages.dev"],
];
for (const [name, domain] of expected) {
  const project = projects.find((candidate) => candidate?.["Project Name"] === name);
  if (!project) throw new Error(`Missing Cloudflare Pages project: ${name}`);
  const domains = new Set(String(project["Project Domains"] ?? "").split(/,\s*/)
    .filter(Boolean).map((value) => value.replace(/^https?:\/\//, "").replace(/\/$/, "")));
  if (!domains.has(domain)) {
    throw new Error(`${name} is not attached to ${domain}`);
  }
}
NODE

snapshot_dir="$(mktemp -d "${TMPDIR:-/tmp}/groundedrelay-pages.XXXXXX")"
cleanup() { rm -rf -- "$snapshot_dir"; }
trap cleanup EXIT
git archive "$commit_sha" sites/storefront sites/embed sites/merchant-demo |
  tar -x -C "$snapshot_dir"

asset_check() {
  local label="$1"
  local url="$2"
  local expected_file="$3"
  local remote_file="$snapshot_dir/remote-$RANDOM"
  local expected_hash
  local remote_hash
  expected_hash="$(shasum -a 256 "$expected_file" | awk '{print $1}')"
  for attempt in 1 2 3 4 5; do
    curl --fail --silent --show-error --location \
      --retry 2 --retry-delay 1 --retry-all-errors --max-time 12 \
      --header 'Cache-Control: no-cache' \
      --output "$remote_file" "${url}?release=${commit_sha}" || true
    remote_hash="$(shasum -a 256 "$remote_file" 2>/dev/null | awk '{print $1}' || true)"
    if [[ "$remote_hash" == "$expected_hash" ]]; then break; fi
    if [[ "$attempt" != 5 ]]; then sleep 2; fi
  done
  if [[ "$remote_hash" != "$expected_hash" ]]; then
      echo "Stopping after $label: deployed bytes do not match public release $commit_sha." >&2
      echo "Expected: $expected_hash" >&2
      echo "Received: ${remote_hash:-request failed}" >&2
      exit 1
    fi
  echo "Exact asset passed: $label ($url)"
}

site_tree_check() {
  local label="$1"
  local base_url="$2"
  local site_dir="$3"
  local entry_file="$4"
  local entry_path="$5"
  local expected_file
  local relative
  local public_path
  while IFS= read -r -d '' expected_file; do
    relative="${expected_file#"$site_dir"/}"
    case "$relative" in
      _headers|.gitignore) continue ;;
    esac
    public_path="/$relative"
    if [[ "$relative" == "$entry_file" ]]; then public_path="$entry_path"; fi
    asset_check "$label $relative" "${base_url}${public_path}" "$expected_file"
  done < <(find "$site_dir" -type f -print0)
}

npx --yes "wrangler@${wrangler_version}" pages deploy "$snapshot_dir/sites/storefront" \
  --project-name groundedrelay \
  --branch main \
  --commit-hash "$commit_sha"
site_tree_check "storefront" "https://groundedrelay.pages.dev" \
  "$snapshot_dir/sites/storefront" "index.html" "/"

npx --yes "wrangler@${wrangler_version}" pages deploy "$snapshot_dir/sites/embed" \
  --project-name groundedrelay-provider \
  --branch main \
  --commit-hash "$commit_sha"
site_tree_check "provider" "https://groundedrelay-provider.pages.dev" \
  "$snapshot_dir/sites/embed" "embed.html" "/embed"

npx --yes "wrangler@${wrangler_version}" pages deploy "$snapshot_dir/sites/merchant-demo" \
  --project-name groundedrelay-merchant \
  --branch main \
  --commit-hash "$commit_sha"
site_tree_check "merchant" "https://groundedrelay-merchant.pages.dev" \
  "$snapshot_dir/sites/merchant-demo" "index.html" "/"

echo "Running the signed-out production contract, including the complete multi-catalogue provider…"
npm run check:release -- --code-only --online

echo "All three Pages origins serve every tracked public asset from release $commit_sha."
echo "Production also passed the three-catalogue, six-product, two-host release contract."
