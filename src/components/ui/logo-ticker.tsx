'use client';

import Image from 'next/image';

interface Logo {
  src: string;
  alt: string;
  width?: string;
}

// Logo sizes - uniform width for visual symmetry
const logos: Logo[] = [
  { src: '/logos/Genesys-v3.png', alt: 'Mixmax', width: '100px' },
  { src: '/logos/Genesys-v3-1.png', alt: 'Ahrefs', width: '100px' },
  { src: '/logos/Genesys-v3-2.png', alt: 'Toast', width: '100px' },
  { src: '/logos/Genesys-v3-3.png', alt: 'Common Room', width: '100px' },
  { src: '/logos/Genesys-v3-4.png', alt: 'Ethena', width: '100px' },
  { src: '/logos/Genesys-v3-5.png', alt: 'Fullenrich', width: '100px' },
  { src: '/logos/Genesys-v3-6.png', alt: 'Clarice Heights', width: '100px' },
  { src: '/logos/Genesys-v3-7.png', alt: 'GTM Engineer School', width: '100px' },
  { src: '/logos/Genesys-v3-8.png', alt: 'Logo 9', width: '100px' },
  { src: '/logos/Genesys-v3-9.png', alt: 'Logo 10', width: '100px' },
];

export function LogoTicker() {
  return (
    <div className="w-full overflow-hidden py-4">
      <div className="logo-ticker-container">
        <div className="logo-ticker">
          {/* First set of logos */}
          {logos.map((logo, index) => (
            <div
              key={`logo-1-${index}`}
              className="flex-shrink-0 mx-6 opacity-70 hover:opacity-100 transition-all duration-300 flex items-center justify-center"
              style={{ width: logo.width || '80px', height: '28px' }}
            >
              <Image
                src={logo.src}
                alt={logo.alt}
                width={80}
                height={28}
                className="max-h-7 object-contain brightness-0 invert"
                style={{ maxWidth: logo.width || '80px' }}
              />
            </div>
          ))}
          {/* Duplicate set for seamless loop */}
          {logos.map((logo, index) => (
            <div
              key={`logo-2-${index}`}
              className="flex-shrink-0 mx-6 opacity-70 hover:opacity-100 transition-all duration-300 flex items-center justify-center"
              style={{ width: logo.width || '80px', height: '28px' }}
            >
              <Image
                src={logo.src}
                alt={logo.alt}
                width={80}
                height={28}
                className="max-h-7 object-contain brightness-0 invert"
                style={{ maxWidth: logo.width || '80px' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
