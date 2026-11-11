/**
 * The app mark: public/logo.png used as a mask, so the colour is just a
 * background class (`bg-…`) and never needs a new image. Decorative.
 */
const BatLogo = ({ className = 'w-24 bg-white' }) => (
  <span
    aria-hidden="true"
    className={`${className} inline-block aspect-[207/64]`}
    style={{
      WebkitMaskImage: 'url(/logo.png)',
      maskImage: 'url(/logo.png)',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
    }}
  />
);

export default BatLogo;
