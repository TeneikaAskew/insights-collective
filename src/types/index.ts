// If Course type already exists, add the imageUrl property
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  students?: number;
  rating?: number;
  published?: boolean;
  imageUrl?: string;
  // ... other fields
}
