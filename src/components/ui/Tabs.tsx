import React, {
  createContext,
  useContext,
  forwardRef,
  useCallback,
  useRef,
  useId,
  useLayoutEffect,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

// ─── Context ──────────────────────────────────────────────────────────────────

interface TabsContextValue {
  activeId: string;
  onChange: (id: string) => void;
  tabIds: React.MutableRefObject<string[]>;
  groupId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(name: string) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${name}> phải dùng bên trong <Tabs.Root>`);
  return ctx;
}

// ─── Tabs.Root ────────────────────────────────────────────────────────────────

export interface TabsRootProps {
  activeId: string;
  onChange: (id: string) => void;
  children: React.ReactNode;
  className?: string | undefined;
}

function TabsRoot({ activeId, onChange, children, className }: TabsRootProps) {
  const groupId = useId();
  const tabIds = useRef<string[]>([]);

  return (
    <TabsContext.Provider value={{ activeId, onChange, tabIds, groupId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}
TabsRoot.displayName = 'Tabs.Root';

// ─── Tabs.List ────────────────────────────────────────────────────────────────

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  'aria-label'?: string;
}

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className, 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        aria-label={ariaLabel || 'Tabs'}
        className={cn('flex border-b border-border-default', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'Tabs.List';

// ─── Tabs.Tab ─────────────────────────────────────────────────────────────────

export interface TabsTabProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'id'> {
  id: string;
  children: React.ReactNode;
  /** Optional badge count displayed to the right of label */
  badge?: number | undefined;
}

const TabsTab = forwardRef<HTMLButtonElement, TabsTabProps>(
  ({ id, children, badge, className, ...props }, ref) => {
    const { activeId, onChange, tabIds, groupId } = useTabsContext('Tabs.Tab');

    useLayoutEffect(() => {
      if (!tabIds.current.includes(id)) tabIds.current.push(id);
      return () => {
        tabIds.current = tabIds.current.filter((tid) => tid !== id);
      };
    }, [id, tabIds]);

    const isActive = activeId === id;

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        const ids = tabIds.current;
        const currentIndex = ids.indexOf(id);
        let nextIndex = -1;

        if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % ids.length;
        else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + ids.length) % ids.length;
        else if (e.key === 'Home') nextIndex = 0;
        else if (e.key === 'End') nextIndex = ids.length - 1;

        if (nextIndex !== -1) {
          e.preventDefault();
          const nextId = ids[nextIndex];
          if (nextId) {
            onChange(nextId);
            const tabEl = document.getElementById(`tab-${groupId}-${nextId}`);
            tabEl?.focus();
          }
        }
      },
      [id, tabIds, onChange, groupId]
    );

    return (
      <button
        ref={ref}
        id={`tab-${groupId}-${id}`}
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${groupId}-${id}`}
        tabIndex={isActive ? 0 : -1}
        onClick={() => onChange(id)}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative h-9 px-4 flex items-center justify-center gap-1.5 text-[14px] font-medium',
          'transition-colors duration-120 outline-none',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-[4px]',
          isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
          className
        )}
        {...props}
      >
        <span>{children}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[11px] font-medium tabular-nums',
              isActive
                ? 'bg-accent text-bg-surface'
                : 'bg-bg-sunken text-text-secondary'
            )}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {isActive && (
          <motion.div
            layoutId={`tab-indicator-${groupId}`}
            className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-accent"
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.18 }}
          />
        )}
      </button>
    );
  }
);
TabsTab.displayName = 'Tabs.Tab';

// ─── Tabs.Panel ───────────────────────────────────────────────────────────────

export interface TabsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  children: React.ReactNode;
}

const TabsPanel = forwardRef<HTMLDivElement, TabsPanelProps>(
  ({ id, children, className }, ref) => {
    const { activeId, groupId } = useTabsContext('Tabs.Panel');

    return (
      <AnimatePresence mode="wait">
        {activeId === id && (
          <motion.div
            ref={ref}
            key={id}
            id={`panel-${groupId}-${id}`}
            role="tabpanel"
            aria-labelledby={`tab-${groupId}-${id}`}
            tabIndex={0}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'linear' }}
            className={cn(
              'w-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg',
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
TabsPanel.displayName = 'Tabs.Panel';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Tabs = Object.assign(
  function TabsLegacy({ tabs, activeId, onChange, className, 'aria-label': ariaLabel }: LegacyTabsProps) {
    if (!tabs || tabs.length === 0) return null;

    return (
      <TabsRoot activeId={activeId} onChange={onChange} className={className}>
        <TabsList aria-label={ariaLabel ?? 'Tabs'}>
          {tabs.map((tab) => (
            <TabsTab key={tab.id} id={tab.id} {...(tab.badge !== undefined ? { badge: tab.badge } : {})}>
              {tab.label}
            </TabsTab>
          ))}
        </TabsList>
        <div className="relative pt-4">
          {tabs.map((tab) => (
            <TabsPanel key={tab.id} id={tab.id}>
              {tab.content}
            </TabsPanel>
          ))}
        </div>
      </TabsRoot>
    );
  },
  {
    Root: TabsRoot,
    List: TabsList,
    Tab: TabsTab,
    Panel: TabsPanel,
  }
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: number;
}

export interface LegacyTabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}
