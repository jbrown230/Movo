// Modales del presupuesto: el mensual, el de cada categoría y a qué porcentaje avisar.

import { useState } from 'react';
import { AmountInput, SegmentedControl } from '../components/formControls.jsx';
import { CategoryIcon } from '../components/Icon.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { ALERT_PERCENT_OPTIONS, BUDGETABLE_CATEGORY_KEYS } from '../../domain/budget.js';
import { getCategory } from '../../domain/categories.js';
import { textToCents } from '../../domain/money.js';
import { formatColonesShort } from '../format/money.js';
import { useConfirm } from './ConfirmModal.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

/** Cambiar el presupuesto mensual. */
export function BudgetModal() {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const confirm = useConfirm();
  const showToast = useToast();
  const currentCents = services.preferences.budgetCents();
  const [amountText, setAmountText] = useState(String(Math.round(currentCents / 100)));

  const save = () => {
    const cents = textToCents(amountText);
    if (!(cents > 0) || cents === currentCents) {
      closeModal();
      return;
    }
    confirm({
      title: 'Cambiar presupuesto',
      text: `Tu presupuesto mensual pasa de ${formatColonesShort(currentCents)} a ${formatColonesShort(cents)}.`,
      confirmLabel: 'Cambiar presupuesto',
      danger: false,
      onConfirm: () => {
        services.preferences.setBudgetCents(cents);
        refresh();
        showToast('Presupuesto actualizado');
      },
    });
  };

  return (
    <>
      <ModalHeader title="Presupuesto mensual" />
      <AmountInput value={amountText} onChange={setAmountText} />
      <button type="button" className="cta" onClick={save}>
        Guardar
      </button>
    </>
  );
}

/** Los montos escritos, en colones sin decimales: `{ comida: '50000' }`. Vacío es "sin presupuesto". */
const toAmountTexts = (budgets) =>
  Object.fromEntries(
    BUDGETABLE_CATEGORY_KEYS.map((key) => [key, budgets[key] ? String(Math.round(budgets[key] / 100)) : '']),
  );

const toBudgets = (amountTexts) =>
  Object.fromEntries(
    Object.entries(amountTexts)
      .map(([key, text]) => [key, textToCents(text)])
      .filter(([, cents]) => cents > 0),
  );

const sameBudgets = (first, second) =>
  BUDGETABLE_CATEGORY_KEYS.every((key) => (first[key] ?? 0) === (second[key] ?? 0));

function categoryBudgetsSummary(budgets) {
  const count = Object.keys(budgets).length;
  if (!count) return 'Ninguna categoría queda con presupuesto propio.';
  const names = Object.keys(budgets).map((key) => `${getCategory(key).name} ${formatColonesShort(budgets[key])}`);
  return `${count === 1 ? 'Queda con presupuesto propio' : 'Quedan con presupuesto propio'}: ${names.join(', ')}.`;
}

/** Presupuesto de cada categoría. Una categoría sin monto no tiene límite propio. */
export function CategoryBudgetsModal({ prefill = null }) {
  const { services, refresh } = useSession();
  const { closeModal, openModal } = useModal();
  const confirm = useConfirm();
  const showToast = useToast();
  const currentBudgets = services.preferences.categoryBudgets();
  const [amountTexts, setAmountTexts] = useState(prefill ?? toAmountTexts(currentBudgets));

  const setAmount = (key, text) => setAmountTexts((texts) => ({ ...texts, [key]: text.replace(/[^\d.,]/g, '') }));

  const save = () => {
    const budgets = toBudgets(amountTexts);
    if (sameBudgets(budgets, currentBudgets)) {
      closeModal();
      return;
    }
    confirm({
      title: 'Cambiar presupuestos por categoría',
      text: categoryBudgetsSummary(budgets),
      confirmLabel: 'Guardar presupuestos',
      danger: false,
      onCancel: () => openModal(<CategoryBudgetsModal prefill={amountTexts} />),
      onConfirm: () => {
        services.preferences.setCategoryBudgets(budgets);
        refresh();
        showToast('Presupuestos actualizados');
      },
    });
  };

  return (
    <>
      <ModalHeader title="Presupuesto por categoría" />
      <p className="meta">
        Movo te avisa cuando una categoría se acerca a su límite. Deja en blanco las que no quieras limitar.
      </p>
      <div className="catbudgets">
        {BUDGETABLE_CATEGORY_KEYS.map((key) => {
          const { name } = getCategory(key);
          return (
            <label className="catbudget" key={key}>
              <CategoryIcon category={key} size={34} />
              <span>{name}</span>
              <span className="catbudget-input">
                ₡
                <input
                  value={amountTexts[key]}
                  onChange={(event) => setAmount(key, event.target.value)}
                  inputMode="decimal"
                  placeholder="Sin límite"
                  aria-label={`Presupuesto de ${name}`}
                  autoComplete="off"
                />
              </span>
            </label>
          );
        })}
      </div>
      <button type="button" className="cta" onClick={save}>
        Guardar
      </button>
    </>
  );
}

const ALERT_OPTIONS = ALERT_PERCENT_OPTIONS.map((percent) => ({ value: percent, label: `${percent} %` }));

/** A qué porcentaje del presupuesto avisar. Al 100 % siempre se avisa. */
export function BudgetAlertModal() {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const confirm = useConfirm();
  const showToast = useToast();
  const currentPercent = services.preferences.budgetAlertPercent();
  const [percent, setPercent] = useState(currentPercent);

  const save = () => {
    if (percent === currentPercent) {
      closeModal();
      return;
    }
    confirm({
      title: 'Cambiar el aviso del presupuesto',
      text: `Movo te avisa al llegar al ${percent} % de cada presupuesto, y otra vez al 100 %.`,
      confirmLabel: 'Cambiar aviso',
      danger: false,
      onConfirm: () => {
        services.preferences.setBudgetAlertPercent(percent);
        refresh();
        showToast('Aviso actualizado');
      },
    });
  };

  return (
    <>
      <ModalHeader title="Aviso del presupuesto" />
      <p className="meta">
        Elige a qué parte del presupuesto avisarte. Vale para el presupuesto mensual y para el de cada categoría.
      </p>
      <SegmentedControl
        options={ALERT_OPTIONS}
        value={percent}
        onChange={setPercent}
        label="Avisar al llegar al"
        isCompact
      />
      <button type="button" className="cta" onClick={save}>
        Guardar
      </button>
    </>
  );
}
