export interface DashboardSummaryDto {
  totalProducts: number;
  activeProducts: number;
  totalIncidents: number;
  totalActivities: number;
  recentActivities: Array<{
    productId: string | number;
    productName: string;
    status: string;
    turn: number | string;
    date: string;
  }>;
}
