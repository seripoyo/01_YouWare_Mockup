import type { MockupGalleryItem } from "../gallery";
import { MockupGallery } from "../gallery";

interface MockupGalleryPanelProps {
  onSelectFrame: (item: MockupGalleryItem) => void;
  onClose: () => void;
}

export function MockupGalleryPanel({ onSelectFrame, onClose }: MockupGalleryPanelProps) {
  return <MockupGallery onSelectFrame={onSelectFrame} onClose={onClose} />;
}
