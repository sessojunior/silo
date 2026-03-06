declare module "frappe-gantt" {
  export interface FrappeGanttTask {
    id: string;
    name: string;
    start: string | Date;
    end: string | Date;
    progress?: number;
    dependencies?: string[] | string;
    custom_class?: string;
    [key: string]: unknown;
  }

  export interface FrappeGanttOptions {
    view_mode?: string;
    view_modes?: Array<Record<string, unknown>>;
    language?: string;
    readonly?: boolean;
    readonly_dates?: boolean;
    readonly_progress?: boolean;
    move_dependencies?: boolean;
    container_height?: number | "auto";
    popup?: false | ((ctx: unknown) => unknown);
    on_click?: (task: { id: string }) => void;
    [key: string]: unknown;
  }

  export default class Gantt {
    constructor(
      wrapper: string | HTMLElement | SVGElement,
      tasks: FrappeGanttTask[],
      options?: FrappeGanttOptions,
    );

    clear(): void;
  }
}
