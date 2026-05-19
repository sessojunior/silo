import picturesJson from "@/app/admin/monitoring/pictures.json";
import radarsJson from "@/app/admin/monitoring/radars.json";
import type { MonitoringProductsFile } from "@/components/admin/monitoring/product-monitoring-cards";
import type { PicturePage } from "./picture-pages-accordion";
import MonitoringOverviewSection from "./monitoring-overview-section";
import MonitoringRadarPanel from "./monitoring-radar-panel";
import MonitoringRecentFiguresSection from "./monitoring-recent-figures-section";
import {
  buildRadarGroups,
  mergePicturePagesWithFallback,
  type DbRadar,
  type DbRadarGroup,
  type RadarFile,
} from "./monitoring-page-shared";

export type { DbRadarGroup, DbRadar } from "./monitoring-page-shared";

const FALLBACK_PICTURE_PAGES = (picturesJson as { pages: PicturePage[] }).pages;
const FALLBACK_RADAR_GROUPS = (radarsJson as RadarFile).groups;

type MonitoringPageClientProps = {
  productsData: MonitoringProductsFile;
  picturePages?: PicturePage[];
  radarGroups?: DbRadarGroup[];
  radars?: DbRadar[];
};

export default function MonitoringPageClient({
  productsData,
  picturePages,
  radarGroups,
  radars,
}: MonitoringPageClientProps) {
  const mergedPicturePages = mergePicturePagesWithFallback(
    picturePages ?? [],
    FALLBACK_PICTURE_PAGES,
  );
  const finalRadarGroups = buildRadarGroups(
    radarGroups,
    radars,
    FALLBACK_RADAR_GROUPS,
  );

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden lg:flex-row">
        <div className="scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-[linear-gradient(180deg,#fafafa_0%,#f4f6f9_100%)] dark:bg-[linear-gradient(180deg,#111214_0%,#0f1115_100%)]">
          <div>
            <MonitoringOverviewSection
              productsData={productsData}
              picturePages={mergedPicturePages}
            />
            <MonitoringRecentFiguresSection picturePages={mergedPicturePages} />
          </div>
        </div>

        <MonitoringRadarPanel radarGroups={finalRadarGroups} />
      </div>
    </div>
  );
}
