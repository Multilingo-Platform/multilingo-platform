import React from 'react';
import type { ExamOption, SharedMedia } from '../../types/exam.types';

interface Props {
  options: ExamOption[];
  value: string | null;
  onChange: (v: string) => void;
  media?: SharedMedia | null;
}

const MapLabelingRenderer: React.FC<Props> = ({ options, value, onChange, media }) => (
  <div>
    {media && <img src={media.url} alt="Map" style={{ maxWidth: '100%', marginBottom: '8px' }} />}
    <div role="radiogroup">
      {options.map(opt => (
        <label key={opt.id} style={{ display: 'block', margin: '4px 0', cursor: 'pointer' }}>
          <input
            type="radio"
            name="map-label"
            value={opt.id}
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
          />
          {' '}{opt.text}
        </label>
      ))}
    </div>
  </div>
);

export default MapLabelingRenderer;
