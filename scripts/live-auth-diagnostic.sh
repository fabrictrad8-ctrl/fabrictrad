#!/usr/bin/env bash
set -u

inspect_domain() {
  local base_url="$1"
  local safe_name
  safe_name=$(echo "$base_url" | sed 's#https://##; s#[^a-zA-Z0-9]#-#g')

  echo "DOMAIN=$base_url"

  local login_status
  login_status=$(curl -sS --connect-timeout 10 --max-time 30 -o "/tmp/${safe_name}-login.html" -w '%{http_code}' "$base_url/login" || true)
  echo "LOGIN=$login_status"

  local buyer_status
  buyer_status=$(curl -sS --connect-timeout 10 --max-time 30 \
    -o "/tmp/${safe_name}-buyer.json" -w '%{http_code}' \
    -c "/tmp/${safe_name}-buyer.cookies" \
    -H 'Content-Type: application/json' \
    --data '{"email":"demo.buyer@fabrictrad.com","password":"FabricDemo@2026"}' \
    "$base_url/api/auth/demo-session" || true)
  echo "BUYER=$buyer_status BODY=$(tr -d '\n' < "/tmp/${safe_name}-buyer.json" 2>/dev/null || true) COOKIE=$(grep -c 'fabrictrad_demo_role' "/tmp/${safe_name}-buyer.cookies" 2>/dev/null || true)"

  local buyer_marketplace_status buyer_marketplace_location
  buyer_marketplace_status=$(curl -sS --connect-timeout 10 --max-time 30 \
    -D "/tmp/${safe_name}-buyer-marketplace.headers" -o /dev/null -w '%{http_code}' \
    -b "/tmp/${safe_name}-buyer.cookies" --max-redirs 0 "$base_url/marketplace" || true)
  buyer_marketplace_location=$(grep -i '^location:' "/tmp/${safe_name}-buyer-marketplace.headers" 2>/dev/null | tr -d '\r\n' || true)
  echo "BUYER_MARKETPLACE=$buyer_marketplace_status $buyer_marketplace_location"

  local seller_status
  seller_status=$(curl -sS --connect-timeout 10 --max-time 30 \
    -o "/tmp/${safe_name}-seller.json" -w '%{http_code}' \
    -c "/tmp/${safe_name}-seller.cookies" \
    -H 'Content-Type: application/json' \
    --data '{"email":"demo.seller@fabrictrad.com","password":"FabricDemo@2026"}' \
    "$base_url/api/auth/demo-session" || true)
  echo "SELLER=$seller_status BODY=$(tr -d '\n' < "/tmp/${safe_name}-seller.json" 2>/dev/null || true) COOKIE=$(grep -c 'fabrictrad_demo_role' "/tmp/${safe_name}-seller.cookies" 2>/dev/null || true)"

  local seller_dashboard_status seller_dashboard_location
  seller_dashboard_status=$(curl -sS --connect-timeout 10 --max-time 30 \
    -D "/tmp/${safe_name}-seller-dashboard.headers" -o /dev/null -w '%{http_code}' \
    -b "/tmp/${safe_name}-seller.cookies" --max-redirs 0 "$base_url/seller-dashboard" || true)
  seller_dashboard_location=$(grep -i '^location:' "/tmp/${safe_name}-seller-dashboard.headers" 2>/dev/null | tr -d '\r\n' || true)
  echo "SELLER_DASHBOARD=$seller_dashboard_status $seller_dashboard_location"
  echo
}

inspect_domain 'https://fabrictrad.com'
inspect_domain 'https://www.fabrictrad.com'
