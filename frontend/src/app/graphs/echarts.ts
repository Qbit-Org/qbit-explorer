// Import tree-shakeable echarts
import * as echarts from 'echarts/core';
import { LineChart, LinesChart, BarChart, TreemapChart, PieChart, ScatterChart, GaugeChart, CustomChart, TreeChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent, GeoComponent, DataZoomComponent, VisualMapComponent, MarkLineComponent, GraphicComponent } from 'echarts/components';
import { SVGRenderer, CanvasRenderer } from 'echarts/renderers';
// echarts 6 replaced grid.containLabel; this keeps it working for the block spacing chart.
import { LegacyGridContainLabel } from 'echarts/features';
// Typescript interfaces
import type { EChartsCoreOption } from 'echarts/core';
import type { TreemapSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts';


echarts.use([
  SVGRenderer, CanvasRenderer,
  TitleComponent, TooltipComponent, GridComponent,
  LegendComponent, GeoComponent, DataZoomComponent,
  VisualMapComponent, MarkLineComponent,
  LineChart, LinesChart, BarChart, TreemapChart, PieChart, ScatterChart, GaugeChart,
  CustomChart, GraphicComponent, TreeChart, LegacyGridContainLabel
]);
export { echarts, EChartsCoreOption as EChartsOption, TreemapSeriesOption, LineSeriesOption, PieSeriesOption };
