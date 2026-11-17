// The strip across the top of the public demo: what this is, feedback, and the way out. Rendered only
// in demo mode (?demo), so the real app is untouched.
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { exitDemo } from '../lib/demo';
import { dialogFrame, useLayout } from '../lib/layout';
import { Icon } from './ui';

export function DemoBar() {
  const [about, setAbout] = useState(false);
  const layout = useLayout();
  const frame = dialogFrame(layout, 460, '10vh');
  return (
    <>
      <div role="region" aria-label="Demo" className="flex shrink-0 items-center gap-3 border-b border-line bg-sunken px-4 py-1.5 text-[12px] text-muted phone:px-3">
        <Icon name="science" size={15} className="text-brand-ink" />
        <p className="min-w-0 flex-1 truncate">
          <b className="font-semibold text-ink">Demo</b>
          <span className="phone:hidden"> · sample data, nothing is saved</span>
          <span className="hidden phone:inline"> · sample data</span>
        </p>
        <button type="button" onClick={() => setAbout(true)} className="font-semibold text-brand-ink hover:underline">About</button>
        <button type="button" onClick={exitDemo} className="font-semibold text-brand-ink hover:underline phone:hidden">Sign in</button>
      </div>
      <Dialog.Root open={about} onOpenChange={setAbout}>
        <Dialog.Portal>
          <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
          <Dialog.Content className={frame.className} style={frame.style}>
            <div className="px-6 py-5 phone:px-5">
              <div className="flex items-start justify-between gap-4">
                <Dialog.Title className="text-[15px] font-semibold phone:text-[19px] phone:font-bold">About this demo</Dialog.Title>
                <Dialog.Close className="btn-ghost -mr-2 -mt-1 h-8 w-8 justify-center px-0" aria-label="Close"><Icon name="close" /></Dialog.Close>
              </div>
              <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-muted">
                Serendib tracks Sri Lankan credit cards: what you owe, what’s due, and the fastest way to pay it off.
              </Dialog.Description>
              <ul className="mt-4 space-y-3 text-[13px] leading-relaxed">
                <li className="flex gap-3"><Icon name="person_off" size={18} className="mt-0.5 shrink-0 text-faint" /><span><b className="font-semibold">Made-up data.</b> The cards, balances and spending here are samples. Add, edit and delete freely: nothing is saved, and a refresh starts over.</span></li>
                <li className="flex gap-3"><Icon name="lock" size={18} className="mt-0.5 shrink-0 text-faint" /><span><b className="font-semibold">Nothing collected.</b> There’s no account in the demo, and what you type stays in your browser.</span></li>
                <li className="flex gap-3"><Icon name="gavel" size={18} className="mt-0.5 shrink-0 text-faint" /><span><b className="font-semibold">Not financial advice.</b> Interest, fees and minimum payments follow each bank’s published tariff as of late 2026, and banks change them. Check your statement before you rely on a figure.</span></li>
                <li className="flex gap-3"><Icon name="local_offer" size={18} className="mt-0.5 shrink-0 text-faint" /><span><b className="font-semibold">Sample offers.</b> The Offers page shows examples, not live bank promotions.</span></li>
                <li className="flex gap-3"><Icon name="chat" size={18} className="mt-0.5 shrink-0 text-faint" /><span><b className="font-semibold">Your feedback.</b> Reply to the post on X where you found this. What’s confusing, what’s missing, what broke: all of it helps.</span></li>
              </ul>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-outline" onClick={exitDemo}>Sign in with your own cards</button>
                <Dialog.Close className="btn-primary">Back to the demo</Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
