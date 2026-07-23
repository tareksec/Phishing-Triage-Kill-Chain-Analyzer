import './LoadingStepper.css';

interface Step {
  label: string;
  icon: string;
}

interface Props {
  steps: Step[];
  currentIndex: number;     // -1 = not started
  error?: string | null;
}

export default function LoadingStepper({ steps, currentIndex, error }: Props) {
  return (
    <div className="stepper" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemax={steps.length}>
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFailed = isCurrent && !!error;

        return (
          <div
            key={i}
            className={[
              'stepper__step',
              isDone && 'stepper__step--done',
              isCurrent && !isFailed && 'stepper__step--active',
              isFailed && 'stepper__step--error',
            ].filter(Boolean).join(' ')}
          >
            <div className="stepper__icon-wrapper">
              {isDone ? (
                <span className="stepper__check" aria-hidden="true">✓</span>
              ) : isFailed ? (
                <span className="stepper__error-icon" aria-hidden="true">✗</span>
              ) : (
                <span className="stepper__step-icon" aria-hidden="true">{step.icon}</span>
              )}
              {isCurrent && !isFailed && <div className="stepper__pulse" />}
            </div>
            <span className="stepper__label">{step.label}</span>
            {isFailed && error && (
              <span className="stepper__error-msg">{error}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
