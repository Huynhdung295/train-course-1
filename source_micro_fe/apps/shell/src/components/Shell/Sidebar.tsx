'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'POS', href: 'pos', icon: '🏪' },
  { label: 'Dashboard', href: 'erp/dashboard', icon: '📊' },
  { label: 'Sản phẩm', href: 'erp/products', icon: '📦' },
  { label: 'Kho hàng', href: 'erp/inventory', icon: '🏭' },
  { label: 'Nhân viên', href: 'erp/users', icon: '👥' },
];

export const Sidebar = ({ tenantId }: { tenantId: string }) => {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 text-white flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-base">N</div>
          <span className="font-bold text-sm text-white">Nexus ERP</span>
        </div>
        <p className="text-xs text-gray-500 mt-1 truncate">{tenantId}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const fullHref = `/${tenantId}/${href}`;
          const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
          return (
            <Link
              key={href}
              href={fullHref}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 pb-4">
        <Link
          href={`/${tenantId}/erp/users`}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-xs font-bold">U</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">Tài khoản</p>
            <p className="text-[10px] text-gray-500">Cài đặt</p>
          </div>
        </Link>
      </div>
    </aside>
  );
};
