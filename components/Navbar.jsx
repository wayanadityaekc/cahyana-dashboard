'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Bell, ChevronDown, ExternalLink, LogOut, MessageCircle, UserRound, X } from 'lucide-react';
import { MENU_ROW_BOX } from '@/components/ui/railClasses';

// The dashboard's header, ported from the public site's navbar (Sep 2026,
// DASHBOARD BRIEF #1/#2: "same style as the website navbar"). The strings below
// are the site's own, copied as-is so the two headers measure the same - the
// dashboard does not consume the shared library, same as RailLayout.
//
// What differs from the site, on purpose:
//  - The hamburger + drawer are PHONES ONLY (<=992px). Desktop keeps the cream
//    rail as it was (Wayan, brief #2 Q1), so the burger has nothing to open there.
//  - The drawer holds the dashboard sections, a link to the live site and Sign
//    out. Chat is NOT in it: it is its own icon in the bar (brief #1 point 2).
//  - The account slot is the owner, not a guest: its menu is Settings + Sign out.

// Site gutter: 16px on phones, 20px on desktop. The site gets 16 from
// --container-x, which this app does not narrow on phones, so it is spelled out.
const ROW_BOX = 'flex justify-between items-center max-w-[1200px] mx-auto py-[0.55rem] px-4 min-[993px]:px-5';

const BURGER_BAR =
  'w-full h-[2px] bg-gold max-[992px]:w-[20px] ' +
  '[transition:translate_var(--dur)_var(--ease),rotate_var(--dur)_var(--ease),opacity_var(--dur-fast)_var(--ease)] ' +
  'motion-reduce:transition-none';

// A drawer row. Same shape as the site's (MENU_ROW_BOX, --fs-strong, soft black,
// active = cream pill + semibold). These rows are buttons, so they bring their
// own font and reset the button chrome.
const navLink = (active) =>
  `${MENU_ROW_BOX} text-strong font-body no-underline border-none cursor-pointer ` +
  (active
    ? 'font-semibold bg-cream text-gold-d'
    : 'font-medium bg-transparent text-gold hover:bg-cream hover:text-gold-d');

// Pulls each row out by the pill's own padding so labels line up with "Menu".
const NAV_LI = '-mx-3';

const BADGE_BASE =
  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-sm text-white text-label font-semibold leading-none [&[hidden]]:hidden';

const COUNT = 'ml-auto font-body text-small font-normal text-muted tabular-nums';
const SPLIT = 'block h-px bg-line my-[var(--space-1)] mx-3';

const ICON_BTN =
  'relative inline-flex items-center text-gold mr-[1.3rem] bg-transparent border-none p-0 cursor-pointer ' +
  '[transition:color_var(--dur)_ease,scale_var(--dur-fast)_var(--ease)] hover:text-gold-d max-[992px]:mr-[0.85rem]';

const ACCT_ROW = `${MENU_ROW_BOX} text-small font-medium text-gold no-underline bg-transparent border-none cursor-pointer font-body hover:bg-cream`;

export const SITE_URL = 'https://cahyanaubudexperience.com';

function AccountSlot({ demo, onSignOut, onSettings, who: whoName, title, subtitle, settingsLabel, SettingsIcon }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const btnRef = useRef(null);
  const panelId = useId();
  const who = whoName || (demo ? 'Demo' : 'Owner');

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={boxRef} data-account-slot>
      <button
        type="button"
        ref={btnRef}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer font-body text-small font-semibold text-gold [transition:color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:text-gold-d"
      >
        <span className="w-[30px] h-[30px] max-[992px]:w-[28px] max-[992px]:h-[28px] rounded-[50%] bg-gold text-white grid place-items-center" aria-hidden="true">
          <UserRound className="w-[var(--icon-sm)] h-[var(--icon-sm)]" strokeWidth={1.8} />
        </span>
        <span className="max-[992px]:hidden whitespace-nowrap">{who}</span>
        <ChevronDown className={`max-[992px]:hidden w-[var(--icon-sm)] h-[var(--icon-sm)] transition-[rotate] duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-[calc(100%+var(--space-1))] z-[130] min-[993px]:w-[18rem] w-[15rem] bg-white border border-line rounded-[var(--r-md)] p-[var(--space-1)]"
      >
        <div className="px-3 pt-2 pb-3">
          <b className="block text-small font-semibold text-gold">{title || (demo ? 'Demo account' : 'Owner')}</b>
          <span className="block text-small text-muted">{subtitle || 'Cahyana dashboard'}</span>
        </div>
        <span className="block h-px bg-line mb-1" aria-hidden="true" />
        {/* Same place as the site's account menu puts "Settings" (brief #4). */}
        <button type="button" className={ACCT_ROW} onClick={() => { setOpen(false); onSettings(); }} data-acct-settings>
          <SettingsIcon strokeWidth={1.7} aria-hidden="true" />{settingsLabel}
        </button>
        <span className="block h-px bg-line mt-1" aria-hidden="true" />
        <div className="pt-1">
          <button type="button" className={ACCT_ROW} onClick={() => { setOpen(false); onSignOut(); }}>
            <LogOut strokeWidth={1.7} aria-hidden="true" />Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// The driver app (brief #7) is the same bar with its own words: `home` is where
// the logo goes, `account` relabels the account slot, and `siteLink` drops the
// "Live website" row a driver has no use for.
export default function Navbar({
  sections, active, onPick, unread = 0, onChat, onSignOut, onSettings, demo = false,
  home = '/', account = {}, siteLink = true, label = 'Dashboard sections',
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const navRef = useRef(null);
  const burgerRef = useRef(null);

  // The page clears the header by this variable, so it is measured, not guessed.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;
    const set = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      const inNav = navRef.current && navRef.current.contains(e.target);
      const onBurger = burgerRef.current && burgerRef.current.contains(e.target);
      if (!inNav && !onBurger) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    // The drawer is phones only: widening the window past it closes it.
    const mq = window.matchMedia('(min-width: 993px)');
    const onMq = () => { if (mq.matches) setMenuOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onMq);
    };
  }, [menuOpen]);

  const pick = (id) => { onPick(id); setMenuOpen(false); };

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] w-full bg-white" ref={headerRef} data-navbar>
      <div className={ROW_BOX}>
        <button
          className="min-[993px]:hidden relative flex flex-col gap-[4px] w-6 bg-transparent border-none cursor-pointer max-[992px]:h-[2.2rem] max-[992px]:mr-2 max-[992px]:items-center max-[992px]:justify-center"
          id="hamburger"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="nav-menu"
          ref={burgerRef}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`${BURGER_BAR} ${menuOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
          <span className={`${BURGER_BAR} ${menuOpen ? 'opacity-0' : 'opacity-100'}`} />
          <span className={`${BURGER_BAR} ${menuOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
        </button>

        <a href={home} className="mr-auto">
          <img className="h-10 w-auto block mr-4 ml-[0.1rem] max-[992px]:h-[34px] max-[992px]:ml-0" src="/logo.webp" alt="The Cahyana Logo" width="1005" height="324" />
        </a>

        {/* Chat sits OUTSIDE the drawer, same shape as the site's chat icon. */}
        <button
          type="button"
          className={`${ICON_BTN} ${active === 'chat' ? 'text-gold-d' : ''}`}
          aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
          aria-current={active === 'chat' ? 'page' : undefined}
          onClick={() => { onChat(); setMenuOpen(false); }}
          data-nav-chat
        >
          <MessageCircle className="w-5 h-5" strokeWidth={1.6} aria-hidden="true" />
          <span className={`absolute top-[-7px] right-[-9px] bg-gold ${BADGE_BASE}`} hidden={!unread}>{unread}</span>
        </button>

        <nav ref={navRef} aria-label={label}>
          <ul
            className={`min-[993px]:hidden fixed top-0 left-0 bottom-0 right-auto w-4/5 max-w-[360px] h-[100dvh] bg-white px-[22px] pb-[30px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain transition-[translate] duration-300 ease-[var(--ease)] motion-reduce:transition-none z-[120] flex flex-col items-stretch text-left gap-0 list-none m-0 ${menuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}`}
            id="nav-menu"
            aria-hidden={!menuOpen}
          >
            <li className="flex items-center gap-[10px] bg-white border-b border-line mx-[-22px] pt-[0.8rem] px-[22px] pb-[0.8rem] min-h-[65px] mb-[0.9rem]">
              <b className="text-strong font-semibold text-gold">Menu</b>
              <button
                type="button"
                className="ml-auto flex-none grid place-items-center w-[34px] h-[34px] rounded-[var(--r-md)] [border:1px_solid_var(--line)] bg-white text-gold cursor-pointer [&>svg]:w-4 [&>svg]:h-4 [transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream"
                aria-label="Close menu"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => setMenuOpen(false)}
              >
                <X strokeWidth={2} aria-hidden="true" />
              </button>
            </li>

            {sections.map((s) => (
              <li key={s.id} className={NAV_LI}>
                {s.split && <span className={SPLIT} aria-hidden="true" />}
                <button
                  type="button"
                  className={navLink(active === s.id)}
                  aria-current={active === s.id ? 'page' : undefined}
                  tabIndex={menuOpen ? 0 : -1}
                  onClick={() => pick(s.id)}
                  data-drawer-row={s.id}
                >
                  <s.Icon strokeWidth={1.7} aria-hidden="true" />
                  {s.label}
                  {s.count != null && <span className={COUNT}>{s.count}</span>}
                </button>
              </li>
            ))}

            {siteLink && (
            <li className={`mt-auto pt-4 ${NAV_LI}`}>
              <span className={SPLIT} aria-hidden="true" />
              <a href={SITE_URL} target="_blank" rel="noopener" className={navLink(false)} tabIndex={menuOpen ? 0 : -1} data-drawer-site>
                <ExternalLink strokeWidth={1.7} aria-hidden="true" />Live website
              </a>
            </li>
            )}
            <li className={siteLink ? NAV_LI : `mt-auto pt-4 ${NAV_LI}`}>
              {!siteLink && <span className={SPLIT} aria-hidden="true" />}
              <button type="button" className={navLink(false)} tabIndex={menuOpen ? 0 : -1} onClick={() => { setMenuOpen(false); onSignOut(); }} data-drawer-signout>
                <LogOut strokeWidth={1.7} aria-hidden="true" />Sign out
              </button>
            </li>
          </ul>
        </nav>

        <AccountSlot
          demo={demo}
          onSignOut={onSignOut}
          onSettings={onSettings}
          who={account.who}
          title={account.title}
          subtitle={account.subtitle}
          settingsLabel={account.settingsLabel || 'Settings'}
          SettingsIcon={account.SettingsIcon || Bell}
        />
      </div>

      <div
        className={`min-[993px]:hidden fixed inset-0 bg-[rgba(26,26,26,0.45)] z-[95] transition-[opacity,visibility] duration-300 ease-[var(--ease)] ${menuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setMenuOpen(false)}
        data-nav-scrim
      />
    </header>
  );
}
