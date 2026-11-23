import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface M3SelectOption<T extends string = string> {
  value: T;
  label: string;
  badge?: string;
  description?: string;
}

interface M3SelectPopupProps<T extends string = string> {
  id?: string;
  value: T;
  options: Array<M3SelectOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  menuTitle?: string;
  icon?: React.ReactNode;
  variant?: 'pill' | 'field';
  className?: string;
  testId?: string;
}

interface PopupCoords {
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxHeight: number;
  openUpward: boolean;
}

export function M3SelectPopup<T extends string = string>({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  menuTitle,
  icon,
  variant = 'pill',
  className = '',
  testId,
}: M3SelectPopupProps<T>) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopupCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];

  const updateCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const minWidth = Math.max(rect.width, Math.min(270, vw - 24));
    const maxWidth = Math.min(340, vw - 24);
    const desiredWidth = Math.min(Math.max(minWidth, 240), maxWidth);
    const left = Math.max(12, Math.min(rect.left, vw - desiredWidth - 12));
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

    setCoords({
      top: openUpward ? undefined : rect.bottom + 8,
      bottom: openUpward ? vh - rect.top + 8 : undefined,
      left,
      minWidth: desiredWidth,
      maxHeight: Math.max(160, Math.min(340, openUpward ? spaceAbove : spaceBelow)),
      openUpward,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleBack = (e: Event) => {
      e.preventDefault();
      setOpen(false);
    };

    const handleViewportChange = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      updateCoords();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKey);
    window.addEventListener('talikhata:back', handleBack);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('talikhata:back', handleBack);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  const triggerClasses =
    variant === 'field'
      ? 'w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base font-semibold text-[#171D19] hover:bg-[#ECF3ED] focus:border-[#006B47] focus:bg-white'
      : 'min-h-[44px] rounded-full bg-[#CBEAD6]/70 px-4 py-2 text-sm sm:text-[15px] font-bold text-[#002114] ring-1 ring-[#B4DFC4] hover:bg-[#CBEAD6]';

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center justify-between gap-2.5 text-left transition-colors focus:outline-2 focus:outline-[#006B47] ${triggerClasses} ${className}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-[#006B47]">{icon}</span>}
          <span className="truncate">{selectedOption?.label ?? ''}</span>
          {selectedOption?.badge !== undefined && (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold font-mono-num text-[#006B47] shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#006B47] transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={menuTitle || ariaLabel}
            style={{
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              minWidth: coords.minWidth,
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: coords.maxHeight,
              zIndex: 70,
            }}
            className="overflow-y-auto overscroll-contain rounded-[24px] border border-[#DCE7DF] bg-[#FFFFFF] p-2 shadow-2xl"
          >
            {menuTitle && (
              <div className="px-3.5 py-2 text-xs font-bold text-[#404943]">
                {menuTitle}
              </div>
            )}
            <div className="space-y-1">
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full min-h-[44px] items-center justify-between gap-3 rounded-2xl px-3.5 py-2 text-left text-[15px] transition-colors ${
                      active
                        ? 'bg-[#CBEAD6] font-bold text-[#002114]'
                        : 'font-medium text-[#171D19] hover:bg-[#F5FAF6]'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-xs font-normal text-[#404943]">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {opt.badge !== undefined && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold font-mono-num ${
                            active
                              ? 'bg-white/80 text-[#002114]'
                              : 'bg-[#ECF3ED] text-[#404943]'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {active && <Check className="h-4 w-4 text-[#006B47] shrink-0" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
