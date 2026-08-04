import fs from 'node:fs';

// The signed-in primary role owns the visible workspace until the user signs out.
const read = (path) => fs.readFileSync(path, 'utf8');
const profileMenu = read('src/components/ProfileMenu.tsx');
const buyerLayout = read('src/app/buyer-dashboard/components/ModernBuyerDashboardLayout.tsx');
const sellerLayout = read('src/app/seller-dashboard/components/SellerDashboardLayout.tsx');

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

if (failures.length) {
  console.error('Role workspace UI verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Buyer, seller and administrator menus are role-specific with no in-session workspace switch.');
