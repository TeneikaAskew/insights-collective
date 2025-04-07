
import { ReactNode } from "react";

export type Assistant = {
  id: string;
  name: string;
  icon: ReactNode | { component: any; props: any };
  description: string;
  category: "analytics" | "coding" | "content" | "career";
  popular?: boolean;
};
