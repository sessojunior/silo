export interface ReportAvailabilityDto {
  productId: string | number;
  productName: string;
  slug: string;
  availability: number;
  totalTurns: number;
  completedTurns: number;
  period: { from: string; to: string };
}

export interface ReportProblemsDto {
  incidentId: string;
  incidentName: string;
  count: number;
  percentage: number;
}

export interface ReportProjectsDto {
  projectId: string;
  projectName: string;
  status: string;
  activitiesCount: number;
  tasksCount: number;
  completedTasksCount: number;
  progress: number;
}
