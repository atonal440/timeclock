import { isForked } from '../utils/preview';

interface PreviewBannerProps {
  pr: number;
  onReset: () => void;
}

export function PreviewBanner({ pr, onReset }: PreviewBannerProps) {
  const forked = isForked();
  return (
    <div className="preview-banner">
      <span>
        <b>PR #{pr} preview</b>
        {forked ? ' · editing a copy of your data' : ' · reading your live data'}
      </span>
      {forked && <button className="preview-reset" onClick={onReset}>Reset</button>}
    </div>
  );
}
