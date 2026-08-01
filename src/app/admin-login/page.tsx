import AdminLoginClient from './AdminLoginClient';

export const metadata = {
  title: 'Admin Login | FabricTrad',
  description: 'Secure administrator access for the FabricTrad operations dashboard.',
};

export default function AdminLoginPage() {
  return (
    <div className="ft-auth">
      <AdminLoginClient />
    </div>
  );
}
