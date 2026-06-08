'use client';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Wallet } from 'lucide-react';

const nav = [
  { href: '/board', icon: LayoutGrid, label: 'Доска задач' },
  { href: '/accounting', icon: Wallet, label: 'Бухгалтерия' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <html lang="ru">
      <body className="bg-gray-50">
        <div className="flex min-h-screen">
          <aside className="w-60 bg-gray-900 text-white flex flex-col fixed h-full">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-lg">T</div>
                <div>
                  <div className="font-semibold text-sm">ToolBox-TODO</div>
                  <div className="text-xs text-gray-400">Задачи и бухгалтерия</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href === '/board' && pathname === '/');
                return (
                  <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'active' : ''}`}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 text-xs text-gray-500 border-t border-white/10">ToolBox · внутренняя панель</div>
          </aside>
          <main className="flex-1 ml-60">
            <div className="p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
