// Bottom sheets for the phone design: menus, alerts and the account, sliding up from the tab bar
// (the iPad uses them for the account menu; phone: classes are the phone's look only)
import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Icon } from './ui';

export function Sheet({ open, onClose, title, children, description, bare }: { open: boolean; onClose: () => void; title: string; children: ReactNode; description?: string; bare?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fade-in fixed inset-0 z-40 bg-black/35 phone:bg-black/40" />
        <Dialog.Content onOpenAutoFocus={(e) => e.preventDefault()} className="sheet-up scroll-thin fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] tablet:max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-line bg-panel pb-[max(14px,env(safe-area-inset-bottom))] shadow-pop focus:outline-none phone:rounded-t-[28px] phone:border-t-0">
          <div className="sticky top-0 z-10 bg-panel pb-1 pt-2.5">
            <div className="mx-auto h-1 w-10 rounded-full bg-line-strong/70" />
            {/* bare: the content brings its own header */}
            <div className={bare ? 'sr-only' : 'flex items-center justify-between px-5 pt-2.5'}>
              <Dialog.Title className="text-[16px] font-semibold phone:text-[19px] phone:font-bold phone:tracking-tight">{title}</Dialog.Title>
              <Dialog.Close className="btn-ghost -mr-2 h-9 w-9 justify-center px-0 phone:h-10 phone:w-10 phone:rounded-full phone:bg-sunken" aria-label="Close"><Icon name="close" /></Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">{description || title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// The icon tile's colour on phones (index.css --m-*)
const COLORS = {
  plan: 'phone:bg-m-plan/15 phone:text-m-plan',
  debt: 'phone:bg-m-debt/15 phone:text-m-debt',
  free: 'phone:bg-m-free/15 phone:text-m-free',
  limit: 'phone:bg-m-limit/15 phone:text-m-limit',
  spend: 'phone:bg-m-spend/15 phone:text-m-spend',
  space: 'phone:bg-m-space/15 phone:text-m-space',
  offer: 'phone:bg-m-offer/15 phone:text-m-offer',
  slate: 'phone:bg-m-slate/15 phone:text-m-slate'
};
export type SheetColor = keyof typeof COLORS;

// A sheet row: an icon tile, a label (and a line under it), then a chevron
export function SheetItem({ icon, label, sub, onClick, danger, tone, color }: { icon: string; label: string; sub?: string; onClick: () => void; danger?: boolean; tone?: 'brand'; color?: SheetColor }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-[54px] w-full items-center gap-3.5 px-5 py-2 text-left active:bg-sunken phone:min-h-[60px] phone:px-4 phone:active:bg-line/60 phone:[&:not(:last-child)]:border-b phone:[&:not(:last-child)]:border-line/70">
      <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl phone:h-10 phone:w-10 ' +
        (danger ? 'bg-danger/10 text-danger' : tone === 'brand' ? 'bg-brand text-white' : 'bg-sunken text-muted ' + (color ? COLORS[color] : 'phone:bg-panel'))}><Icon name={icon} size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className={'block text-[14px] font-semibold ' + (danger ? 'text-danger' : '')}>{label}</span>
        {sub && <span className="block truncate text-[12px] text-faint">{sub}</span>}
      </span>
      {!danger && <Icon name="chevron_right" size={20} className="text-faint" />}
    </button>
  );
}

// Phones: the rows sit in a rounded inset group
export function SheetGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="py-1 phone:py-1.5">
      {label && <p className="label px-5 pb-1 pt-2">{label}</p>}
      <div className="phone:mx-4 phone:overflow-hidden phone:rounded-2xl phone:bg-sunken">{children}</div>
    </div>
  );
}
