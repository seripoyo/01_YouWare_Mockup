
import { DeviceType, MockupMetadata } from '../features/mockup/gallery/types';

export const parseFilenameToMetadata = (filename: string, index: number): MockupMetadata => {
  const cleanName = filename.substring(0, filename.lastIndexOf('.')) || filename;
  const parts = cleanName.split('_');
  
  let deviceString = parts[0]?.toLowerCase() || 'other';
  let device: DeviceType = DeviceType.LAPTOP; 

  if (deviceString.includes('laptop') && deviceString.includes('sp')) {
    device = DeviceType.SET;
  } else if (deviceString.includes('laptop')) {
    device = DeviceType.LAPTOP;
  } else if (deviceString.includes('phone') || deviceString.includes('sp')) {
    device = DeviceType.SMARTPHONE;
  } else if (deviceString.includes('tablet')) {
    device = DeviceType.TABLET;
  }

  let aspectRatio = '1:1';
  const ratioPart = parts.find(p => p.includes('x'));
  if (ratioPart) aspectRatio = ratioPart.replace('x', ':');

  const knownParts = [deviceString, ratioPart, parts[2]];
  const colors = parts.filter(p => !knownParts.includes(p) && isNaN(Number(p))).map(c => c.charAt(0).toUpperCase() + c.slice(1));

  let width = 1080, height = 1080;
  switch (aspectRatio) {
    case '4:5': width = 1080; height = 1350; break;
    case '9:16': width = 1080; height = 1920; break;
    case '16:9': width = 1200; height = 675; break;
  }

  return {
    id: `mockup-${index}`,
    originalFilename: filename,
    url: `https://picsum.photos/${width}/${height}?random=${index}`,
    device,
    aspectRatio,
    colors,
    tags: [device, aspectRatio, ...colors]
  };
};

export const RAW_FILENAMES = [
  "laptop_1x1_001_white_minimal.webp",
  "smartphone_9x16_002_black_matte.png",
  "SpAndLaptop_16x9_003_wood_desk.jpg",
  "tablet_4x5_004_grey_studio.webp",
  "laptop_16x9_005_baige_coffee.webp",
  "phone_1x1_006_blue_pastel.png",
  "laptop_4x5_007_dark_neon.webp",
  "tablet_9x16_009_metal_sport.jpg",
  "smartphone_4x5_014_floating_glass.webp"
];
