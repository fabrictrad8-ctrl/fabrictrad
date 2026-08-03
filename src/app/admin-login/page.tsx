import AdminLoginClient from './AdminLoginClient';
import { configuredAdminEmail } from '@/lib/adminAccess';

export const metadata = {
  title: 'Admin Login | FabricTrad',
  description: 'Secure administrator access for the FabricTrad operations dashboard.',
};

export default function AdminLoginPage() {
  return (
    <div className="ft-auth">
      <AdminLoginClient configuredEmail={configuredAdminEmail()} />
    </div>
  );
}
