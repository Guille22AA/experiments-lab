// What happens after "Lo he cocinado": first the quick feedback, then the
// proposal to lower the pantry products used. Both can be skipped.
import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import DeductionSheet from '../menu/DeductionSheet.jsx';
import FeedbackSheet from './FeedbackSheet.jsx';

/**
 * @param {{ cooked: { recipeId, cookedLogId, isFirstTime, deduction: [], title? }, onFinish: () => void }} props
 */
export default function AfterCooking({ cooked, onFinish }) {
  const showToast = useToast();
  const [step, setStep] = useState(cooked.recipeId ? 'feedback' : 'deduction');

  const goToDeduction = () => (cooked.deduction.length > 0 ? setStep('deduction') : onFinish());

  if (step === 'feedback') return <FeedbackSheet cooked={cooked} onDone={goToDeduction} />;
  if (step === 'deduction' && cooked.deduction.length > 0) {
    return (
      <DeductionSheet
        proposals={cooked.deduction}
        onDone={(count) => {
          if (count > 0) showToast('Despensa actualizada');
          onFinish();
        }}
        onClose={onFinish}
      />
    );
  }
  return null;
}
