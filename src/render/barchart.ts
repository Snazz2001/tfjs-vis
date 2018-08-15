/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import embed, {Mode, Result as EmbedRes, VisualizationSpec} from 'vega-embed';
import {Drawable, VisOptions} from '../types';
import {getDrawArea, shallowEquals} from './render_utils';

const defaultOpts = {
  xLabel: '',
  yLabel: '',
  xType: 'ordinal',
  yType: 'quantitative',
};

interface InstanceInfo {
  // Note the type of 'view' is not exported by vega-embed. We could import it
  // from vega but that would add a direct dependency to vega.

  // tslint:disable-next-line:no-any
  view: any;
  lastOptions: VisOptions;
}

interface Datum {
  index: number;
  value: number;
}

// We keep a map of containers to chart instances in order to reuse the instance
// where possible.
const instances: Map<HTMLElement, InstanceInfo> =
    new Map<HTMLElement, InstanceInfo>();

/**
 * Renders a barchart.
 *
 * @param data — Data in the following format, (an array of objects)
 *              [ {index: number, value: number} ... ]
 * @param container — An HTMLElement in which to draw the histogram. Note that
 *                    this chart expects to have complete control over the
 *                    contents of the container and can clear its contents
 *                    at will.
 * @param opts - optional parameters
 * @param opts.width — width of chart in px
 * @param opts.height — height of chart in px
 * @param opts.xLabel — label for x-axis, set to null to hide the
 * @param opts.yLabel — label for y-axis, set to null to hide the
 *
 * @returns Promise - indicates completion of rendering
 */
export function renderBarchart(
    data: Datum[], container: Drawable, opts: VisOptions = {}): Promise<void> {
  const drawArea = getDrawArea(container);
  const values = data;
  const options = Object.assign({}, defaultOpts, opts);

  // If we have rendered this chart before with the same options we can do a
  // data only update, else  we do a regular re-render.
  if (instances.has(drawArea)) {
    const instanceInfo = instances.get(drawArea)!;
    if (shallowEquals(options, instanceInfo.lastOptions)) {
      return new Promise((resolve, reject) => {
        new Promise(r => requestAnimationFrame(r))
            .then(() => {
              const view = instanceInfo.view;
              const changes =
                  view.changeset().remove(() => true).insert(values);
              return view.change('values', changes).runAsync();
            })
            .then(() => resolve())
            .catch((e) => reject(e));
      });
    }
  }

  const {xLabel, yLabel, xType, yType} = options;

  let xAxis: {}|null = null;
  if (xLabel != null) {
    xAxis = {title: xLabel};
  }

  let yAxis: {}|null = null;
  if (yLabel != null) {
    yAxis = {title: yLabel};
  }

  const embedOpts = {
    actions: false,
    mode: 'vega-lite' as Mode,
  };

  const spec: VisualizationSpec = {
    'width': options.width || drawArea.clientWidth,
    'height': options.height || drawArea.clientHeight,
    'padding': 5,
    'autosize': {
      'type': 'fit',
      'contains': 'padding',
      'resize': true,
    },
    'data': {'values': values, 'name': 'values'},
    'mark': 'bar',
    'encoding': {
      'x': {'field': 'index', 'type': xType, 'axis': xAxis},
      'y': {'field': 'value', 'type': yType, 'axis': yAxis}
    }
  };

  return new Promise((resolve, reject) => {
    new Promise(r => requestAnimationFrame(r))
        .then(() => embed(drawArea, spec, embedOpts))
        .then((res: EmbedRes) => {
          instances.set(drawArea, {
            view: res.view,
            lastOptions: options,
          });
          resolve();
        })
        .catch((e) => reject(e));
  });
}