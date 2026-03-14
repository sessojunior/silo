export interface SeedRadar {
  id: string;
  name: string;
  description: string;
  logDate?: string;
  logUrl?: string;
  delay: string;
  delayMinutes: number | null;
  status: string;
}

export interface SeedRadarGroup {
  id: string;
  name: string;
  radars: SeedRadar[];
}

export interface SeedPictureLink {
  id: string;
  slug?: string;
  name: string;
  url: string;
  size: string;
  lastUpdate: string;
  delay: string;
  delayMinutes: number | null;
  status: string;
  type?: string;
}

export interface SeedPicturePage {
  id: string;
  name: string;
  url: string;
  description: string;
  checkMode: string;
  status: string;
  delay: string;
  delayMinutes: number | null;
  delayedLinks: number;
  offlineLinks: number;
  onlineLinks?: number;
  links: SeedPictureLink[];
}

export interface SeedMonitoringProduct {
  productId: string;
  model: string;
  description: string;
  turns: {
    turn: string;
    status: string;
    progress: number;
  }[];
}
