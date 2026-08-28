import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const email = required('ADMIN_EMAIL').toLowerCase();
const fullName = process.env.ADMIN_FULL_NAME?.trim() || 'FabricTrad Administrator';
const requestedRole = process.env.ADMIN_ROLE?.trim() || 'super_admin';

if (!['super_admin', 'admin_staff'].includes(requestedRole)) {
  throw new Error('ADMIN_ROLE must be either super_admin or admin_staff.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const findUserByEmail = async () => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
};

const existingUser = await findUserByEmail();
let user;

if (existingUser) {
  const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
    email_confirm: true,
    app_metadata: {
      ...(existingUser.app_metadata || {}),
      role: requestedRole,
    },
    user_metadata: {
      ...(existingUser.user_metadata || {}),
      full_name: fullName,
    },
  });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: requestedRole },
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  user = data.user;
}

if (!user) throw new Error('Supabase did not return the administrator user.');

const { error: profileError } = await supabase.from('user_profiles').upsert(
  {
    id: user.id,
    email,
    full_name: fullName,
    role: requestedRole,
    is_active: true,
    can_buy: false,
    can_sell: false,
    phone_verified: false,
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'id' }
);

if (profileError) throw profileError;

console.info(`Administrator ready for email-OTP access: ${email} (${requestedRole}).`);
console.info('No administrator password was created or rotated by this command.');
