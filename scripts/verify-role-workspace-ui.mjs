import fs from 'node:fs';

// The signed-in primary role owns the visible workspace until the user signs out.
const read = (path) => fs.readFileSync(path, 'utf8');
const profileMenu = read('src/components/ProfileMenu.tsx');
const buyerLayout = read('src/app/buyer-dashboard/components/ModernBuyerDashboardLayout.tsx');
const sellerLayout = read('src/app/seller-dashboard/components/SellerDashboardLayout.tsx');
const buyerGuard = read('src/components/BuyerOnlyGuard.tsx');
const accountLayout = read('src/app/account/layout.tsx');
const buyerRouteLayout = read('src/app/buyer-dashboard/layout.tsx');
const sessionDestination = read('src/app/api/auth/session-destination/route.ts');
const passwordLogin = read('src/app/api/auth/password-login/route.ts');
const loginGuard = read('src/app/login/LoginRedirectGuard.tsx');
const workspaceStatus = read('src/app/api/account/workspace-status/route.ts');
const oauthCallback = read('src/app/auth/callback/route.ts');

const failures = [];
const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
};
const forbidText = (source, text, message) => {
  if (source.includes(text)) failures.push(message);
};

requireText(profileMenu, "const isSeller = profile?.role === 'seller';", 'Profile menu must use the signed-in primary role.');
requireText(profileMenu, "const items = isAdmin ? adminItems : isSeller ? sellerItems : buyerItems;", 'Profile menu must select one role-specific menu.');
requireText(profileMenu, "'Seller account'", 'Seller account label is missing.');
requireText(profileMenu, "'Buyer account'", 'Buyer account label is missing.');
requireText(profileMenu, 'To use a different account type, sign out first', 'Profile menu must explain that changing account type requires sign-out.');

forbidText(profileMenu, 'businessItems', 'Mixed buyer/seller business menu must not exist.');
forbidText(profileMenu, 'canSell && canBuy', 'Capability-based mixed menu must not exist.');
forbidText(profileMenu, '> Buy\n', 'Profile menu must not render a Buy workspace switch.');
forbidText(profileMenu, '> Sell\n', 'Profile menu must not render a Sell workspace switch.');
forbidText(profileMenu, "href=\"/buyer-dashboard\"\n                onClick", 'Seller menu must not expose a buyer workspace switch.');

requireText(profileMenu, "{ label: 'Buyer Profile'", 'Buyer terminology must be explicit.');
requireText(profileMenu, "{ label: 'Store Profile'", 'Seller terminology must be explicit.');
requireText(profileMenu, "{ label: 'My Orders'", 'Buyer order terminology must be buyer-specific.');
requireText(profileMenu, "{ label: 'Orders to Fulfil'", 'Seller order terminology must be seller-specific.');
requireText(profileMenu, "{ label: 'Payouts & Settlements'", 'Seller payout terminology must be seller-specific.');

forbidText(buyerLayout, 'Open seller workspace', 'Buyer navigation must not switch to seller workspace.');
forbidText(buyerLayout, 'Activate selling', 'Buyer navigation must not activate selling from the signed-in buyer shell.');
forbidText(buyerLayout, "href={canSell ? '/seller-dashboard'", 'Buyer shell must not link to seller workspace.');
forbidText(sellerLayout, 'Buyer workspace', 'Seller navigation must not switch to buyer workspace.');
forbidText(sellerLayout, '> Buy fabrics', 'Seller navigation must not offer a buyer-mode switch.');
forbidText(sellerLayout, 'href="/buyer-dashboard"', 'Seller shell must not link to buyer dashboard.');

// Seller-primary accounts never enter buyer/account chooser routes.
requireText(accountLayout, "profile?.role === 'seller') redirect('/seller-dashboard')", 'Account route must redirect primary sellers to seller dashboard.');
requireText(buyerRouteLayout, "profile?.role === 'seller') redirect('/seller-dashboard')", 'Buyer dashboard route must reject primary sellers server-side.');
requireText(buyerGuard, "const primarySeller = profile?.role === 'seller';", 'Buyer-only guard must detect primary sellers.');
requireText(buyerGuard, "primarySeller ? '/seller-dashboard' : '/profile'", 'Buyer-only guard must return sellers to seller workspace.');
requireText(sessionDestination, "if (role === 'seller') return '/seller-dashboard';", 'Persisted seller sessions must land directly in seller dashboard.');
requireText(passwordLogin, "if (role === 'seller') return '/seller-dashboard';", 'Password seller login must land directly in seller dashboard.');
requireText(loginGuard, "if (role === 'seller') return '/seller-dashboard';", 'Client login fail-safe must land sellers directly in seller dashboard.');
requireText(oauthCallback, "if (sellerSession) return `${origin}/seller-dashboard`;", 'OAuth seller login must land directly in seller dashboard.');
requireText(workspaceStatus, "const primarySeller = profile.role === 'seller';", 'Workspace status must distinguish the primary seller role.');
requireText(workspaceStatus, 'const canBuy = Boolean(!primarySeller', 'Workspace status must not expose buyer capability to primary sellers.');

forbidText(sessionDestination, "role === 'seller' ? '/account'", 'Session routing must not send sellers to account chooser.');
forbidText(passwordLogin, "role === 'seller' ? '/account'", 'Password login must not send sellers to account chooser.');
forbidText(loginGuard, "role === 'seller' ? '/account'", 'Login fail-safe must not send sellers to account chooser.');

if (failures.length) {
  console.error('Role workspace UI verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.info('Buyer, seller and administrator workspaces are isolated and primary seller login routes directly to Seller Dashboard.');
