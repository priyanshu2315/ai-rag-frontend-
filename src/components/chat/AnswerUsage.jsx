import { useId } from 'react';
import { Zap } from 'lucide-react';
import { JsonDetails } from '../chunks/ChunkInspection';

const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN') : 'Unavailable';
const money = (value, currency) => typeof value === 'number' && Number.isFinite(value)
  ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value) : 'Unavailable';

export const UsageBreakdown = ({ steps }) => <div className="mt-2 overflow-x-auto"><table className="w-full whitespace-nowrap text-left">
  <thead><tr>{['Step', 'Model', 'Input', 'Output', 'Total tokens', 'USD', 'INR'].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead>
  <tbody>{steps.map((step, index) => <tr key={step.eventId ?? index}>
    <td className="p-2">{step.step ?? 'Unavailable'}</td><td className="p-2">{step.model ?? 'Unavailable'}</td>
    <td className="p-2">{number(step.promptTokens)}</td><td className="p-2">{number(step.completionTokens)}</td><td className="p-2">{number(step.totalTokens)}</td>
    <td className="p-2">{money(step.costUSD, 'USD')}</td><td className="p-2">{step.formattedINR ?? money(step.costINR, 'INR')}</td>
  </tr>)}</tbody>
</table></div>;

const AnswerUsage = ({ usage, stepCosts = [], historical = false }) => {
  const popoverId = useId();
  if (!usage && !stepCosts.length) return null;
  const steps = Array.isArray(usage?.breakdown) ? usage.breakdown : stepCosts;
  return <section aria-label="Answer usage" className="mt-3 border-t border-border pt-3 text-[12px] text-muted">
    <details className="group/usage" open={!usage}>
      <summary aria-controls={popoverId} className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 font-medium text-ink-2">
        <Zap className="h-3.5 w-3.5 text-blue" aria-hidden="true" />
        {usage ? `${number(usage.totalTokens)} tokens • ${usage.formattedTotalCost ?? money(usage.totalCostINR, 'INR')}` : `${historical ? 'Saved' : 'Live'} step costs • ${stepCosts.length}`}
      </summary>
      <div id={popoverId} className="mt-2 rounded-(--radius-sm) border border-border bg-surface p-3">
        <p className="font-semibold text-ink-2">Query cost breakdown</p>
        {!usage && <p>Final usage summary not received yet.</p>}
        <UsageBreakdown steps={steps} />
        {stepCosts.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Reported step costs · {stepCosts.length}</summary>
          <UsageBreakdown steps={stepCosts} />
          {stepCosts.map((cost, index) => <JsonDetails key={cost.eventId ?? index} title={`Exact step cost event ${index + 1}`} value={cost} />)}
        </details>}
        {usage && <JsonDetails title="Exact total usage summary" value={usage} />}
      </div>
    </details>
  </section>;
};

export default AnswerUsage;
