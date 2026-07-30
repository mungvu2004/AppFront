import React from 'react';
import { motion } from 'framer-motion';

export interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
}

const RadioContext = React.createContext<{
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  name: string;
} | null>(null);

export function RadioGroup({ value, onChange, children, disabled = false, name, className = '' }: RadioGroupProps) {
  const defaultName = React.useId();
  const internalName = name || defaultName;
  return (
    <RadioContext.Provider value={{ value, onChange, disabled, name: internalName }}>
      <div className={`flex flex-col gap-2 ${className}`} role="radiogroup">
        {children}
      </div>
    </RadioContext.Provider>
  );
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  label?: string;
}

export function Radio({ value, label, disabled = false, className = '', id, ...props }: RadioProps) {
  const context = React.useContext(RadioContext);
  const defaultId = React.useId();
  const internalId = id || defaultId;
  
  if (!context) {
    throw new Error('Radio must be used within a RadioGroup');
  }

  const isChecked = context.value === value;
  const isDisabled = context.disabled || disabled;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isDisabled) context.onChange(value);
    }
  };

  return (
    <label 
      htmlFor={internalId}
      className={`flex items-center min-h-[32px] cursor-pointer outline-none ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <input
          id={internalId}
          type="radio"
          name={context.name}
          value={value}
          checked={isChecked}
          disabled={isDisabled}
          onChange={() => context.onChange(value)}
          onKeyDown={handleKeyDown}
          className="peer sr-only"
          {...props}
        />
        
        <motion.div
          className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-colors duration-120
            peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2
            ${isChecked ? 'border-accent' : 'border-border-default bg-bg-surface'}
          `}
          whileTap={!isDisabled ? { scale: 0.94 } : {}}
          transition={{ duration: 0.12 }}
        >
          <motion.div 
            className="w-[6px] h-[6px] rounded-full bg-accent"
            initial={{ scale: 0 }}
            animate={{ scale: isChecked ? 1 : 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          />
        </motion.div>
      </div>
      
      {label && (
        <span className={`ml-2 text-[15px] leading-[24px] select-none ${isDisabled ? 'text-text-muted' : 'text-text-primary'}`}>
          {label}
        </span>
      )}
    </label>
  );
}

export interface IconRadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; icon: React.ReactNode; label: string }[];
  disabled?: boolean;
  className?: string;
}

export function IconRadioGroup({ value, onChange, options, disabled = false, className = '' }: IconRadioGroupProps) {
  return (
    <div className={`flex gap-1 ${className}`} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          aria-label={opt.label}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-colors duration-120
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-hover'}
            ${value === opt.value ? 'bg-accent-wash text-accent' : 'text-text-secondary'}
          `}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
