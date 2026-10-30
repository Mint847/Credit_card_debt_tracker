// Bottom sheets for the phone design: menus, alerts and the account, sliding up from the tab bar
import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Icon } from './ui';

export function Sheet({ open, onClose, title, children, description, bare }: { open: boolean; onClose: () => void; title: string; children: ReactNode; description?: string; bare?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fade-in fixed inset-0 z-40 bg-black/35" />
        <Dialog.Content onOpenAutoFocus={(e) => e.preventDefault()} className="sheet-up scroll-thin fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] tablet:max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-line bg-panel pb-[max(14px,env(safe-area-inset-bottom))] shadow-pop focus:outline-none">
          <div className="sticky top-0 z-10 bg-panel pb-1 pt-2.5">
            <div className="mx-auto h-1 w-10 rounded-full bg-line-strong/70" />
            {/* bare: the content brings its own header */}
            <div className={bare ? 'sr-only' : 'flex items-center justify-between px-5 pt-2.5'}>
              <Dialog.Title className="text-[16px] font-semibold">{title}</Dialog.Title>
              <Dialog.Close className="btn-ghost -mr-2 h-9 w-9 justify-center px-0" aria-label="Close"><Icon name="close" /></Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">{description || title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// A sheet row: an icon tile, a label (and a line under it), then a chevron
export function SheetItem({ icon, label, sub, onClick, danger, tone }: { icon: string; label: string; sub?: string; onClick: () => void; danger?: boolean; tone?: 'brand' }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-[54px] w-full items-center gap-3.5 px-5 py-2 text-left active:bg-sunken">
      <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' +
        (danger ? 'bg-danger/10 text-danger' : tone === 'brand' ? 'bg-brand text-white' : 'bg-sunken text-muted')}><Icon name={icon} size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className={'block text-[14px] font-semibold ' + (danger ? 'text-danger' : '')}>{label}</span>
        {sub && <span className="block truncate text-[12px] text-faint">{sub}</span>}
      </span>
      {!danger && <Icon name="chevron_right" size={20} className="text-faint" />}
    </button>
  );
}

export function SheetGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="py-1">
      {label && <p className="label px-5 pb-1 pt-2">{label}</p>}
      {children}
    </div>
  );
}
