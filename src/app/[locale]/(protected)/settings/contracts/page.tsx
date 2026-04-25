'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';

type ContractType = 'debt' | 'blackmail';
type ContractStatus = 'active' | 'paused';
type MoneyDirection = 'selectedUserPaysViewer' | 'viewerPaysSelectedUser';

type Contract = {
  id: string;
  type: ContractType;
  status: ContractStatus;
  user: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  totalCents: number;
  paidCents: number;
  interestPct: number;
  nextInterestDays: number;
  createdAt: string;
  history: HistoryRow[];
  blackmailInfo?: BlackmailInfo;
  moneyDirection: MoneyDirection;
  viewerCanManage: boolean;
};

type HistoryRow = {
  id: string;
  date: string;
  type: string;
  amountCents: number;
};

type BlackmailInfo = {
  personal: Record<string, string>;
  work: Record<string, string>;
  closePerson: Record<string, string>;
};

const AVATAR_PH = '/images/avatar-placeholder.png';

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c1',
    type: 'debt',
    status: 'active',
    user: {
      id: 'u1',
      handle: 'maxsub',
      displayName: 'Max Mustermann',
      avatarUrl: null,
    },
    totalCents: 1000000,
    paidCents: 250000,
    interestPct: 15,
    nextInterestDays: 10,
    createdAt: '2025-04-20',
    history: [
      { id: 'h1', date: '20.04.2025', type: 'Debt payment', amountCents: 5000 },
      { id: 'h2', date: '19.04.2025', type: 'Dom changed amount', amountCents: 50000 },
      { id: 'h3', date: '30.03.2025', type: 'Interest', amountCents: -2530 },
      { id: 'h4', date: '20.03.2025', type: 'Debt payment', amountCents: 5000 },
      { id: 'h5', date: '19.03.2025', type: 'Dom changed amount', amountCents: 50000 },
      { id: 'h6', date: '30.02.2025', type: 'Interest', amountCents: -2530 },
      { id: 'h7', date: '20.02.2025', type: 'Debt payment', amountCents: 5000 },
      { id: 'h8', date: '19.02.2025', type: 'Dom changed amount', amountCents: 50000 },
    ],
    moneyDirection: 'selectedUserPaysViewer',
    viewerCanManage: true,
  },
  {
    id: 'c2',
    type: 'blackmail',
    status: 'active',
    user: {
      id: 'u2',
      handle: 'blackmailmax',
      displayName: 'Alex Schuld',
      avatarUrl: null,
    },
    totalCents: 450000,
    paidCents: 175000,
    interestPct: 10,
    nextInterestDays: 6,
    createdAt: '2025-04-12',
    history: [
      { id: 'b1', date: '20.04.2025', type: 'Blackmail payment', amountCents: 2500 },
      { id: 'b2', date: '15.04.2025', type: 'Amount changed', amountCents: 10000 },
      { id: 'b3', date: '12.04.2025', type: 'Contract created', amountCents: 0 },
    ],
    blackmailInfo: {
      personal: {
        'Full Name': 'Alex Schuld',
        City: 'Vienna',
        Street: '',
        Door: '',
        'Telephone Number': '',
        'Card Details': '',
      },
      work: {
        'Job Title': '',
        Salary: '',
        "Boss's Name": '',
        Address: '',
        Door: '',
      },
      closePerson: {
        'Full Name': '',
        City: '',
        Street: '',
        Door: '',
        'Telephone Number': '',
        'Card Details': '',
      },
    },
    moneyDirection: 'selectedUserPaysViewer',
    viewerCanManage: true,
  },
];

const SEARCH_USERS = [
  { id: 'u1', handle: 'maxsub', displayName: 'Max Mustermann', avatarUrl: null, role: 'sub' },
  { id: 'u2', handle: 'blackmailmax', displayName: 'Alex Schuld', avatarUrl: null, role: 'domme' },
  { id: 'u3', handle: 'walletpet', displayName: 'Wallet Pet', avatarUrl: null, role: 'sub' },
] as const;

function money(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function pct(paid: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
}

export default function ContractsPage() {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };

  const [contracts, setContracts] = React.useState<Contract[]>(MOCK_CONTRACTS);
  const [query, setQuery] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState<ContractType | null>(null);
  const [sort, setSort] = React.useState<'latest' | 'mostDebt'>('latest');

  const [newOpen, setNewOpen] = React.useState(false);
  const [selectedContract, setSelectedContract] = React.useState<Contract | null>(null);
  const [historyFor, setHistoryFor] = React.useState<Contract | null>(null);
  const [blackmailFor, setBlackmailFor] = React.useState<Contract | null>(null);
  const [stopFor, setStopFor] = React.useState<Contract | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<'deactivate' | 'delete' | null>(null);
  const filterRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
    if (!filterOpen) return;

    function handlePointerDown(e: PointerEvent) {
        if (!filterRef.current) return;
        if (filterRef.current.contains(e.target as Node)) return;

        setFilterOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') setFilterOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);
    };
    }, [filterOpen]);

  const visibleContracts = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    let out = contracts.filter((c) => {
        if (typeFilter && c.type !== typeFilter) return false;

        if (!q) return true;
        return (
            c.user.displayName.toLowerCase().includes(q) ||
            c.user.handle.toLowerCase().includes(q) ||
            c.type.toLowerCase().includes(q)
        );
    });

    if (sort === 'mostDebt') {
      out = out.slice().sort((a, b) => (b.totalCents - b.paidCents) - (a.totalCents - a.paidCents));
    } else {
      out = out.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }

    return out;
  }, [contracts, query, sort, typeFilter]);

  function updateAmount(contract: Contract, nextTotalCents: number) {
    setContracts((prev) =>
      prev.map((c) =>
        c.id === contract.id
          ? {
              ...c,
              totalCents: Math.max(c.paidCents, nextTotalCents),
              history: [
                {
                  id: crypto.randomUUID(),
                  date: new Date().toLocaleDateString(),
                  type: 'Amount changed',
                  amountCents: nextTotalCents - c.totalCents,
                },
                ...c.history,
              ],
            }
          : c
      )
    );
  }

  function deactivate(contract: Contract) {
    setContracts((prev) =>
      prev.map((c) => (c.id === contract.id ? { ...c, status: 'paused' } : c))
    );
    setConfirmAction(null);
    setStopFor(null);
  }

  function deleteContract(contract: Contract) {
    setContracts((prev) => prev.filter((c) => c.id !== contract.id));
    setConfirmAction(null);
    setStopFor(null);
  }

  return (
    <Viewport>
      <section className="mx-auto max-w-2xl min-h-[calc(100dvh-2rem)] rounded-app border border-white/10 bg-black/80 shadow-app overflow-hidden">
        <header className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10 px-4 pt-3 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/settings`)}
              className="inline-grid place-items-center size-9 rounded-full hover:bg-white/10 text-[var(--purple)]"
              aria-label="Back"
            >
              <ChevronLeftIcon />
            </button>

            <div className="min-w-0 flex-1">
                <h1 className="text-[26px] font-extrabold leading-none">Contracts</h1>
                <p className="mt-1 text-[13px] text-white/55">Debt and blackmail contracts</p>
            </div>

            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="h-10 px-5 rounded-full bg-[var(--purple)]/35 hover:bg-[var(--purple)]/50 border border-[var(--purple)]/30 font-semibold"
            >
              New
            </button>
          </div>
        </header>

        <div className="px-4 py-4">
          <div className="mb-4">
            <h2 className="text-[18px] font-bold">Current Contracts</h2>

            <div className="mt-2 flex items-center gap-2">
              <label className="relative flex-1 block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
                  <SearchIcon />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search active contracts"
                  className="w-full h-9 rounded-full bg-white/[.06] border border-white/10 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-[var(--purple)]/35"
                />
              </label>

              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className="size-9 grid place-items-center rounded-full hover:bg-white/10 text-[var(--purple)]"
                  aria-label="Filter"
                >
                  <FilterIcon />
                </button>

                {filterOpen && (
                  <div className="absolute right-0 top-11 z-30 w-48 rounded-2xl border border-white/10 bg-[#121214] p-2 shadow-2xl">
                    <div className="px-2 py-1 text-[11px] text-white/45">Filter Contracts</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSort('latest');
                        setFilterOpen(false);
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-white/10"
                    >
                      <CheckBox active={sort === 'latest'} />
                      Latest Contract
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSort('mostDebt');
                        setFilterOpen(false);
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-white/10"
                    >
                      <CheckBox active={sort === 'mostDebt'} />
                      Most debt left
                    </button>
                    <div className="my-1 h-px bg-white/10" />
                    <button
                        type="button"
                        onClick={() => {
                            setTypeFilter((v) => (v === 'blackmail' ? null : 'blackmail'));
                        }}
                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-white/10"
                        >
                        <CheckBox active={typeFilter === 'blackmail'} />
                        Only BM Contracts
                        </button>

                        <button
                        type="button"
                        onClick={() => {
                            setTypeFilter((v) => (v === 'debt' ? null : 'debt'));
                        }}
                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-white/10"
                        >
                        <CheckBox active={typeFilter === 'debt'} />
                        Only Debt Contracts
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {visibleContracts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="snap-y snap-mandatory space-y-4 sm:snap-none pb-[calc(96px+env(safe-area-inset-bottom))]">
              {visibleContracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onChangeAmount={() => setSelectedContract(contract)}
                  onHistory={() => setHistoryFor(contract)}
                  onBlackmailInfo={() => setBlackmailFor(contract)}
                  onStop={() => setStopFor(contract)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {newOpen && (
        <NewContractFlow
          onClose={() => setNewOpen(false)}
          onCreate={(next) => {
            setContracts((prev) => [next, ...prev]);
            setNewOpen(false);
          }}
        />
      )}

      {selectedContract && (
        <ChangeAmountOverlay
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
          onSave={(amount) => {
            updateAmount(selectedContract, amount);
            setSelectedContract(null);
          }}
        />
      )}

      {historyFor && (
        <HistoryOverlay contract={historyFor} onClose={() => setHistoryFor(null)} />
      )}

      {blackmailFor && (
        <BlackmailOverlay
          contract={blackmailFor}
          onClose={() => setBlackmailFor(null)}
          onSave={(info) => {
            setContracts((prev) =>
              prev.map((c) => (c.id === blackmailFor.id ? { ...c, blackmailInfo: info } : c))
            );
            setBlackmailFor(null);
          }}
        />
      )}

      {stopFor && (
        <StopOverlay
          contract={stopFor}
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          onClose={() => {
            setStopFor(null);
            setConfirmAction(null);
          }}
          onDeactivate={() => deactivate(stopFor)}
          onDelete={() => deleteContract(stopFor)}
        />
      )}
    </Viewport>
  );
}

function ContractCard({
  contract,
  onChangeAmount,
  onHistory,
  onBlackmailInfo,
  onStop,
}: {
  contract: Contract;
  onChangeAmount: () => void;
  onHistory: () => void;
  onBlackmailInfo: () => void;
  onStop: () => void;
}) {
  const paidPct = pct(contract.paidCents, contract.totalCents);
  const leftCents = contract.totalCents - contract.paidCents;
  const canManage = contract.viewerCanManage;

  const typeLabel = contract.type === 'blackmail' ? 'Blackmail Contract' : 'Debt Contract';

  return (
    <article className="contract-card snap-start">
      <div className="contract-card-head">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={contract.user.avatarUrl} name={contract.user.displayName} />
            <div className="min-w-0">
            <div className="text-[17px] font-extrabold truncate">
                {contract.user.displayName}
            </div>
            <div className="text-[12px] text-white/45 truncate">
                @{contract.user.handle}
            </div>
            </div>
        </div>

        <div className="text-right shrink-0">
          <div className="contract-type-pill">{typeLabel}</div>
          {contract.status === 'paused' && <div className="mt-1 text-[11px] text-amber-300">Paused</div>}
        </div>
      </div>

      <div className="contract-main">
        <div className="contract-donut-wrap">
          <ProgressDonut percent={paidPct} />
          <div className="contract-donut-center">
            <div className="text-[11px] text-white/45 font-semibold">Paid</div>
            <div className="text-[28px] font-black tracking-tight">{paidPct}%</div>
          </div>
        </div>

        <div className="contract-stats">
          <StatBox label="Amount paid" value={money(contract.paidCents)} tone="paid" />
          <StatBox label="Amount left" value={money(leftCents)} tone="left" />
          <StatBox label="Next interest" value={`${contract.nextInterestDays} days`} />
          <StatBox label="Interest" value={`${contract.interestPct}%`} />
        </div>
      </div>

      <div className="contract-actions">
        <button
        className="contract-btn contract-btn-primary disabled:opacity-35 disabled:cursor-not-allowed"
        onClick={onChangeAmount}
        disabled={!canManage}
        >
        Change Amount
        </button>

        <button
        className="contract-btn contract-btn-danger disabled:opacity-35 disabled:cursor-not-allowed"
        onClick={onStop}
        disabled={!canManage}
        >
        {contract.status === 'paused' ? 'Delete Contract' : 'Stop Contract'}
        </button>
        <button className="contract-btn contract-btn-soft" onClick={onHistory}>
          Payment History
        </button>

        {contract.type === 'blackmail' ? (
        <button className="contract-btn contract-btn-dark" onClick={onBlackmailInfo}>
            Blackmail Info
        </button>
        ) : (
        <div className="contract-history-spacer" />
        )}
      </div>
        {!canManage && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white/50">
            You are the payer in this contract. Only the receiver can change or stop it.
            </div>
        )}
    </article>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'paid' | 'left';
}) {
  return (
    <div className="stat-box">
      <div className="text-[11px] text-white/45 font-semibold">{label}</div>
      <div
        className={[
          'mt-0.5 text-[18px] sm:text-[20px] font-black tracking-tight',
          tone === 'paid' ? 'text-teal-300' : '',
          tone === 'left' ? 'text-rose-300' : '',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function ProgressDonut({ percent }: { percent: number }) {
  return (
    <div
      className="contract-donut"
      style={{
        background: `conic-gradient(
          #8b5cf6 0 ${percent}%,
          rgba(255,255,255,.10) ${percent}% 100%
        )`,
      }}
    >
      <div className="contract-donut-hole" />
    </div>
  );
}

function NewContractFlow({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (contract: Contract) => void;
}) {
  const [step, setStep] = React.useState<'pick' | 'form'>('pick');
  const [q, setQ] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<(typeof SEARCH_USERS)[number] | null>(null);
  const [type, setType] = React.useState<ContractType>('debt');
  const [moneyDirection, setMoneyDirection] = React.useState<MoneyDirection | null>(null);

  const users = SEARCH_USERS.filter((u) => {
    const s = q.trim().toLowerCase();
    return !s || u.displayName.toLowerCase().includes(s) || u.handle.toLowerCase().includes(s);
  });

  function createBase(totalCents: number, interestPct: number, blackmailInfo?: BlackmailInfo) {
    if (!selectedUser || !moneyDirection) return;

    onCreate({
        id: crypto.randomUUID(),
        type,
        status: 'active',
        user: selectedUser,
        totalCents,
        paidCents: 0,
        interestPct,
        nextInterestDays: 30,
        createdAt: new Date().toISOString(),
        moneyDirection,
        viewerCanManage: moneyDirection === 'selectedUserPaysViewer',
        history: [
        {
            id: crypto.randomUUID(),
            date: new Date().toLocaleDateString(),
            type: 'Contract created',
            amountCents: 0,
        },
        ],
        blackmailInfo,
    });
    }

  return (
    <Overlay>
      <div className="modal-card max-w-md max-h-[calc(100dvh-96px-env(safe-area-inset-bottom))] overflow-hidden flex flex-col">
        <OverlayHeader
          title={step === 'pick' ? 'Pick a Contract' : type === 'debt' ? 'Debt Contract' : 'Blackmail Contract'}
          subtitle={
            step === 'pick'
              ? 'Choose a user and contract type'
              : selectedUser
              ? selectedUser.displayName
              : undefined
          }
          onBack={step === 'pick' ? onClose : () => setStep('pick')}
        />

        {step === 'pick' ? (
          <div className="p-4 overflow-y-auto">
            <SearchInput value={q} onChange={setQ} placeholder="Search Subm8" />

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.035] overflow-hidden">
              {users.map((u) => {
                const active = selectedUser?.id === u.id;

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUser(u)}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-3 text-left transition',
                      active ? 'bg-[var(--purple)]/18' : 'hover:bg-white/[.06]',
                    ].join(' ')}
                  >
                    <Avatar src={u.avatarUrl} name={u.displayName} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="font-extrabold truncate">{u.displayName}</div>

                            <span
                            className={[
                                'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase leading-none',
                                u.role === 'domme'
                                ? 'border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200'
                                : 'border-sky-400/30 bg-sky-500/15 text-sky-200',
                            ].join(' ')}
                            >
                            {u.role === 'domme' ? 'Domme' : 'Sub'}
                            </span>
                        </div>

                        <div className="text-[12px] text-white/55 truncate">@{u.handle}</div>
                    </div>
                    {active && <div className="text-[var(--purple)] font-black">✓</div>}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <div className="text-center text-[15px] font-black mb-3">
                What kind of contract do you want to make?
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('debt')}
                  className={`contract-choice-clean ${type === 'debt' ? 'is-active' : ''}`}
                >
                  <strong>Debt Contract</strong>
                  <span>Set debt, interest and payment terms.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('blackmail')}
                  className={`contract-choice-clean ${type === 'blackmail' ? 'is-active' : ''}`}
                >
                  <strong>Blackmail Contract</strong>
                  <span>Debt plus consensual blackmail info.</span>
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button className="secondary-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary-btn disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!selectedUser}
                onClick={() => setStep('form')}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <ContractForm
            type={type}
            userName={selectedUser?.displayName ?? ''}
            moneyDirection={moneyDirection}
            setMoneyDirection={setMoneyDirection}
            onCancel={onClose}
            onSave={(amount, interest, info) => createBase(amount, interest, info)}
        />
        )}
      </div>
    </Overlay>
  );
}

function ContractForm({
  type,
  userName,
  moneyDirection,
  setMoneyDirection,
  onCancel,
  onSave,
}: {
  type: ContractType;
  userName: string;
  moneyDirection: MoneyDirection | null;
  setMoneyDirection: (v: MoneyDirection) => void;
  onCancel: () => void;
  onSave: (amountCents: number, interestPct: number, blackmailInfo?: BlackmailInfo) => void;
}) {
  const [amount, setAmount] = React.useState('');
  const [interest, setInterest] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const [info, setInfo] = React.useState<BlackmailInfo>({
    personal: { 'Full Name': userName },
    work: {},
    closePerson: {},
  });

  const amountCents = Math.max(0, Math.round(Number(amount.replace(',', '.')) * 100) || 0);
  const interestPct = Math.max(0, Math.round(Number(interest.replace(',', '.')) || 0));
  const fullName = (info.personal['Full Name'] ?? '').trim();

  const amountInvalid = submitted && amountCents <= 0;
  const interestInvalid = submitted && (interest.trim() === '' || interestPct < 0);
  const directionInvalid = submitted && !moneyDirection;
  const fullNameInvalid = submitted && type === 'blackmail' && fullName.length < 2;

  const canSave =
    amountCents > 0 &&
    interest.trim() !== '' &&
    interestPct >= 0 &&
    !!moneyDirection &&
    (type !== 'blackmail' || fullName.length >= 2);

  function handleSave() {
    setSubmitted(true);
    if (!canSave) return;

    onSave(amountCents, interestPct, type === 'blackmail' ? info : undefined);
  }

  return (
    <div className="overflow-y-auto p-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
      <p className="text-center text-[13px] text-white/60 leading-snug">
        This contract will be saved locally for now. Later you can connect this form to your API.
      </p>

      <section className="mt-4 form-panel">
        <div className="form-section-title">Debt Information</div>

        <div className="grid gap-3">
          <Input
            label="Amount to be paid"
            required
            error={amountInvalid}
            value={amount}
            onChange={setAmount}
            suffix="€"
          />

          <div className="grid gap-2">
            <Input
              label="Monthly interest"
              required
              error={interestInvalid}
              value={interest}
              onChange={setInterest}
              suffix="%"
            />

            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white/55">
              Interest is applied automatically at the beginning of every month.
            </div>

            <div className="mt-3 grid gap-2">
              <div className={`text-[12px] font-bold ${directionInvalid ? 'text-red-400' : 'text-white/65'}`}>
                Who pays whom? <span className="text-red-400">*</span>
              </div>

              <button
                type="button"
                onClick={() => setMoneyDirection('selectedUserPaysViewer')}
                className={`direction-choice ${moneyDirection === 'selectedUserPaysViewer' ? 'is-active' : ''} ${directionInvalid ? 'is-error' : ''}`}
              >
                <span>{userName || 'Selected user'} pays you</span>
                <small>You can change amount and stop the contract.</small>
              </button>

              <button
                type="button"
                onClick={() => setMoneyDirection('viewerPaysSelectedUser')}
                className={`direction-choice ${moneyDirection === 'viewerPaysSelectedUser' ? 'is-active' : ''} ${directionInvalid ? 'is-error' : ''}`}
              >
                <span>You pay {userName || 'selected user'}</span>
                <small>You cannot change amount, stop, or deactivate this contract.</small>
              </button>

              {directionInvalid && (
                <div className="text-[12px] font-semibold text-red-400">
                  Please choose who pays whom.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {type === 'blackmail' && (
        <div className="mt-3 space-y-3">
          <InfoGroup
            title="Personal Information"
            value={info.personal}
            onChange={(next) => setInfo((p) => ({ ...p, personal: next }))}
            fields={['Full Name', 'City', 'Street', 'Door', 'Telephone Number', 'Card Details']}
            requiredFields={['Full Name']}
            errorFields={fullNameInvalid ? ['Full Name'] : []}
          />

          <InfoGroup
            title="Work Information"
            value={info.work}
            onChange={(next) => setInfo((p) => ({ ...p, work: next }))}
            fields={['Job Title', 'Salary', "Boss's Name", 'Address', 'Door']}
          />

          <InfoGroup
            title="Someone Close to User"
            value={info.closePerson}
            onChange={(next) => setInfo((p) => ({ ...p, closePerson: next }))}
            fields={['Full Name', 'City', 'Street', 'Door', 'Telephone Number', 'Card Details']}
          />
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button className="secondary-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}

function ChangeAmountOverlay({
  contract,
  onClose,
  onSave,
}: {
  contract: Contract;
  onClose: () => void;
  onSave: (amountCents: number) => void;
}) {
  const [amount, setAmount] = React.useState(String(contract.totalCents / 100));
  const cents = Math.round((Number(amount.replace(',', '.')) || 0) * 100);

  return (
    <Overlay>
      <div className="modal-card max-w-sm p-4">
        <h2 className="text-center text-[22px] font-black">Change Amount</h2>
        <p className="text-center text-white/60 text-[13px]">{contract.user.displayName}</p>

        <div className="mt-4">
          <Input label="New total amount" value={amount} onChange={setAmount} suffix="€" />
        </div>

        <div className="mt-5 flex gap-3">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={() => onSave(cents)}>Save</button>
        </div>
      </div>
    </Overlay>
  );
}

function HistoryOverlay({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  return (
    <Overlay>
      <div className="modal-card max-w-md p-4">
        <h2 className="text-[22px] font-black">Debt Payment History</h2>

        <div className="mt-3 max-h-[55dvh] overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#222]">
              <tr className="text-white/80">
                <th className="text-left px-2 py-2">Date/time</th>
                <th className="text-left px-2 py-2">Type</th>
                <th className="text-right px-2 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {contract.history.map((h) => (
                <tr key={h.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{h.date}</td>
                  <td className="px-2 py-2">{h.type}</td>
                  <td className={`px-2 py-2 text-right font-bold ${h.amountCents >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {h.amountCents >= 0 ? '+' : ''}
                    {money(h.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="mt-4 w-full h-12 rounded-xl bg-white/10 hover:bg-white/15 font-black text-[20px]" onClick={onClose}>
          Go Back
        </button>
      </div>
    </Overlay>
  );
}

function BlackmailOverlay({
  contract,
  onClose,
  onSave,
}: {
  contract: Contract;
  onClose: () => void;
  onSave: (info: BlackmailInfo) => void;
}) {
  const [info, setInfo] = React.useState<BlackmailInfo>(
    contract.blackmailInfo ?? { personal: {}, work: {}, closePerson: {} }
  );

  return (
    <Overlay>
      <div className="modal-card max-w-md max-h-[calc(100dvh-24px)] overflow-y-auto p-4">
        <h2 className="text-center text-[24px] font-black">Blackmail Info</h2>
        <p className="text-center font-bold">{contract.user.displayName}</p>

        <div className="mt-4 space-y-3">
          <InfoGroup
            title="Personal Information"
            value={info.personal}
            onChange={(next) => setInfo((p) => ({ ...p, personal: next }))}
            fields={['Full Name', 'City', 'Street', 'Door', 'Telephone Number', 'Card Details']}
          />
          <InfoGroup
            title="Work Information"
            value={info.work}
            onChange={(next) => setInfo((p) => ({ ...p, work: next }))}
            fields={['Job Title', 'Salary', "Boss's Name", 'Address', 'Door']}
          />
          <InfoGroup
            title="Someone Close to Information Max"
            value={info.closePerson}
            onChange={(next) => setInfo((p) => ({ ...p, closePerson: next }))}
            fields={['Full Name', 'City', 'Street', 'Door', 'Telephone Number', 'Card Details']}
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={() => onSave(info)}>Save</button>
        </div>
      </div>
    </Overlay>
  );
}

function StopOverlay({
  contract,
  confirmAction,
  setConfirmAction,
  onClose,
  onDeactivate,
  onDelete,
}: {
  contract: Contract;
  confirmAction: 'deactivate' | 'delete' | null;
  setConfirmAction: (v: 'deactivate' | 'delete' | null) => void;
  onClose: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  return (
    <Overlay>
      <div className="modal-card max-w-sm p-4 relative">
        <p className="text-center text-white/45 font-bold">{contract.user.displayName}</p>
        <h2 className="text-center text-[26px] font-black leading-tight">Stop/Deactivate Contract</h2>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="primary-btn bg-fuchsia-950/90" onClick={() => setConfirmAction('deactivate')}>
            Deactivate
          </button>
          <button className="primary-btn bg-red-900" onClick={() => setConfirmAction('delete')}>
            Delete
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-center text-[12px] text-white/75 font-semibold">
          <p>If you deactivate it, interest stops and no payments will be added.</p>
          <p>If you delete it, all contract information will be lost forever.</p>
        </div>

        <button className="mt-5 w-full secondary-btn" onClick={onClose}>Cancel</button>

        {confirmAction && (
          <div className="absolute inset-x-6 top-20 z-10 rounded-2xl border border-white/10 bg-[#090909] p-4 shadow-2xl">
            <h3 className="text-center text-[18px] font-black">
              Are you sure you want to {confirmAction === 'delete' ? 'delete' : 'deactivate'} it?
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="primary-btn bg-fuchsia-950"
                onClick={confirmAction === 'delete' ? onDelete : onDeactivate}
              >
                Yes
              </button>
              <button className="primary-btn bg-red-900" onClick={() => setConfirmAction(null)}>
                No
              </button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

const INFO_PLACEHOLDERS: Record<string, string> = {
  'Full Name': 'e.g. Max Mustermann',
  City: 'e.g. Vienna',
  Street: 'e.g. Main Street 12',
  Door: 'e.g. Top 4 / Door 12',
  'Telephone Number': 'e.g. +43 660 1234567',
  'Card Details': 'e.g. Last 4 digits / bank hint',
  'Job Title': 'e.g. Office Manager',
  Salary: 'e.g. €2,400 / month',
  "Boss's Name": 'e.g. Anna Schmidt',
  Address: 'e.g. Company address',
};

function InfoGroup({
  title,
  fields,
  value,
  onChange,
  requiredFields = [],
  errorFields = [],
}: {
  title: string;
  fields: string[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  requiredFields?: string[];
  errorFields?: string[];
}) {
  return (
    <div>
      <div className="mb-1 text-[14px] font-black">{title}</div>

      <div className="rounded-2xl bg-white/[.06] border border-white/10 p-3 space-y-2">
        {fields.map((f) => {
          const required = requiredFields.includes(f);
          const hasError = errorFields.includes(f);

          return (
            <label
              key={f}
              className="grid grid-cols-[120px_1fr] items-center gap-2 text-[12px] font-semibold"
            >
              <span className={hasError ? 'text-red-400' : ''}>
                {f}:{required && <span className="text-red-400"> *</span>}
              </span>

              <input
                value={value[f] ?? ''}
                placeholder={INFO_PLACEHOLDERS[f] ?? `Enter ${f.toLowerCase()}`}
                onChange={(e) => onChange({ ...value, [f]: e.target.value })}
                className={[
                  'h-8 min-w-0 rounded-lg bg-black/40 border px-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/30 placeholder:text-white/38 placeholder:font-semibold',
                  hasError ? 'border-red-500/80 ring-1 ring-red-500/35' : 'border-white/10',
                ].join(' ')}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  suffix,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <label className="block">
      <span className={`block text-[12px] mb-1 font-semibold ${error ? 'text-red-400' : 'text-white/65'}`}>
        {label} {required && <span className="text-red-400">*</span>}
      </span>

      <div
        className={[
          'flex items-center rounded-xl bg-black/40 border overflow-hidden',
          error ? 'border-red-500/80 ring-1 ring-red-500/35' : 'border-white/10',
        ].join(' ')}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="h-11 flex-1 min-w-0 bg-transparent px-3 outline-none"
        />
        {suffix && <span className="px-3 text-white/45">{suffix}</span>}
      </div>

      {error && (
        <div className="mt-1 text-[11px] font-semibold text-red-400">
          This field is required.
        </div>
      )}
    </label>
  );
}

function EmptyState() {
  return (
    <div className="min-h-[55dvh] rounded-2xl border border-white/10 bg-[#171719] grid place-items-center p-8 text-center">
      <div>
        <div className="mx-auto mb-4 size-14 rounded-full bg-white/5 border border-white/10 grid place-items-center text-[var(--purple)]">
          <ContractsSmallIcon />
        </div>
        <h2 className="text-[25px] font-black text-white/40 leading-tight">Currently no active Contracts</h2>
        <p className="mt-2 text-[13px] text-white/45">Create a new contract to see it here.</p>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2147483600] grid place-items-center bg-black/70 backdrop-blur-sm p-3">
      {children}
    </div>
  );
}

function OverlayHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <header className="relative px-4 pt-4 pb-3 border-b border-white/10">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-3 top-4 size-8 grid place-items-center rounded-full hover:bg-white/10 text-[var(--purple)]"
      >
        <ChevronLeftIcon />
      </button>
      <div className="text-center">
        <h2 className="text-[22px] font-black leading-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-white/60">{subtitle}</p>}
      </div>
    </header>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
        <SearchIcon />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 rounded-full bg-white/[.06] border border-white/10 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-[var(--purple)]/35"
      />
    </label>
  );
}

function Viewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-0 bg-black bg-gradient-to-b from-black to-[#0b0b0b]">
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-[calc(88px+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>

      <style jsx global>{`
        .direction-choice.is-error {
        border-color: rgba(239, 68, 68, .75);
        box-shadow: inset 0 0 0 1px rgba(239, 68, 68, .25);
        }
        .contract-history-spacer {
        display: block;
        }

        @media (min-width: 381px) {
        .contract-history-spacer {
            display: block;
        }

        .contract-actions:has(.contract-history-spacer) .contract-btn-soft {
            grid-column: 1 / -1;
            justify-self: center;
            width: calc(50% - 5px);
        }
        }

        @media (max-width: 380px) {
        .contract-history-spacer {
            display: none;
        }

        .contract-actions:has(.contract-history-spacer) .contract-btn-soft {
            width: 100%;
        }
        }
        .direction-choice {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.25);
        padding: 12px;
        text-align: left;
        display: grid;
        gap: 3px;
        }

        .direction-choice span {
        font-size: 14px;
        font-weight: 900;
        }

        .direction-choice small {
        font-size: 12px;
        color: rgba(255,255,255,.48);
        line-height: 1.25;
        }

        .direction-choice.is-active {
        border-color: rgba(139,92,246,.65);
        background: rgba(139,92,246,.20);
        }
        .contract-card {
            border-radius: 28px;
            border: 1px solid rgba(255,255,255,.10);
            background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
            box-shadow: 0 18px 55px rgba(0,0,0,.35);
            overflow: hidden;
            padding: 14px;
        }

        @media (max-width: 640px) {
            .contract-card {
                min-height: calc(100dvh - 178px - 88px);
                scroll-margin-bottom: calc(96px + env(safe-area-inset-bottom));
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
        }

        .contract-card-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
        }

        .contract-type-pill {
            border-radius: 999px;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 900;
            color: #e9d5ff;
            background: rgba(139,92,246,.16);
            border: 1px solid rgba(139,92,246,.28);
            white-space: nowrap;
        }

        .contract-main {
            display: grid;
            grid-template-columns: minmax(180px, 280px) 1fr;
            align-items: center;
            gap: 22px;
            padding: 24px 4px 18px;
        }

        @media (max-width: 640px) {
            .contract-main {
            grid-template-columns: 1fr;
            gap: 18px;
            padding-top: 18px;
            }
        }

        .contract-donut-wrap {
            position: relative;
            display: grid;
            place-items: center;
            justify-self: center;
        }

        .contract-donut {
            position: relative;
            width: min(62vw, 260px);
            height: min(62vw, 260px);
            max-width: 260px;
            max-height: 260px;
            min-width: 190px;
            min-height: 190px;
            border-radius: 999px;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
        }

        .contract-donut-hole {
            position: absolute;
            inset: 22%;
            border-radius: 999px;
            background: #151518;
            border: 1px solid rgba(255,255,255,.08);
        }

        .contract-donut-center {
            position: absolute;
            inset: 0;
            display: grid;
            place-content: center;
            text-align: center;
            pointer-events: none;
        }

        .contract-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        @media (max-width: 420px) {
            .contract-stats {
            grid-template-columns: 1fr 1fr;
            }
        }

        .stat-box {
            min-height: 72px;
            border-radius: 18px;
            padding: 12px;
            background: rgba(0,0,0,.28);
            border: 1px solid rgba(255,255,255,.08);
        }

        .contract-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        @media (max-width: 380px) {
            .contract-actions {
            grid-template-columns: 1fr;
            }
        }

        .contract-btn {
            min-height: 46px;
            border-radius: 999px;
            padding: 0.65rem 0.9rem;
            font-size: 14px;
            font-weight: 900;
            color: white;
            transition: transform 140ms ease, opacity 140ms ease, background 140ms ease;
        }

        .contract-btn:active {
            transform: scale(.98);
        }

        .contract-btn-primary {
            background: linear-gradient(135deg, rgba(139,92,246,.95), rgba(168,85,247,.72));
        }

        .contract-btn-soft {
            background: rgba(139,92,246,.22);
            border: 1px solid rgba(139,92,246,.22);
        }

        .contract-btn-danger {
            background: rgba(190,18,60,.28);
            border: 1px solid rgba(244,63,94,.22);
            color: #fecdd3;
        }

        .contract-btn-dark {
            background: rgba(0,0,0,.42);
            border: 1px solid rgba(255,255,255,.08);
        }

        .modal-card {
            width: 100%;
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,.12);
            background: #18181b;
            box-shadow: 0 20px 80px rgba(0,0,0,.55);
            overflow: hidden;
        }

        .primary-btn {
            min-height: 44px;
            flex: 1;
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(139,92,246,.95), rgba(168,85,247,.68));
            padding: .65rem 1rem;
            font-weight: 850;
            color: white;
        }

        .secondary-btn {
            min-height: 44px;
            flex: 1;
            border-radius: 999px;
            background: rgba(255,255,255,.07);
            padding: .65rem 1rem;
            font-weight: 850;
            color: white;
        }

        .contract-choice {
            min-height: 128px;
            border-radius: 20px;
            background:
            radial-gradient(circle at 30% 0%, rgba(255,255,255,.16), transparent 38%),
            linear-gradient(180deg, rgba(139,92,246,.95), rgba(88,28,135,.9));
            padding: 14px;
            text-align: center;
            display: grid;
            gap: 8px;
            align-content: center;
            border: 1px solid rgba(255,255,255,.10);
        }

        .contract-choice strong {
            line-height: 1.05;
        }

        .contract-choice span {
            font-size: 13px;
            color: rgba(255,255,255,.68);
            line-height: 1.15;
        }
        
        .contract-choice-clean {
        min-height: 132px;
        border-radius: 22px;
        padding: 14px;
        display: grid;
        align-content: center;
        gap: 8px;
        text-align: center;
        background: rgba(255,255,255,.045);
        border: 1px solid rgba(255,255,255,.10);
        transition: transform 140ms ease, background 140ms ease, border 140ms ease;
        }

        .contract-choice-clean:active {
        transform: scale(.98);
        }

        .contract-choice-clean.is-active {
        background: rgba(139,92,246,.22);
        border-color: rgba(139,92,246,.55);
        box-shadow: inset 0 0 0 1px rgba(139,92,246,.22);
        }

        .contract-choice-clean strong {
        font-size: 16px;
        line-height: 1.05;
        }

        .contract-choice-clean span {
        font-size: 13px;
        line-height: 1.25;
        color: rgba(255,255,255,.62);
        }

        .form-panel {
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.045);
        padding: 14px;
        }

        .form-section-title {
        margin-bottom: 10px;
        font-size: 14px;
        font-weight: 900;
        }
        `}</style>
    </div>
  );
}

function Avatar({ src, name }: { src?: string | null; name: string }) {
  return (
    <Image
      src={src || AVATAR_PH}
      alt={`${name} avatar`}
      width={40}
      height={40}
      className="size-10 rounded-full object-cover border border-white/15 bg-white/10"
      onError={(e) => {
        e.currentTarget.src = AVATAR_PH;
      }}
    />
  );
}

function CheckBox({ active }: { active: boolean }) {
  return (
    <span className="size-4 rounded border border-[var(--purple)]/60 grid place-items-center">
      {active && <span className="size-2 rounded-sm bg-[var(--purple)]" />}
    </span>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 50 50" width="18" height="18" fill="currentColor">
      <path d="M 4 2 C 3.398438 2 3 2.398438 3 3 L 3 6 C 3 6.300781 3.113281 6.488281 3.3125 6.6875 L 19.3125 23.6875 C 19.511719 23.886719 19.800781 24 20 24 L 30 24 C 30.300781 24 30.488281 23.886719 30.6875 23.6875 L 46.6875 6.6875 C 46.886719 6.488281 47 6.300781 47 6 L 47 3 C 47 2.398438 46.601563 2 46 2 Z M 19 26 L 19 41 C 19 41.398438 19.199219 41.707031 19.5 41.90625 L 29.5 47.90625 C 29.601563 48.007813 29.800781 48 30 48 C 30.199219 48 30.300781 48.007813 30.5 47.90625 C 30.800781 47.707031 31 47.398438 31 47 L 31 26 Z" />
    </svg>
  );
}

function ContractsSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3.5h7.5L19 8v12.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14.5 3.5V8H19" />
      <path d="M8.5 12h7M8.5 15h5M8.5 18h6.5" strokeLinecap="round" />
    </svg>
  );
}