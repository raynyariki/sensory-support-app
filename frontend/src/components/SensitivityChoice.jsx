import { SENSITIVITY_LEVELS } from "../data/soundCategories";

function SensitivityChoice({ name, label, value, onChange }) {
  return (
    <fieldset className="choice">
      <legend className="choice__label">{label}</legend>
      <div className="choice__options">
        {SENSITIVITY_LEVELS.map((level) => {
          const optionId = `${name}-${level.value}`;
          return (
            <div className="choice__option" key={level.value}>
              <input
                type="radio"
                id={optionId}
                name={name}
                value={level.value}
                checked={value === level.value}
                onChange={() => onChange(name, level.value)}
              />
              <label htmlFor={optionId}>{level.label}</label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export default SensitivityChoice;